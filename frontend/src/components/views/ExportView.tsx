"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import { Project, CutDecision, EditVersion } from "@/types";
import { DEMO_REFERENCE_VIDEO } from "@/utils/media";

interface ExportViewProps {
  activeProject: Project | null;
  activePreviewUrl: string;
  versions: EditVersion[];
  decisions: CutDecision[];
}

export const ExportView: React.FC<ExportViewProps> = ({
  activeProject,
  activePreviewUrl,
  versions,
  decisions,
}) => {
  const [exportPreset, setExportPreset] = useState<string>("h264");
  const [exportResolution, setExportResolution] = useState<string>("1080p");
  const [exportFrameRate, setExportFrameRate] = useState<string>("24 FPS");

  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
        {/* Left: Codec Presets & Export Actions */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
              MASTER ENCODING // DELIVERY
            </span>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
              Broadcast Render & Export Presets
            </h2>
            <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
              Select distribution packaging and download the rendered master or cut-list decision table.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              {
                id: "h264",
                name: "H.264 MP4 Master",
                specs: "MP4 • H.264 / AAC • 25 Mbps • High Profile",
                desc: "Universal web and streaming distribution format with fast-start moov atom.",
              },
              {
                id: "prores",
                name: "ProRes 422 LT Broadcast",
                specs: "MOV • ProRes 422 • 10-Bit 4:2:2 • Rec.709",
                desc: "Master archiving and high-fidelity grading roundtrip format.",
              },
              {
                id: "edl",
                name: "FalkorDB Cut-List JSON / EDL",
                specs: "JSON • OpenCypher Traceability • SMPTE In/Out",
                desc: "Machine-readable decision list for DaVinci Resolve and Premiere Pro import.",
              },
            ].map((preset) => {
              const isSelected = exportPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setExportPreset(preset.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "5px",
                    backgroundColor: isSelected ? "#1C1C24" : "#101014",
                    border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    transition: "all 0.12s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: isSelected ? "#F4F4F6" : "#D4D4D8" }}>
                      {preset.name}
                    </span>
                    {isSelected && (
                      <span className="tech-tag-amber" style={{ fontSize: "9px" }}>
                        SELECTED
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
                    {preset.specs}
                  </span>
                  <span style={{ fontSize: "11px", color: "#71717A", marginTop: "2px" }}>
                    {preset.desc}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#D4D4D8", marginBottom: "4px" }}>
                Resolution
              </label>
              <select
                value={exportResolution}
                onChange={(e) => setExportResolution(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="1080p">1080P (1920×1080)</option>
                <option value="4k">4K UHD (3840×2160)</option>
                <option value="720p">720P Proxy (1280×720)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#D4D4D8", marginBottom: "4px" }}>
                Timebase
              </label>
              <select
                value={exportFrameRate}
                onChange={(e) => setExportFrameRate(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="24 FPS">24 FPS Film</option>
                <option value="30 FPS">30 FPS Broadcast</option>
                <option value="60 FPS">60 FPS High-Motion</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: "10px", display: "flex", gap: "10px" }}>
            <a
              href={activePreviewUrl || DEMO_REFERENCE_VIDEO}
              download={`${activeProject?.title || "director_ai"}_master.mp4`}
              className="btn-primary"
              style={{
                flex: 1,
                textDecoration: "none",
                padding: "10px",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Download size={14} strokeWidth={2} />
              <span>Download Master MP4</span>
            </a>

            <button
              type="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(decisions, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `kino_studio_cutlist_${activeProject?.id || "project"}.json`;
                a.click();
              }}
              className="btn-secondary"
              style={{ padding: "10px 14px" }}
            >
              Export Cut JSON
            </button>
          </div>
        </div>

        {/* Right: Master Render Preview Player & Spec Sheet */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
              RENDER VERIFICATION
            </span>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
              Master Render Preview Player
            </h2>
          </div>

          <div
            style={{
              aspectRatio: "16/9",
              backgroundColor: "#050507",
              border: "1px solid #1F1F26",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            <video
              controls
              src={activePreviewUrl || DEMO_REFERENCE_VIDEO}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F26", borderRadius: "5px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#F59E0B", fontFamily: "ui-monospace, monospace", textTransform: "uppercase" }}>
              TECHNICAL SPECIFICATION SHEET
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
              <div>
                <span style={{ color: "#71717A" }}>Container: </span>
                <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>MP4 (MPEG-4 Part 14)</span>
              </div>
              <div>
                <span style={{ color: "#71717A" }}>Video Codec: </span>
                <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>H.264 / AVC</span>
              </div>
              <div>
                <span style={{ color: "#71717A" }}>Audio Codec: </span>
                <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>AAC-LC 48kHz Stereo</span>
              </div>
              <div>
                <span style={{ color: "#71717A" }}>Total Cuts: </span>
                <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>{decisions.length || 4} Segments</span>
              </div>
              <div>
                <span style={{ color: "#71717A" }}>Active Version ID: </span>
                <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>{versions[versions.length - 1]?.id || "v1"}</span>
              </div>
              <div>
                <span style={{ color: "#71717A" }}>Target Duration: </span>
                <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>{activeProject?.target_duration || 12.0}s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
