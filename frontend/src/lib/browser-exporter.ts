"use client";

import { TimelineProjectState, TimelineClip } from "@/types";

export interface ExportProgress {
  progressPercent: number;
  currentFrame: number;
  totalFrames: number;
  statusText: string;
}

export interface ExportOptions {
  resolution?: "1080p" | "720p";
  fps?: number;
  format?: "mp4" | "webm";
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Renders a TimelineProjectState directly in the client browser
 * using HTML5 Canvas + MediaRecorder API, with 0 server or API cost.
 */
export async function renderTimelineInBrowser(
  timeline: TimelineProjectState,
  options: ExportOptions = {}
): Promise<{ blob: Blob; url: string; filename: string }> {
  if (typeof window === "undefined") {
    throw new Error("Browser export only runs in a browser context");
  }

  const fps = options.fps || timeline.fps || 30;
  const is1080p = options.resolution !== "720p";
  const targetWidth = is1080p ? (timeline.width || 1920) : Math.round((timeline.width || 1920) * 0.666);
  const targetHeight = is1080p ? (timeline.height || 1080) : Math.round((timeline.height || 1080) * 0.666);
  const duration = Math.max(1, timeline.duration || 12.0);
  const totalFrames = Math.ceil(duration * fps);

  // Setup offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context for rendering");
  }

  // Preload video and image elements for smooth seeking
  const mediaElements = await preloadMediaElements(timeline.clips);

  // Determine supported mime type (prefer MP4 where supported, else WebM)
  let mimeType = "video/webm;codecs=vp9,opus";
  let extension = "webm";

  if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1,mp4a.40.2")) {
    mimeType = "video/mp4;codecs=avc1,mp4a.40.2";
    extension = "mp4";
  } else if (MediaRecorder.isTypeSupported("video/mp4")) {
    mimeType = "video/mp4";
    extension = "mp4";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
    mimeType = "video/webm;codecs=vp8,opus";
  }

  // Capture canvas stream and mix in active audio tracks via Web Audio
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
  const audioDest = audioCtx ? audioCtx.createMediaStreamDestination() : null;

  const canvasStream = canvas.captureStream(fps);
  const mixedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => mixedStream.addTrack(t));
  if (audioDest) audioDest.stream.getAudioTracks().forEach((t) => mixedStream.addTrack(t));

  const recorder = new MediaRecorder(mixedStream, {
    mimeType,
    videoBitsPerSecond: is1080p ? 8_000_000 : 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.start(100);

  // Render loop across timeline frames
  const frameIntervalMs = 1000 / fps;
  const audioClips = (timeline.clips || []).filter((c) => c.type === "audio" && c.sourceUrl);
  const audioSources = new Map<string, { el: HTMLAudioElement; src?: MediaElementAudioSourceNode }>();
  if (audioCtx && audioDest) {
    for (const clip of audioClips) {
      try {
        const el = new Audio();
        el.src = clip.sourceUrl as string;
        const source = audioCtx.createMediaElementSource(el);
        source.connect(audioDest);
        el.playbackRate = clip.audio?.speed || 1;
        el.volume = (clip.audio?.volume ?? 100) / 100;
        if (clip.audio?.muted) el.muted = true;
        el.currentTime = clip.start;
        void el.play().catch(() => {});
        audioSources.set(clip.id, { el, src: source });
      } catch (err) {
        console.warn("Could not attach audio source node:", err);
      }
    }
  }

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / fps;

    // Draw background
    drawBackground(ctx, targetWidth, targetHeight, timeline.background);

    // Draw active clips sorted by track/order
    const activeClips = timeline.clips.filter(
      (c) => currentTime >= c.start && currentTime <= c.start + c.duration
    );

    // Draw video/image clips first (lower tracks)
    for (const clip of activeClips) {
      if (clip.type === "video" || clip.type === "image") {
        drawMediaClip(ctx, clip, currentTime, targetWidth, targetHeight, mediaElements);
      } else if (clip.type === "shape" || clip.type === "sticker") {
        drawShapeClip(ctx, clip, targetWidth, targetHeight);
      }
    }

    // Draw text and overlay clips on top
    for (const clip of activeClips) {
      if (clip.type === "text") {
        drawTextClip(ctx, clip, currentTime, targetWidth, targetHeight);
      }
    }

    // Drive active audio elements in sync with the playhead
    for (const clip of audioClips) {
      const entry = audioSources.get(clip.id);
      if (!entry) continue;
      const el = entry.el;
      if (currentTime >= clip.start && currentTime <= clip.start + clip.duration) {
        const local = currentTime - clip.start;
        if (Math.abs(el.currentTime - local) > 0.2) el.currentTime = local;
        if (el.paused) void el.play();
      } else {
        if (!el.paused) el.pause();
      }
    }

    // Report progress
    const progressPercent = Math.min(100, Math.round(((frame + 1) / totalFrames) * 100));
    if (options.onProgress) {
      options.onProgress({
        progressPercent,
        currentFrame: frame + 1,
        totalFrames,
        statusText: `Encoding frame ${frame + 1} of ${totalFrames} (${progressPercent}%)`,
      });
    }

    // Yield to the event loop so MediaRecorder processes stream chunks
    await new Promise((r) => setTimeout(r, Math.max(4, Math.floor(frameIntervalMs * 0.4))));
  }

  // Finalize recording
  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(finalBlob);
      const safeTitle = (timeline.projectId || "kino_export").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const filename = `${safeTitle}.${extension}`;

      if (options.onProgress) {
        options.onProgress({
          progressPercent: 100,
          currentFrame: totalFrames,
          totalFrames,
          statusText: "Export Complete!",
        });
      }

      // Cleanup preloaded media & audio elements
      cleanupMediaElements(mediaElements);
      for (const entry of audioSources.values()) {
        entry.el.pause();
        entry.src?.disconnect();
      }
      audioSources.clear();
      if (audioCtx) void audioCtx.close();

      resolve({ blob: finalBlob, url, filename });
    };

    recorder.onerror = (e) => reject(e);
    recorder.stop();
  });
}

