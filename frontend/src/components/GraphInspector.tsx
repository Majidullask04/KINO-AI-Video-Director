"use client";

import React, { useState } from "react";
import { CutDecision, GraphState, QueryLog } from "@/types";
import {
  Network,
  Terminal,
  Clock,
  Copy,
  Check,
  Database,
  Layers,
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

  const queryLogs: QueryLog[] = graphState?.query_logs || [];

  const handleCopyCypher = (query: string, idx: number) => {
    navigator.clipboard.writeText(query);
    setCopiedQueryIndex(idx);
    setTimeout(() => setCopiedQueryIndex(null), 2000);
  };

  const selectedCut = selectedDecision;

  return (
    <div className="bg-[#121215] border border-[#222228] rounded-[6px] overflow-hidden flex flex-col h-full select-none">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 border-b border-[#222228] bg-[#0c0c0e] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.6} />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#f4f4f6]">
            FalkorDB Graph Inspector
          </h2>
          <span className="tech-tag tech-tag-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Live Traceability
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#09090b] p-0.5 rounded border border-[#222228] text-xs">
          <button
            onClick={() => setActiveTab("topology")}
            className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 font-medium text-[11px] ${
              activeTab === "topology"
                ? "bg-[#18181c] text-[#f4f4f6] border border-[#2c2c35]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Network className="w-3 h-3 text-amber-400" strokeWidth={1.6} />
            <span>Multi-Hop Topology</span>
          </button>
          <button
            onClick={() => setActiveTab("cypher")}
            className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 font-medium text-[11px] ${
              activeTab === "cypher"
                ? "bg-[#18181c] text-[#f4f4f6] border border-[#2c2c35]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-3 h-3 text-emerald-400" strokeWidth={1.6} />
            <span>OpenCypher Queries ({queryLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        {/* TAB 1: INTERACTIVE SVG MULTI-HOP TOPOLOGY */}
        {activeTab === "topology" && (
          <div className="space-y-3">
            {/* SVG Canvas Frame */}
            <div className="relative w-full h-[245px] rounded-[6px] bg-[#09090B] border border-[#222228] overflow-hidden bg-studio-grid flex flex-col justify-between p-2">
              {/* Top Subgraph Legend */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 bg-[#0c0c0e]/95 px-2 py-0.5 rounded border border-[#222228]">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <span className="w-2 h-2 rounded-full border border-zinc-500 bg-[#121216]" />
                    :Reference
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-2 rounded-full border border-amber-500 bg-[#121216]" />
                    :StoryBeat
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-sm border border-emerald-500 bg-[#121216]" />
                    :CutDecision
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2 h-2 rounded-full border border-cyan-500 bg-[#121216]" />
                    :VideoClip
                  </span>
                  <span className="flex items-center gap-1 text-zinc-400">
                    <span className="w-2 h-2 rounded-full border border-zinc-600 bg-[#121216]" />
                    :VisualTag
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-2 h-2 rounded-full border border-rose-500 border-dashed bg-[#121216]" />
                    [:REJECTED]
                  </span>
                </div>

                <button
                  onClick={onRefreshGraph}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#16161a] hover:bg-[#1f1f25] text-zinc-300 border border-[#26262e] font-mono transition-colors"
                >
                  Reset View
                </button>
              </div>

              {/* Interactive SVG Diagram */}
              <svg viewBox="0 0 680 240" className="w-full h-full">
                {/* 1. ReferenceVideo -> StoryBeat */}
                <path
                  d="M 100 70 C 150 70, 160 70, 215 70"
                  stroke="#71717A"
                  strokeWidth="1.6"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 2. StoryBeat -> VisualTag */}
                <path
                  d="M 255 95 C 255 145, 320 160, 375 160"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 3. CutDecision -> StoryBeat */}
                <path
                  d="M 375 70 C 320 70, 310 70, 275 70"
                  stroke="#10B981"
                  strokeWidth="2"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 4. CutDecision -> VideoClip */}
                <path
                  d="M 435 70 C 490 70, 500 70, 555 70"
                  stroke="#06B6D4"
                  strokeWidth="2"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 5. VideoClip -> VisualTag */}
                <path
                  d="M 555 95 C 520 145, 465 160, 435 160"
                  stroke="#A1A1AA"
                  strokeWidth="1.5"
                  fill="none"
                  className="animate-graph-edge"
                />
                {/* 6. Negative Memory Edge: (:VideoClip)-[:REJECTED_FOR]->(:StoryBeat) */}
                <path
                  d="M 555 195 C 410 220, 290 195, 245 95"
                  stroke="#F43F5E"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  fill="none"
                />

                {/* Edge Text Labels */}
                <text x="155" y="60" fill="#71717A" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:HAS_BEAT]
                </text>
                <text x="325" y="60" fill="#10B981" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:FULFILLS_BEAT]
                </text>
                <text x="495" y="60" fill="#06B6D4" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:SELECTS_CLIP]
                </text>
                <text x="300" y="142" fill="#F59E0B" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:REQUIRES_TAG]
                </text>
                <text x="510" y="142" fill="#A1A1AA" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:HAS_TAG]
                </text>
                <text x="405" y="215" fill="#F43F5E" fontSize="8" textAnchor="middle" fontFamily="monospace">
                  [:REJECTED_FOR (Negative Memory)]
                </text>

                {/* Node 1: ReferenceVideo */}
                <g transform="translate(70, 70)">
                  <circle r="26" fill="#121216" stroke="#71717A" strokeWidth="1.5" />
                  <text y="-3" fill="#F4F4F6" fontSize="9" fontWeight="600" textAnchor="middle">:Reference</text>
                  <text y="9" fill="#71717A" fontSize="7" textAnchor="middle">12.0s Lock</text>
                </g>

                {/* Node 2: StoryBeat */}
                <g transform="translate(245, 70)">
                  <circle r="28" fill="#121216" stroke="#F59E0B" strokeWidth="1.8" />
                  <text y="-4" fill="#F4F4F6" fontSize="9.5" fontWeight="600" textAnchor="middle">:StoryBeat</text>
                  <text y="9" fill="#F59E0B" fontSize="8" textAnchor="middle" fontWeight="bold">
                    {selectedCut?.narrative_beat || "HOOK"}
                  </text>
                </g>

                {/* Node 3: CutDecision */}
                <g transform="translate(405, 70)">
                  <rect x="-32" y="-22" width="64" height="44" rx="5" fill="#121216" stroke="#10B981" strokeWidth="1.8" />
                  <text y="-4" fill="#F4F4F6" fontSize="9" fontWeight="600" textAnchor="middle">:CutDecision</text>
                  <text y="9" fill="#10B981" fontSize="8" textAnchor="middle">
                    {Math.round((selectedCut?.match_confidence || 0.95) * 100)}% Match
                  </text>
                </g>

                {/* Node 4: Selected VideoClip */}
                <g transform="translate(585, 70)">
                  <circle r="28" fill="#121216" stroke="#06B6D4" strokeWidth="1.8" />
                  <text y="-4" fill="#F4F4F6" fontSize="9" fontWeight="600" textAnchor="middle">:VideoClip</text>
                  <text y="9" fill="#06B6D4" fontSize="8" textAnchor="middle">
                    {selectedCut ? `${selectedCut.source_in_sec}s–${selectedCut.source_out_sec}s` : "0.0s–3.0s"}
                  </text>
                </g>

                {/* Node 5: Shared VisualTag */}
                <g transform="translate(405, 160)">
                  <rect x="-38" y="-12" width="76" height="24" rx="4" fill="#121216" stroke="#A1A1AA" strokeWidth="1.4" />
                  <text y="-1" fill="#F4F4F6" fontSize="8" fontWeight="600" textAnchor="middle">:VisualTag</text>
                  <text y="8" fill="#A1A1AA" fontSize="7" textAnchor="middle">
                    {selectedCut?.shot_type || "closeup"}
                  </text>
                </g>

                {/* Node 6: Rejected VideoClip (Negative Memory Edge) */}
                <g transform="translate(585, 195)">
                  <circle r="19" fill="#121216" stroke="#F43F5E" strokeWidth="1.4" strokeDasharray="3 3" />
                  <text y="-2" fill="#F4F4F6" fontSize="7.5" fontWeight="600" textAnchor="middle">:Clip</text>
                  <text y="8" fill="#F43F5E" fontSize="6.5" textAnchor="middle">Excluded</text>
                </g>
              </svg>
            </div>

            {/* Traceability Card */}
            {selectedCut ? (
              <div className="p-3 rounded-[6px] bg-[#0c0c0e] border border-[#222228] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#f4f4f6] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.6} />
                    Director Decision Traceability
                  </span>
                  <span className="tech-tag tech-tag-emerald">
                    {Math.round(selectedCut.match_confidence * 100)}% Confidence
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed bg-[#121215] p-2.5 rounded border border-[#222228]">
                  {selectedCut.explanation}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-[#121215] border border-[#222228]">
                    <span className="text-[9px] text-zinc-500 uppercase block">Source File</span>
                    <span className="text-zinc-200 truncate block">{selectedCut.source_asset}</span>
                  </div>
                  <div className="p-2 rounded bg-[#121215] border border-[#222228]">
                    <span className="text-[9px] text-zinc-500 uppercase block">Trim Window</span>
                    <span className="text-amber-400 block">
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
              <span className="font-mono text-[11px]">Real OpenCypher Traversal Queries (FalkorDB :6379)</span>
              <button
                onClick={onRefreshGraph}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-mono"
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
                    className={`p-3 rounded-[6px] border transition-all cursor-pointer font-mono text-xs ${
                      selectedLogIndex === idx
                        ? "bg-[#18181c] border-[#383842]"
                        : "bg-[#0c0c0e] border-[#222228] hover:border-[#2e2e38]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-2 pb-1.5 border-b border-[#222228]">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <Clock className="w-3 h-3 text-amber-500" strokeWidth={1.6} />
                        <span>Execution:</span>
                        <strong className="tech-tag tech-tag-emerald font-bold">
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

                    <pre className="text-[11px] text-[#f4f4f6] overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                      {log.query}
                    </pre>

                    {log.params && Object.keys(log.params).length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-[#222228] text-[10px] text-zinc-400 flex items-center gap-1">
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
