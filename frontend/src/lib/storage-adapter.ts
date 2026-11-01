"use client";

import {
  Project,
  CutDecision,
  TimelineProjectState,
  TimelineClip,
  LocalAssetRecord,
  ProjectCheckpoint,
} from "@/types";
import { API_BASE } from "@/utils/media";
import {
  serializeTimelineToHtml,
  parseHtmlToTimeline,
  DEFAULT_TRACKS,
} from "./html-serializer";

const DB_NAME = "kino_studio_db";
const DB_VERSION = 2;

let isBackendAvailableCache: boolean | null = null;
let lastCheckTime = 0;

/**
 * Checks if the local FastAPI backend is responsive within 800ms.
 * Cached for 10 seconds to avoid spamming the endpoint.
 */
export async function checkBackendAvailability(force = false): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const now = Date.now();
  if (!force && isBackendAvailableCache !== null && now - lastCheckTime < 10000) {
    return isBackendAvailableCache;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 800);

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    isBackendAvailableCache = res.ok;
    lastCheckTime = now;
    return res.ok;
  } catch {
    clearTimeout(timeoutId);
    isBackendAvailableCache = false;
    lastCheckTime = now;
    return false;
  }
}

/**
 * IndexedDB Promise-based Connection Helper
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("assets")) {
        db.createObjectStore("assets", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("timelines")) {
        db.createObjectStore("timelines", { keyPath: "projectId" });
      }
      if (!db.objectStoreNames.contains("checkpoints")) {
        db.createObjectStore("checkpoints", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─────────────────────────────────────────────────────────────
// Project Management
// ─────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const isOnline = await checkBackendAvailability();

  if (isOnline) {
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        const projs: Project[] = data.projects || [];
        // Mirror to IndexedDB
        for (const p of projs) {
          await saveProjectToIndexedDb(p);
        }
        return projs;
      }
    } catch (e) {
      console.warn("Backend listProjects failed, using IndexedDB fallback:", e);
    }
  }

  // Fallback to IndexedDB
  const localProjects = await getProjectsFromIndexedDb();
  if (localProjects.length === 0) {
    // Seed browser starter project
    const seeded = await seedStarterProject();
    return [seeded];
  }
  return localProjects;
}

export async function createProject(params: {
  title: string;
  target_duration?: number;
  aspect_ratio?: string;
  category?: string;
  mood?: string;
}): Promise<Project> {
  const isOnline = await checkBackendAvailability();
  const projId = params.title.toLowerCase().replace(/[^a-z0-9]/g, "-") || `proj-${Date.now()}`;
  const width = params.aspect_ratio === "9:16" ? 1080 : 1920;
  const height = params.aspect_ratio === "9:16" ? 1920 : 1080;

  const project: Project = {
    id: projId,
    title: params.title,
    category: params.category || "Social Video",
    target_duration: params.target_duration || 12.0,
    duration: params.target_duration || 12.0,
    aspect_ratio: params.aspect_ratio || "16:9",
    width,
    height,
    fps: 30,
    mood: params.mood || "energetic",
    created_at: Date.now(),
    status: "ready",
  };

  if (isOnline) {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: params.title,
          target_duration: params.target_duration || 12.0,
          aspect_ratio: params.aspect_ratio || "16:9",
          category: params.category,
          mood: params.mood,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.project || project;
        await saveProjectToIndexedDb(created);
        return created;
      }
    } catch (e) {
      console.warn("Backend createProject failed, saving locally:", e);
    }
  }

  // Save to IndexedDB
  await saveProjectToIndexedDb(project);

  // Initialize standard starter files in IndexedDB
  const starterStoryboard = `# Storyboard: ${project.title}\n\n## Creative Brief\nDirecting: ${project.title}\n\n## Narrative Beats\n- Beat 1: Hook (0s-3s)\n- Beat 2: Core Concept (3s-6s)\n- Beat 3: Features & Demo (6s-9s)\n- Beat 4: Call to Action (9s-12s)\n`;
  const starterScript = `# Script: ${project.title}\n\n[Hook] Welcome to KINO Studio.\n[Body] Edit any element manually or with AI.\n[CTA] Export in browser or local MP4.\n`;
  const starterFrameMd = `# Brand Tokens: ${project.title}\n\n- Primary Accent: #34D399\n- Canvas Background: #0F0F0E\n- Typography: Inter, sans-serif\n`;

  await saveFile(projId, "STORYBOARD.md", starterStoryboard);
  await saveFile(projId, "SCRIPT.md", starterScript);
  await saveFile(projId, "frame.md", starterFrameMd);
  await saveFile(projId, "meta.json", JSON.stringify(project, null, 2));

  // Initialize empty timeline
  const initialTimeline: TimelineProjectState = {
    projectId: projId,
    duration: project.duration || 12.0,
    fps: 30,
    width,
    height,
    aspectRatio: project.aspect_ratio,
    background: { type: "color", value: "#000000" },
    tracks: DEFAULT_TRACKS,
    clips: [
      {
        id: "clip-title-1",
        name: params.title,
        type: "text",
        start: 0.0,
        duration: 3.5,
        trackIndex: 0,
        text: params.title,
        transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 52, color: "#FFFFFF", fontWeight: 700, fontFamily: "Inter, sans-serif" },
        animation: { in: "pop", out: "fade", duration: 0.5 },
      },
    ],
  };

  await saveTimeline(projId, initialTimeline);

  return project;
}

export async function getProjectDetails(projectId: string): Promise<{
  project: Project | null;
  decisions: CutDecision[];
  assets: LocalAssetRecord[];
}> {
  const isOnline = await checkBackendAvailability();

  if (isOnline) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        const project = data.project;
        const decisions = data.decisions || [];
        const assets = data.source_assets || [];
        if (project) {
          await saveProjectToIndexedDb(project);
        }
        return { project, decisions, assets };
      }
    } catch (e) {
      console.warn("Backend getProjectDetails failed, using IndexedDB:", e);
    }
  }

  // Fallback to IndexedDB
  const project = await getProjectFromIndexedDb(projectId);
  const timeline = await getTimeline(projectId);
  const assets = await listAssets(projectId);

  // Map timeline clips to CutDecision format for backward compatibility
  const decisions: CutDecision[] = (timeline.clips || []).map((c, idx) => ({
    decision_id: c.id,
    order: idx + 1,
    track: `V${c.trackIndex ?? 1}`,
    narrative_beat: c.narrative_beat || `BEAT_${idx + 1}`,
    source_asset: c.sourceAsset || c.name,
    clip_id: c.id,
    source_in_sec: c.start,
    source_out_sec: c.start + c.duration,
    duration: c.duration,
    track_index: c.trackIndex ?? 1,
    track_kind: c.type === "audio" ? "audio" : "video",
  }));

  return { project, decisions, assets };
}

export async function deleteProject(projectId: string): Promise<void> {
  const isOnline = await checkBackendAvailability();
  if (isOnline) {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Backend deleteProject error:", e);
    }
  }

  // Remove from IndexedDB
  const db = await openDatabase();
  const tx = db.transaction(["projects", "timelines"], "readwrite");
  tx.objectStore("projects").delete(projectId);
  tx.objectStore("timelines").delete(projectId);
}

// ─────────────────────────────────────────────────────────────
// File Storage (index.html, STORYBOARD.md, frame.md, SCRIPT.md)
// ─────────────────────────────────────────────────────────────

export async function getFile(projectId: string, filename: string): Promise<string> {
  const isOnline = await checkBackendAvailability();

  if (isOnline) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/${filename}`);
      if (res.ok) {
        const data = await res.json();
        const content = data.content || "";
        await saveFileToIndexedDb(projectId, filename, content);
        return content;
      }
    } catch (e) {
      console.warn(`Backend getFile(${filename}) failed:`, e);
    }
  }

  // Read from IndexedDB
  return await getFileFromIndexedDb(projectId, filename);
}

export async function saveFile(projectId: string, filename: string, content: string): Promise<void> {
  const isOnline = await checkBackendAvailability();

  if (isOnline) {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/files/${filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch (e) {
      console.warn(`Backend saveFile(${filename}) failed:`, e);
    }
  }

  // Always save to IndexedDB
  await saveFileToIndexedDb(projectId, filename, content);
}

// ─────────────────────────────────────────────────────────────
// Asset Management (Upload & In-Browser Audio/Video Telemetry)
// ─────────────────────────────────────────────────────────────

export async function saveAsset(projectId: string, file: File): Promise<LocalAssetRecord> {
  const isOnline = await checkBackendAvailability();
  const blobUrl = URL.createObjectURL(file);
  const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Extract client-side media telemetry with thumbnail frame capture and audio waveform
  const telemetry = await inspectClientMedia(file, blobUrl);
  const waveform = await extractAudioWaveform(file, 100);

  const assetRecord: LocalAssetRecord = {
    id: assetId,
    filename: file.name,
    url: blobUrl,
    thumbnailUrl: telemetry.thumbnailUrl,
    filmstrip: telemetry.filmstrip,
    waveform: waveform.length > 0 ? waveform : undefined,
    blob: file,
    duration: telemetry.duration || 4.0,
    width: telemetry.width,
    height: telemetry.height,
    fps: telemetry.fps || 30,
    filesize_bytes: file.size,
    has_audio: telemetry.hasAudio || waveform.length > 0,
    has_video: telemetry.hasVideo,
    aspect_ratio: telemetry.width && telemetry.height ? (telemetry.width >= telemetry.height ? "16:9" : "9:16") : "16:9",
    created_at: Date.now(),
  };

  if (isOnline) {
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/assets`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.assets && data.assets.length > 0) {
          const backendAsset = data.assets[0];
          assetRecord.url = `${API_BASE}${backendAsset.url || backendAsset.video_url}`;
        }
      }
    } catch (e) {
      console.warn("Backend upload failed, using local Blob URL:", e);
    }
  }

  // Store asset Blob in IndexedDB
  await saveAssetToIndexedDb(projectId, assetRecord);

  return assetRecord;
}

export async function deleteAsset(projectId: string, assetIdOrFilename: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("assets", "readwrite");
  const store = tx.objectStore("assets");
  store.delete(assetIdOrFilename);
  store.delete(`${projectId}/${assetIdOrFilename}`);

  const isOnline = await checkBackendAvailability();
  if (isOnline) {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/assets/${encodeURIComponent(assetIdOrFilename)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("Backend asset deletion error:", e);
    }
  }
}

export async function listAssets(projectId: string): Promise<LocalAssetRecord[]> {
  const isOnline = await checkBackendAvailability();

  if (isOnline) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/manifest`);
      if (res.ok) {
        const data = await res.json();
        const backendAssets = (data.assets || []).map((a: any) => ({
          id: a.id || `${projectId}/${a.filename}`,
          filename: a.filename,
          url: `${API_BASE}${a.url || a.video_url}`,
          duration: a.duration || 4.0,
          width: a.width,
          height: a.height,
          fps: a.fps || 30,
          has_audio: !!a.has_audio,
          has_video: !!a.has_video,
          created_at: Date.now(),
        }));
        if (backendAssets.length > 0) return backendAssets;
      }
    } catch (e) {
      console.warn("Backend manifest fetch failed:", e);
    }
  }

  return await getAssetsFromIndexedDb(projectId);
}

// ─────────────────────────────────────────────────────────────
// Checkpoints Management (Snapshots in IndexedDB + Git)
// ─────────────────────────────────────────────────────────────

export async function listCheckpoints(projectId: string): Promise<ProjectCheckpoint[]> {
  const db = await openDatabase();
  const tx = db.transaction("checkpoints", "readonly");
  const req = tx.objectStore("checkpoints").getAll();
  return new Promise((resolve) => {
    req.onsuccess = () => {
      const records = (req.result || []) as ProjectCheckpoint[];
      const filtered = records
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => b.timestamp - a.timestamp);
      resolve(filtered);
    };
    req.onerror = () => resolve([]);
  });
}

export async function createCheckpoint(
  projectId: string,
  name: string,
  timeline: TimelineProjectState
): Promise<ProjectCheckpoint> {
  const checkpoint: ProjectCheckpoint = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    name: name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`,
    timestamp: Date.now(),
    timeline: JSON.parse(JSON.stringify(timeline)),
  };

  const db = await openDatabase();
  const tx = db.transaction("checkpoints", "readwrite");
  tx.objectStore("checkpoints").put(checkpoint);

  // If online, also commit to git backend
  const isOnline = await checkBackendAvailability();
  if (isOnline) {
    try {
      await fetch(`${API_BASE}/api/checkpoints/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: checkpoint.name }),
      });
    } catch (e) {
      console.warn("Backend checkpoint creation failed:", e);
    }
  }

  return checkpoint;
}

export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("checkpoints", "readwrite");
  tx.objectStore("checkpoints").delete(checkpointId);
}

// ─────────────────────────────────────────────────────────────
// Timeline Sync & State Management
// ─────────────────────────────────────────────────────────────

export async function getTimeline(projectId: string): Promise<TimelineProjectState> {
  const db = await openDatabase();
  const tx = db.transaction("timelines", "readonly");
  const store = tx.objectStore("timelines");

  const localTimeline = await new Promise<TimelineProjectState | null>((resolve) => {
    const req = store.get(projectId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (localTimeline && localTimeline.clips) {
    return localTimeline;
  }

  // If no timeline in IndexedDB, attempt to parse from index.html
  const html = await getFile(projectId, "index.html");
  if (html) {
    const parsed = parseHtmlToTimeline(html, projectId);
    await saveTimeline(projectId, parsed);
    return parsed;
  }

  // Default empty timeline
  const emptyState: TimelineProjectState = {
    projectId,
    duration: 12.0,
    fps: 30,
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    background: { type: "color", value: "#000000" },
    tracks: DEFAULT_TRACKS,
    clips: [],
  };

  return emptyState;
}

export async function saveTimeline(projectId: string, state: TimelineProjectState): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("timelines", "readwrite");
  tx.objectStore("timelines").put({ ...state, projectId });

  // Two-way sync: serialize timeline into deterministic HyperFrames index.html
  const html = serializeTimelineToHtml(state);
  await saveFile(projectId, "index.html", html);
}

// ─────────────────────────────────────────────────────────────
// Internal IndexedDB Helpers
// ─────────────────────────────────────────────────────────────

async function saveProjectToIndexedDb(project: Project): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").put(project);
}

async function getProjectFromIndexedDb(projectId: string): Promise<Project | null> {
  const db = await openDatabase();
  const tx = db.transaction("projects", "readonly");
  const req = tx.objectStore("projects").get(projectId);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function getProjectsFromIndexedDb(): Promise<Project[]> {
  const db = await openDatabase();
  const tx = db.transaction("projects", "readonly");
  const req = tx.objectStore("projects").getAll();
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function saveFileToIndexedDb(projectId: string, filename: string, content: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("files", "readwrite");
  tx.objectStore("files").put({
    id: `${projectId}/${filename}`,
    projectId,
    filename,
    content,
    updated_at: Date.now(),
  });
}

async function getFileFromIndexedDb(projectId: string, filename: string): Promise<string> {
  const db = await openDatabase();
  const tx = db.transaction("files", "readonly");
  const req = tx.objectStore("files").get(`${projectId}/${filename}`);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result?.content || "");
    req.onerror = () => resolve("");
  });
}

async function saveAssetToIndexedDb(projectId: string, asset: LocalAssetRecord): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("assets", "readwrite");
  tx.objectStore("assets").put({
    id: `${projectId}/${asset.filename}`,
    projectId,
    ...asset,
  });
}

async function getAssetsFromIndexedDb(projectId: string): Promise<LocalAssetRecord[]> {
  const db = await openDatabase();
  const tx = db.transaction("assets", "readonly");
  const req = tx.objectStore("assets").getAll();
  return new Promise((resolve) => {
    req.onsuccess = () => {
      const records = req.result || [];
      const filtered = records
        .filter((r: any) => r.projectId === projectId)
        .map((r: any) => ({
          ...r,
          url: r.blob ? URL.createObjectURL(r.blob) : r.url,
        }));
      resolve(filtered);
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Extracts normalized audio waveform peaks (Float32Array -> 100 values between 0.0 and 1.0)
 * using the browser's Web Audio API (decodeAudioData)
 */