/**
 * Triggers a native browser file download for a generated Blob URL
 */
export function triggerFileDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────────────────
// Canvas Drawing Primitives
// ─────────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: TimelineProjectState["background"]
): void {
  if (bg?.type === "gradient" && bg.value) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#18181b");
    grad.addColorStop(1, "#09090b");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg?.value || "#0F0F0E";
  }
  ctx.fillRect(0, 0, w, h);
}

function drawTextClip(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  currentTime: number,
  canvasW: number,
  canvasH: number
): void {
  const { text = clip.name, style = {}, transform = { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 } } = clip;
  const fontSize = style.fontSize || 48;
  const color = style.color || "#FFFFFF";
  const fontFamily = style.fontFamily || "Inter, sans-serif";
  const fontWeight = style.fontWeight || 700;

  // Entrance animation progress
  const timeIntoClip = currentTime - clip.start;
  let opacity = transform.opacity ?? 1;
  let scale = transform.scale ?? 1;

  if (clip.animation?.in === "fade" && timeIntoClip < 0.5) {
    opacity *= timeIntoClip / 0.5;
  } else if (clip.animation?.in === "pop" && timeIntoClip < 0.4) {
    scale *= 0.6 + (timeIntoClip / 0.4) * 0.4;
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // Position
  const centerX = (canvasW / 2) + ((transform.x / 100) * canvasW);
  const centerY = (canvasH / 2) + ((transform.y / 100) * canvasH);

  ctx.translate(centerX, centerY);
  ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);
  ctx.scale(scale, scale);

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = style.textAlign || "center";
  ctx.textBaseline = "middle";

  // Background pill if configured
  if (style.backgroundColor) {
    const metrics = ctx.measureText(text);
    const pad = 16;
    const pillW = metrics.width + pad * 2;
    const pillH = fontSize * 1.5;
    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 8);
    ctx.fill();
  }

  // Shadow
  if (style.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
  }

  // Fill text
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);

  // Stroke outline if configured
  if (style.outlineWidth) {
    ctx.lineWidth = style.outlineWidth;
    ctx.strokeStyle = style.outlineColor || "#000000";
    ctx.strokeText(text, 0, 0);
  }

  ctx.restore();
}

