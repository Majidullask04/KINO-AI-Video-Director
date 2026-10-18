"use client";

import React, { useState } from "react";
import { CutDecision, GraphState, QueryLog } from "@/types";
import {
  Network,
  Terminal,
  Clock,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Layers,
  Database,
  ArrowRight
} from "lucide-react";

interface GraphInspectorProps {
  selectedDecision: CutDecision | null;
  graphState: GraphState | null;
  onRefreshGraph: () => void;
}

export const GraphInspector: React.FC<GraphInspectorProps> = ({
  selectedDecision,
  graphState,
  onRefreshGraph,
}) => {
  const [activeTab, setActiveTab] = useState<"topology" | "cypher">("topology");
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [copiedQueryIndex, setCopiedQueryIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const queryLogs: QueryLog[] = graphState?.query_logs || [];

  const handleCopyCypher = (query: string, idx: number) => {
    navigator.clipboard.writeText(query);
    setCopiedQueryIndex(idx);
    setTimeout(() => setCopiedQueryIndex(null), 2000);
  };

  const selectedCut = selectedDecision;

  return (
    <div className="bg-[#0b0b12] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col h-full shadow-2xl relative select-none">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.06] bg-[#0f0f18] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-violet-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            FalkorDB Graph Inspector
          </h2>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Traceability
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#07070b] p-0.5 rounded-lg border border-white/10 text-[11px]">
          <button
            onClick={() => setActiveTab("topology")}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium ${
              activeTab === "topology"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Network className="w-3 h-3" />
            <span>Multi-Hop Topology</span>
          </button>
          <button
            onClick={() => setActiveTab("cypher")}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium ${
              activeTab === "cypher"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>OpenCypher Queries ({queryLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-3.5 flex-1 overflow-y-auto space-y-3">
        {/* TAB 1: INTERACTIVE SVG MULTI-HOP TOPOLOGY */}
        {activeTab === "topology" && (
          <div className="space-y-3">
            {/* SVG Canvas Frame */}
            <div className="relative w-full h-[250px] rounded-xl bg-[#06060a] border border-white/[0.08] overflow-hidden bg-studio-grid shadow-inner flex flex-col justify-between p-2">
              {/* Top Subgraph Legend */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 bg-[#0c0c14]/90 px-2 py-0.5 rounded-md border border-white/10">
                  <span className="flex items-center gap-1 text-violet-300">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    :StoryBeat
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                    :CutDecision
                  </span>
                  <span className="flex items-center gap-1 text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    :VideoClip
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    :VisualTag
                  </span>
                  <span className="flex items-center gap-1 text-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    [:REJECTED_FOR]
                  </span>
                </div>

                <button
                  onClick={onRefreshGraph}
                  className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 font-mono transition-colors"
                >
                  Reset View
                </button>
              </div>

              {/* Interactive SVG Diagram */}
              <svg viewBox="0 0 680 250" className="w-full h-full">
                <defs>
                  <linearGradient id="edgeViolet" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Animated Bezier Edges */}
                {/* 1. ReferenceVideo -> StoryBeat */}
                <path
                  d="M 100 70 C 150 70, 160 70, 215 70"
                  stroke="#6366f1"
                  strokeWidth="2"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 2. StoryBeat -> VisualTag */}
                <path
                  d="M 255 95 C 255 145, 320 165, 375 165"
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 3. StoryBeat <- CutDecision */}
                <path
                  d="M 375 70 C 320 70, 310 70, 275 70"
                  stroke="url(#edgeViolet)"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 4. CutDecision -> VideoClip */}
                <path
                  d="M 435 70 C 490 70, 500 70, 555 70"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 5. VideoClip -> VisualTag */}
                <path
                  d="M 555 95 C 520 145, 465 165, 435 165"
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 6. Negative Memory Edge: (:VideoClip)-[:REJECTED_FOR]->(:StoryBeat) */}
                <path
                  d="M 555 205 C 410 230, 290 200, 245 95"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  fill="none"
                />

                {/* Edge Text Labels */}
                <text x="155" y="60" fill="#a1a1aa" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:HAS_BEAT]
                </text>
                <text x="325" y="60" fill="#c4b5fd" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:FULFILLS_BEAT]
                </text>
                <text x="495" y="60" fill="#6ee7b7" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:SELECTS_CLIP]
                </text>
                <text x="300" y="148" fill="#fcd34d" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:REQUIRES_TAG]
                </text>
                <text x="510" y="148" fill="#fcd34d" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:HAS_TAG]
                </text>
                <text x="405" y="222" fill="#fda4af" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:REJECTED_FOR (Memory)]
                </text>

                {/* Node 1: ReferenceVideo */}
                <g transform="translate(70, 70)">
                  <circle r="26" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2" />
                  <text y="-3" fill="#e0e7ff" fontSize="9" fontWeight="bold" textAnchor="middle">:Reference</text>
                  <text y="9" fill="#a5b4fc" fontSize="7" textAnchor="middle">12.0s Lock</text>
                </g>

                {/* Node 2: StoryBeat */}
                <g transform="translate(245, 70)">
                  <circle r="28" fill="#2e1065" stroke="#8b5cf6" strokeWidth="2.5" filter="url(#glow)" />
                  <text y="-4" fill="#f3e8ff" fontSize="10" fontWeight="bold" textAnchor="middle">:StoryBeat</text>
                  <text y="9" fill="#d8b4fe" fontSize="8" textAnchor="middle">
                    {selectedCut?.narrative_beat || "HOOK"}
                  </text>
                </g>

                {/* Node 3: CutDecision */}
                <g transform="translate(405, 70)">
                  <rect x="-32" y="-22" width="64" height="44" rx="8" fill="#064e3b" stroke="#10b981" strokeWidth="2.2" filter="url(#glow)" />
                  <text y="-4" fill="#ecfdf5" fontSize="9" fontWeight="bold" textAnchor="middle">:CutDecision</text>
                  <text y="9" fill="#6ee7b7" fontSize="8" textAnchor="middle">
                    {Math.round((selectedCut?.match_confidence || 0.95) * 100)}% Conf
                  </text>
                </g>

                {/* Node 4: Selected VideoClip */}
                <g transform="translate(585, 70)">
                  <circle r="28" fill="#083344" stroke="#06b6d4" strokeWidth="2.5" />
                  <text y="-4" fill="#cffafe" fontSize="9" fontWeight="bold" textAnchor="middle">:VideoClip</text>
                  <text y="9" fill="#67e8f9" fontSize="8" textAnchor="middle">
                    {selectedCut ? `${selectedCut.source_in_sec}s–${selectedCut.source_out_sec}s` : "0.0s–3.0s"}
                  </text>
                </g>

                {/* Node 5: Shared VisualTag */}
                <g transform="translate(405, 165)">
                  <rect x="-40" y="-14" width="80" height="28" rx="14" fill="#451a03" stroke="#f59e0b" strokeWidth="1.6" />
                  <text y="-1" fill="#fef3c7" fontSize="8" fontWeight="bold" textAnchor="middle">:VisualTag</text>
                  <text y="9" fill="#fcd34d" fontSize="7" textAnchor="middle">
                    #{selectedCut?.shot_type || "closeup"}
                  </text>
                </g>

                {/* Node 6: Rejected VideoClip (Negative Memory Edge) */}
                <g transform="translate(585, 200)">
                  <circle r="20" fill="#4c0519" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                  <text y="-2" fill="#ffe4e6" fontSize="8" fontWeight="bold" textAnchor="middle">:Clip</text>
                  <text y="8" fill="#fda4af" fontSize="7" textAnchor="middle">Excluded</text>
                </g>
              </svg>
            </div>

            {/* Traceability Card */}
            {selectedCut ? (
              <div className="p-3 rounded-lg bg-[#0e0e16] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    AI Director Explainability Rationale
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
                    {Math.round(selectedCut.match_confidence * 100)}% Confidence
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed bg-[#07070b] p-2.5 rounded-lg border border-white/[0.05]">
                  {selectedCut.explanation}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-[#07070b] border border-white/[0.04]">
                    <span className="text-[9px] text-zinc-500 uppercase block">Source File</span>
                    <span className="text-zinc-200 truncate block">{selectedCut.source_asset}</span>
                  </div>
                  <div className="p-2 rounded bg-[#07070b] border border-white/[0.04]">
                    <span className="text-[9px] text-zinc-500 uppercase block">Trim Window</span>
                    <span className="text-violet-300 block">
                      {selectedCut.source_in_sec.toFixed(2)}s ➔ {selectedCut.source_out_sec.toFixed(2)}s
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 text-xs">
                Click any timeline cut block to view its complete FalkorDB provenance.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE OPENCYPHER QUERY CONSOLE */}
        {activeTab === "cypher" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Telemetry: Real OpenCypher Queries Executed on FalkorDB (Port 6379)</span>
              <button
                onClick={onRefreshGraph}
                className="text-[10px] text-violet-400 hover:text-violet-300 underline font-mono"
              >
                Refresh Log
              </button>
            </div>

            {queryLogs.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                No queries logged yet. Trigger an edit or revision to inspect live Cypher queries.
              </div>
            ) : (
              <div className="space-y-2">
                {queryLogs.map((log, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedLogIndex(idx)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer font-mono text-xs ${
                      selectedLogIndex === idx
                        ? "bg-[#11111c] border-violet-500/80 shadow-lg shadow-violet-900/20"
                        : "bg-[#08080e] border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-2 pb-1.5 border-b border-white/[0.06]">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <Clock className="w-3 h-3 text-violet-400" />
                        Execution Latency:
                        <strong className="text-emerald-400 font-bold ml-0.5">
                          {log.execution_time_ms} ms
                        </strong>
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Rows: {log.row_count}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCypher(log.query, idx);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          title="Copy Cypher for FalkorDB Browser"
                        >
                          {copiedQueryIndex === idx ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <pre className="text-[11px] text-violet-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {log.query}
                    </pre>

                    {log.params && Object.keys(log.params).length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-white/[0.04] text-[10px] text-zinc-400 flex items-center gap-1">
                        <span className="text-zinc-500 font-semibold">Parameters:</span>
                        <span className="text-zinc-300 font-mono truncate">{JSON.stringify(log.params)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
