"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  TimelineProjectState,
  TimelineClip,
  TimelineTrack,
  CutDecision,
  formatSMPTE,
} from "@/types";
import {
  Play,
  Pause,
  Scissors,
  MousePointer,
  Magnet,
  Layers,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Sparkles,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Type,
  Film,
  Music,
  Maximize2,
} from "lucide-react";

interface StudioTimelineProps {
  timeline?: TimelineProjectState;
  onUpdateTimeline?: (timeline: TimelineProjectState) => void;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string | null) => void;
  // Backward-compatible props
  decisions?: CutDecision[];
  selectedDecisionId?: string | null;
  onSelectDecision?: (d: CutDecision) => void;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeVersionNum?: number;
}

export const StudioTimeline: React.FC<StudioTimelineProps> = ({
  timeline,
  onUpdateTimeline,
  selectedClipId,
  onSelectClip,
  decisions = [],
  selectedDecisionId,
  onSelectDecision,
  currentTime,
  totalDuration,
  onSeek,
  isPlaying,
  onTogglePlay,
  activeVersionNum = 1,
}) => {
  const [activeTool, setActiveTool] = useState<"pointer" | "razor">("pointer");
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 4x
  const [isAddTrackOpen, setIsAddTrackOpen] = useState<boolean>(false);

  // Track lock/mute/hide states if timeline doesn't have them
  const [trackLocks, setTrackLocks] = useState<Record<number, boolean>>({});
  const [trackMutes, setTrackMutes] = useState<Record<number, boolean>>({});
  const [trackHides, setTrackHides] = useState<Record<number, boolean>>({});

  // Clip drag & trim state
  const [dragState, setDragState] = useState<{
    clipId: string;
    mode: "move" | "trim-left" | "trim-right";
    initialMouseX: number;
    initialStart: number;
    initialDuration: number;
    trackIndex: number;
  } | null>(null);

  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const duration = Math.max(1, timeline?.duration || totalDuration || 12.0);
  const effectiveSelectedId = selectedClipId || selectedDecisionId || null;

  // Convert legacy decisions into TimelineClips if no rich timeline is passed
  const activeClips: TimelineClip[] = timeline?.clips || (
    decisions.length > 0
      ? decisions.map((d, idx) => ({
          id: d.decision_id || `legacy-clip-${idx}`,
          name: `${d.order}. ${d.narrative_beat || "Scene"}`,
          type: "video",
          start: d.source_in_sec,
          duration: Math.max(0.5, d.source_out_sec - d.source_in_sec),
          trackIndex: 1,
          sourceAsset: d.source_asset,
          transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
          narrative_beat: d.narrative_beat,
          order: d.order,
        }))
      : []
  );

  const defaultTracks: TimelineTrack[] = [
    { id: "track-0", index: 0, kind: "text", name: "T0 Graphics & Text", locked: false, muted: false, hidden: false },
    { id: "track-1", index: 1, kind: "video", name: "T1 Primary Video", locked: false, muted: false, hidden: false },
    { id: "track-2", index: 2, kind: "video", name: "T2 B-Roll & Layers", locked: false, muted: false, hidden: false },
    { id: "track-3", index: 3, kind: "audio", name: "T3 Master Audio", locked: false, muted: false, hidden: false },
  ];

  const tracks: TimelineTrack[] = timeline?.tracks && timeline.tracks.length > 0
    ? timeline.tracks
    : defaultTracks;

  // SMPTE ticks every 1s (or 0.5s if zoomed)
  const tickStep = zoomLevel >= 2 ? 0.5 : 1.0;
  const tickCount = Math.floor(duration / tickStep);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep);

  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === "s" || e.key === "S") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleSplitAtPlayhead();
        }
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleDeleteSelectedClip();
      } else if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleDuplicateSelectedClip();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setSnapEnabled((prev) => !prev);
      } else if (e.key === "v" || e.key === "V") {
        setActiveTool("pointer");
      } else if (e.key === "c" || e.key === "C") {
        setActiveTool("razor");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - 0.1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + 0.1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, effectiveSelectedId, activeClips, timeline]);

  // ── Mouse Dragging for Clip Move & Trimming ──
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineContainerRef.current) return;
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const pixelsPerSecond = rect.width / duration;
      const deltaSeconds = (e.clientX - dragState.initialMouseX) / pixelsPerSecond;

      let nextClips = [...activeClips];
      const targetClipIndex = nextClips.findIndex((c) => c.id === dragState.clipId);
      if (targetClipIndex === -1) return;

      const clip = { ...nextClips[targetClipIndex] };

      if (dragState.mode === "move") {
        let newStart = Math.max(0, dragState.initialStart + deltaSeconds);
        newStart = Math.min(duration - clip.duration, newStart);

        // Magnetic Snapping
        if (snapEnabled) {
          const snapThreshold = 0.2; // 200ms snap window
          if (Math.abs(newStart - currentTime) < snapThreshold) {
            newStart = currentTime;
          } else if (Math.abs(newStart - 0) < snapThreshold) {
            newStart = 0;
          } else {
            // Snap to other clips
            for (const other of nextClips) {
              if (other.id === clip.id) continue;
              const otherEnd = other.start + other.duration;
              if (Math.abs(newStart - otherEnd) < snapThreshold) {
                newStart = otherEnd;
                break;
              }
              if (Math.abs(newStart + clip.duration - other.start) < snapThreshold) {
                newStart = other.start - clip.duration;
                break;
              }
            }
          }
        }

        clip.start = Math.max(0, Math.round(newStart * 100) / 100);
      } else if (dragState.mode === "trim-left") {
        let newStart = Math.max(0, dragState.initialStart + deltaSeconds);
        const originalEnd = dragState.initialStart + dragState.initialDuration;
        const minDuration = 0.2;

        if (newStart > originalEnd - minDuration) {
          newStart = originalEnd - minDuration;
        }

        const newDuration = originalEnd - newStart;
        clip.start = Math.round(newStart * 100) / 100;
        clip.duration = Math.round(newDuration * 100) / 100;
        clip.trimStart = (clip.trimStart || 0) + (clip.start - dragState.initialStart);
      } else if (dragState.mode === "trim-right") {
        let newDuration = Math.max(0.2, dragState.initialDuration + deltaSeconds);
        if (clip.start + newDuration > duration) {
          newDuration = duration - clip.start;
        }
        clip.duration = Math.round(newDuration * 100) / 100;
      }

      nextClips[targetClipIndex] = clip;

      if (onUpdateTimeline && timeline) {
        onUpdateTimeline({ ...timeline, clips: nextClips });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, activeClips, duration, snapEnabled, currentTime, timeline, onUpdateTimeline]);

  // ── Edit Actions ──

  const handleSelectClip = (clip: TimelineClip) => {
    if (onSelectClip) {
      onSelectClip(clip.id);
    }
    if (onSelectDecision) {
      onSelectDecision({
        decision_id: clip.id,
        order: clip.order || 1,
        track: `V${clip.trackIndex}`,
        narrative_beat: clip.narrative_beat || clip.name,
        source_asset: clip.sourceAsset || clip.name,
        clip_id: clip.id,
        source_in_sec: clip.start,
        source_out_sec: clip.start + clip.duration,
        duration: clip.duration,
        track_index: clip.trackIndex,
        track_kind: clip.type === "audio" ? "audio" : "video",
      });
    }
  };

  const handleToggleTrack = (trackIndex: number, prop: "locked" | "muted" | "hidden") => {
    if (!timeline || !onUpdateTimeline) return;
    const updated = tracks.map((t) =>
      t.index === trackIndex ? { ...t, [prop]: !t[prop] } : t
    );
    onUpdateTimeline({ ...timeline, tracks: updated });
  };

  // Split selected clip or clip under playhead
  const handleSplitAtPlayhead = () => {
    let targetClip: TimelineClip | undefined;

    if (effectiveSelectedId) {
      targetClip = activeClips.find(
        (c) => c.id === effectiveSelectedId && currentTime > c.start && currentTime < c.start + c.duration
      );
    }

    if (!targetClip) {
      // Find top-most clip spanning current time
      const spanning = activeClips.filter(
        (c) => currentTime > c.start && currentTime < c.start + c.duration
      );
      if (spanning.length > 0) {
        targetClip = spanning.sort((a, b) => (b.trackIndex ?? 0) - (a.trackIndex ?? 0))[0];
      }
    }

    if (!targetClip) return;

    // Check if track is locked
    const isLocked = tracks.find((t) => t.index === targetClip!.trackIndex)?.locked;
    if (isLocked) return;

    const splitOffset = currentTime - targetClip.start;
    if (splitOffset <= 0.1 || targetClip.duration - splitOffset <= 0.1) return;

    const firstHalf: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}-a-${Date.now()}`,
      duration: Math.round(splitOffset * 100) / 100,
    };

    const secondHalf: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}-b-${Date.now()}`,
      start: Math.round(currentTime * 100) / 100,
      duration: Math.round((targetClip.duration - splitOffset) * 100) / 100,
      trimStart: (targetClip.trimStart || 0) + splitOffset,
    };

    const updated = activeClips
      .filter((c) => c.id !== targetClip!.id)
      .concat([firstHalf, secondHalf]);

    if (onUpdateTimeline && timeline) {
      onUpdateTimeline({ ...timeline, clips: updated });
    }
    if (onSelectClip) {
      onSelectClip(secondHalf.id);
    }
  };

  // Delete selected clip
  const handleDeleteSelectedClip = () => {
    if (!effectiveSelectedId) return;
    const clip = activeClips.find((c) => c.id === effectiveSelectedId);
    if (!clip) return;

    // Check if track is locked
    const isLocked = tracks.find((t) => t.index === clip.trackIndex)?.locked;
    if (isLocked) return;

    const updated = activeClips.filter((c) => c.id !== effectiveSelectedId);
    if (onUpdateTimeline && timeline) {
      onUpdateTimeline({ ...timeline, clips: updated });
    }
    if (onSelectClip) {
      onSelectClip(null);
    }
  };

  // Duplicate selected clip
  const handleDuplicateSelectedClip = () => {
    if (!effectiveSelectedId) return;
    const clip = activeClips.find((c) => c.id === effectiveSelectedId);
    if (!clip) return;

    const duplicated: TimelineClip = {
      ...clip,
      id: `clip-copy-${Date.now()}`,
      name: `${clip.name} (Copy)`,
      start: Math.min(duration - clip.duration, clip.start + clip.duration),
    };

    const updated = [...activeClips, duplicated];
    if (onUpdateTimeline && timeline) {
      onUpdateTimeline({ ...timeline, clips: updated });
    }
    if (onSelectClip) {
      onSelectClip(duplicated.id);
    }
  };

  // Add new track
  const handleAddTrack = (kind: "video" | "audio" | "text") => {
    setIsAddTrackOpen(false);
    const newIndex = tracks.length;
    const newTrack: TimelineTrack = {
      id: `track-${newIndex}`,
      index: newIndex,
      kind,
      name: `T${newIndex} ${kind.charAt(0).toUpperCase() + kind.slice(1)}`,
      locked: false,
      muted: false,
      hidden: false,
    };

    if (onUpdateTimeline && timeline) {
      onUpdateTimeline({ ...timeline, tracks: [...tracks, newTrack] });
    }
  };

  return (
    <div className="bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden flex flex-col h-full select-none shadow-2xl">
      {/* ── 1. Top OpenCut Studio Toolbar (38px height) ── */}
      <div className="h-[38px] min-h-[38px] px-3 border-b border-[#222220] bg-[#181817] flex items-center justify-between shrink-0">
        {/* Left: Transport + Edit Tool Palettes */}
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="w-7 h-7 rounded-lg bg-[#222220] hover:bg-[#2c2c28] text-white flex items-center justify-center transition-all border border-white/10 shadow-sm"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-[#34D399]" />
            ) : (
              <Play className="w-3.5 h-3.5 text-zinc-200 fill-current ml-0.5" />
            )}
          </button>

          {/* SMPTE Timecode Pill */}
          <div className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#0F0F0E] border border-white/10 text-zinc-200 flex items-center gap-1.5 shadow-inner">
            <span className="text-[#34D399] font-bold">{formatSMPTE(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{formatSMPTE(duration)}</span>
          </div>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Edit Tools: Pointer (V), Razor (C/S), Snap (M), Duplicate, Delete */}
          <div className="flex items-center bg-[#0F0F0E] p-0.5 rounded-lg border border-white/10 gap-0.5">
            <button
              onClick={() => setActiveTool("pointer")}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                activeTool === "pointer"
                  ? "bg-[#222220] text-[#34D399] border border-white/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Selection Tool (V)"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setActiveTool("razor");
                handleSplitAtPlayhead();
              }}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                activeTool === "razor"
                  ? "bg-[#222220] text-[#34D399] border border-white/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Split at Playhead (S or Razor)"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDuplicateSelectedClip}
              disabled={!effectiveSelectedId}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                effectiveSelectedId
                  ? "text-zinc-400 hover:text-white"
                  : "text-zinc-600 opacity-40 cursor-not-allowed"
              }`}
              title="Duplicate Selected (Cmd+D)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteSelectedClip}
              disabled={!effectiveSelectedId}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                effectiveSelectedId
                  ? "text-rose-400 hover:text-rose-300"
                  : "text-zinc-600 opacity-40 cursor-not-allowed"
              }`}
              title="Delete Selected Clip (Delete / Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Magnet Snapping Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1 transition-all border ${
              snapEnabled
                ? "bg-[#34D399]/10 text-[#34D399] border-[#34D399]/30"
                : "bg-[#0F0F0E] text-zinc-500 border-white/5 hover:text-zinc-300"
            }`}
            title="Toggle Magnet Snapping (M)"
          >
            <Magnet className="w-3 h-3" />
            <span className="text-[10px]">Snap</span>
          </button>
        </div>

        {/* Right: Zoom Level + Add Track + Format Info */}
        <div className="flex items-center gap-2">
          {/* Zoom In/Out */}
          <div className="flex items-center gap-1 bg-[#0F0F0E] px-2 py-0.5 rounded-lg border border-white/10 text-zinc-400">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
              className="p-1 hover:text-white"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-zinc-300 w-7 text-center">
              {zoomLevel.toFixed(1)}x
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.5))}
              className="p-1 hover:text-white"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Add Track Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsAddTrackOpen(!isAddTrackOpen)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#222220] hover:bg-[#2c2c28] text-zinc-200 border border-white/10 transition-colors"
            >
              <Plus className="w-3 h-3 text-[#34D399]" />
              <span>Track</span>
            </button>
            {isAddTrackOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-[#1c1c1b] border border-white/15 rounded-xl shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => handleAddTrack("video")}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-zinc-200 flex items-center gap-2"
                >
                  <Film className="w-3 h-3 text-emerald-400" />
                  <span>+ Video Track</span>
                </button>
                <button
                  onClick={() => handleAddTrack("text")}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-zinc-200 flex items-center gap-2"
                >
                  <Type className="w-3 h-3 text-purple-400" />
                  <span>+ Text Track</span>
                </button>
                <button
                  onClick={() => handleAddTrack("audio")}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-zinc-200 flex items-center gap-2"
                >
                  <Music className="w-3 h-3 text-teal-400" />
                  <span>+ Audio Track</span>
                </button>
              </div>
            )}
          </div>

          <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
            30 FPS
          </span>
        </div>
      </div>

      {/* ── 2. Multitrack Lanes & Ruler Canvas Area ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Headers Column (148px) */}
        <div className="w-[148px] shrink-0 bg-[#181817] border-r border-[#222220] flex flex-col z-20">
          {/* Ruler Blank Header */}
          <div className="h-[24px] border-b border-[#222220] flex items-center px-3 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
            TRACK LANES
          </div>

          {/* Dynamic Track Headers */}
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => {
              const isLocked = trackLocks[track.index] ?? track.locked;
              const isMuted = trackMutes[track.index] ?? track.muted;
              const isHidden = trackHides[track.index] ?? track.hidden;

              return (
                <div
                  key={track.id || track.index}
                  className="h-14 border-b border-[#222220] px-3 py-1.5 flex flex-col justify-between bg-[#181817]/80 hover:bg-[#1e1e1d] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 truncate">
                      {track.kind === "text" && <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />}
                      {track.kind === "video" && <Film className="w-3 h-3 text-emerald-400 shrink-0" />}
                      {track.kind === "audio" && <Music className="w-3 h-3 text-teal-400 shrink-0" />}
                      <span className="truncate">{track.name}</span>
                    </span>
                  </div>

                  {/* Track Controls: Lock, Mute/Solo, Hide */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleTrack(track.index, "locked")}
                      className={`p-1 rounded text-[10px] ${
                        isLocked
                          ? "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                          : "bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                      title={isLocked ? "Unlock track" : "Lock track"}
                    >
                      {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    </button>
                    {track.kind === "audio" ? (
                      <button
                        onClick={() => handleToggleTrack(track.index, "muted")}
                        className={`p-1 rounded text-[10px] ${
                          isMuted
                            ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white"
                        }`}
                        title={isMuted ? "Unmute track" : "Mute track"}
                      >
                        {isMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleTrack(track.index, "hidden")}
                        className={`p-1 rounded text-[10px] ${
                          isHidden
                            ? "bg-blue-950/80 text-blue-300 border border-blue-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white"
                        }`}
                        title={isHidden ? "Show track" : "Hide track"}
                      >
                        {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Track Lanes & Scrubber Area */}
        <div
          ref={timelineContainerRef}
          style={{ width: `${zoomLevel * 100}%` }}
          className="flex-1 overflow-x-auto relative bg-[#0e0e0d] flex flex-col justify-between select-none"
        >
          {/* SMPTE Ruler (24px height) */}
          <div
            ref={rulerRef}
            className="h-[24px] min-h-[24px] border-b border-[#222220] relative bg-[#141413] cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(ratio * duration);
            }}
          >
            {ticks.map((sec) => (
              <div
                key={sec}
                style={{ left: `${(sec / duration) * 100}%` }}
                className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
              >
                <span className="font-mono text-[8px] text-zinc-500 mt-0.5">
                  {formatSMPTE(sec).slice(3)}
                </span>
                <div className="w-px h-1.5 bg-[#2c2c28] mt-auto" />
              </div>
            ))}
          </div>

          {/* Playhead Scrubber Needle */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-[#34D399] z-30 pointer-events-none transition-all duration-75 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
          >
            <div className="w-3 h-3 bg-[#34D399] -ml-[5px] top-0 rounded-t-sm shadow-md" />
          </div>

          {/* Track Lanes */}
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => {
              const trackClips = activeClips.filter(
                (c) => (c.trackIndex ?? 1) === track.index
              );

              return (
                <div
                  key={track.id || track.index}
                  className="h-14 border-b border-[#222220] p-1.5 relative flex items-center bg-[#111110]/40"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                    onSeek(ratio * duration);
                  }}
                >
                  {trackClips.map((clip) => {
                    const leftPercent = (clip.start / duration) * 100;
                    const widthPercent = (clip.duration / duration) * 100;
                    const isSelected = effectiveSelectedId === clip.id;

                    // Color themes by clip type
                    let themeClass = "bg-[#1f2937]/90 border-blue-500/40 text-blue-200";
                    if (clip.type === "text") {
                      themeClass = "bg-purple-950/70 border-purple-500/50 text-purple-200";
                    } else if (clip.type === "video") {
                      themeClass = "bg-emerald-950/70 border-emerald-500/40 text-emerald-200";
                    } else if (clip.type === "audio") {
                      themeClass = "bg-teal-950/70 border-teal-500/40 text-teal-200";
                    } else if (clip.type === "shape" || clip.type === "sticker") {
                      themeClass = "bg-amber-950/70 border-amber-500/40 text-amber-200";
                    }

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectClip(clip);
                          onSeek(clip.start);
                        }}
                        onMouseDown={(e) => {
                          // Ignore if clicking on trim handles
                          if ((e.target as HTMLElement).dataset.handle) return;
                          setDragState({
                            clipId: clip.id,
                            mode: "move",
                            initialMouseX: e.clientX,
                            initialStart: clip.start,
                            initialDuration: clip.duration,
                            trackIndex: track.index,
                          });
                        }}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${Math.max(1, widthPercent)}%`,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded-xl border px-2 flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${themeClass} ${
                          isSelected
                            ? "border-[#34D399] ring-2 ring-[#34D399]/40 shadow-lg shadow-[#34D399]/20 z-10"
                            : "hover:border-white/30"
                        }`}
                      >
                        {/* Left Trim Handle */}
                        <div
                          data-handle="left"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDragState({
                              clipId: clip.id,
                              mode: "trim-left",
                              initialMouseX: e.clientX,
                              initialStart: clip.start,
                              initialDuration: clip.duration,
                              trackIndex: track.index,
                            });
                          }}
                          className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-[#34D399] cursor-ew-resize z-20 transition-all rounded-l"
                          title="Drag to trim start"
                        />

                        {/* Clip Content Details */}
                        <div className="flex items-center justify-between text-[10px] font-mono font-medium truncate pointer-events-none mt-0.5">
                          <span className="truncate">{clip.name}</span>
                          <span className="text-[9px] text-[#34D399] font-bold shrink-0 ml-1">
                            {clip.duration.toFixed(1)}s
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 truncate pointer-events-none mb-0.5">
                          <span className="truncate">{clip.text || clip.sourceAsset || clip.type}</span>
                          <span className="text-zinc-500 shrink-0">
                            {clip.start.toFixed(1)}s
                          </span>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          data-handle="right"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDragState({
                              clipId: clip.id,
                              mode: "trim-right",
                              initialMouseX: e.clientX,
                              initialStart: clip.start,
                              initialDuration: clip.duration,
                              trackIndex: track.index,
                            });
                          }}
                          className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-[#34D399] cursor-ew-resize z-20 transition-all rounded-r"
                          title="Drag to trim end"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
