"use client";

import React, { useState, useRef, useEffect } from "react";
import { EditVersion, VersionDiffItem, formatSMPTE } from "@/types";
import {
  GitBranch,
  ArrowRight,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Check,
  SplitSquareVertical,
  Sliders,
  Volume2
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

  const handleSyncSeek = (time: number) => {
    if (videoARef.current) videoARef.current.currentTime = time;
    if (videoBRef.current) videoBRef.current.currentTime = time;
    setSyncTime(time);
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setSyncTime(e.currentTarget.currentTime);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Panel: Git-Style SVG Revision Lineage DAG */}
      <div className="bg-[#0b0b12] border border-white/[0.08] rounded-xl p-5 shadow-2xl relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-violet-400" />
              <span>FalkorDB Revision Lineage DAG (Track 02 Agent Memory)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Immutable EditVersion nodes connected via [:DERIVED_FROM]. Compare two versions side-by-side in synchronized lockstep.
            </p>
          </div>

          {/* Quick Select Dropdowns */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-400">Version A:</span>
              <select
                value={selectedV1}
                onChange={(e) => handleCompare(e.target.value, selectedV2)}
                className="bg-[#12121c] border border-white/10 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-violet-500 font-medium"
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
              <span className="text-zinc-400">Version B:</span>
              <select
                value={selectedV2}
                onChange={(e) => handleCompare(selectedV1, e.target.value)}
                className="bg-[#12121c] border border-white/10 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-violet-500 font-medium"
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

        {/* Visual Lineage Nodes Rail */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center gap-4 overflow-x-auto pb-2">
          {versions.map((v, idx) => {
            const isV1 = v.id === selectedV1;
            const isV2 = v.id === selectedV2;
            const isApproved = approvedVersion === v.id;

            return (
              <React.Fragment key={v.id}>
                <div
                  onClick={() => handleCompare(v.parent_version_id || versions[0]?.id, v.id)}
                  className={`p-3 rounded-xl border min-w-[210px] cursor-pointer transition-all ${
                    isV2
                      ? "bg-gradient-to-br from-violet-950/70 to-indigo-950/70 border-violet-500 shadow-lg shadow-violet-900/30"
                      : isV1
                      ? "bg-gradient-to-br from-indigo-950/50 to-blue-950/50 border-indigo-500/80"
                      : "bg-[#0e0e16] border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isV2 ? "bg-violet-400" : "bg-zinc-500"}`} />
                      EditVersion v{v.version_num}
                    </span>
                    {isApproved ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Approved
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-zinc-500">{v.id.slice(0, 7)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {v.prompt_summary || "Automated synthesis"}
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

      {/* Middle Panel: Synchronized Dual-Monitor A/B Deck */}
      <div className="bg-[#0b0b12] border border-white/[0.08] rounded-xl p-4 shadow-2xl space-y-3">
        {/* Master Sync Transport Bar */}
        <div className="p-3 rounded-xl bg-[#0f0f18] border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSyncPlay}
              className="bg-violet-600 hover:bg-violet-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-900/40 transition-all"
            >
              {isSyncPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isSyncPlaying ? "Pause Both" : "Play Both in Sync"}</span>
            </button>

            <button
              onClick={handleSyncRestart}
              className="bg-[#12121c] hover:bg-[#1a1a28] text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>00:00:00:00</span>
            </button>

            <div className="font-timecode text-xs text-violet-300 font-bold bg-[#07070b] px-2.5 py-1 rounded border border-white/10">
              Sync TC: {formatSMPTE(syncTime)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (v2Obj) {
                  setApprovedVersion(v2Obj.id);
                  onApproveFinalCut(v2Obj.id);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve & Lock Version B</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Dual Video Monitors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deck A (Left) */}
          <div className="bg-[#0e0e16] border border-white/[0.06] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300">
                Deck A: Version {v1Obj?.version_num || 1}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {v1Obj?.preview_url || "Rendering..."}
              </span>
            </div>

            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative shadow-inner">
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
          <div className="bg-[#0e0e16] border border-violet-500/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-violet-300 flex items-center gap-1.5">
                Deck B: Version {v2Obj?.version_num || 2} (Revised Cut)
              </span>
              <span className="text-[10px] font-mono text-violet-400">
                {v2Obj?.preview_url || "Rendering..."}
              </span>
            </div>

            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative shadow-inner">
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

      {/* Bottom Panel: Beat-by-Beat Graph Diff Matrix (Query 4) */}
      <div className="bg-[#0b0b12] border border-white/[0.08] rounded-xl p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <span>FalkorDB Cut Diff Matrix (Cypher Query 4)</span>
          </h3>
          <span className="text-[10px] text-zinc-400 font-mono">
            Direct graph-traversal delta between v{v1Obj?.version_num} and v{v2Obj?.version_num}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] uppercase font-bold text-zinc-400 bg-[#0c0c14]">
                <th className="py-2.5 px-3">Beat</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Version A Cut</th>
                <th className="py-2.5 px-3">Version B Cut</th>
                <th className="py-2.5 px-3">Diff Status</th>
                <th className="py-2.5 px-3">Revision Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
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
                    className={`hover:bg-white/[0.02] transition-colors ${
                      item.diff_status === "MODIFIED" ? "bg-violet-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-200">
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
                            ? "bg-violet-900/80 text-violet-200 border border-violet-600"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.diff_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 text-[11px] max-w-xs truncate">
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
