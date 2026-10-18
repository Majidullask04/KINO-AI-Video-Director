"use client";

import React, { useState } from "react";
import { Search, Plus, ArrowRight } from "lucide-react";
import { Project, formatSMPTE } from "@/types";
import { DEMO_REFERENCE_VIDEO } from "@/utils/media";

interface DashboardViewProps {
  projects: Project[];
  activeProject: Project | null;
  isSeeding: boolean;
  onSelectProject: (p: Project) => void;
  onOpenProjectInStudio: (p: Project) => void;
  onOpenProjectDiff: (p: Project) => void;
  onSeedDemo: () => void;
  onNewProject: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  activeProject,
  isSeeding,
  onOpenProjectInStudio,
  onOpenProjectDiff,
  onSeedDemo,
  onNewProject,
}) => {
  const [projectSearch, setProjectSearch] = useState("");

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#121215",
              border: "1px solid #222228",
              borderRadius: "5px",
              padding: "4px 10px",
              width: "260px",
            }}
          >
            <Search size={13} color="#71717A" />
            <input
              type="text"
              placeholder="Filter productions..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: "12px",
                color: "#F4F4F6",
                width: "100%",
                outline: "none",
              }}
            />
          </div>
          <span className="tech-tag">
            {projects.length} PRODUCTIONS
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={onSeedDemo}
            disabled={isSeeding}
            className="btn-secondary"
          >
            {isSeeding ? "Seeding..." : "Quick Re-Seed"}
          </button>
          <button
            onClick={onNewProject}
            className="btn-primary"
          >
            <Plus size={14} strokeWidth={2} />
            <span>New Production</span>
          </button>
        </div>
      </div>

      {/* Grid of Production Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
        {filteredProjects.map((p) => {
          const isCurrentActive = activeProject?.id === p.id;
          return (
            <div
              key={p.id}
              className="studio-card"
              style={{
                padding: "0",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                borderColor: isCurrentActive ? "#F59E0B" : "#222228",
                boxShadow: isCurrentActive ? "0 0 0 1px #F59E0B" : "none",
              }}
            >
              {/* 16:9 Real Video Thumbnail Header */}
              <div
                style={{
                  aspectRatio: "16/9",
                  backgroundColor: "#050507",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <video
                  src={`${DEMO_REFERENCE_VIDEO}#t=0.5`}
                  muted
                  playsInline
                  loop
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0.5;
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    cursor: "pointer",
                  }}
                  onClick={() => onOpenProjectInStudio(p)}
                />

                <div style={{ position: "absolute", top: "8px", left: "8px", pointerEvents: "none" }}>
                  <span className="tech-tag" style={{ backgroundColor: "rgba(12, 12, 14, 0.85)" }}>
                    {p.aspect_ratio || "16:9"}
                  </span>
                </div>

                <div style={{ position: "absolute", bottom: "8px", right: "8px", pointerEvents: "none" }}>
                  <span className="font-timecode" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(0,0,0,0.8)", color: "#F4F4F6", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {formatSMPTE(p.target_duration || 12.0)}
                  </span>
                </div>
              </div>

              {/* Card Meta & Actions */}
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1, justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>
                      {p.category}
                    </span>
                    <span className="tech-tag-amber" style={{ fontSize: "9.5px" }}>
                      v{p.version_count || 1} Active
                    </span>
                  </div>
                  <h3 style={{ fontSize: "13.5px", fontWeight: 600, color: "#F4F4F6", margin: "0 0 4px 0", lineHeight: 1.3 }}>
                    {p.title}
                  </h3>
                  <span style={{ fontSize: "11px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                    Mood: {p.mood || "upbeat"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1C1C22", paddingTop: "10px", marginTop: "4px" }}>
                  <button
                    onClick={() => onOpenProjectDiff(p)}
                    className="btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                  >
                    Diff Lineage
                  </button>
                  <button
                    onClick={() => onOpenProjectInStudio(p)}
                    className="btn-primary"
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                  >
                    <span>Open Workspace</span>
                    <ArrowRight size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