function drawMediaClip(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  currentTime: number,
  canvasW: number,
  canvasH: number,
  mediaMap: Map<string, HTMLVideoElement | HTMLImageElement>
): void {
  const el = mediaMap.get(clip.id);
  if (!el) return;

  const { transform = { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 } } = clip;

  ctx.save();
  ctx.globalAlpha = transform.opacity ?? 1;

  if (clip.filter === "blur") ctx.filter = "blur(4px)";
  else if (clip.filter === "bw") ctx.filter = "grayscale(100%)";
  else if (clip.filter === "vintage") ctx.filter = "sepia(50%) contrast(110%)";
  else if (clip.filter === "cinematic") ctx.filter = "contrast(115%) saturate(110%) brightness(102%)";
  else if (clip.filter === "warm") ctx.filter = "sepia(28%) saturate(135%) contrast(105%) brightness(98%)";

  const centerX = (canvasW / 2) + ((transform.x / 100) * canvasW);
  const centerY = (canvasH / 2) + ((transform.y / 100) * canvasH);

  ctx.translate(centerX, centerY);
  ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);
  ctx.scale(transform.scale || 1, transform.scale || 1);

  const drawW = canvasW * ((transform.width || 100) / 100);
  const drawH = canvasH * ((transform.height || 100) / 100);

  if (el instanceof HTMLVideoElement) {
    const clipOffset = (currentTime - clip.start) + (clip.trimStart || 0);
    el.currentTime = Math.max(0, clipOffset);
    ctx.drawImage(el, -drawW / 2, -drawH / 2, drawW, drawH);
  } else if (el instanceof HTMLImageElement) {
    ctx.drawImage(el, -drawW / 2, -drawH / 2, drawW, drawH);
  }

  ctx.restore();
}

function drawShapeClip(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  canvasW: number,
  canvasH: number
): void {
  const { transform = { x: 0, y: 0, width: 200, height: 100, scale: 1, rotation: 0, opacity: 1 } } = clip;
  const isCircle = clip.name.toLowerCase().includes("circle");

  ctx.save();
  ctx.globalAlpha = transform.opacity ?? 1;

  const centerX = (canvasW / 2) + ((transform.x / 100) * canvasW);
  const centerY = (canvasH / 2) + ((transform.y / 100) * canvasH);

  ctx.translate(centerX, centerY);
  ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);

  const w = transform.width || 200;
  const h = transform.height || 100;

  ctx.fillStyle = "rgba(52, 211, 153, 0.25)";
  ctx.strokeStyle = "#34D399";
  ctx.lineWidth = 3;

  ctx.beginPath();
  if (isCircle) {
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(-w / 2, -h / 2, w, h, 12);
  }
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

async function preloadMediaElements(
  clips: TimelineClip[]
): Promise<Map<string, HTMLVideoElement | HTMLImageElement>> {
  const map = new Map<string, HTMLVideoElement | HTMLImageElement>();

  for (const clip of clips) {
    if (!clip.sourceUrl) continue;

    if (clip.type === "video") {
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.src = clip.sourceUrl;
      vid.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        vid.onloadedmetadata = () => resolve();
        vid.onerror = () => resolve();
        setTimeout(resolve, 800);
      });
      map.set(clip.id, vid);
    } else if (clip.type === "image") {
      const img = new Image();
      img.src = clip.sourceUrl;
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 800);
      });
      map.set(clip.id, img);
    }
  }

  return map;
}

function cleanupMediaElements(map: Map<string, HTMLVideoElement | HTMLImageElement>): void {
  for (const el of map.values()) {
    if (el instanceof HTMLVideoElement) {
      el.pause();
      el.src = "";
      el.load();
    }
  }
  map.clear();
}