export async function extractAudioWaveform(file: File, bars: number = 100): Promise<number[]> {
  try {
    if (typeof window === "undefined") return [];
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return [];
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / bars);
    const peaks: number[] = [];

    for (let i = 0; i < bars; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j]);
      }
      const avg = sum / blockSize;
      // Boost slightly for clear visual contrast
      peaks.push(Math.min(1.0, Math.round(avg * 3.5 * 100) / 100));
    }
    audioCtx.close();
    return peaks;
  } catch {
    return [];
  }
}

/**
 * Client-Side Video/Audio Telemetry Extractor (runs 100% in browser with frame capture & filmstrips)
 */
function inspectClientMedia(file: File, url: string): Promise<{
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  thumbnailUrl?: string;
  filmstrip?: string[];
}> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith("video") || file.name.match(/\.(mp4|mov|webm|m4v)$/i);
    const isAudio = file.type.startsWith("audio") || file.name.match(/\.(mp3|wav|ogg|aac|m4a)$/i);
    const isImage = file.type.startsWith("image") || file.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i);

    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      const timeout = setTimeout(() => {
        resolve({ duration: 4.0, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: true });
      }, 3500);

      video.onloadedmetadata = () => {
        const dur = Math.max(0.5, Math.round(video.duration * 10) / 10);
        const w = video.videoWidth || 1920;
        const h = video.videoHeight || 1080;
        video.currentTime = Math.min(0.5, dur / 2);

        video.onseeked = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, 320, 180);
              const thumb = canvas.toDataURL("image/jpeg", 0.7);
              // Multi-frame filmstrip simulation
              const filmstrip = [thumb, thumb, thumb, thumb];
              resolve({ duration: dur, width: w, height: h, fps: 30, hasVideo: true, hasAudio: true, thumbnailUrl: thumb, filmstrip });
              return;
            }
          } catch {}
          resolve({ duration: dur, width: w, height: h, fps: 30, hasVideo: true, hasAudio: true });
        };
      };

      video.onerror = () => {
        clearTimeout(timeout);
        resolve({ duration: 4.0, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: false });
      };
    } else if (isImage) {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, 320, 180);
            const thumb = canvas.toDataURL("image/jpeg", 0.7);
            resolve({ duration: 5.0, width: img.naturalWidth || 1920, height: img.naturalHeight || 1080, hasVideo: false, hasAudio: false, thumbnailUrl: thumb, filmstrip: [thumb, thumb] });
            return;
          }
        } catch {}
        resolve({ duration: 5.0, width: img.naturalWidth || 1920, height: img.naturalHeight || 1080, hasVideo: false, hasAudio: false, thumbnailUrl: url });
      };
      img.onerror = () => {
        resolve({ duration: 5.0, width: 1920, height: 1080, hasVideo: false, hasAudio: false });
      };
    } else if (isAudio) {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = url;
      audio.onloadedmetadata = () => {
        resolve({
          duration: Math.max(1, Math.round(audio.duration * 10) / 10),
          hasVideo: false,
          hasAudio: true,
        });
      };
      audio.onerror = () => {
        resolve({ duration: 12.0, hasVideo: false, hasAudio: true });
      };
    } else {
      resolve({ duration: 4.0, hasVideo: false, hasAudio: false });
    }
  });
}

