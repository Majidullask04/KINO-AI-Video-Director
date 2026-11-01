"use client";

import {
  Project,
  CutDecision,
  TimelineProjectState,
  TimelineClip,
  LocalAssetRecord,
} from "@/types";
import { API_BASE } from "@/utils/media";
import {
  serializeTimelineToHtml,
  parseHtmlToTimeline,
  DEFAULT_TRACKS,
} from "./html-serializer";

const DB_NAME = "kino_studio_db";
const DB_VERSION = 1;

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

  // Extract client-side media telemetry
  const telemetry = await inspectClientMedia(file, blobUrl);

  const assetRecord: LocalAssetRecord = {
    filename: file.name,
    url: blobUrl,
    blob: file,
    duration: telemetry.duration || 4.0,
    width: telemetry.width,
    height: telemetry.height,
    fps: telemetry.fps || 30,
    filesize_bytes: file.size,
    has_audio: telemetry.hasAudio,
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

export async function listAssets(projectId: string): Promise<LocalAssetRecord[]> {
  const isOnline = await checkBackendAvailability();

  if (isOnline) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/manifest`);
      if (res.ok) {
        const data = await res.json();
        return (data.assets || []).map((a: any) => ({
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
      }
    } catch (e) {
      console.warn("Backend manifest fetch failed:", e);
    }
  }

  return await getAssetsFromIndexedDb(projectId);
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
 * Client-Side Video/Audio Telemetry Extractor (runs 100% in browser)
 */
function inspectClientMedia(file: File, url: string): Promise<{
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith("video");
    const isAudio = file.type.startsWith("audio");

    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;
      video.onloadedmetadata = () => {
        resolve({
          duration: Math.max(1, Math.round(video.duration * 10) / 10),
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          fps: 30,
          hasVideo: true,
          hasAudio: true,
        });
      };
      video.onerror = () => {
        resolve({ duration: 4.0, width: 1920, height: 1080, hasVideo: true, hasAudio: false });
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
      resolve({ duration: 3.0, hasVideo: false, hasAudio: false });
    }
  });
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
      {
        id: "clip-intro-1",
        name: "KINO AI Video Director",
        type: "text",
        start: 0.0,
        duration: 3.0,
        trackIndex: 0,
        text: "KINO AI Video Director",
        transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 56, color: "#34D399", fontWeight: 800, fontFamily: "Inter, sans-serif" },
        animation: { in: "pop", out: "fade", duration: 0.4 },
      },
      {
        id: "clip-sub-1",
        name: "Manual Non-Linear Editing + AI",
        type: "text",
        start: 3.0,
        duration: 4.5,
        trackIndex: 0,
        text: "Zero Cost · Direct Canvas Edit · Instant Export",
        transform: { x: 0, y: 15, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 32, color: "#F4F4F2", fontWeight: 600, fontFamily: "Inter, sans-serif" },
        animation: { in: "slide-up", out: "fade", duration: 0.5 },
      },
      {
        id: "clip-cta-1",
        name: "Export Anywhere",
        type: "text",
        start: 7.5,
        duration: 4.5,
        trackIndex: 0,
        text: "Direct Video Export in Browser",
        transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 44, color: "#FFFFFF", fontWeight: 700, fontFamily: "Inter, sans-serif" },
        animation: { in: "fade", out: "fade", duration: 0.4 },
      },
    ],
  };

  await saveTimeline(starter.id, initialTimeline);
  return starter;
}

