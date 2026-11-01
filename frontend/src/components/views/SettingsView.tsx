"use client";

import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Sparkles,
  Activity,
  Trash2,
  CheckCircle2,
  Terminal,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { API_BASE } from "@/utils/media";

interface SettingsViewProps {
  graphState?: any;
  preferences: any[];
  handleTriggerTasteLearning: () => Promise<void> | void;
  isLearningTaste: boolean;
  feedbackSummary: any | null;
  handleDeletePreference: (id: string) => Promise<void> | void;
  handleAddPreference: (e: React.FormEvent) => Promise<void> | void;
  newPrefCategory: string;
  setNewPrefCategory: (val: string) => void;
  newPrefRule: string;
  setNewPrefRule: (val: string) => void;
}

export function SettingsView({
  preferences,
  handleTriggerTasteLearning,
  isLearningTaste,
  feedbackSummary,
  handleDeletePreference,
  handleAddPreference,
  newPrefCategory,
  setNewPrefCategory,
  newPrefRule,
  setNewPrefRule,
}: SettingsViewProps) {
  const [prereqs, setPrereqs] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoadingPrereqs, setIsLoadingPrereqs] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("claude");

  useEffect(() => {
    fetchPrereqs();
    fetchAgents();
  }, []);

  const fetchPrereqs = async () => {
    setIsLoadingPrereqs(true);
    try {
      const res = await fetch(`${API_BASE}/api/system/prerequisites`);
      if (res.ok) {
        const data = await res.json();
        setPrereqs(data);
      }
    } catch (e) {
      console.warn("Could not fetch prerequisites:", e);
    } finally {
      setIsLoadingPrereqs(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cli/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (e) {
      console.warn("Could not fetch CLI agents:", e);
    }
  };

  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. System Host Prerequisites Card */}
      <div className="studio-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Cpu size={16} color="#10B981" />
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: 0 }}>
                Host Environment & KINO Prerequisites
              </h2>
            </div>
            <p style={{ fontSize: "12px", color: "#8E8E98", marginTop: "4px", marginBottom: 0 }}>
              KINO runs locally against your operating system, requiring Node.js 22+, FFmpeg, and the HyperFrames CLI (npx hyperframes).
            </p>
          </div>

          <button
            onClick={fetchPrereqs}
            disabled={isLoadingPrereqs}
            className="btn-secondary"
            style={{ fontSize: "11px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={12} className={isLoadingPrereqs ? "animate-spin" : ""} />
            <span>Re-verify Host Doctor</span>
          </button>
        </div>

        {/* 4 Diagnostic Pillars */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F26", borderRadius: "6px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>NODE.JS ENGINE</span>
              {prereqs?.node_valid ? (
                <span style={{ color: "#10B981", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <CheckCircle2 size={12} /> Valid (&ge;22)
                </span>
              ) : (
                <span style={{ color: "#EF4444", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <AlertTriangle size={12} /> Requires &ge;22
                </span>
              )}
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>
              {prereqs?.node_version || "Checking..."}
            </div>
          </div>

          <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F26", borderRadius: "6px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>FFMPEG & FFPROBE</span>
              {prereqs?.ffmpeg_available && prereqs?.ffprobe_available ? (
                <span style={{ color: "#10B981", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <CheckCircle2 size={12} /> Installed
                </span>
              ) : (
                <span style={{ color: "#EF4444", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <AlertTriangle size={12} /> Missing
                </span>
              )}
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>
              v{prereqs?.ffmpeg_version || "7.0"}
            </div>
          </div>

          <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F26", borderRadius: "6px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>HYPERFRAMES CLI</span>
              {prereqs?.hyperframes_available ? (
                <span style={{ color: "#10B981", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <CheckCircle2 size={12} /> Operational
                </span>
              ) : (
                <span style={{ color: "#EF4444", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                  <AlertTriangle size={12} /> Not Found
                </span>
              )}
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#10B981", fontFamily: "ui-monospace, monospace" }}>
              v{prereqs?.hyperframes_version || "0.8.225"}
            </div>
          </div>

          <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F26", borderRadius: "6px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>STATE STORAGE</span>
              <span style={{ color: "#F59E0B", fontSize: "10px" }}>Local-First</span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>
              projects/ (No DB)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Terminal Coding Agent Configurations Card */}
      <div className="studio-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Terminal size={16} color="#06B6D4" />
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: 0 }}>
              Local CLI Agent Bridge & Plan Runner
            </h2>
          </div>
          <p style={{ fontSize: "12px", color: "#8E8E98", marginTop: "4px", marginBottom: 0 }}>
            Select which local command-line agent executes multi-step video plans, modifies `index.html`, and installs registry blocks.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
          {agents.map((ag) => {
            const isSelected = selectedAgent === ag.id;
            return (
              <div
                key={ag.id}
                onClick={() => setSelectedAgent(ag.id)}
                style={{
                  backgroundColor: isSelected ? "#06B6D410" : "#0C0C0E",
                  border: isSelected ? "1px solid #06B6D4" : "1px solid #1F1F26",
                  borderRadius: "6px",
                  padding: "14px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: isSelected ? "#06B6D4" : "#F4F4F6" }}>
                    {ag.name}
                  </span>
                  {ag.available ? (
                    <span style={{ fontSize: "9.5px", color: "#10B981", fontFamily: "ui-monospace, monospace" }}>
                      ● Installed
                    </span>
                  ) : (
                    <span style={{ fontSize: "9.5px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                      ○ Custom Path
                    </span>
                  )}
                </div>
                <code style={{ fontSize: "10.5px", color: "#8E8E98", fontFamily: "ui-monospace, monospace" }}>
                  $ {ag.command} {ag.args?.join(" ")}
                </code>
                <span style={{ fontSize: "11px", color: "#71717A", lineHeight: 1.3 }}>
                  {ag.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Style Directives Table */}
      <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SlidersHorizontal size={16} color="#F59E0B" />
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: 0 }}>
                Director Style Preferences & frame.md Tokens
              </h2>
            </div>
            <p style={{ fontSize: "12px", color: "#8E8E98", marginTop: "4px", marginBottom: 0 }}>
              Editorial rules and aesthetic guidelines synchronized into each project's `frame.md` and `STORYBOARD.md`.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="tech-tag-amber">
              {preferences.length} Active Rules
            </span>
          </div>
        </div>

        <div style={{ border: "1px solid #1C1C22", borderRadius: "5px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#111115", borderBottom: "1px solid #1C1C22", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", color: "#71717A", fontWeight: 600, fontSize: "10px", textTransform: "uppercase" }}>Category</th>
                <th style={{ padding: "10px 14px", color: "#71717A", fontWeight: 600, fontSize: "10px", textTransform: "uppercase" }}>Directive / Aesthetic Rule</th>
                <th style={{ padding: "10px 14px", color: "#71717A", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", width: "80px" }}>Weight</th>
                <th style={{ padding: "10px 14px", width: "40px" }}></th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #16161A" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontSize: "11px" }}>
                    {p.category}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#F4F4F6" }}>
                    {p.rule_text}
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "ui-monospace, monospace", color: "#8E8E98" }}>
                    {p.weight}x
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDeletePreference(p.id)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#71717A", padding: "4px" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add New Preference Form */}
        <form
          onSubmit={handleAddPreference}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#0C0C0E",
            padding: "12px",
            borderRadius: "5px",
            border: "1px solid #1F1F26",
            flexWrap: "wrap",
          }}
        >
          <select
            value={newPrefCategory}
            onChange={(e) => setNewPrefCategory(e.target.value)}
            style={{ width: "180px" }}
          >
            <option value="Pacing & Style">Pacing & Style</option>
            <option value="Framing & Composition">Framing & Composition</option>
            <option value="B-Roll Priority">B-Roll Priority</option>
            <option value="Audio Sync">Audio Sync</option>
          </select>

          <input
            type="text"
            placeholder="Enter new editorial rule (e.g. Lead with high-energy talking head under 3s)..."
            value={newPrefRule}
            onChange={(e) => setNewPrefRule(e.target.value)}
            style={{ flex: 1 }}
          />

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: "7px 14px" }}
          >
            + Add Rule
          </button>
        </form>
      </div>
    </div>
  );
}
