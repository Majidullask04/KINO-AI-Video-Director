import { TimelineProjectState, TimelineClip, TimelineTrack } from "@/types";

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "track-0", index: 0, kind: "overlay", name: "T0 Overlays & Text", locked: false, muted: false, hidden: false },
  { id: "track-1", index: 1, kind: "video", name: "T1 Main Video", locked: false, muted: false, hidden: false },
  { id: "track-2", index: 2, kind: "video", name: "T2 B-Roll & PiP", locked: false, muted: false, hidden: false },
  { id: "track-3", index: 3, kind: "audio", name: "T3 Master Audio", locked: false, muted: false, hidden: false },
];

export function serializeTimelineToHtml(
  state: TimelineProjectState,
  title: string = "KINO Production"
): string {
  const { width, height, duration, fps, clips, background } = state;

  // Background style
  let bgCss = "background: #000;";
  if (background?.type === "color") {
    bgCss = `background: ${background.value || "#000"};`;
  } else if (background?.type === "gradient") {
    bgCss = `background: ${background.value || "linear-gradient(135deg, #18181b, #09090b)"};`;
  }

  // Generate HTML for each clip
  const clipElements = clips.map((clip, idx) => {
    const start = clip.start.toFixed(2);
    const dur = clip.duration.toFixed(2);
    const trackIdx = clip.trackIndex ?? 1;
    const trackKind = clip.type === "audio" ? "audio" : "video";
    const elemId = clip.id || `clip-${idx + 1}`;

    const { x = 0, y = 0, width: w = 100, height: h = 100, scale = 1, rotation = 0, opacity = 1 } = clip.transform || {};

    // Transform style
    const transformCss = `transform: translate(${x}%, ${y}%) scale(${scale}) rotate(${rotation}deg); opacity: ${opacity};`;

    // Filter style
    let filterCss = "";
    if (clip.filter === "blur") filterCss = "filter: blur(4px);";
    else if (clip.filter === "glow") filterCss = "filter: drop-shadow(0 0 15px rgba(52, 211, 153, 0.6));";
    else if (clip.filter === "bw") filterCss = "filter: grayscale(100%);";
    else if (clip.filter === "vintage") filterCss = "filter: sepia(60%) contrast(110%);";
    else if (clip.filter === "contrast") filterCss = "filter: contrast(140%) saturate(120%);";
    else if (clip.filter === "vignette") filterCss = "box-shadow: inset 0 0 100px rgba(0,0,0,0.8);";

    // Text / Sticker / Video / Audio rendering
    if (clip.type === "text") {
      const style = clip.style || {};
      const fontSize = Math.max(28, style.fontSize || 48);
      const color = style.color || "#FFFFFF";
      const font = style.fontFamily || "Inter, sans-serif";
      const bg = style.backgroundColor ? `background: ${style.backgroundColor};` : "";
      const textShadow = style.shadow ? `text-shadow: ${style.shadow};` : "text-shadow: 0 2px 10px rgba(0,0,0,0.7);";
      const outline = style.outlineWidth ? `-webkit-text-stroke: ${style.outlineWidth}px ${style.outlineColor || "#000"};` : "";

      return `    <!-- Text Clip: ${clip.name} -->
    <div id="${elemId}" class="clip" data-start="${start}" data-duration="${dur}" data-track-index="${trackIdx}" data-track-kind="${trackKind}"
         style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: ${10 + idx}; ${transformCss}">
      <span style="font-family: ${font}; font-size: ${fontSize}px; font-weight: ${style.fontWeight || 700}; color: ${color}; ${bg} ${textShadow} ${outline} padding: 8px 16px; border-radius: 8px; text-align: ${style.textAlign || "center"}; letter-spacing: ${style.letterSpacing || 0}px;">
        ${escapeHtml(clip.text || clip.name)}
      </span>
    </div>`;
    }

    if (clip.type === "shape" || clip.type === "sticker") {
      const isCircle = clip.name.toLowerCase().includes("circle");
      const isBar = clip.name.toLowerCase().includes("bar");
      const shapeStyle = isCircle ? "border-radius: 50%;" : isBar ? "height: 60px; width: 100%;" : "border-radius: 12px;";

      return `    <!-- Shape/Sticker: ${clip.name} -->
    <div id="${elemId}" class="clip" data-start="${start}" data-duration="${dur}" data-track-index="${trackIdx}" data-track-kind="${trackKind}"
         style="position: absolute; left: 50%; top: 50%; width: ${w}px; height: ${h}px; margin-left: -${w / 2}px; margin-top: -${h / 2}px; background: rgba(52, 211, 153, 0.2); border: 2px solid #34D399; ${shapeStyle} ${transformCss} z-index: ${5 + idx};">
    </div>`;
    }

    if (clip.type === "audio") {
      const vol = ((clip.audio?.volume ?? 100) / 100).toFixed(2);
      return `    <!-- Master Audio Track -->
    <audio id="${elemId}" class="clip" src="${clip.sourceUrl || `assets/${clip.sourceAsset || "audio_bed.mp3"}`}" data-start="${start}" data-duration="${dur}" data-track-index="${trackIdx}" data-track-kind="audio" preload="auto" data-volume="${vol}"></audio>`;
    }

    if (clip.type === "image") {
      return `    <!-- Image Clip: ${clip.name} -->
    <img id="${elemId}" class="clip" src="${clip.sourceUrl || `assets/${clip.sourceAsset || "image.png"}`}" data-start="${start}" data-duration="${dur}" data-track-index="${trackIdx}" data-track-kind="video"
         style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; ${transformCss} ${filterCss} z-index: ${1 + idx};" />`;
    }

    // Default Video Clip
    const hasAudio = clip.audio && !clip.audio.muted && (clip.audio.volume ?? 100) > 0;
    const mutedAttr = hasAudio ? "" : "muted";
    const src = clip.sourceUrl || `assets/${clip.sourceAsset || "video.mp4"}`;

    return `    <!-- Video Clip: ${clip.name} -->
    <video id="${elemId}" class="clip" src="${src}" data-start="${start}" data-duration="${dur}" data-track-index="${trackIdx}" data-track-kind="video" data-has-audio="${hasAudio ? "true" : "false"}" ${mutedAttr} preload="auto" playsinline
           style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; ${transformCss} ${filterCss} z-index: ${1 + idx};"></video>`;
  }).join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - KINO Composition</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #root {
      width: ${width}px;
      height: ${height}px;
      position: relative;
      overflow: hidden;
      ${bgCss}
    }
  </style>
