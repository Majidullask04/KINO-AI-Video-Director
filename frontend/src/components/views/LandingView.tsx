"use client";

import React from "react";
import { Film, Database } from "lucide-react";
import { Project, EditVersion, CreatorPreference } from "@/types";
import { DEMO_REFERENCE_VIDEO } from "@/utils/media";

interface LandingViewProps {
  activeProject: Project | null;
  activePreviewUrl: string;
  versions: EditVersion[];
  preferences: CreatorPreference[];
  isSeeding: boolean;
  onOpenStudio: () => void;
  onSeedDemo: () => void;
  onManagePreferences: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  activeProject,
  activePreviewUrl,
  versions,
  preferences,
  isSeeding,
  onOpenStudio,
  onSeedDemo,
  onManagePreferences,
}) => {
  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top System Strip */}
      <div
        className="studio-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#F4F4F6", letterSpacing: "-0.02em" }}>
              KINO // STUDIO
            </span>
            <span style={{ color: "#71717A", fontSize: "12px" }}>—</span>
            <span style={{ fontSize: "12.5px", color: "#A1A1AA" }}>
              Graph-Grounded Non-Linear Editing System Powered by FalkorDB
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "2px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
              FalkorDB Graph Engine: <strong style={{ color: "#10B981", fontWeight: 600 }}>Online</strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
              Gemini 2.5 Flash Directorial Reasoning: <strong style={{ color: "#10B981", fontWeight: 600 }}>Active</strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
              FFmpeg Render Engine: <strong style={{ color: "#10B981", fontWeight: 600 }}>Ready</strong>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onOpenStudio}
            className="btn-primary"
          >
            Open Timeline Studio
          </button>
          <button
            onClick={onSeedDemo}
            disabled={isSeeding}
            className="btn-secondary"
          >
            {isSeeding ? "Seeding..." : "Load Sample Production"}
          </button>
        </div>
      </div>

      {/* 4-Stage Architecture Pipeline Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        {[
          {
            step: "01 / INGEST",
            title: "Reference Decomposition",
            desc: "PySceneDetect segments reference video rhythm into narrative beats.",
            schema: "(:ReferenceVideo)-[:HAS_BEAT]->(:StoryBeat)",
          },
          {
            step: "02 / INDEX",
            title: "Multimodal Asset Index",
            desc: "Raw rushes analyzed via Gemini 2.5 Flash for shot types, motion, and visual tags.",
            schema: "(:SourceAsset)-[:CONTAINS_CLIP]->(:VideoClip)",
          },
          {
            step: "03 / TRAVERSE",
            title: "OpenCypher Matching",
            desc: "DirectorAgent traverses multi-hop graph paths to select optimal clips.",
            schema: "Multi-Hop OpenCypher Match",
          },
          {
            step: "04 / ASSEMBLE",
            title: "Lineage Assembly",
            desc: "EditVersion branched with CutDecision nodes and FFmpeg render.",
            schema: "(:EditVersion)-[:HAS_DECISION]->(:CutDecision)",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="studio-card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "10px",
              padding: "16px",
            }}
          >
            <div>
              <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                {item.step}
              </span>
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6", marginTop: "4px", marginBottom: "4px" }}>
                {item.title}
              </h4>
              <p style={{ fontSize: "11.5px", color: "#8E8E98", lineHeight: 1.45, margin: 0 }}>
                {item.desc}
              </p>
            </div>
            <div
              style={{
                backgroundColor: "#0A0A0D",
                border: "1px solid #1E1E24",
                borderRadius: "4px",
                padding: "6px 8px",
                fontSize: "9.5px",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                color: "#71717A",
                overflowX: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.schema}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Split */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px" }}>
        {/* Left: Active Production Summary & Render Preview */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Film size={15} strokeWidth={1.6} color="#F59E0B" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                Active Production Summary & Latest Cut
              </span>
            </div>
            <span className="tech-tag-amber">
              {activeProject ? activeProject.title : "Sample Project"}
            </span>
          </div>

          <div
            style={{
              aspectRatio: "16/9",
              backgroundColor: "#050507",
              border: "1px solid #1F1F26",
              borderRadius: "5px",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              controls
              src={activePreviewUrl || DEMO_REFERENCE_VIDEO}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
              <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>FORMAT</span>
              <div style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                {activeProject?.aspect_ratio || "16:9"} Widescreen
              </div>
            </div>
            <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
              <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>TARGET DURATION</span>
              <div style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                {activeProject?.target_duration || 12.0}s SMPTE
              </div>
            </div>
            <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
              <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>GRAPH EDITIONS</span>
              <div style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                {versions.length || 1} EditVersions
              </div>
            </div>
          </div>
        </div>

        {/* Right: FalkorDB Cypher Operations & Learned Rules */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Database size={15} strokeWidth={1.6} color="#10B981" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                Recent FalkorDB Cypher Operations
              </span>
            </div>
            <span className="tech-tag-emerald">
              0.4ms Latency
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              {
                action: "TRAVERSE CANDIDATES",
                cypher: "MATCH (b:StoryBeat)-[:REQUIRES_TAG]->(t:VisualTag)<-[:TAGGED_WITH]-(c:VideoClip) WHERE b.project_id = $pid RETURN c ORDER BY c.pacing_score DESC LIMIT 5",
                latency: "0.4ms",
              },
              {
                action: "BRANCH EDIT VERSION",
                cypher: "MATCH (v_old:EditVersion {id: $v1}) CREATE (v_new:EditVersion {version: 2})-[:DERIVED_FROM]->(v_old)",
                latency: "0.6ms",
              },
              {
                action: "REINFORCE PREFERENCE",
                cypher: "MATCH (p:CreatorPreference {rule_id: 'pref_hook'}) SET p.reinforced_sessions = p.reinforced_sessions + 1",
                latency: "0.3ms",
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "#0C0C0E",
                  border: "1px solid #1F1F26",
                  borderRadius: "5px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "9.5px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600 }}>
                    {item.action}
                  </span>
                  <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "#10B981" }}>
                    {item.latency}
                  </span>
                </div>
                <code style={{ fontSize: "10.5px", color: "#A1A1AA", fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.4 }}>
                  {item.cypher}
                </code>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #1F1F26", paddingTop: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#D4D4D8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Learned Creator Memory Rules ({preferences.length})
              </span>
              <button
                onClick={onManagePreferences}
                style={{ padding: "2px 6px", fontSize: "10.5px", background: "transparent", border: "none", color: "#A1A1AA", cursor: "pointer" }}
              >
                Manage Rules ➔
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {preferences.slice(0, 2).map((pref) => (
                <div
                  key={pref.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#0C0C0E",
                    border: "1px solid #1F1F26",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    fontSize: "11px",
                  }}
                >
                  <span className="truncate" style={{ color: "#E4E4E7", maxWidth: "260px" }}>
                    {pref.rule_text}
                  </span>
                  <span className="tech-tag-amber">
                    {pref.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
