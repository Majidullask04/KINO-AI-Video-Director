"use client";

import React from "react";
import { Activity, Trash2 } from "lucide-react";

interface SettingsViewProps {
  graphState: { nodes: any[]; edges: any[] } | null;
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
  graphState,
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
  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[
          { label: "GRAPH DATABASE", value: "ai_video_director", sub: "FalkorDB v2.4", color: "#F4F4F6" },
          { label: "TOTAL NODES", value: `${graphState?.nodes.length || 17} Nodes`, sub: "Indexed in RAM", color: "#10B981" },
          { label: "TOTAL EDGES", value: `${graphState?.edges.length || 16} Edges`, sub: "Multi-Hop Traversal", color: "#06B6D4" },
          { label: "AVG QUERY LATENCY", value: "0.4 ms", sub: "Sub-Millisecond Cypher", color: "#F59E0B" },
        ].map((metric) => (
          <div
            key={metric.label}
            className="studio-card"
            style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}
          >
            <span style={{ fontSize: "9.5px", fontFamily: "ui-monospace, monospace", color: "#71717A", letterSpacing: "0.06em" }}>
              {metric.label}
            </span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: metric.color, fontFamily: "ui-monospace, monospace" }}>
              {metric.value}
            </div>
            <span style={{ fontSize: "10px", color: "#8E8E98" }}>
              {metric.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Persistent Creator Preferences Table */}
      <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
              PERSISTENT MEMORY & TASTE LEARNING // TRACK 02
            </span>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
              Creator Preference Nodes (:CreatorPreference)
            </h2>
            <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
              Mined procedural rules and aesthetic preferences stored in FalkorDB that continuously refine clip rankings.
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={handleTriggerTasteLearning}
              disabled={isLearningTaste}
              className="btn-studio btn-studio-primary"
              style={{ height: "30px", fontSize: "11px", padding: "0 12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Activity className={`w-3 h-3 ${isLearningTaste ? "animate-spin" : ""}`} />
              <span>{isLearningTaste ? "Mining Choices..." : "Mine & Learn Taste"}</span>
            </button>
            <span className="tech-tag-amber">
              {preferences.length} Stored Rules
            </span>
          </div>
        </div>

        {/* Feedback Analytics Summary Bar */}
        {feedbackSummary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", backgroundColor: "#0C0C0E", padding: "12px", borderRadius: "5px", border: "1px solid #1F1F26" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "#71717A", textTransform: "uppercase" }}>
                Recorded Feedback
              </span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>
                {feedbackSummary.total_feedback} Choices
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "#71717A", textTransform: "uppercase" }}>
                Approved / Kept
              </span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#10B981", fontFamily: "ui-monospace, monospace" }}>
                {feedbackSummary.keeps} Cuts
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "#71717A", textTransform: "uppercase" }}>
                Replaced / Swapped
              </span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#F59E0B", fontFamily: "ui-monospace, monospace" }}>
                {feedbackSummary.replaces} Cuts
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "#71717A", textTransform: "uppercase" }}>
                Approval Rate
              </span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#06B6D4", fontFamily: "ui-monospace, monospace" }}>
                {feedbackSummary.approval_rate}%
              </span>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div style={{ border: "1px solid #1F1F26", borderRadius: "5px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#0C0C0E", borderBottom: "1px solid #1F1F26", color: "#71717A", fontSize: "10px", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>
                <th style={{ padding: "8px 12px" }}>Category</th>
                <th style={{ padding: "8px 12px" }}>Rule Specification</th>
                <th style={{ padding: "8px 12px" }}>Weight</th>
                <th style={{ padding: "8px 12px" }}>Session Count</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(preferences.length > 0 ? preferences : [
                { id: "pref_1", category: "Pacing & Style", rule_text: "Always start with high-energy establishing shot", weight: 1.5, reinforced_sessions: 3 },
                { id: "pref_2", category: "Framing & Composition", rule_text: "Limit talking-head dialog segments to under 3.5 seconds", weight: 1.8, reinforced_sessions: 4 },
                { id: "pref_3", category: "B-Roll Priority", rule_text: "Use cutaway B-roll code shots over monotonous wide angles", weight: 1.2, reinforced_sessions: 2 },
              ]).map((pref) => (
                <tr
                  key={pref.id}
                  style={{
                    borderBottom: "1px solid #18181E",
                    backgroundColor: "#101014",
                  }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <span className="tech-tag-amber" style={{ fontSize: "9.5px" }}>
                      {pref.category}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#F4F4F6", fontWeight: 500 }}>
                    {pref.rule_text}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", color: "#A1A1AA" }}>
                    {pref.weight || 1.5}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>
                    {pref.reinforced_sessions || 1} sessions
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className="tech-tag-emerald" style={{ fontSize: "9px" }}>
                      Active in DirectorAgent
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDeletePreference(pref.id)}
                      style={{ padding: "3px 6px", background: "transparent", border: "1px solid #2C2C35", color: "#71717A" }}
                      title="Delete rule node"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form to add a new standing editorial rule */}
        <form
          onSubmit={handleAddPreference}
          style={{
            borderTop: "1px solid #1F1F26",
            paddingTop: "14px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
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
            placeholder="Enter new editorial standing rule (e.g. Prioritize macro B-roll for technical beats)..."
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
