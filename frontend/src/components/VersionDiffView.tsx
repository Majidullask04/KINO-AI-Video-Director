"use client";

import React, { useState } from "react";
import { EditVersion, VersionDiffItem } from "@/types";
import {
  GitBranch,
  ArrowRight,
  CheckCircle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Check
} from "lucide-react";

interface VersionDiffViewProps {
  versions: EditVersion[];
  diffItems: VersionDiffItem[];
  onSelectVersionsToCompare: (v1Id: string, v2Id: string) => void;
  onApproveFinalCut: (versionId: string) => void;
  activeVersionId: string;
}

export const VersionDiffView: React.FC<VersionDiffViewProps> = ({
  versions,
  diffItems,
  onSelectVersionsToCompare,
  onApproveFinalCut,
  activeVersionId,
}) => {
  const [selectedV1, setSelectedV1] = useState<string>(
    versions.length > 1 ? versions[versions.length - 2].id : versions[0]?.id || ""
  );
  const [selectedV2, setSelectedV2] = useState<string>(
    versions.length > 0 ? versions[versions.length - 1].id : ""
  );
  const [approvedVersion, setApprovedVersion] = useState<string | null>(null);

  const handleCompare = (v1: string, v2: string) => {
    setSelectedV1(v1);
    setSelectedV2(v2);
    onSelectVersionsToCompare(v1, v2);
  };

  const v1Obj = versions.find((v) => v.id === selectedV1);
  const v2Obj = versions.find((v) => v.id === selectedV2);

  return (
    <div className="space-y-6">
      {/* Header & Lineage DAG Summary */}
      <div className="bg-[#121217] border border-zinc-800/80 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-violet-400" />
              <span>FalkorDB Revision Lineage DAG & Version Comparison</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Every timeline cut list is an immutable EditVersion node linked via [:DERIVED_FROM].
              Compare side-by-side versions powered by Cypher Query 4.
            </p>
          </div>

          {/* Quick Version Dropdowns */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-400">Compare:</span>
              <select
                value={selectedV1}
                onChange={(e) => handleCompare(e.target.value, selectedV2)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2.5 py-1.5 focus:border-violet-500"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_num} ({v.id.slice(0, 7)})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-600" />

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-400">With:</span>
              <select
                value={selectedV2}
                onChange={(e) => handleCompare(selectedV1, e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2.5 py-1.5 focus:border-violet-500"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_num} ({v.id.slice(0, 7)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Visual Lineage Timeline DAG */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center gap-4 overflow-x-auto pb-2">
          {versions.map((v, idx) => {
            const isV1 = v.id === selectedV1;
            const isV2 = v.id === selectedV2;
            const isApproved = approvedVersion === v.id;

            return (
              <React.Fragment key={v.id}>
                <div
                  onClick={() => handleCompare(v.parent_version_id || versions[0]?.id, v.id)}
                  className={`p-3 rounded-lg border min-w-[200px] cursor-pointer transition-all ${
                    isV2
                      ? "bg-violet-950/60 border-violet-500 shadow-md"
                      : isV1
                      ? "bg-indigo-950/40 border-indigo-500/80"
                      : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                      Version {v.version_num}
                    </span>
                    {isApproved ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Approved
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-500 font-mono">{v.id.slice(0, 7)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {v.prompt_summary || "Automated edit"}
                  </p>
                </div>

                {idx < versions.length - 1 && (
                  <div className="flex flex-col items-center text-zinc-600 shrink-0">
                    <ArrowRight className="w-4 h-4 text-violet-500" />
                    <span className="text-[8px] font-mono text-zinc-500">[:DERIVED_FROM]</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Video Players */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Version A Player */}
        <div className="bg-[#121217] border border-zinc-800/80 rounded-xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">
              Version A: v{v1Obj?.version_num || 1}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {v1Obj?.preview_url || "No preview"}
            </span>
          </div>

          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800/80 relative">
            {v1Obj?.preview_url ? (
              <video
                src={v1Obj.preview_url}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                Video not rendered yet
              </div>
            )}
          </div>
        </div>

        {/* Version B Player */}
        <div className="bg-[#121217] border border-violet-900/50 rounded-xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-300">
              Version B: v{v2Obj?.version_num || 2} (Revised)
            </span>
            <button
              onClick={() => {
                if (v2Obj) {
                  setApprovedVersion(v2Obj.id);
                  onApproveFinalCut(v2Obj.id);
                }
              }}
              className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded transition-colors flex items-center gap-1 shadow-sm"
            >
              <CheckCircle className="w-3 h-3" />
              <span>Approve Final Cut</span>
            </button>
          </div>

          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800/80 relative">
            {v2Obj?.preview_url ? (
              <video
                src={v2Obj.preview_url}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                Video not rendered yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FalkorDB Version Diff Table (Query 4) */}
      <div className="bg-[#121217] border border-zinc-800/80 rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <span>FalkorDB Cut Diff Matrix (Cypher Query 4)</span>
          </h3>
          <span className="text-[10px] text-zinc-400 font-mono">
            Direct graph-traversal comparison between v{v1Obj?.version_num} and v{v2Obj?.version_num}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                <th className="py-2.5 px-3">Beat</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Version A Cut</th>
                <th className="py-2.5 px-3">Version B Cut</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">AI Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {diffItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    No differences found or only 1 version exists. Use the assistant to revise a cut.
                  </td>
                </tr>
              ) : (
                diffItems.map((item) => (
                  <tr
                    key={item.beat_index}
                    className={`hover:bg-zinc-900/40 transition-colors ${
                      item.diff_status === "MODIFIED" ? "bg-violet-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-300">
                      #{item.beat_index}
                    </td>
                    <td className="py-2.5 px-3 font-semibold uppercase text-zinc-200">
                      {item.beat_role}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400">
                      <div>{item.v1_source}</div>
                      <div className="text-[10px] text-zinc-500">
                        [{item.v1_in.toFixed(1)}s - {item.v1_out.toFixed(1)}s]
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-violet-300">
                      <div>{item.v2_source}</div>
                      <div className="text-[10px] text-violet-400/80">
                        [{item.v2_in.toFixed(1)}s - {item.v2_out.toFixed(1)}s]
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${
                          item.diff_status === "MODIFIED"
                            ? "bg-violet-900 text-violet-200 border border-violet-700"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.diff_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px] max-w-xs truncate">
                      {item.v2_reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
