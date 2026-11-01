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
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { Project } from "@/types";
import { API_BASE } from "@/utils/media";

interface CheckpointHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: Project | null;
  onRestored?: () => void;
}

interface Checkpoint {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
}

export const CheckpointHistoryModal: React.FC<CheckpointHistoryModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  onRestored,
}) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Checkpoint | null>(null);
  const [diffText, setDiffText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [isReverting, setIsReverting] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeProject) {
      loadCheckpoints();
    }
  }, [isOpen, activeProject?.id]);

  const loadCheckpoints = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/checkpoints`);
      if (res.ok) {
        const data = await res.json();
        setCheckpoints(data.checkpoints || []);
        if (data.checkpoints?.length > 0) {
          loadDiff(data.checkpoints[0]);
        }
      }
    } catch (e) {
      console.warn("Failed to load checkpoints:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDiff = async (commit: Checkpoint) => {
    if (!activeProject) return;
    setSelectedCommit(commit);
    setIsLoadingDiff(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/checkpoints/${commit.hash}/diff`);
      if (res.ok) {
        const data = await res.json();
        setDiffText(data.diff || "No diff available");
      }
    } catch (e) {
      setDiffText("Error loading commit diff");
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const handleRevert = async (commit: Checkpoint) => {
    if (!activeProject) return;
    const confirmed = window.confirm(
      `Are you sure you want to restore workspace to checkpoint [${commit.short_hash}]?\n\n"${commit.message}"\n\nThis will restore index.html, STORYBOARD.md, and frame.md to this exact state.`
    );
    if (!confirmed) return;

    setIsReverting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/checkpoints/${commit.hash}/revert`, {
        method: "POST",
      });
      if (res.ok) {
        setActionNotice(`Workspace restored to ${commit.short_hash}`);
        await loadCheckpoints();
        if (onRestored) onRestored();
      } else {
        alert("Failed to revert to checkpoint");
      }
    } catch (e) {
      alert("Error reverting checkpoint: " + String(e));
    } finally {
      setIsReverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        className="studio-card"
        style={{
          width: "900px",
          maxWidth: "95vw",
          height: "640px",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.8)",
          border: "1px solid #27272A",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            backgroundColor: "#121215",
            borderBottom: "1px solid #222228",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GitCommit size={18} color="#10B981" />
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#F4F4F6", margin: 0 }}>
                Git Checkpoint History & Rollback
              </h2>
              <span style={{ fontSize: "11px", color: "#8E8E98" }}>
                Project: {activeProject?.title || ""} ({checkpoints.length} checkpoints logged)
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {actionNotice && (
              <span style={{ fontSize: "11px", color: "#10B981", display: "flex", alignItems: "center", gap: "4px" }}>
                <CheckCircle2 size={12} /> {actionNotice}
              </span>
            )}
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: Split View (Commit Rail vs Diff View) */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", flex: 1, minHeight: 0 }}>
          {/* Left Commit List */}
          <div
            style={{
              backgroundColor: "#0A0A0D",
              borderRight: "1px solid #1C1C22",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {isLoading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#71717A", fontSize: "12px" }}>
                Loading git checkpoints...
              </div>
            ) : checkpoints.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#71717A", fontSize: "12px" }}>
                No git checkpoints recorded yet.
              </div>
            ) : (
              checkpoints.map((c, idx) => {
                const isSelected = selectedCommit?.hash === c.hash;
                const isLatest = idx === 0;
                return (
                  <div
                    key={c.hash}
                    onClick={() => loadDiff(c)}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid #16161B",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#14141A" : "transparent",
                      borderLeft: isSelected ? "3px solid #10B981" : "3px solid transparent",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "10.5px", fontFamily: "'IBM Plex Mono', monospace", color: isSelected ? "#10B981" : "#A1A1AA", fontWeight: 600 }}>
                        {c.short_hash}
                      </span>
                      {isLatest && (
                        <span className="tech-tag tech-tag-green" style={{ fontSize: "9px", padding: "1px 5px" }}>
                          HEAD
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 500, lineHeight: 1.3 }}>
                      {c.message}
                    </span>

                    <span style={{ fontSize: "10px", color: "#71717A", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={10} /> {c.date.slice(0, 19)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Diff Surface */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, backgroundColor: "#060608" }}>
            {selectedCommit ? (
              <>
                <div
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#0D0D10",
                    borderBottom: "1px solid #1C1C22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", color: "#A1A1AA" }}>Inspecting Checkpoint: </span>
                    <strong style={{ fontSize: "11px", color: "#F4F4F6", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {selectedCommit.short_hash}
                    </strong>
                  </div>

                  <button
                    onClick={() => handleRevert(selectedCommit)}
                    disabled={isReverting}
                    style={{
                      padding: "5px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      backgroundColor: "#F59E0B",
                      border: "none",
                      borderRadius: "4px",
                      color: "#000",
                      cursor: isReverting ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>{isReverting ? "Restoring..." : "Restore Workspace to this Checkpoint"}</span>
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                  {isLoadingDiff ? (
                    <div style={{ color: "#71717A", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}>
                      Loading diff patch...
                    </div>
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "11px",
                        lineHeight: 1.5,
                        color: "#D4D4D8",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {diffText}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#71717A", fontSize: "12px" }}>
                Select a checkpoint on the left to inspect changes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

