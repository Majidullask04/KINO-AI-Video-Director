"use client";

import React, { useState } from "react";
import { CutDecision, GraphState, QueryLog } from "@/types";
import {
  Network,
  Terminal,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Database
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
  const [activeTab, setActiveTab] = useState<"traceability" | "cypher" | "topology">("traceability");
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);

  const queryLogs: QueryLog[] = graphState?.query_logs || [];

  return (
    <div className="bg-[#121217] border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col h-full shadow-xl">
      {/* Inspector Tab Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-violet-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            FalkorDB Traceability Inspector
          </h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
          <button
            onClick={() => setActiveTab("traceability")}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeTab === "traceability"
                ? "bg-violet-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Lineage Path
          </button>
          <button
            onClick={() => setActiveTab("cypher")}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              activeTab === "cypher"
                ? "bg-violet-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>Cypher Queries ({queryLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("topology")}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              activeTab === "topology"
                ? "bg-violet-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Network className="w-3 h-3" />
            <span>Topology ({graphState?.nodes.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Inspector Body */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* TAB 1: LINEAGE PATH */}
        {activeTab === "traceability" && (
          <>
            {selectedDecision ? (
              <div className="space-y-4">
                {/* Visual Multi-Hop Path Ribbon */}
                <div className="p-3 rounded-lg bg-zinc-950/80 border border-violet-900/40 space-y-2">
                  <div className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Multi-Hop Traversal (Query 1 & 3)</span>
                    <span className="text-emerald-400 font-mono text-[9px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> FalkorDB Verified
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    {/* StoryBeat Node */}
                    <div className="flex-1 p-2 rounded bg-violet-950/50 border border-violet-700/60 text-center">
                      <div className="text-[9px] uppercase font-bold text-violet-300">
                        (:StoryBeat)
                      </div>
                      <div className="text-xs font-bold text-white uppercase mt-0.5">
                        {selectedDecision.narrative_beat}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {selectedDecision.beat_target_sec}s target
                      </div>
                    </div>

                    <div className="flex items-center justify-center text-violet-400 text-xs">
                      <span className="text-[9px] font-mono px-1 bg-zinc-900 rounded border border-zinc-800">
                        [:FULFILLS_BEAT]
                      </span>
                    </div>

                    {/* CutDecision Node */}
                    <div className="flex-1 p-2 rounded bg-indigo-950/50 border border-indigo-700/60 text-center">
                      <div className="text-[9px] uppercase font-bold text-indigo-300">
                        (:CutDecision)
                      </div>
                      <div className="text-xs font-bold text-white uppercase mt-0.5">
                        Order #{selectedDecision.order}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {(selectedDecision.source_out_sec - selectedDecision.source_in_sec).toFixed(1)}s trim
                      </div>
                    </div>

                    <div className="flex items-center justify-center text-indigo-400 text-xs">
                      <span className="text-[9px] font-mono px-1 bg-zinc-900 rounded border border-zinc-800">
                        [:SELECTS_CLIP]
                      </span>
                    </div>

                    {/* VideoClip Node */}
                    <div className="flex-1 p-2 rounded bg-cyan-950/50 border border-cyan-700/60 text-center">
                      <div className="text-[9px] uppercase font-bold text-cyan-300">
                        (:VideoClip)
                      </div>
                      <div className="text-xs font-bold text-white uppercase mt-0.5">
                        {selectedDecision.shot_type}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        ⚡ {selectedDecision.energy_level}/5 Energy
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Rationale & Confidence */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      Director Agent Rationale
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
                      {Math.round(selectedDecision.match_confidence * 100)}% Match Confidence
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-2.5 rounded border border-zinc-800/80 font-sans">
                    {selectedDecision.explanation}
                  </p>
                </div>

                {/* Clip Specifications & Timestamps */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                      Source Asset File
                    </span>
                    <span className="font-mono text-zinc-200 text-xs truncate block">
                      {selectedDecision.source_asset}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                      Trim Range
                    </span>
                    <span className="font-mono text-violet-300 text-xs block">
                      {selectedDecision.source_in_sec.toFixed(2)}s ➔ {selectedDecision.source_out_sec.toFixed(2)}s
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-500 text-xs">
                Select a cut block on the timeline to inspect its multi-hop FalkorDB graph path.
              </div>
            )}
          </>
        )}

        {/* TAB 2: LIVE CYPHER QUERY AUDIT LOG */}
        {activeTab === "cypher" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                Recent OpenCypher Queries Executed on Port 6379:
              </span>
              <button
                onClick={onRefreshGraph}
                className="text-[10px] text-violet-400 hover:text-violet-300 underline font-mono"
              >
                Refresh Log
              </button>
            </div>

            {queryLogs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                No Cypher queries logged yet. Trigger an edit or revision to inspect live Cypher queries.
              </div>
            ) : (
              <div className="space-y-2">
                {queryLogs.map((log, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedLogIndex(idx)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer font-mono text-xs ${
                      selectedLogIndex === idx
                        ? "bg-zinc-900 border-violet-500/80 shadow-md"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1.5 pb-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-violet-400" />
                        Execution Time:
                        <strong className="text-emerald-400 font-bold ml-0.5">
                          {log.execution_time_ms} ms
                        </strong>
                      </span>
                      <span className="text-zinc-400">
                        Rows: <strong className="text-zinc-200">{log.row_count}</strong>
                      </span>
                    </div>

                    <pre className="text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {log.query}
                    </pre>

                    {log.params && Object.keys(log.params).length > 0 && (
                      <div className="mt-2 pt-1 border-t border-zinc-800/50 text-[10px] text-zinc-400">
                        <span className="text-zinc-500">Params: </span>
                        {JSON.stringify(log.params)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GRAPH TOPOLOGY */}
        {activeTab === "topology" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                <span>Active Graph Nodes ({graphState?.nodes.length || 0})</span>
                <span className="text-zinc-500 text-[11px]">
                  Edges: {graphState?.edges.length || 0}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] max-h-60 overflow-y-auto">
                {graphState?.nodes.map((n, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold px-1 rounded bg-violet-950 text-violet-300 font-mono">
                        {n.label}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-mono truncate max-w-[80px]">
                        {n.id}
                      </span>
                    </div>
                    <span className="text-zinc-200 font-medium truncate mt-1">
                      {n.name || n.role || n.title || n.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Edge Types Summary */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Active Edge Types in Memory
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "[:FULFILLS_BEAT]",
                  "[:SELECTS_CLIP]",
                  "[:NEXT_BEAT]",
                  "[:DERIVED_FROM]",
                  "[:REJECTED_FOR]",
                  "[:REQUIRES_TAG]",
                  "[:REMEMBERS_PREF]",
                ].map((edge) => (
                  <span
                    key={edge}
                    className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono text-[10px]"
                  >
                    {edge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