/**
 * Creates 100% in-browser procedural sample video & audio clips so users can test immediately
 */
export async function createSampleMediaAssets(projectId: string): Promise<LocalAssetRecord[]> {
  const assets: LocalAssetRecord[] = [];

  // 1. Procedural Video 1: "KINO Neon City Drift"
  const videoCanvas = document.createElement("canvas");
  videoCanvas.width = 1280;
  videoCanvas.height = 720;
  const vCtx = videoCanvas.getContext("2d");
  if (vCtx) {
    const grad = vCtx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, "#09090b");
    grad.addColorStop(0.5, "#1e1b4b");
    grad.addColorStop(1, "#0284c7");
    vCtx.fillStyle = grad;
    vCtx.fillRect(0, 0, 1280, 720);

    // Grid lines
    vCtx.strokeStyle = "rgba(52, 211, 153, 0.25)";
    vCtx.lineWidth = 2;
    for (let x = 0; x < 1280; x += 80) {
      vCtx.beginPath();
      vCtx.moveTo(x, 0);
      vCtx.lineTo(x, 720);
      vCtx.stroke();
    }

    // Glow circle
    vCtx.fillStyle = "rgba(52, 211, 153, 0.4)";
    vCtx.beginPath();
    vCtx.arc(640, 360, 140, 0, Math.PI * 2);
    vCtx.fill();

    vCtx.fillStyle = "#FFFFFF";
    vCtx.font = "bold 52px Inter, sans-serif";
    vCtx.textAlign = "center";
    vCtx.fillText("KINO CYBER DRIFT", 640, 350);
    vCtx.fillStyle = "#34D399";
    vCtx.font = "bold 24px monospace";
    vCtx.fillText("SAMPLE MEDIA // 1080P COMPOSITION", 640, 410);

    const thumb1 = videoCanvas.toDataURL("image/jpeg", 0.8);
    const videoAsset1: LocalAssetRecord = {
      id: `sample-video-1-${Date.now()}`,
      filename: "sample-neon-drift.mp4",
      url: thumb1,
      thumbnailUrl: thumb1,
      filmstrip: [thumb1, thumb1, thumb1, thumb1],
      duration: 6.0,
      width: 1280,
      height: 720,
      fps: 30,
      has_audio: false,
      has_video: true,
      created_at: Date.now(),
    };
    await saveAssetToIndexedDb(projectId, videoAsset1);
    assets.push(videoAsset1);

    // 2. Procedural Video 2: "Golden Hour Cinematic"
    const grad2 = vCtx.createLinearGradient(0, 0, 1280, 720);
    grad2.addColorStop(0, "#18181b");
    grad2.addColorStop(0.5, "#78350f");
    grad2.addColorStop(1, "#b45309");
    vCtx.fillStyle = grad2;
    vCtx.fillRect(0, 0, 1280, 720);

    vCtx.fillStyle = "rgba(251, 191, 36, 0.5)";
    vCtx.beginPath();
    vCtx.arc(640, 360, 160, 0, Math.PI * 2);
    vCtx.fill();

    vCtx.fillStyle = "#FFFFFF";
    vCtx.font = "bold 52px Inter, sans-serif";
    vCtx.textAlign = "center";
    vCtx.fillText("GOLDEN HOUR BEAT", 640, 350);
    vCtx.fillStyle = "#FBBF24";
    vCtx.font = "bold 24px monospace";
    vCtx.fillText("AMBER SERIF GRADE // SCENE 02", 640, 410);

    const thumb2 = videoCanvas.toDataURL("image/jpeg", 0.8);
    const videoAsset2: LocalAssetRecord = {
      id: `sample-video-2-${Date.now()}`,
      filename: "sample-golden-hour.mp4",
      url: thumb2,
      thumbnailUrl: thumb2,
      filmstrip: [thumb2, thumb2, thumb2, thumb2],
      duration: 6.0,
      width: 1280,
      height: 720,
      fps: 30,
      has_audio: false,
      has_video: true,
      created_at: Date.now() + 1,
    };
    await saveAssetToIndexedDb(projectId, videoAsset2);
    assets.push(videoAsset2);
  }

  // 3. Procedural Synthesized Waveform Audio
  const syntheticWaveform: number[] = [];
  for (let i = 0; i < 100; i++) {
    // Rhythmic pattern: kick on beat, snare, hi-hat rhythm
    const beat = i % 10 === 0 ? 0.95 : i % 5 === 0 ? 0.75 : Math.sin(i * 0.4) * 0.35 + 0.3;
    syntheticWaveform.push(Math.round(Math.min(1.0, Math.max(0.1, beat)) * 100) / 100);
  }

  const audioAsset: LocalAssetRecord = {
    id: `sample-audio-1-${Date.now()}`,
    filename: "sample-lofi-beat.mp3",
    url: "",
    duration: 12.0,
    has_audio: true,
    has_video: false,
    waveform: syntheticWaveform,
    created_at: Date.now() + 2,
  };
  await saveAssetToIndexedDb(projectId, audioAsset);
  assets.push(audioAsset);

  return assets;
}

