"use client";

import React, { useState } from "react";
import { CutDecision, formatSMPTE } from "@/types";
import {
  Play,
  Pause,
  Scissors,
  MousePointer,
  Magnet,
  Layers,
  Volume2,
  Lock,
  Sparkles,
  Tv
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

  // Track lock & mute controls
  const [t0Locked, setT0Locked] = useState(false);
  const [t1Locked, setT1Locked] = useState(false);
  const [t2Locked, setT2Locked] = useState(false);
  const [t3Muted, setT3Muted] = useState(false);

  const duration = totalDuration > 0 ? totalDuration : 12.0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // Generate SMPTE ticks every 1 second
  const tickCount = Math.floor(duration);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i);

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-[6px] overflow-hidden flex flex-col h-full select-none">
      {/* 1. Top HyperFrames Studio Toolbar (34px height) */}
      <div className="h-[34px] min-h-[34px] px-3 border-b border-[#2a2a2a] bg-[#18181b] flex items-center justify-between shrink-0">
        {/* Left: Transport + Tool Palettes */}
        <div className="flex items-center gap-2.5">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="w-6 h-6 rounded bg-[#222222] hover:bg-[#2c2c2c] text-white flex items-center justify-center transition-all border border-[#3a3a3a]"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 text-emerald-400" />
            ) : (
              <Play className="w-3 h-3 text-zinc-200 fill-current ml-0.5" />
            )}
          </button>

          {/* SMPTE Timecode Counter */}
          <div className="font-timecode text-xs px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-zinc-200 flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">{formatSMPTE(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-500">{formatSMPTE(duration)}</span>
          </div>

          {/* Edit Tools (Select, Razor, Snap) */}
          <div className="flex items-center bg-[#0a0a0a] p-0.5 rounded border border-[#2a2a2a] gap-0.5">
            <button
              onClick={() => setActiveTool("pointer")}
              className={`p-1 rounded text-xs transition-colors ${
                activeTool === "pointer"
                  ? "bg-[#222222] text-emerald-400 border border-[#3a3a3a]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Selection Tool (V)"
            >
              <MousePointer className="w-3 h-3" strokeWidth={1.6} />
            </button>
            <button
              onClick={() => setActiveTool("razor")}
              className={`p-1 rounded text-xs transition-colors ${
                activeTool === "razor"
                  ? "bg-[#222222] text-emerald-400 border border-[#3a3a3a]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Razor Cut (C)"
            >
              <Scissors className="w-3 h-3" strokeWidth={1.6} />
            </button>
            <div className="w-px h-3 bg-[#2a2a2a] mx-0.5" />
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`p-1 rounded text-xs transition-colors ${
                snapEnabled ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-400"
              }`}
              title="Magnetic Snapping (S)"
            >
              <Magnet className="w-3 h-3" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* Right: Active Version & Format Badge */}
        <div className="flex items-center gap-2">
          <span className="tech-tag tech-tag-green font-mono font-medium">
            EditVersion v{activeVersionNum}
          </span>
          <span className="tech-tag font-mono text-[9.5px]">
            30 FPS • 1080P
          </span>
        </div>
      </div>

      {/* 2. Main Multitrack Canvas Area with Left Header and Track Lanes */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Headers Column (140px) */}
        <div className="w-[140px] shrink-0 bg-[#141414] border-r border-[#2a2a2a] flex flex-col justify-between z-20">
          {/* Ruler Header Blank */}
          <div className="h-[22px] border-b border-[#2a2a2a] flex items-center px-2 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
            TRACK LANES
          </div>

          {/* T0 Header (Graphics & Kinetic Overlays) */}
          <div className="h-10 border-b border-[#2a2a2a] p-1.5 px-2 flex items-center justify-between bg-[#18181b]/60">
            <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-purple-400" strokeWidth={1.6} />
              T0 Graphics
            </span>
            <button
              onClick={() => setT0Locked(!t0Locked)}
              className={`p-0.5 px-1 rounded text-[9px] font-mono ${
                t0Locked ? "bg-rose-950 text-rose-300" : "bg-[#0a0a0a] text-zinc-400 hover:text-zinc-200 border border-[#2a2a2a]"
              }`}
            >
              <Lock className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* T1 Header (Primary Video Storyline) */}
          <div className="h-14 border-b border-[#2a2a2a] p-2 flex flex-col justify-between bg-[#1a1a1e]/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                T1 Video
              </span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">Primary</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setT1Locked(!t1Locked)}
                className={`p-0.5 px-1 rounded text-[9px] font-mono ${
                  t1Locked ? "bg-rose-950 text-rose-300" : "bg-[#0a0a0a] text-zinc-400 hover:text-zinc-200 border border-[#2a2a2a]"
                }`}
                title="Lock Track"
              >
                <Lock className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* T2 Header (B-Roll Cutaways) */}
          <div className="h-10 border-b border-[#2a2a2a] p-1.5 px-2 flex items-center justify-between bg-[#18181b]/60">
            <span className="text-[11px] font-medium text-blue-400 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-blue-400" strokeWidth={1.6} />
              T2 B-Roll
            </span>
            <button
              onClick={() => setT2Locked(!t2Locked)}
              className={`p-0.5 px-1 rounded text-[9px] font-mono ${
                t2Locked ? "bg-rose-950 text-rose-300" : "bg-[#0a0a0a] text-zinc-400 hover:text-zinc-200 border border-[#2a2a2a]"
              }`}
            >
              <Lock className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* T3 Header (Audio Bed) */}
          <div className="h-10 p-1.5 px-2 flex items-center justify-between bg-[#18181b]/60">
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <Volume2 className="w-3 h-3 text-emerald-400" strokeWidth={1.6} />
              T3 Audio
            </span>
            <button
              onClick={() => setT3Muted(!t3Muted)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                t3Muted ? "bg-rose-900 text-white font-bold" : "bg-[#0a0a0a] text-zinc-400 border border-[#2a2a2a]"
              }`}
              title="Mute Track"
            >
              M
            </button>
          </div>
        </div>

        {/* Center Track Lanes & Ruler */}
        <div className="flex-1 overflow-x-auto relative bg-[#0a0a0a] bg-studio-grid flex flex-col justify-between">
          {/* SMPTE Timecode Ruler (22px height) */}
          <div
            className="h-[22px] min-h-[22px] border-b border-[#2a2a2a] relative bg-[#141414] cursor-pointer"
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
                <span className="font-timecode text-[8px] text-zinc-500 mt-0.5">
                  {formatSMPTE(sec).slice(3)}
                </span>
                <div className="w-px h-1.5 bg-[#3a3a3a] mt-auto" />
              </div>
            ))}
          </div>

          {/* Playhead Scrubber Needle */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute top-0 bottom-0 w-[1.5px] bg-[#22c55e] z-30 pointer-events-none transition-all duration-75 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
          >
            <div className="w-2.5 h-2.5 bg-[#22c55e] -ml-[4.5px] top-0 rounded-t-sm" />
          </div>

          {/* TRACK 0: GRAPHICS / KINETIC OVERLAYS */}
          <div className="h-10 border-b border-[#2a2a2a] p-1 relative flex items-center">
            {/* Opening Title Block Preview */}
            <div
              style={{ left: "0%", width: "24%" }}
              className="absolute top-1 bottom-1 rounded bg-purple-950/40 border border-purple-500/40 px-2 flex items-center justify-between text-[10px] text-purple-300 font-mono"
            >
              <span className="truncate">Kinetic Title</span>
              <span className="text-[9px] text-purple-400">0.0s - 2.8s</span>
            </div>

            {/* Outro Freeze Cut Preview */}
            <div
              style={{ left: "75%", width: "25%" }}
              className="absolute top-1 bottom-1 rounded bg-purple-950/40 border border-purple-500/40 px-2 flex items-center justify-between text-[10px] text-purple-300 font-mono"
            >
              <span className="truncate">Beat Freeze Cut</span>
              <span className="text-[9px] text-purple-400">9.5s - 12.0s</span>
            </div>
          </div>

          {/* TRACK 1: PRIMARY VIDEO CUTS */}
          <div
            className="h-14 border-b border-[#2a2a2a] p-1 relative cursor-pointer"
            style={{ display: "flex", flexDirection: "row", gap: "4px" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(ratio * duration);
            }}
          >
            {decisions.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 font-mono">
                No active cuts. Click &quot;Load Demo Project&quot; to initialize timeline.
              </div>
            ) : (
              decisions.map((cut, idx) => {
                const cutDur = Math.max(0.5, cut.source_out_sec - cut.source_in_sec);
                const widthPercent = (cutDur / duration) * 100;
                const isSelected = selectedDecisionId === cut.decision_id;

                return (
                  <div
                    key={cut.decision_id || idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDecision(cut);
                      onSeek(cut.source_in_sec);
                    }}
                    style={{ width: `${widthPercent}%` }}
                    className={`h-full rounded relative overflow-hidden transition-all flex flex-col justify-between p-1.5 border ${
                      isSelected
                        ? "bg-[#1f2937] border-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.3)] z-10"
                        : "bg-[#18181b] border-[#2a2a2a] hover:border-zinc-500 hover:bg-[#202024]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-zinc-200 truncate">
                        {cut.order}. {cut.narrative_beat}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 font-semibold">
                        {cutDur.toFixed(1)}s
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[8.5px] font-mono text-zinc-400 truncate">
                      <span className="truncate">{cut.source_asset}</span>
                      <span className="text-zinc-500 shrink-0">
                        {cut.source_in_sec.toFixed(1)}s
                      </span>
                    </div>

                    {/* Selection bounding handles */}
                    {isSelected && (
                      <>
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-400" />
                        <div className="absolute top-0 bottom-0 right-0 w-1 bg-emerald-400" />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* TRACK 2: B-ROLL CUTAWAYS */}
          <div className="h-10 border-b border-[#2a2a2a] p-1 relative flex items-center">
            {/* Cutaway clip representation */}
            <div
              style={{ left: "26%", width: "22%" }}
              className="absolute top-1 bottom-1 rounded bg-blue-950/40 border border-blue-500/40 px-2 flex items-center justify-between text-[10px] text-blue-300 font-mono"
            >
              <span className="truncate">Product Cutaway</span>
              <span className="text-[9px] text-blue-400">2.6s</span>
            </div>
          </div>

          {/* TRACK 3: AUDIO BED */}
          <div className="h-10 p-1 relative flex items-center bg-[#0d1310]/50">
            <div className="w-full h-full rounded bg-emerald-950/30 border border-emerald-500/20 px-2 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
              <span className="flex items-center gap-1.5 truncate">
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span>Master Audio Bed (LUFS Normalized -14dB)</span>
              </span>
              <span className="text-[9px] text-emerald-500">
                0.0s - {duration.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
