"use client";

import React from "react";
import { CutDecision } from "@/types";
import { Play, Pause, Scissors, Sparkles, Layers, Volume2 } from "lucide-react";

interface StudioTimelineProps {
  decisions: CutDecision[];
  selectedDecisionId: string | null;
  onSelectDecision: (d: CutDecision) => void;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
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
}) => {
  const duration = totalDuration > 0 ? totalDuration : 12.0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // Determine beat color
  const getBeatColor = (role: string, isSelected: boolean) => {
    const r = role.toLowerCase();
    if (r.includes("hook")) {
      return isSelected
        ? "bg-violet-600/50 border-violet-400 text-violet-100 shadow-lg shadow-violet-900/40"
        : "bg-violet-950/60 border-violet-800/80 text-violet-200 hover:border-violet-600";
    } else if (r.includes("setup")) {
      return isSelected
        ? "bg-cyan-600/50 border-cyan-400 text-cyan-100 shadow-lg shadow-cyan-900/40"
        : "bg-cyan-950/60 border-cyan-800/80 text-cyan-200 hover:border-cyan-600";
    } else if (r.includes("demo")) {
      return isSelected
        ? "bg-emerald-600/50 border-emerald-400 text-emerald-100 shadow-lg shadow-emerald-900/40"
        : "bg-emerald-950/60 border-emerald-800/80 text-emerald-200 hover:border-emerald-600";
    } else {
      return isSelected
        ? "bg-amber-600/50 border-amber-400 text-amber-100 shadow-lg shadow-amber-900/40"
        : "bg-amber-950/60 border-amber-800/80 text-amber-200 hover:border-amber-600";
    }
  };

  return (
    <div className="bg-[#121217] border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col shadow-xl">
      {/* Timeline Controls Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all shadow-md"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
          <div className="text-xs font-mono text-zinc-300">
            <span className="text-violet-400 font-bold">{currentTime.toFixed(2)}s</span>
            <span className="text-zinc-600 mx-1">/</span>
            <span className="text-zinc-500">{duration.toFixed(2)}s</span>
          </div>
          <span className="text-[11px] text-zinc-500 hidden sm:inline-block">
            {decisions.length} FalkorDB CutDecisions Synced
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mr-1">
            Tracks: V1 (Primary) • V2 (B-Roll) • A1 (Audio)
          </span>
          <div className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-300 border border-zinc-700/60 flex items-center gap-1">
            <Scissors className="w-3 h-3 text-violet-400" />
            <span>Interactive Cuts</span>
          </div>
        </div>
      </div>

      {/* Multitrack Workspace */}
      <div className="p-3 relative select-none overflow-x-auto">
        {/* Time Ruler */}
        <div className="h-6 relative border-b border-zinc-800/60 mb-2 flex items-center text-[10px] font-mono text-zinc-400">
          <div className="w-20 shrink-0 font-medium text-zinc-400 text-[9px] uppercase">RULER (SEC)</div>
          <div className="flex-1 relative h-full">
            {[0, 2, 4, 6, 8, 10, 12].map((sec) => (
              <div
                key={sec}
                style={{ left: `${(sec / duration) * 100}%` }}
                className="absolute top-0 flex flex-col items-center"
              >
                <span className="leading-none">{sec}s</span>
                <div className="w-px h-1.5 bg-zinc-700 mt-0.5"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Playhead Scrubber Line */}
        <div
          style={{ left: `calc(5rem + (100% - 5rem) * ${progressPercent / 100})` }}
          className="absolute top-3 bottom-3 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75"
        >
          <div className="w-2.5 h-2.5 bg-rose-500 -ml-1 -top-1 rounded-full shadow-lg"></div>
        </div>

        {/* TRACK V1: PRIMARY NARRATIVE */}
        <div className="flex items-center mb-2">
          <div className="w-20 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-violet-500"></span>
            <span>Track V1</span>
          </div>
          <div
            className="flex-1 h-16 bg-zinc-950/70 rounded-lg p-1 border border-zinc-800/80 flex gap-1 relative cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(ratio * duration);
            }}
          >
            {decisions.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">
                No active EditVersion cuts loaded. Click &quot;Synthesize Edit&quot; or &quot;1-Click Demo Seed&quot;.
              </div>
            ) : (
              decisions.map((cut) => {
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
                    className={`h-full rounded-md border p-1.5 flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${getBeatColor(
                      cut.narrative_beat,
                      isSelected
                    )}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                        #{cut.order} {cut.narrative_beat}
                      </span>
                      <span className="text-[9px] font-mono opacity-80 shrink-0">
                        {cutDur.toFixed(1)}s
                      </span>
                    </div>

                    <div className="text-[10px] truncate text-zinc-300 font-mono">
                      {cut.source_asset}
                    </div>

                    <div className="flex items-center justify-between text-[9px]">
                      <span className="opacity-70 font-mono">
                        [{cut.source_in_sec.toFixed(1)}s - {cut.source_out_sec.toFixed(1)}s]
                      </span>
                      <span className="px-1 rounded bg-black/40 text-[8px] font-mono">
                        ⚡ {cut.energy_level}/5
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TRACK V2: B-ROLL OVERLAYS */}
        <div className="flex items-center mb-2">
          <div className="w-20 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Track V2</span>
          </div>
          <div className="flex-1 h-9 bg-zinc-950/50 rounded-lg p-1 border border-zinc-800/60 flex gap-1 relative">
            <div
              style={{ left: "25%", width: "25%" }}
              className="absolute top-1 bottom-1 bg-indigo-950/80 border border-indigo-700/60 rounded px-2 flex items-center justify-between text-[9px] text-indigo-300"
            >
              <span className="truncate">B-Roll Cutaway (Terminal Code)</span>
              <span className="font-mono text-[8px]">2.5s</span>
            </div>
            <div
              style={{ left: "75%", width: "20%" }}
              className="absolute top-1 bottom-1 bg-indigo-950/80 border border-indigo-700/60 rounded px-2 flex items-center justify-between text-[9px] text-indigo-300"
            >
              <span className="truncate">B-Roll Fast Motion</span>
              <span className="font-mono text-[8px]">2.0s</span>
            </div>
          </div>
        </div>

        {/* TRACK A1: AUDIO & DIALOGUE */}
        <div className="flex items-center">
          <div className="w-20 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Track A1</span>
          </div>
          <div className="flex-1 h-8 bg-zinc-950/50 rounded-lg px-2 border border-zinc-800/60 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
            <span>♫ Upbeat Synthesizer & Dialogue Sync (Normalized -14 LUFS)</span>
            <span className="text-[9px] text-zinc-500">48kHz / Stereo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
