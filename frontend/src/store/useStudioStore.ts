"use client";

import { create } from "zustand";
import {
  TimelineProjectState,
  TimelineClip,
  TimelineTrack,
  LocalAssetRecord,
  Project,
} from "@/types";

/**
 * Unified Studio Store — single source of truth for the KINO studio.
 * Modeled after OpenCut NLE state + HeyGen HyperFrames deterministic engine.
 */

export interface StudioBackground {
  type: "color" | "gradient" | "blurred-video";
  value: string;
}

export interface StudioPlaybackState {
  currentTime: number;
  isPlaying: boolean;
  loop: boolean;
  muted: boolean;
  playbackRate: number;
  selectedClipId: string | null;
  zoomLevel: number;
  snapEnabled: boolean;
}

export interface StudioCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  timeline: TimelineProjectState;
}

export interface StudioHistory {
  past: TimelineProjectState[];
  future: TimelineProjectState[];
  undo: () => void;
  redo: () => void;
  saveCheckpoint: (name: string) => void;
}

export interface StudioState {
  // ── Project & Timeline (HyperFrames contract state) ──
  project: Project | null;
  timeline: TimelineProjectState | null;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: string;
  background: StudioBackground;

  // ── Playback ──
  playback: StudioPlaybackState;

  // ── Undo / Redo & Checkpoints ──
  history: StudioHistory;
  checkpoints: StudioCheckpoint[];

  // ── Assets (Local Media Bin) ──
  assets: LocalAssetRecord[];

  // ── Actions ──
  setProject: (project: Project | null) => void;
  setTimeline: (next: TimelineProjectState, opts?: { recordUndo?: boolean }) => void;
  updateClip: (id: string, patch: Partial<TimelineClip>) => void;
  updateClips: (clips: TimelineClip[]) => void;
  selectClip: (id: string | null) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setPlaying: (playing: boolean) => void;
  setLoop: (loop: boolean) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setZoomLevel: (zoom: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setAssets: (assets: LocalAssetRecord[]) => void;
  undo: () => void;
  redo: () => void;
  saveCheckpoint: (name: string) => void;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const HISTORY_LIMIT = 40;

export const useStudioStore = create<StudioState>((set, get) => ({
  project: null,
  timeline: null,
  tracks: [],
  clips: [],
  duration: 12,
  fps: 30,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  background: { type: "color", value: "#0F0F0E" },

  playback: {
    currentTime: 0,
    isPlaying: false,
    loop: false,
    muted: false,
    playbackRate: 1,
    selectedClipId: null,
    zoomLevel: 1,
    snapEnabled: true,
  },

  history: {
    past: [],
    future: [],
    undo: () => {
      const { timeline, history } = get();
      if (!timeline || history.past.length === 0) return;
      const previous = history.past[history.past.length - 1];
      set({
        timeline: previous,
        history: {
          past: history.past.slice(0, -1),
          future: [...history.future, timeline],
          undo: get().history.undo,
          redo: get().history.redo,
          saveCheckpoint: get().history.saveCheckpoint,
        },
      });
    },
    redo: () => {
      const { timeline, history } = get();
      if (!timeline || history.future.length === 0) return;
      const next = history.future[history.future.length - 1];
      set({
        timeline: next,
        history: {
          past: [...history.past, timeline],
          future: history.future.slice(0, -1),
          undo: get().history.undo,
          redo: get().history.redo,
          saveCheckpoint: get().history.saveCheckpoint,
        },
      });
    },
    saveCheckpoint: (name: string) => {
      const { timeline, checkpoints } = get();
      if (!timeline) return;
      const checkpoint: StudioCheckpoint = {
        id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim() || `Snapshot ${checkpoints.length + 1}`,
        timestamp: Date.now(),
        timeline: deepClone(timeline),
      };
      set({ checkpoints: [...checkpoints, checkpoint] });
    },
  },
  checkpoints: [],

  assets: [],

  setProject: (project) => set({ project }),

  setTimeline: (next, opts) => {
    const prev = get().timeline;
    if (opts?.recordUndo && prev) {
      const past = [...get().history.past, deepClone(prev)].slice(-HISTORY_LIMIT);
      set({ history: { ...get().history, past, future: [] } });
    }
    set({ timeline: next });
    if (next) {
      set({
        clips: next.clips || [],
        tracks: next.tracks || [],
        duration: next.duration ?? 0,
        fps: next.fps ?? 30,
        width: next.width ?? 1920,
        height: next.height ?? 1080,
        aspectRatio: next.aspectRatio || "16:9",
        background: next.background || { type: "color", value: "#0F0F0E" },
      });
    }
  },

  updateClip: (id, patch) => {
    const { timeline } = get();
    if (!timeline) return;
    const nextClips = (timeline.clips || []).map((c) => (c.id === id ? { ...c, ...patch } : c));
    get().setTimeline({ ...timeline, clips: nextClips });
  },

  updateClips: (clips) => {
    const { timeline } = get();
    if (!timeline) return;
    get().setTimeline({ ...timeline, clips });
  },

  selectClip: (id) => set({ playback: { ...get().playback, selectedClipId: id } }),

  setCurrentTime: (time) =>
    set((s) => ({
      playback: { ...s.playback, currentTime: typeof time === "function" ? time(s.playback.currentTime) : Math.max(0, time) },
    })),

  setPlaying: (playing) => set({ playback: { ...get().playback, isPlaying: playing } }),

  setLoop: (loop) => set({ playback: { ...get().playback, loop } }),

  setMuted: (muted) => set({ playback: { ...get().playback, muted } }),

  setPlaybackRate: (rate) => set({ playback: { ...get().playback, playbackRate: rate } }),

  setZoomLevel: (zoom) => set({ playback: { ...get().playback, zoomLevel: zoom } }),

  setSnapEnabled: (enabled) => set({ playback: { ...get().playback, snapEnabled: enabled } }),

  setAssets: (assets) => set({ assets }),

  undo: () => get().history?.undo?.(),
  redo: () => get().history?.redo?.(),
  saveCheckpoint: (name) => get().history?.saveCheckpoint?.(name),
}));

export const selectStudioTimeline = (s: StudioState): TimelineProjectState | null => s.timeline;
export const selectStudioPlayback = (s: StudioState) => s.playback;
export const selectStudioHistory = (s: StudioState) => s.history;
export const selectStudioProject = (s: StudioState) => s.project;
export const selectStudioAssets = (s: StudioState) => s.assets;
