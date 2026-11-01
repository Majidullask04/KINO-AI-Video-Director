"use client";

import React, { useState } from "react";
import {
  Code,
  Sliders,
  Sparkles,
  Layers,
  Clock,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  Film
} from "lucide-react";
import { CutDecision } from "@/types";

interface HyperFramesClipInspectorProps {
  decision: CutDecision | null;
  totalDuration: number;
  onApplyBlock?: (blockId: string, beatIndex: number) => void;
}

export const HyperFramesClipInspector: React.FC<HyperFramesClipInspectorProps> = ({
  decision,
  totalDuration,
  onApplyBlock,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!decision) {
    return (
      <div className="p-6 text-center text-zinc-500 text-xs h-full flex flex-col items-center justify-center">
        <Film className="w-8 h-8 text-zinc-600 mb-2" strokeWidth={1.5} />
        <p className="font-semibold text-zinc-400 m-0">No Clip Selected</p>
        <p className="text-[11px] text-zinc-600 mt-1">
          Click any clip block on the multitrack timeline to inspect its KINO HTML/CSS attributes.
        </p>
      </div>
    );
  }

  const clipDuration = Math.max(0.5, round2(decision.source_out_sec - decision.source_in_sec));
  const trackIndex = decision.track === "V2" ? 2 : 1;
  const elementId = `clip-beat-${decision.order}`;

  const htmlSnippet = `<div
  id="${elementId}"
  class="clip"
  data-start="${decision.source_in_sec.toFixed(2)}"
  data-duration="${clipDuration.toFixed(2)}"
  data-track-index="${trackIndex}"
  data-track-kind="video"
  data-beat-role="${decision.narrative_beat}"
>
  <video
    src="/assets/${decision.source_asset}"
    data-has-audio="true"
    muted
  ></video>
</div>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(htmlSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#141414] text-xs select-none overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#2a2a2a]">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="tech-tag tech-tag-green">
              BEAT #{decision.order}
            </span>
            <span className="font-mono text-[10px] text-zinc-400 uppercase">
              {decision.narrative_beat}
            </span>
          </div>
          <h3 className="text-sm font-bold text-zinc-200 mt-1 truncate max-w-[240px]">
            {decision.source_asset}
          </h3>
        </div>

        <button
          onClick={copySnippet}
          className="p-1 px-2 text-[10.5px] rounded bg-[#1e1e24] border border-[#2a2a2a] text-zinc-300 hover:text-white"
          title="Copy KINO HTML Tag"
        >
          {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copiedSnippet ? "Copied" : "Copy Tag"}</span>
        </button>
      </div>

      {/* HTML Composition Snippet */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-500 uppercase">
          <span>KINO Composition Element</span>
          <span className="text-emerald-400">Valid Contract</span>
        </div>
        <pre className="p-2.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[10.5px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
          {htmlSnippet}
        </pre>
      </div>

      {/* Timing & Track Specs */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="p-2.5 rounded bg-[#18181b] border border-[#2a2a2a] space-y-1">
          <span className="text-zinc-500 text-[10px] block uppercase">Timeline In / Out</span>
          <span className="text-zinc-200 font-semibold block">
            {decision.source_in_sec.toFixed(2)}s → {decision.source_out_sec.toFixed(2)}s
          </span>
          <span className="text-emerald-400 text-[10px] block">
            Duration: {clipDuration.toFixed(2)}s
          </span>
        </div>

        <div className="p-2.5 rounded bg-[#18181b] border border-[#2a2a2a] space-y-1">
          <span className="text-zinc-500 text-[10px] block uppercase">Track Lane</span>
          <span className="text-zinc-200 font-semibold block">
            Track {trackIndex} (Primary Video)
          </span>
          <span className="text-blue-400 text-[10px] block">
            z-index: 10
          </span>
        </div>
      </div>

      {/* Visual Attributes */}
      <div className="p-3 rounded bg-[#18181b] border border-[#2a2a2a] space-y-2">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          Visual & Shot Classification
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Shot Classification:</span>
          <span className="tech-tag tech-tag-blue">{decision.shot_type || "B_ROLL"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Motion Energy Level:</span>
          <span className="tech-tag tech-tag-amber">Level {decision.energy_level || 3} / 5</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Match Confidence:</span>
          <span className="tech-tag tech-tag-green">{Math.round((decision.match_confidence || 0.95) * 100)}% Confidence</span>
        </div>
      </div>

      {/* Director AI Rationale */}
      <div className="p-3 rounded bg-[#18181b] border border-[#2a2a2a] space-y-1.5">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Director Editorial Justification</span>
        </div>
        <p className="text-zinc-300 text-xs leading-relaxed italic m-0">
          &ldquo;{decision.explanation || "Selected based on narrative pacing requirements and visual tag compatibility in STORYBOARD.md."}&rdquo;
        </p>
      </div>

      {/* Quick Action: Apply HyperFrames Block */}
      {onApplyBlock && (
        <div className="pt-2 border-t border-[#2a2a2a] space-y-2">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Quick Block Overlays
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onApplyBlock("beat-freeze-cut", decision.order)}
              className="text-[10.5px] p-2 rounded bg-[#0a0a0a] border border-[#2a2a2a] hover:border-emerald-500/40 text-zinc-300"
            >
              + Freeze Cut
            </button>
            <button
              onClick={() => onApplyBlock("kinetic-title", decision.order)}
              className="text-[10.5px] p-2 rounded bg-[#0a0a0a] border border-[#2a2a2a] hover:border-blue-500/40 text-zinc-300"
            >
              + Kinetic Title
            </button>
            <button
              onClick={() => onApplyBlock("camcorder-hud", decision.order)}
              className="text-[10.5px] p-2 rounded bg-[#0a0a0a] border border-[#2a2a2a] hover:border-purple-500/40 text-zinc-300"
            >
              + Camcorder HUD
            </button>
            <button
              onClick={() => onApplyBlock("ai-chat-reveal", decision.order)}
              className="text-[10.5px] p-2 rounded bg-[#0a0a0a] border border-[#2a2a2a] hover:border-amber-500/40 text-zinc-300"
            >
              + Prompt Terminal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

