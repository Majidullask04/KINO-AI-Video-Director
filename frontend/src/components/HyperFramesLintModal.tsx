"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ShieldCheck,
  Terminal,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { HyperFramesLintReport } from "@/types";
import { API_BASE } from "@/utils/media";

interface HyperFramesLintModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const HyperFramesLintModal: React.FC<HyperFramesLintModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const [report, setReport] = useState<HyperFramesLintReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const runLint = () => {
    setIsLoading(true);
    fetch(`${API_BASE}/api/hyperframes/projects/${projectId}/lint`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.report) {
          setReport(data.report);
        }
      })
      .catch((err) => {
        console.warn("Linter request failed:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen && projectId) {
      runLint();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("npx hyperframes check --json");
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

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
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          backgroundColor: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 18px",
            backgroundColor: "#181818",
            borderBottom: "1px solid #2a2a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f5f5f5" }}>
              KINO Contract Verification Gate
            </span>
            <span className="tech-tag tech-tag-green" style={{ fontSize: "9px" }}>
              npx hyperframes check
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={runLint}
              disabled={isLoading}
              style={{
                padding: "4px 8px",
                fontSize: "10.5px",
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#a0a0a0",
              }}
              title="Re-run verification"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              <span>Verify</span>
            </button>
            <button
              onClick={onClose}
              style={{ padding: "4px", background: "none", border: "none", color: "#71717a", cursor: "pointer" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "18px", overflowY: "auto", flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#a0a0a0" }}>
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
              <div style={{ fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}>
                Running headless Chrome gate & contract validation...
              </div>
            </div>
          ) : report ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Summary Status Box */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "6px",
                  backgroundColor:
                    report.status === "passed"
                      ? "rgba(34, 197, 94, 0.1)"
                      : report.status === "warnings"
                      ? "rgba(251, 191, 36, 0.1)"
                      : "rgba(244, 63, 94, 0.1)",
                  border: `1px solid ${
                    report.status === "passed"
                      ? "rgba(34, 197, 94, 0.3)"
                      : report.status === "warnings"
                      ? "rgba(251, 191, 36, 0.3)"
                      : "rgba(244, 63, 94, 0.3)"
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {report.status === "passed" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : report.status === "warnings" ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#f5f5f5" }}>
                      {report.status === "passed"
                        ? "Composition Ready to Render"
                        : report.status === "warnings"
                        ? "Passed with Non-Blocking Warnings"
                        : "Contract Violations Detected"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#a0a0a0", marginTop: "2px" }}>
                      {report.summary}
                    </div>
                  </div>
                </div>

                <div className="font-mono text-xs" style={{ textAlign: "right" }}>
                  <span style={{ color: "#22c55e" }}>{report.checks_count - report.errors_count - report.warnings_count} Passed</span>
                  {report.warnings_count > 0 && <span style={{ color: "#fbbf24", marginLeft: "8px" }}>{report.warnings_count} Warnings</span>}
                  {report.errors_count > 0 && <span style={{ color: "#f43f5e", marginLeft: "8px" }}>{report.errors_count} Errors</span>}
                </div>
              </div>

              {/* Checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: "#71717a", textTransform: "uppercase" }}>
                  CONTRACT AUDIT CHECKS ({report.checks.length})
                </div>

                {report.checks.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "#18181b",
                      border: "1px solid #2a2a2a",
                      borderRadius: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {c.status === "passed" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : c.status === "warning" ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#e5e5e5" }}>
                          {c.name}
                        </span>
                      </div>
                      <span
                        className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            c.status === "passed"
                              ? "rgba(34, 197, 94, 0.15)"
                              : c.status === "warning"
                              ? "rgba(251, 191, 36, 0.15)"
                              : "rgba(244, 63, 94, 0.15)",
                          color:
                            c.status === "passed"
                              ? "#22c55e"
                              : c.status === "warning"
                              ? "#fbbf24"
                              : "#f43f5e",
                        }}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "11px", color: "#a0a0a0", paddingLeft: "24px" }}>
                      {c.description}
                    </div>

                    {c.fix && (
                      <div
                        style={{
                          marginTop: "4px",
                          marginLeft: "24px",
                          padding: "6px 10px",
                          backgroundColor: "#0a0a0a",
                          border: "1px solid #2a2a2a",
                          borderRadius: "4px",
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: "10.5px",
                          color: "#fbbf24",
                        }}
                      >
                        Fix: {c.fix}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px", color: "#71717a", textAlign: "center" }}>
              Unable to load verification report
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 18px",
            backgroundColor: "#181818",
            borderTop: "1px solid #2a2a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-mono text-xs text-zinc-400">npx hyperframes check</span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleCopyCommand}
              style={{
                fontSize: "11px",
                padding: "5px 10px",
                backgroundColor: "#222222",
                border: "1px solid #3a3a3a",
                color: "#f5f5f5",
              }}
            >
              {copiedCli ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCli ? "Copied" : "Copy CLI Check"}</span>
            </button>
            <button
              onClick={onClose}
              className="btn-green"
              style={{ fontSize: "11px", padding: "5px 12px" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

