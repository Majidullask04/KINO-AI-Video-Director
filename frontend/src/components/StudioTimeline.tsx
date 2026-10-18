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
  ChevronRight
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

  // Track state controls
  const [v1Locked, setV1Locked] = useState(false);
  const [v2Locked, setV2Locked] = useState(false);
  const [a1Muted, setA1Muted] = useState(false);

  const duration = totalDuration > 0 ? totalDuration : 12.0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // Generate ticks for SMPTE ruler (every 1.0s)
  const tickCount = Math.floor(duration);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i);

  return (
    <div className="bg-[#0c0c0e] border border-[#222228] rounded-[6px] overflow-hidden flex flex-col h-full select-none">
      {/* 1. Top NLE Timeline Toolbar (34px height) */}
      <div className="h-[34px] min-h-[34px] px-3 border-b border-[#222228] bg-[#121215] flex items-center justify-between shrink-0">
        {/* Left: Transport + Tool Palettes */}
        <div className="flex items-center gap-2.5">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="w-6 h-6 rounded bg-[#18181c] hover:bg-[#222228] text-white flex items-center justify-center transition-all border border-[#2c2c35]"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 text-amber-400" />
            ) : (
              <Play className="w-3 h-3 text-zinc-200 fill-current ml-0.5" />
            )}
          </button>

          {/* SMPTE Timecode Counter */}
          <div className="font-timecode text-xs px-2 py-0.5 rounded bg-[#09090b] border border-[#222228] text-zinc-200 flex items-center gap-1.5">
            <span className="text-amber-400 font-bold">{formatSMPTE(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-500">{formatSMPTE(duration)}</span>
          </div>

          {/* Edit Tools (Select, Razor, Snap) */}
          <div className="flex items-center bg-[#09090b] p-0.5 rounded border border-[#222228] gap-0.5">
            <button
              onClick={() => setActiveTool("pointer")}
              className={`p-1 rounded text-xs transition-colors ${
                activeTool === "pointer"
                  ? "bg-[#18181c] text-amber-400 border border-[#2c2c35]"
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
                  ? "bg-[#18181c] text-amber-400 border border-[#2c2c35]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Razor Blade Cut (C)"
            >
              <Scissors className="w-3 h-3" strokeWidth={1.6} />
            </button>
            <div className="w-px h-3 bg-[#222228] mx-0.5" />
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`p-1 rounded text-xs transition-colors ${
                snapEnabled ? "text-amber-400" : "text-zinc-500 hover:text-zinc-400"
              }`}
              title="Magnetic Snapping (S)"
            >
              <Magnet className="w-3 h-3" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* Right: Active Version Badge */}
        <div className="flex items-center gap-2">
          <span className="tech-tag tech-tag-amber font-mono font-medium">
            EditVersion v{activeVersionNum}
          </span>
        </div>
      </div>

      {/* 2. Main Multitrack Canvas Area with Left Header and Right VU Meter */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Headers Column (140px) */}
        <div className="w-[140px] shrink-0 bg-[#0c0c0e] border-r border-[#222228] flex flex-col justify-between z-20">
          {/* Ruler Header Blank */}
          <div className="h-[22px] border-b border-[#222228] flex items-center px-2 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
            TRACKS
          </div>

          {/* V1 Header */}
          <div className="h-16 border-b border-[#222228] p-2 flex flex-col justify-between bg-[#121215]/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Track V1
              </span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">Primary</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setV1Locked(!v1Locked)}
                className={`p-0.5 px-1 rounded text-[9px] font-mono ${
                  v1Locked ? "bg-rose-950 text-rose-300" : "bg-[#09090b] text-zinc-400 hover:text-zinc-200 border border-[#222228]"
                }`}
                title="Lock Track"
              >
                <Lock className="w-2.5 h-2.5" />
              </button>
              <button
                className="px-1.5 py-0.5 rounded bg-[#09090b] text-[9px] font-mono text-zinc-400 hover:text-zinc-200 border border-[#222228]"
                title="Solo Track"
              >
                S
              </button>
            </div>
          </div>

          {/* V2 Header */}
          <div className="h-10 border-b border-[#222228] p-2 flex items-center justify-between bg-[#101013]/60">
            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-zinc-400" strokeWidth={1.6} />
              Track V2
            </span>
            <button
              onClick={() => setV2Locked(!v2Locked)}
              className={`p-0.5 px-1 rounded text-[9px] font-mono ${
                v2Locked ? "bg-rose-950 text-rose-300" : "bg-[#09090b] text-zinc-400 hover:text-zinc-200 border border-[#222228]"
              }`}
            >
              <Lock className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* A1 Header */}
          <div className="h-12 p-2 flex items-center justify-between bg-[#101013]/60">
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <Volume2 className="w-3 h-3 text-emerald-400" strokeWidth={1.6} />
              Track A1
            </span>
            <button
              onClick={() => setA1Muted(!a1Muted)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                a1Muted ? "bg-rose-900 text-white font-bold" : "bg-[#09090b] text-zinc-400 border border-[#222228]"
              }`}
              title="Mute Track"
            >
              M
            </button>
          </div>
        </div>

        {/* Center Track Lanes & Ruler */}
        <div className="flex-1 overflow-x-auto relative bg-[#09090b] bg-studio-grid flex flex-col justify-between">
          {/* 3. SMPTE Timecode Ruler (22px height) */}
          <div
            className="h-[22px] min-h-[22px] border-b border-[#222228] relative bg-[#0c0c0e] cursor-pointer"
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
                <div className="w-px h-1.5 bg-[#2b2b33] mt-auto" />
              </div>
            ))}
          </div>

          {/* 4. Playhead Needle (Crisp 1.5px vertical Amber line with triangle cap) */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute top-0 bottom-0 w-[1.5px] bg-[#f59e0b] z-30 pointer-events-none transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          >
            {/* Top Triangle Cap */}
            <div className="w-2.5 h-2.5 bg-[#f59e0b] -ml-[4.5px] top-0 clip-path-playhead rounded-t-sm" />
          </div>

          {/* 5. TRACK V1: PRIMARY STORYLINE CUTS */}
          <div
            className="h-16 border-b border-[#222228] p-1 relative cursor-pointer"
            style={{ display: "flex", flexDirection: "row", gap: "6px", overflowX: "auto" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(ratio * duration);
            }}
          >
            {decisions.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 font-mono">
                No active cuts. Click &quot;Load Sample Production&quot; to build timeline from FalkorDB.
              </div>
            ) : (
              decisions.map((cut, idx) => {
                const cutDur = Math.max(0.5, cut.source_out_sec - cut.source_in_sec);
                const widthPercent = (cutDur / duration) * 100;
                const isSelected = selectedDecisionId === cut.decision_id;

                return (
                  <div
                    key={cut.decision_id}
                    style={{
                      width: `${widthPercent}%`,
                      background: "#18181F",
                      border: `1px solid ${isSelected ? "#F59E0B" : "#2E2E3A"}`,
                      borderLeft: "3px solid #F59E0B",
                      borderRadius: "4px",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDecision(cut);
                      onSeek(cut.source_in_sec);
                    }}
                    className="h-full p-1.5 flex flex-col justify-between transition-all relative overflow-hidden group cursor-pointer"
                  >
                    {/* Clip Header: Order + Beat Role */}
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[10px] font-semibold uppercase tracking-wider truncate text-[#f4f4f6]">
                        {idx + 1 < 10 ? `0${idx + 1}` : idx + 1} {cut.narrative_beat.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-timecode font-medium text-zinc-400 shrink-0">
                        {cutDur.toFixed(1)}s
                      </span>
                    </div>

                    {/* Filename */}
                    <div className="text-[9px] font-mono text-zinc-400 truncate z-10">
                      {cut.source_asset}
                    </div>

                    {/* Bottom Meta: In/Out + Match Score */}
                    <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 z-10">
                      <span>[{cut.source_in_sec.toFixed(1)}s–{cut.source_out_sec.toFixed(1)}s]</span>
                      <span className="tech-tag tech-tag-emerald text-[8px] px-1 py-0">
                        {Math.round(cut.match_confidence * 100)}% Match
                      </span>
                    </div>

                    {/* Transition Chevron */}
                    {idx < decisions.length - 1 && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-black/50 rounded-l flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-2.5 h-2.5 text-zinc-400" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 6. TRACK V2: SEMANTIC B-ROLL OVERLAYS */}
          <div className="h-10 border-b border-[#222228] p-1 flex relative">
            <div
              style={{ left: "25%", width: "25%", background: "#141418", border: "1px solid #26262E", borderRadius: "3px" }}
              className="absolute top-1 bottom-1 px-2 flex items-center justify-between text-[9px] text-zinc-300"
            >
              <span className="truncate font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                OVERLAY: CODE_CLOSEUP
              </span>
              <span className="font-mono text-[8px] text-zinc-500">3.0s</span>
            </div>

            <div
              style={{ left: "75%", width: "20%", background: "#141418", border: "1px solid #26262E", borderRadius: "3px" }}
              className="absolute top-1 bottom-1 px-2 flex items-center justify-between text-[9px] text-zinc-300"
            >
              <span className="truncate font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                OVERLAY: BROLL_PACING
              </span>
              <span className="font-mono text-[8px] text-zinc-500">2.5s</span>
            </div>
          </div>

          {/* 7. TRACK A1: AUDIO & WAVEFORM */}
          <div className="h-12 p-1 flex items-center relative">
            <div className="w-full h-full bg-[#0d1410] border border-[#1b2b20] rounded-[3px] px-2 flex items-center justify-between overflow-hidden relative">
              {/* Multi-bar SVG Audio Waveform in Muted Emerald */}
              <div className="absolute inset-0 flex items-center justify-around opacity-45 px-2 pointer-events-none">
                {Array.from({ length: 64 }).map((_, i) => {
                  const barH = Math.round(15 + Math.sin(i * 0.35) * 12 + (i % 3) * 5);
                  return (
                    <div
                      key={i}
                      style={{ height: `${barH}px` }}
                      className="w-1 bg-emerald-400 rounded-full"
                    />
                  );
                })}
              </div>

              <div className="relative z-10 flex items-center justify-between w-full text-[9px] font-mono text-emerald-400">
                <span className="flex items-center gap-1">
                  <span>MASTER AUDIO</span>
                  <span className="text-zinc-500">• 48kHz Stereo</span>
                </span>
                <span className="text-zinc-500 font-mono">Master Sync</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right VU Audio Level Meter */}
        <div className="w-6 shrink-0 bg-[#0c0c0e] border-l border-[#222228] p-1 flex flex-col justify-between items-center py-2">
          <span className="text-[7.5px] font-mono text-zinc-500 uppercase">VU</span>
          <div className="w-1.5 flex-1 bg-[#121215] rounded-full overflow-hidden flex flex-col justify-end my-1 border border-[#222228]">
            <div
              style={{ height: isPlaying ? "68%" : "25%" }}
              className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
            />
          </div>
          <span className="text-[7px] font-mono text-zinc-500">-12</span>
        </div>
      </div>
    </div>
  );
};
