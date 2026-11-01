"use client";

import { TimelineProjectState, TimelineTrack, TimelineClip, LocalAssetRecord } from "@/types";

/**
 * Bulletproof Client-Side Media Engine (IndexedDB + Offscreen Telemetry)
 *
 * - Persists raw uploaded Blobs into the `kino_media_blobs` IndexedDB store.
 * - Hydrates fresh object URLs after reloads so uploaded media never breaks.
 * - Extracts duration / dimensions / fps / thumbnail frame / waveform peaks.
 * - Seeds a playable procedural starter composition for first-time visitors.
 */

const DB_NAME = "kino_media_blobs";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

// ─────────────────────────────────────────────────────────────
// IndexedDB Helpers (kino_media_blobs)
// ─────────────────────────────────────────────────────────────

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putMediaBlob(assetId: string, blob: Blob): Promise<void> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: assetId, blob, size: blob.size, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMediaBlob(assetId: string): Promise<Blob | null> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(assetId);
    req.onsuccess = () => resolve((req.result?.blob as Blob) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMediaBlob(assetId: string): Promise<void> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(assetId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Iterates every stored media blob and regenerates fresh object URLs so
 * uploaded media NEVER breaks after a page reload.
 */
export async function regenerateMediaObjectUrls(): Promise<Record<string, string>> {
  const db = await openMediaDb();
  const keys: string[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) || []);
    req.onerror = () => reject(req.error);
  });

  const urls: Record<string, string> = {};
  for (const key of keys) {
    const rec = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const blob = rec?.blob as Blob | undefined;
    if (blob) urls[key] = URL.createObjectURL(blob);
  }
  return urls;
}

// ─────────────────────────────────────────────────────────────
// Media Telemetry (Offscreen Video / Audio / Image analysis)
// ─────────────────────────────────────────────────────────────

export interface MediaTelemetry {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  thumbnailUrl?: string;
  filmstrip?: string[];
  waveform: number[];
}

const BAR_COUNT = 100;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  const AC = Ctx as typeof AudioContext;
  if (!AC) return null;
  const ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export async function extractAudioWaveform(file: File | Blob, bars: number = BAR_COUNT): Promise<number[]> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return [];
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / bars));
    const peaks: number[] = [];
    for (let i = 0; i < bars; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(channelData[start + j]);
      const avg = sum / blockSize;
      peaks.push(Math.min(1, Math.round(avg * 3.5 * 100) / 100));
    }
    void ctx.close();
    return peaks;
  } catch {
    return [];
  }
}

export async function extractMediaTelemetry(
  file: File | Blob,
  blobUrl: string,
  name: string
): Promise<MediaTelemetry> {
  const isVideo = (file as File).type?.startsWith("video") || /\.(mp4|mov|webm|m4v)$/i.test(name);
  const isAudio = (file as File).type?.startsWith("audio") || /\.(mp3|wav|ogg|aac|m4a)$/i.test(name);
  const isImage = (file as File).type?.startsWith("image") || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(name);

  const fallback: MediaTelemetry = { duration: 4, hasAudio: false, hasVideo: false, waveform: [] };

  if (isVideo) {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = blobUrl;
    const timeout = new Promise<MediaTelemetry>((resolve) => setTimeout(() => resolve(fallback), 3500));
    const loaded = new Promise<MediaTelemetry>((resolve) => {
      video.onloadedmetadata = () => {
        const dur = Math.max(0.5, Math.round(video.duration * 10) / 10);
        const w = video.videoWidth || 1920;
        const h = video.videoHeight || 1080;
        video.currentTime = Math.min(0.5, dur / 2);
        video.onseeked = async () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, 320, 180);
              const thumb = canvas.toDataURL("image/jpeg", 0.7);
              const waveform = await extractAudioWaveform(file);
              const quality = video.getVideoPlaybackQuality?.() as { frameRate?: number } | undefined;
              resolve({ duration: dur, width: w, height: h, fps: quality?.frameRate, hasAudio: true, hasVideo: true, thumbnailUrl: thumb, waveform });
              return;
            }
          } catch {}
          resolve({ duration: dur, width: w, height: h, hasAudio: true, hasVideo: true, waveform: [] });
        };
      };
      video.onerror = () => resolve(fallback);
    });
    const result = await Promise.race([loaded, timeout]);
    const waveform = result.waveform.length > 0 ? result.waveform : await extractAudioWaveform(file);
    return { ...result, waveform };
  }

  if (isImage) {
    const img = new Image();
    img.src = blobUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    let thumbnailUrl = blobUrl;
    if (ctx) {
      ctx.drawImage(img, 0, 0, 320, 180);
      thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7);
    }
    return { duration: 5, width: img.naturalWidth || 1920, height: img.naturalHeight || 1080, hasAudio: false, hasVideo: false, thumbnailUrl, waveform: [] };
  }

  if (isAudio) {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = blobUrl;
    const duration = await new Promise<number>((resolve) => {
      audio.onloadedmetadata = () => resolve(Math.max(1, audio.duration || 1));
      audio.onerror = () => resolve(4);
      setTimeout(() => resolve(4), 3000);
    });
    const waveform = await extractAudioWaveform(file);
    return { duration, hasAudio: true, hasVideo: false, waveform };
  }

  return fallback;
}