</head>
<body>
  <div id="root">
${clipElements}
  </div>

  <script>
    // Paused Master GSAP Timeline for Deterministic HyperFrames Seeking
    window.__timelines = window.__timelines || {};
    const mainTimeline = gsap.timeline({ paused: true });
    window.__timelines["main"] = mainTimeline;

    // Listen for postMessage playhead sync from Studio Stage
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "SEEK") {
        const time = e.data.time || 0;
        mainTimeline.seek(time);
        document.querySelectorAll("video.clip").forEach((vid) => {
          const start = parseFloat(vid.getAttribute("data-start") || "0");
          const dur = parseFloat(vid.getAttribute("data-duration") || "0");
          if (time >= start && time <= start + dur) {
            vid.currentTime = Math.max(0, time - start);
          }
        });
      }
    });

    mainTimeline.seek(0);
  </script>
</body>
</html>`;
}

export function parseHtmlToTimeline(
  html: string,
  projectId: string,
  fallbackDuration: number = 12.0
): TimelineProjectState {
  const rootMatch = html.match(/id=["']root["'][^>]*style=["']([^"']*)["']/i);
  let width = 1920;
  let height = 1080;
  if (rootMatch) {
    const wMatch = rootMatch[1].match(/width:\s*(\d+)px/);
    const hMatch = rootMatch[1].match(/height:\s*(\d+)px/);
    if (wMatch) width = parseInt(wMatch[1], 10);
    if (hMatch) height = parseInt(hMatch[1], 10);
  }

  const clips: TimelineClip[] = [];
  const tagRegex = /<([a-zA-Z0-9]+)\s+([^>]*class=["'][^"']*\bclip\b[^"']*["'][^>]*)>/gi;
  let match: RegExpExecArray | null;
  let maxTime = fallbackDuration;
  let order = 1;

  while ((match = tagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = match[2];

    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const clipId = idMatch ? idMatch[1] : `clip-${order}`;

    const startMatch = attrs.match(/data-start=["']([^"']+)["']/i);
    const durMatch = attrs.match(/data-duration=["']([^"']+)["']/i);
    const trackMatch = attrs.match(/data-track-index=["']([^"']+)["']/i);
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);

    const start = startMatch ? parseFloat(startMatch[1]) : 0;
    const duration = durMatch ? parseFloat(durMatch[1]) : 3.0;
    const trackIndex = trackMatch ? parseInt(trackMatch[1], 10) : (tagName === "audio" ? 3 : 1);
    const sourceUrl = srcMatch ? srcMatch[1] : undefined;

    if (start + duration > maxTime) {
      maxTime = start + duration;
    }

    let clipType: TimelineClip["type"] = "video";
    if (tagName === "audio") clipType = "audio";
    else if (tagName === "img") clipType = "image";
    else if (tagName === "div") clipType = "text";

    // Extract text content if div
    let text = "";
    if (clipType === "text") {
      const closeTag = `</div>`;
      const fullText = html.substring(match.index, html.indexOf(closeTag, match.index) + closeTag.length);
      const spanMatch = fullText.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
      text = spanMatch ? spanMatch[1].trim() : clipId;
    }

    clips.push({
      id: clipId,
      name: text || clipId,
      type: clipType,
      start,
      duration,
      trackIndex,
      sourceUrl,
      text: text || undefined,
      transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
      order: order++
    });
  }

  const aspectRatio = width >= height ? "16:9" : "9:16";

  return {
    projectId,
    duration: Math.max(3.0, maxTime),
    fps: 30,
    width,
    height,
    aspectRatio,
    background: { type: "color", value: "#000000" },
    tracks: DEFAULT_TRACKS,
    clips
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