/**
 * Seeds a rich in-browser starter showcase project when IndexedDB is empty
 */
async function seedStarterProject(): Promise<Project> {
  const starter: Project = {
    id: "showcase-production",
    title: "KINO Showcase Reel",
    category: "Product Reveal",
    target_duration: 12.0,
    duration: 12.0,
    aspect_ratio: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    mood: "high-energy",
    created_at: Date.now(),
    status: "ready",
  };

  await saveProjectToIndexedDb(starter);

  // Generate starter sample assets so stage is never cold or blank
  let sampleAssets: LocalAssetRecord[] = [];
  try {
    sampleAssets = await createSampleMediaAssets(starter.id);
  } catch {}

  const initialTimeline: TimelineProjectState = {
    projectId: starter.id,
    duration: 12.0,
    fps: 30,
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    background: { type: "gradient", value: "linear-gradient(135deg, #18181b 0%, #09090b 100%)" },
    tracks: DEFAULT_TRACKS,
    clips: [
      // Track 1: Sample Video Clip 1 (0.0s to 6.0s)
      {
        id: "clip-t1-sample-1",
        name: "KINO Cyber Drift",
        type: "image",
        start: 0.0,
        duration: 6.0,
        trackIndex: 1,
        sourceAsset: sampleAssets[0]?.filename || "sample-neon-drift.mp4",
        sourceUrl: sampleAssets[0]?.thumbnailUrl,
        filmstrip: sampleAssets[0]?.filmstrip,
        transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
      },
      // Track 1: Sample Video Clip 2 (6.0s to 12.0s)
      {
        id: "clip-t1-sample-2",
        name: "Golden Hour Beat",
        type: "image",
        start: 6.0,
        duration: 6.0,
        trackIndex: 1,
        sourceAsset: sampleAssets[1]?.filename || "sample-golden-hour.mp4",
        sourceUrl: sampleAssets[1]?.thumbnailUrl,
        filmstrip: sampleAssets[1]?.filmstrip,
        transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
      },
      // Track 0: Intro Title Text (0.0s to 3.5s)
      {
        id: "clip-intro-1",
        name: "KINO AI Video Director",
        type: "text",
        start: 0.0,
        duration: 3.5,
        trackIndex: 0,
        text: "KINO AI Video Director",
        transform: { x: 0, y: 0, width: 85, height: 20, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 52, color: "#34D399", fontWeight: 800, fontFamily: "Inter, sans-serif", shadow: "0 4px 24px rgba(0,0,0,0.8)" },
        animation: { in: "pop", out: "fade", duration: 0.4 },
      },
      // Track 0: Amber Serif Captions (3.5s to 7.5s)
      {
        id: "clip-sub-1",
        name: "Amber Serif Hook",
        type: "text",
        start: 3.5,
        duration: 4.0,
        trackIndex: 0,
        text: "Zero Cost · Direct Canvas Edit · Instant Export",
        transform: { x: 0, y: 30, width: 85, height: 16, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 30, color: "#FBBF24", fontWeight: 700, fontFamily: "'Playfair Display', serif", shadow: "0 0 20px rgba(251,191,36,0.5)" },
        animation: { in: "word-reveal", out: "fade", duration: 0.5 },
      },
      // Track 0: Call to Action (7.5s to 12.0s)
      {
        id: "clip-cta-1",
        name: "Export Anywhere",
        type: "text",
        start: 7.5,
        duration: 4.5,
        trackIndex: 0,
        text: "Export Anywhere · Browser & HyperFrames CLI",
        transform: { x: 0, y: 0, width: 85, height: 20, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 44, color: "#FFFFFF", fontWeight: 700, fontFamily: "Inter, sans-serif", shadow: "0 4px 20px rgba(0,0,0,0.8)" },
        animation: { in: "fade", out: "fade", duration: 0.4 },
      },
      // Track 3: Audio Groove with Waveform
      {
        id: "clip-t3-audio-1",
        name: "Lo-Fi Kinetic Beat",
        type: "audio",
        start: 0.0,
        duration: 12.0,
        trackIndex: 3,
        sourceAsset: sampleAssets[2]?.filename || "sample-lofi-beat.mp3",
        waveform: sampleAssets[2]?.waveform,
        transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
        audio: { volume: 80, muted: false, fadeIn: 0.5, fadeOut: 0.5, speed: 1.0 },
      },
    ],
  };

  await saveTimeline(starter.id, initialTimeline);
  return starter;
}

