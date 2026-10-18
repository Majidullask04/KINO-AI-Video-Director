"use client";

import React, { useState, useRef } from "react";
import { EditVersion, VersionDiffItem, formatSMPTE } from "@/types";
import {
  GitCompare,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Check,
  Layers
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

  // Synchronized Dual-Monitor State
  const [isSyncPlaying, setIsSyncPlaying] = useState<boolean>(false);
  const [syncTime, setSyncTime] = useState<number>(0);
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);

  const handleCompare = (v1: string, v2: string) => {
    setSelectedV1(v1);
    setSelectedV2(v2);
    onSelectVersionsToCompare(v1, v2);
  };

  const v1Obj = versions.find((v) => v.id === selectedV1);
  const v2Obj = versions.find((v) => v.id === selectedV2);

  // Synchronized Master Transport Controls
  const toggleSyncPlay = () => {
    if (isSyncPlaying) {
      videoARef.current?.pause();
      videoBRef.current?.pause();
      setIsSyncPlaying(false);
    } else {
      videoARef.current?.play();
      videoBRef.current?.play();
      setIsSyncPlaying(true);
    }
  };

  const handleSyncRestart = () => {
    if (videoARef.current) videoARef.current.currentTime = 0;
    if (videoBRef.current) videoBRef.current.currentTime = 0;
    setSyncTime(0);
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setSyncTime(e.currentTarget.currentTime);
  };

  return (
    <div className="space-y-4 select-none">
      {/* 1. Top Card: Interactive SVG Revision Lineage DAG */}
      <div className="studio-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#f4f4f6] flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-amber-500" strokeWidth={1.6} />
              <span>Lineage DAG & Version History</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Immutable EditVersion nodes connected via [:DERIVED_FROM] graph edges.
            </p>
          </div>

          {/* Quick Select Dropdowns */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 font-mono text-[11px]">Compare:</span>
            <select
              value={selectedV1}
              onChange={(e) => handleCompare(e.target.value, selectedV2)}
              className="text-xs py-1"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_num} ({v.id.slice(0, 7)})
                </option>
              ))}
            </select>

            <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />

            <select
              value={selectedV2}
              onChange={(e) => handleCompare(selectedV1, e.target.value)}
              className="text-xs py-1"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_num} ({v.id.slice(0, 7)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual Lineage Nodes Rail */}
        <div className="pt-3 border-t border-[#222228] flex items-center gap-3 overflow-x-auto pb-1">
          {versions.map((v, idx) => {
            const isV1 = v.id === selectedV1;
            const isV2 = v.id === selectedV2;
            const isApproved = approvedVersion === v.id;

            return (
              <React.Fragment key={v.id}>
                <div
                  onClick={() => handleCompare(v.parent_version_id || versions[0]?.id, v.id)}
                  className={`p-3 rounded-[5px] border min-w-[200px] cursor-pointer transition-all ${
                    isV2
                      ? "bg-[#18181c] border-[#f59e0b]"
                      : isV1
                      ? "bg-[#141418] border-[#383842]"
                      : "bg-[#0e0e11] border-[#222228] hover:border-[#2e2e38]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#f4f4f6] flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isV2 ? "bg-amber-400" : "bg-zinc-500"}`} />
                      EditVersion v{v.version_num}
                    </span>
                    {isApproved ? (
                      <span className="tech-tag tech-tag-emerald">
                        <Check className="w-2.5 h-2.5" /> Approved
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-zinc-500">{v.id.slice(0, 7)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {v.prompt_summary || "Automated synthesis"}
                  </p>
                </div>

                {idx < versions.length - 1 && (
                  <div className="flex flex-col items-center text-zinc-600 shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[8px] font-mono text-zinc-600">[:DERIVED_FROM]</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 2. Middle Deck: Synchronized Dual-Monitor A/B Deck */}
      <div className="studio-card p-4 space-y-3">
        {/* Master Sync Transport Bar */}
        <div className="p-2.5 rounded-[5px] bg-[#0c0c0e] border border-[#222228] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSyncPlay}
              className="btn-primary"
              style={{ padding: "6px 12px" }}
            >
              {isSyncPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isSyncPlaying ? "Pause Both" : "Play Both in Sync"}</span>
            </button>

            <button
              onClick={handleSyncRestart}
              className="text-xs font-mono"
            >
              <RotateCcw className="w-3 h-3" />
              <span>00:00:00:00</span>
            </button>

            <div className="font-timecode text-xs text-amber-400 bg-[#09090b] px-2.5 py-1 rounded border border-[#222228]">
              Sync TC: {formatSMPTE(syncTime)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (v2Obj) {
                  setApprovedVersion(v2Obj.id);
                  onApproveFinalCut(v2Obj.id);
                }
              }}
              className="btn-primary"
            >
              Approve Active Cut
            </button>
          </div>
        </div>

        {/* Side-by-Side Dual Video Monitors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Deck A (Left) */}
          <div className="bg-[#09090b] border border-[#222228] rounded-[5px] p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300">
                Deck A: Version {v1Obj?.version_num || 1}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {v1Obj?.preview_url ? "Ready" : "Pending"}
              </span>
            </div>

            <div className="aspect-video bg-black rounded overflow-hidden border border-[#1e1e24] relative">
              {v1Obj?.preview_url ? (
                <video
                  ref={videoARef}
                  src={v1Obj.preview_url}
                  onTimeUpdate={handleVideoTimeUpdate}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                  Preview not rendered
                </div>
              )}
            </div>
          </div>

          {/* Deck B (Right) */}
          <div className="bg-[#09090b] border border-[#222228] rounded-[5px] p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                Deck B: Version {v2Obj?.version_num || 2} (Revised Cut)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {v2Obj?.preview_url ? "Ready" : "Pending"}
              </span>
            </div>

            <div className="aspect-video bg-black rounded overflow-hidden border border-[#1e1e24] relative">
              {v2Obj?.preview_url ? (
                <video
                  ref={videoBRef}
                  src={v2Obj.preview_url}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                  Preview not rendered
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Card: Clean architectural diff table */}
      <div className="studio-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f4f4f6] flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.6} />
            <span>FalkorDB Cut Diff Matrix (Cypher Query 4)</span>
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">
            Direct graph-traversal delta between v{v1Obj?.version_num || 1} and v{v2Obj?.version_num || 2}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#222228] text-[10px] uppercase font-semibold text-zinc-500 bg-[#0c0c0e]">
                <th className="py-2 px-3">Beat</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Version A Cut</th>
                <th className="py-2 px-3">Version B Cut</th>
                <th className="py-2 px-3">Diff Status</th>
                <th className="py-2 px-3">Revision Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e24]">
              {diffItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500 font-mono">
                    No differences found or only 1 version exists. Use the assistant to revise a cut.
                  </td>
                </tr>
              ) : (
                diffItems.map((item) => (
                  <tr
                    key={item.beat_index}
                    className={`hover:bg-[#16161a] transition-colors ${
                      item.diff_status === "MODIFIED" ? "bg-[#18181c]/50" : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-mono font-medium text-zinc-300">
                      #{item.beat_index}
                    </td>
                    <td className="py-2 px-3 font-medium uppercase text-zinc-300">
                      {item.beat_role}
                    </td>
                    <td className="py-2 px-3 font-mono text-zinc-400">
                      <div>{item.v1_source}</div>
                      <div className="text-[10px] text-zinc-500">
                        [{item.v1_in.toFixed(1)}s - {item.v1_out.toFixed(1)}s]
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-zinc-200">
                      <div>{item.v2_source}</div>
                      <div className="text-[10px] text-zinc-400">
                        [{item.v2_in.toFixed(1)}s - {item.v2_out.toFixed(1)}s]
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={
                          item.diff_status === "MODIFIED"
                            ? "tech-tag tech-tag-amber"
                            : "tech-tag"
                        }
                      >
                        {item.diff_status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-zinc-400 text-[11px] max-w-xs truncate">
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
