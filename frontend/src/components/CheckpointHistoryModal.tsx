"use client";

import React, { useState, useEffect } from "react";
import {
  GitCommit,
  RotateCcw,
  CheckCircle2,
  Clock,
  FileText,
  X,
  Code2,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Project, TimelineProjectState, ProjectCheckpoint } from "@/types";
import { API_BASE } from "@/utils/media";
import {
  listCheckpoints,
  createCheckpoint,
  deleteCheckpoint,
  saveTimeline,
  checkBackendAvailability,
} from "@/lib/storage-adapter";

interface CheckpointHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: Project | null;
  currentTimeline?: TimelineProjectState | null;
  onRestoreTimeline?: (timeline: TimelineProjectState) => void;
  onRestored?: () => void;
}

export const CheckpointHistoryModal: React.FC<CheckpointHistoryModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  currentTimeline,
  onRestoreTimeline,
  onRestored,
}) => {
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<ProjectCheckpoint | null>(null);
  const [newSnapshotName, setNewSnapshotName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeProject) {
      loadAllCheckpoints();
    }
  }, [isOpen, activeProject?.id]);

  const loadAllCheckpoints = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    setActionNotice(null);
    try {
      const cps = await listCheckpoints(activeProject.id);
      setCheckpoints(cps);
      if (cps.length > 0) {
        setSelectedCheckpoint(cps[0]);
      }
    } catch (e) {
      console.warn("Failed to load checkpoints:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!activeProject || !currentTimeline) return;
    setIsSaving(true);
    try {
      const name = newSnapshotName.trim() || `Snapshot at ${new Date().toLocaleTimeString()}`;
      const cp = await createCheckpoint(activeProject.id, name, currentTimeline);
      setNewSnapshotName("");
      setActionNotice(`Created checkpoint: "${cp.name}"`);
      await loadAllCheckpoints();
    } catch (e: any) {
      alert("Error saving checkpoint: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreCheckpoint = async (cp: ProjectCheckpoint) => {
    if (!activeProject) return;
    const confirmed = window.confirm(
      `Are you sure you want to restore workspace to checkpoint "${cp.name}"?\n\nThis will restore all clips, tracks, and timing to this exact state.`
    );
    if (!confirmed) return;

    try {
      if (cp.timeline) {
        await saveTimeline(activeProject.id, cp.timeline);
        if (onRestoreTimeline) {
          onRestoreTimeline(cp.timeline);
        }
      }
      setActionNotice(`Restored to "${cp.name}"`);
      if (onRestored) onRestored();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e: any) {
      alert("Error restoring checkpoint: " + e.message);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteCheckpoint(id);
    await loadAllCheckpoints();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181817] border border-white/10 rounded-2xl w-[860px] max-w-[95vw] h-[580px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] bg-[#181817] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <GitCommit size={18} className="text-[#34D399]" />
            <div>
              <h2 className="text-sm font-bold text-white">Checkpoints &amp; Workspace History</h2>
              <span className="text-xs text-[#9E9E98]">
                {activeProject?.title || "Project"} ({checkpoints.length} snapshots saved)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actionNotice && (
              <span className="text-xs text-[#34D399] flex items-center gap-1 font-mono">
                <CheckCircle2 size={13} /> {actionNotice}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Create Snapshot Bar */}
        <div className="p-3 border-b border-white/[0.06] bg-[#141413] flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={newSnapshotName}
            onChange={(e) => setNewSnapshotName(e.target.value)}
            placeholder="Name this snapshot (e.g., 'Before splitting intro', 'Final draft')..."
            className="flex-1 bg-[#222220] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none"
          />
          <button
            onClick={handleCreateSnapshot}
            disabled={isSaving}
            className="pill-mint text-xs py-1.5 px-3.5 font-bold flex items-center gap-1.5 shrink-0"
          >
            <Plus size={13} />
            <span>{isSaving ? "Saving..." : "Save Checkpoint"}</span>
          </button>
        </div>

        {/* Body Split View */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Checkpoint List */}
          <div className="w-[320px] border-r border-white/[0.06] bg-[#111110] overflow-y-auto p-2 space-y-1 shrink-0">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-zinc-500">Loading checkpoints...</div>
            ) : checkpoints.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 leading-relaxed">
                No checkpoints created yet. Click &quot;Save Checkpoint&quot; above to create a milestone snapshot!
              </div>
            ) : (
              checkpoints.map((cp, idx) => {
                const isSelected = selectedCheckpoint?.id === cp.id;
                return (
                  <div
                    key={cp.id}
                    onClick={() => setSelectedCheckpoint(cp)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                      isSelected
                        ? "bg-white/10 border-[#34D399] shadow-sm"
                        : "bg-[#181817]/60 border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-white truncate">{cp.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        <span>{new Date(cp.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>{cp.timeline?.clips?.length || 0} clips</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, cp.id)}
                      className="w-5 h-5 rounded hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 flex items-center justify-center shrink-0"
                      title="Delete checkpoint"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Snapshot Details */}
          <div className="flex-1 p-4 bg-[#0A0A09] flex flex-col justify-between overflow-y-auto">
            {selectedCheckpoint ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedCheckpoint.name}</h3>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      Created: {new Date(selectedCheckpoint.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestoreCheckpoint(selectedCheckpoint)}
                    className="pill-mint text-xs py-1.5 px-4 font-bold flex items-center gap-1.5 shadow-md"
                  >
                    <RotateCcw size={13} />
                    <span>Restore This State</span>
                  </button>
                </div>

                {/* Timeline Composition Snapshot Preview */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    Snapshot Composition Summary
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#181817] p-2.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-zinc-500 block">Duration</span>
                      <span className="text-white font-mono font-bold">
                        {selectedCheckpoint.timeline?.duration?.toFixed(1) || 12.0}s
                      </span>
                    </div>
                    <div className="bg-[#181817] p-2.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-zinc-500 block">Aspect Ratio</span>
                      <span className="text-white font-mono font-bold">
                        {selectedCheckpoint.timeline?.aspectRatio || "16:9"}
                      </span>
                    </div>
                    <div className="bg-[#181817] p-2.5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-zinc-500 block">Total Clips</span>
                      <span className="text-white font-mono font-bold">
                        {selectedCheckpoint.timeline?.clips?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Clip Breakdown */}
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[10px] font-mono text-zinc-500">Clips in this snapshot:</div>
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {(selectedCheckpoint.timeline?.clips || []).map((clip, i) => (
                        <div
                          key={clip.id || i}
                          className="bg-[#141413] border border-white/5 p-2 rounded-lg text-xs flex items-center justify-between"
                        >
                          <span className="text-zinc-200 truncate">{clip.name}</span>
                          <span className="text-[10px] font-mono text-[#34D399] shrink-0">
                            {clip.start.toFixed(1)}s - {(clip.start + clip.duration).toFixed(1)}s
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-600">
                Select a checkpoint on the left to inspect and restore
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
