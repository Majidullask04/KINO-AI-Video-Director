"use client";

import React, { useState } from "react";
import { CutDecision, formatSMPTE } from "@/types";
import {
  Play,
  Pause,
  Scissors,
  MousePointer,
  Magnet,
  ZoomIn,
  ZoomOut,
  Layers,
  Volume2,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  Sparkles,
  Radio
} from "lucide-react";

interface StudioTimelineProps {
  decisions: CutDecision[];
  selectedDecisionId: string | null;
  onSelectDecision: (d: CutDecision) => void;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeVersionNum?: number;
}

export const StudioTimeline: React.FC<StudioTimelineProps> = ({
  decisions,
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
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Track state controls
  const [v1Locked, setV1Locked] = useState(false);
  const [v2Locked, setV2Locked] = useState(false);
  const [a1Muted, setA1Muted] = useState(false);

  const duration = totalDuration > 0 ? totalDuration : 12.0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // Beat aesthetic palette
  const getBeatStyle = (role: string, isSelected: boolean) => {
    const r = role.toLowerCase();
    if (r.includes("hook")) {
      return isSelected
        ? "bg-gradient-to-r from-violet-600/70 to-indigo-600/70 border-violet-400 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
        : "bg-gradient-to-r from-violet-950/80 to-indigo-950/80 border-violet-700/60 text-violet-200 hover:border-violet-500";
    } else if (r.includes("setup")) {
      return isSelected
        ? "bg-gradient-to-r from-cyan-600/70 to-blue-600/70 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]"
        : "bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-700/60 text-cyan-200 hover:border-cyan-500";
    } else if (r.includes("demo")) {
      return isSelected
        ? "bg-gradient-to-r from-emerald-600/70 to-teal-600/70 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
        : "bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border-emerald-700/60 text-emerald-200 hover:border-emerald-500";
    } else {
      return isSelected
        ? "bg-gradient-to-r from-amber-600/70 to-orange-600/70 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]"
        : "bg-gradient-to-r from-amber-950/80 to-orange-950/80 border-amber-700/60 text-amber-200 hover:border-amber-500";
    }
  };

  // Generate ticks for SMPTE ruler
  const tickCount = Math.floor(duration);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i);

  return (
    <div className="bg-[#0b0b12] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col h-full shadow-2xl relative select-none">
      {/* Top NLE Timeline Toolbar */}
      <div className="px-3 py-2 border-b border-white/[0.06] bg-[#0f0f18] flex items-center justify-between shrink-0">
        {/* Left: Transport + Tool Palettes */}
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all shadow-md shadow-violet-900/40"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* SMPTE Timecode Counter */}
          <div className="font-timecode text-xs px-2.5 py-1 rounded-md bg-[#07070b] border border-white/10 text-zinc-200 flex items-center gap-1.5 shadow-inner">
            <span className="text-violet-400 font-bold">{formatSMPTE(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-500">{formatSMPTE(duration)}</span>
          </div>

          {/* Edit Tools */}
          <div className="flex items-center bg-[#07070b] p-0.5 rounded-lg border border-white/10 gap-0.5">
            <button
              onClick={() => setActiveTool("pointer")}
              className={`p-1 rounded ${
                activeTool === "pointer"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Selection Pointer (V)"
            >
              <MousePointer className="w-3 h-3" />
            </button>
            <button
              onClick={() => setActiveTool("razor")}
              className={`p-1 rounded ${
                activeTool === "razor"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Razor Blade Cut (C)"
            >
              <Scissors className="w-3 h-3" />
            </button>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`p-1 rounded ${
                snapEnabled ? "text-amber-400" : "text-zinc-500 hover:text-zinc-400"
              }`}
              title="Magnetic Snapping (S)"
            >
              <Magnet className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Zoom + Active Version Badge */}
        <div className="flex items-center gap-3">
          {/* Zoom Slider Controls */}
          <div className="flex items-center gap-1 text-zinc-500">
            <button
              onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.25))}
              className="p-1 hover:text-zinc-300"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] text-zinc-400">{zoomLevel * 100}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(2.5, zoomLevel + 0.25))}
              className="p-1 hover:text-zinc-300"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/80 font-mono font-bold flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            EditVersion v{activeVersionNum}
          </span>
        </div>
      </div>

      {/* Main Multitrack Canvas Area with Left Header and Right VU Meter */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Headers Column (160px) */}
        <div className="w-40 shrink-0 bg-[#0c0c14] border-r border-white/[0.06] flex flex-col justify-between z-20">
          {/* Ruler Header Blank */}
          <div className="h-6 border-b border-white/[0.06] flex items-center px-2 text-[9px] font-mono text-zinc-400 uppercase">
            TRACKS
          </div>

          {/* V1 Header */}
          <div className="h-16 border-b border-white/[0.06] p-2 flex flex-col justify-between bg-[#10101a]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]" />
                Track V1
              </span>
              <span className="text-[9px] font-mono text-zinc-400 uppercase">Primary</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setV1Locked(!v1Locked)}
                className={`p-1 rounded text-[10px] ${
                  v1Locked ? "bg-rose-950 text-rose-300" : "bg-black/40 text-zinc-400 hover:text-zinc-200"
                }`}
                title="Lock Track"
              >
                <Lock className="w-2.5 h-2.5" />
              </button>
              <button
                className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-zinc-400 hover:text-zinc-200"
                title="Solo Track"
              >
                S
              </button>
            </div>
          </div>

          {/* V2 Header */}
          <div className="h-10 border-b border-white/[0.06] p-2 flex items-center justify-between bg-[#0e0e18]/40">
            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-indigo-400" />
              Track V2
            </span>
            <button
              onClick={() => setV2Locked(!v2Locked)}
              className={`p-1 rounded text-[10px] ${
                v2Locked ? "bg-rose-950 text-rose-300" : "bg-black/40 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Lock className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* A1 Header */}
          <div className="h-12 p-2 flex items-center justify-between bg-[#0e0e18]/40">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <Volume2 className="w-3 h-3 text-emerald-400" />
              Track A1
            </span>
            <button
              onClick={() => setA1Muted(!a1Muted)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                a1Muted ? "bg-rose-900 text-white font-bold" : "bg-black/40 text-zinc-400"
              }`}
              title="Mute Track"
            >
              M
            </button>
          </div>
        </div>

        {/* Center Track Lanes & Ruler */}
        <div className="flex-1 overflow-x-auto relative bg-[#07070b] bg-studio-grid flex flex-col justify-between">
          {/* SMPTE Timecode Ruler */}
          <div
            className="h-6 border-b border-white/[0.06] relative bg-[#0a0a10] cursor-pointer"
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
                <span className="font-timecode text-[8px] text-zinc-400 mt-0.5">
                  {formatSMPTE(sec).slice(3)}
                </span>
                <div className="w-px h-1.5 bg-white/20 mt-auto" />
              </div>
            ))}
          </div>

          {/* Red/Violet Draggable Playhead Needle */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75 shadow-[0_0_10px_#f43f5e]"
          >
            {/* Playhead Inverted Cap */}
            <div className="w-3 h-3 bg-rose-500 -ml-[5px] top-0 clip-path-playhead rounded-t-sm shadow-md" />
          </div>

          {/* TRACK V1: PRIMARY STORYLINE CUTS */}
          <div
            className="h-16 border-b border-white/[0.04] p-1 flex gap-1 relative cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(ratio * duration);
            }}
          >
            {decisions.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 font-mono">
                No active cuts. Click &quot;⚡ 1-Click Demo Seed&quot; to build timeline from FalkorDB.
              </div>
            ) : (
              decisions.map((cut, idx) => {
                const cutDur = Math.max(0.5, cut.source_out_sec - cut.source_in_sec);
                const widthPercent = (cutDur / duration) * 100;
                const isSelected = selectedDecisionId === cut.decision_id;

                return (
                  <div
                    key={cut.decision_id}
                    style={{ width: `${widthPercent}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDecision(cut);
                      onSeek(cut.source_in_sec);
                    }}
                    className={`h-full rounded-md border p-1.5 flex flex-col justify-between transition-all relative overflow-hidden group cursor-pointer ${getBeatStyle(
                      cut.narrative_beat,
                      isSelected
                    )}`}
                  >
                    {/* Top Filmstrip Sprockets */}
                    <div className="absolute top-0 inset-x-0 h-1 filmstrip-sprockets opacity-40" />

                    {/* Clip Header: Order + Beat Role */}
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1">
                        #{cut.order} {cut.narrative_beat}
                      </span>
                      <span className="text-[9px] font-timecode font-medium opacity-90 shrink-0">
                        {cutDur.toFixed(1)}s
                      </span>
                    </div>

                    {/* Filename */}
                    <div className="text-[9px] font-mono text-zinc-300 truncate z-10">
                      {cut.source_asset}
                    </div>

                    {/* Bottom Meta: In/Out + Match Score */}
                    <div className="flex items-center justify-between text-[8px] font-mono opacity-80 z-10">
                      <span>[{cut.source_in_sec.toFixed(1)}s–{cut.source_out_sec.toFixed(1)}s]</span>
                      <span className="px-1 rounded bg-black/50 text-white font-bold">
                        {Math.round(cut.match_confidence * 100)}% Match
                      </span>
                    </div>

                    {/* J-Cut / L-Cut Transition Chevron indicator on right */}
                    {idx < decisions.length - 1 && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-black/40 rounded-l flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-2.5 h-2.5 text-zinc-300" />
                      </div>
                    )}

                    {/* Bottom Filmstrip Sprockets */}
                    <div className="absolute bottom-0 inset-x-0 h-1 filmstrip-sprockets opacity-40" />

                    {/* Active Selected Underline Specular */}
                    {isSelected && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white shadow-[0_0_8px_#ffffff]" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* TRACK V2: SEMANTIC B-ROLL OVERLAYS */}
          <div className="h-10 border-b border-white/[0.04] p-1 flex relative">
            <div
              style={{ left: "25%", width: "25%" }}
              className="absolute top-1 bottom-1 bg-gradient-to-r from-indigo-950/90 to-violet-950/90 border border-indigo-500/50 rounded-md px-2 flex items-center justify-between text-[9px] text-indigo-300 shadow-sm"
            >
              <span className="truncate font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Overlay: #code_closeup
              </span>
              <span className="font-mono text-[8px] text-indigo-400">3.0s</span>
            </div>

            <div
              style={{ left: "75%", width: "20%" }}
              className="absolute top-1 bottom-1 bg-gradient-to-r from-indigo-950/90 to-violet-950/90 border border-indigo-500/50 rounded-md px-2 flex items-center justify-between text-[9px] text-indigo-300 shadow-sm"
            >
              <span className="truncate font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Overlay: #fast_broll
              </span>
              <span className="font-mono text-[8px] text-indigo-400">2.5s</span>
            </div>
          </div>

          {/* TRACK A1: AUDIO & WAVEFORM */}
          <div className="h-12 p-1 flex items-center relative">
            <div className="w-full h-full bg-[#091510] border border-emerald-900/40 rounded-md px-2 flex items-center justify-between overflow-hidden relative">
              {/* Simulated SVG Audio Waveform */}
              <div className="absolute inset-0 flex items-center justify-around opacity-40 px-2 pointer-events-none">
                {Array.from({ length: 60 }).map((_, i) => {
                  const barH = 20 + Math.sin(i * 0.4) * 15 + (i % 3) * 6;
                  return (
                    <div
                      key={i}
                      style={{ height: `${barH}%` }}
                      className="w-1 bg-emerald-400 rounded-full"
                    />
                  );
                })}
              </div>

              <span className="text-[10px] text-emerald-300 font-mono z-10 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Normalized Mix (-14 LUFS • 48kHz Master)
              </span>
              <span className="text-[9px] font-mono text-emerald-500 z-10">Stereo V1 Synced</span>
            </div>
          </div>
        </div>

        {/* Right Mini Stereo VU Meter (36px) */}
        <div className="w-9 shrink-0 bg-[#0c0c14] border-l border-white/[0.06] p-1 flex flex-col justify-between items-center text-[8px] font-mono text-zinc-400">
          <div className="text-[7px]">VU</div>
          <div className="flex gap-1 h-32 items-end">
            {/* L Channel */}
            <div className="w-2 h-full bg-black/60 rounded flex flex-col justify-end p-0.5 overflow-hidden">
              <div
                className={`w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 rounded ${
                  isPlaying ? "animate-vu-active" : "h-[30%]"
                }`}
              />
            </div>
            {/* R Channel */}
            <div className="w-2 h-full bg-black/60 rounded flex flex-col justify-end p-0.5 overflow-hidden">
              <div
                className={`w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 rounded ${
                  isPlaying ? "animate-vu-active" : "h-[35%]"
                }`}
                style={{ animationDelay: "0.15s" }}
              />
            </div>
          </div>
          <div className="text-[7px] text-zinc-400">-12dB</div>
        </div>
      </div>
    </div>
  );
};