/**
 * Ingests a user-dropped / pasted / uploaded file:
 * stores the raw blob in IndexedDB, mints an object URL and extracts telemetry.
 */
export async function ingestLocalMediaFile(file: File): Promise<{
  assetId: string;
  blobUrl: string;
  telemetry: MediaTelemetry;
}> {
  const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await putMediaBlob(assetId, file);
  const blobUrl = URL.createObjectURL(file);
  const telemetry = await extractMediaTelemetry(file, blobUrl, file.name);
  return { assetId, blobUrl, telemetry };
}

// ─────────────────────────────────────────────────────────────
// Playable Starter Composition (First Visit, Empty IndexedDB)
// ─────────────────────────────────────────────────────────────

export function createStarterComposition(): TimelineProjectState {
  const now = Date.now();
  const tracks: TimelineTrack[] = [
    { id: "track-0", index: 0, kind: "text", name: "T0 Overlays & Text", locked: false, muted: false, hidden: false },
    { id: "track-1", index: 1, kind: "video", name: "T1 Main Video", locked: false, muted: false, hidden: false },
    { id: "track-2", index: 2, kind: "overlay", name: "T2 B-Roll & PIP", locked: false, muted: false, hidden: false },
    { id: "track-3", index: 3, kind: "audio", name: "T3 Master Audio", locked: false, muted: false, hidden: false },
  ];

  const clips: TimelineClip[] = [
    {
      id: `clip-intro-${now}`,
      name: "KINO Kinetic Intro",
      type: "text",
      start: 0,
      duration: 3.5,
      trackIndex: 0,
      text: "KINO AI VIDEO DIRECTOR",
      transform: { x: 0, y: 0, width: 90, height: 20, scale: 1, rotation: 0, opacity: 1 },
      style: { fontSize: 56, color: "#34D399", fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center", shadow: "0 4px 30px rgba(52,211,153,0.45)" },
      animation: { in: "pop", out: "fade", duration: 0.45 },
    },
    {
      id: `clip-sub-${now}`,
      name: "Amber Kinetic Caption",
      type: "text",
      start: 3.5,
      duration: 4,
      trackIndex: 0,
      text: "Zero Cost · Direct Canvas Edit · Instant Export",
      transform: { x: 0, y: 30, width: 85, height: 16, scale: 1, rotation: 0, opacity: 1 },
      style: { fontSize: 30, color: "#FBBF24", fontWeight: 700, fontFamily: "'Playfair Display', serif", textAlign: "center", shadow: "0 0 20px rgba(251,191,36,0.5)" },
      animation: { in: "word-reveal", out: "fade", duration: 0.5 },
    },
    {
      id: `clip-cta-${now}`,
      name: "Mint CTA Badge",
      type: "text",
      start: 7.5,
      duration: 4.5,
      trackIndex: 0,
      text: "Export Anywhere · Browser & HyperFrames CLI",
      transform: { x: 0, y: 0, width: 85, height: 20, scale: 1, rotation: 0, opacity: 1 },
      style: { fontSize: 44, color: "#FFFFFF", fontWeight: 700, fontFamily: "Inter, sans-serif", textAlign: "center", shadow: "0 4px 20px rgba(0,0,0,0.8)" },
      animation: { in: "fade", out: "fade", duration: 0.4 },
    },
  ];

  return {
    projectId: "starter",
    duration: 12,
    fps: 30,
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    background: { type: "gradient", value: "linear-gradient(135deg, #18181b 0%, #09090b 100%)" },
    tracks,
    clips,
  };
}
