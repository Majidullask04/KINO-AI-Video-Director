"use client";

import React, { useState } from "react";
import { FolderUp, Upload, RefreshCw, Target, X, Check, CheckCircle2 } from "lucide-react";
import { VideoClip, ClipFitAnalysis, formatSMPTE } from "@/types";
import { backendMediaUrl } from "@/utils/media";

interface FootageViewProps {
  sourceClips: VideoClip[];
  isUploadingFootage: boolean;
  uploadStatusText: string;
  selectedClipFitAnalysis: ClipFitAnalysis | null;
  isAnalyzingFit: boolean;
  isAssigningClip: boolean;
  toastNotice: string | null;
  onUploadFootageFiles: (files: FileList | File[]) => Promise<void>;
  onLoadDemoFootage: () => Promise<void>;
  onAnalyzeClipFit: (clipId: string) => Promise<void>;
  onAssignClipToBeat: (clipId: string, beatIndex: number, beatId?: string) => Promise<void>;
  onCloseFitModal: () => void;
  onCloseToast: () => void;
}

export const FootageView: React.FC<FootageViewProps> = ({
  sourceClips,
  isUploadingFootage,
  uploadStatusText,
  selectedClipFitAnalysis,
  isAnalyzingFit,
  isAssigningClip,
  toastNotice,
  onUploadFootageFiles,
  onLoadDemoFootage,
  onAnalyzeClipFit,
  onAssignClipToBeat,
  onCloseFitModal,
  onCloseToast,
}) => {
  const [clipFilter, setClipFilter] = useState<string>("all");

  const filteredClips = (sourceClips.length > 0 ? sourceClips : [
    {
      clip_id: "clip_01",
      filename: "raw_hook_talking_head.mp4",
      shot_type: "TALKING_HEAD",
      clip_duration: 3.2,
      visual_summary: "Close-up talking head delivery with direct gaze and high engagement.",
      tags: ["EXPLAINER", "HOOK", "TALKING_HEAD"],
      energy_level: 5,
      edge_density: 0.05,
    },
    {
      clip_id: "clip_02",
      filename: "raw_closeup_code.mp4",
      shot_type: "CODE_SCREEN",
      clip_duration: 2.8,
      visual_summary: "High-contrast code editor and graph query traversal terminal.",
      tags: ["CODE", "DEVELOPER", "CLOSEUP"],
      energy_level: 3,
      edge_density: 0.14,
    },
    {
      clip_id: "clip_03",
      filename: "raw_broll_lifestyle.mp4",
      shot_type: "BROLL",
      clip_duration: 4.1,
      visual_summary: "Studio director workspace showing timeline tracks and dual monitors.",
      tags: ["STUDIO", "HARDWARE", "BROLL"],
      energy_level: 4,
      edge_density: 0.06,
    },
    {
      clip_id: "clip_04",
      filename: "raw_energetic_broll.mp4",
      shot_type: "BROLL",
      clip_duration: 3.0,
      visual_summary: "High-velocity kinetic motion graphics and outdoor B-roll cut.",
      tags: ["FAST", "BROLL", "CINEMATIC"],
      energy_level: 5,
      edge_density: 0.05,
    },
    {
      clip_id: "clip_05",
      filename: "raw_product_demo.mp4",
      shot_type: "PRODUCT_SHOT",
      clip_duration: 2.5,
      visual_summary: "Product UI walkthrough displaying automated timeline synthesis.",
      tags: ["DEMO", "SOFTWARE", "NLE"],
      energy_level: 4,
      edge_density: 0.09,
    },
  ] as unknown as VideoClip[]).filter((clip) => {
    const st = (clip.shot_type || "").toLowerCase();
    if (clipFilter === "dialog") return st.includes("talking") || st.includes("head");
    if (clipFilter === "broll") return st.includes("broll") || st.includes("action") || st.includes("lifestyle");
    if (clipFilter === "pacing") return (clip.energy_level || 3) >= 4;
    return true;
  });

  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* 1. Raw Footage Upload & Computer Vision Dropzone */}
      <div
        className="studio-card"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onUploadFootageFiles(e.dataTransfer.files);
          }
        }}
        style={{
          border: "1px dashed #27272A",
          backgroundColor: "#09090C",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          position: "relative",
          borderRadius: "6px",
        }}
      >
        <input
          id="media-footage-upload-input"
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUploadFootageFiles(e.target.files);
            }
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "6px",
                backgroundColor: "#1C1C22",
                border: "1px solid #27272A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F59E0B",
                flexShrink: 0,
              }}
            >
              <FolderUp size={18} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6", letterSpacing: "-0.01em" }}>
                  INGEST RAW FOOTAGE & COMPUTER VISION ANALYSIS
                </span>
                <span className="tech-tag" style={{ color: "#06B6D4", borderColor: "rgba(6, 182, 212, 0.3)" }}>
                  OpenCV + Gemini 2.5 Flash
                </span>
              </div>
              <p style={{ fontSize: "11.5px", color: "#71717A", margin: "3px 0 0", lineHeight: 1.4 }}>
                Drag & drop video clips (.mp4, .mov, .webm) or browse files. Real frames are sampled for motion magnitude, energy level (1–5), edge density, and shot type, then matched to StoryBeats.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => document.getElementById("media-footage-upload-input")?.click()}
              disabled={isUploadingFootage}
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Upload size={13} />
              Select Video Files
            </button>
            <button
              type="button"
              onClick={onLoadDemoFootage}
              disabled={isUploadingFootage}
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={13} className={isUploadingFootage ? "spin" : ""} />
              Quick Ingest Demo Pack
            </button>
          </div>
        </div>

        {isUploadingFootage && (
          <div
            style={{
              borderTop: "1px solid #1C1C22",
              paddingTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#F59E0B" }} />
                {uploadStatusText || "Processing video frames..."}
              </span>
              <span className="font-timecode" style={{ fontSize: "10px", color: "#71717A" }}>
                FRAME SAMPLING & GEMINI ANALYSIS
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "4px",
                backgroundColor: "#18181B",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "70%",
                  height: "100%",
                  backgroundColor: "#F59E0B",
                  borderRadius: "2px",
                  animation: "pulse 1.5s infinite",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Filter Bar & Metadata Metrics */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {[
            { id: "all", label: `All Clips (${sourceClips.length || 5})` },
            { id: "dialog", label: "Dialog / Talking Head" },
            { id: "broll", label: "B-Roll & Action" },
            { id: "pacing", label: "High Pacing (4+)" },
          ].map((filter) => {
            const isActive = clipFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setClipFilter(filter.id)}
                style={{
                  backgroundColor: isActive ? "#F4F4F6" : "#121215",
                  color: isActive ? "#09090B" : "#A1A1AA",
                  border: isActive ? "1px solid #FFFFFF" : "1px solid #222228",
                  fontWeight: isActive ? 600 : 450,
                  borderRadius: "4px",
                  padding: "5px 10px",
                  fontSize: "11.5px",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "#71717A" }}>
          <span>Indexed: <strong style={{ color: "#F4F4F6" }}>{sourceClips.length || 5} clips</strong></span>
          <span>•</span>
          <span>CV Telemetry: <strong style={{ color: "#10B981" }}>Active</strong></span>
        </div>
      </div>

      {/* 3. 3-Column Video Contact Sheet Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
        {filteredClips.map((clip) => {
          const clipPath = clip.video_url || (clip.filename ? `/static/${clip.filename.includes("upload") ? clip.filename : `samples/${clip.filename}`}` : "");
          const videoSrc = clipPath ? backendMediaUrl(clipPath) : "";
          return (
            <div
              key={clip.clip_id}
              className="studio-card"
              style={{
                padding: "0",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: "0",
                border: "1px solid #1C1C22",
                transition: "border-color 0.15s ease",
              }}
            >
              <div
                style={{
                  aspectRatio: "16/9",
                  backgroundColor: "#050507",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <video
                  src={`${videoSrc}#t=0.5`}
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
                />

                <div style={{ position: "absolute", top: "8px", left: "8px", pointerEvents: "none" }}>
                  <span className="tech-tag" style={{ backgroundColor: "rgba(12, 12, 14, 0.85)", textTransform: "uppercase" }}>
                    {clip.shot_type}
                  </span>
                </div>

                <div style={{ position: "absolute", bottom: "8px", right: "8px", pointerEvents: "none" }}>
                  <span className="font-timecode" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(0,0,0,0.8)", color: "#F4F4F6", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {formatSMPTE(clip.clip_duration || 3.0)}
                  </span>
                </div>
              </div>

              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#F4F4F6", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {clip.filename || clip.clip_id}
                  </span>
                  <span style={{ fontSize: "10px", color: "#10B981", fontFamily: "ui-monospace, monospace" }}>
                    {clip.edge_density ? `Edges: ${clip.edge_density}` : ""}
                  </span>
                </div>

                <p style={{ fontSize: "11px", color: "#71717A", margin: 0, lineHeight: 1.4, minHeight: "30px" }}>
                  &quot;{clip.visual_summary || clip.transcript || `Detected ${clip.shot_type} footage`}&quot;
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {clip.tags?.slice(0, 4).map((t) => (
                    <span key={t} className="tech-tag" style={{ fontSize: "9px", padding: "1px 5px" }}>
                      {t}
                    </span>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #1C1C22", paddingTop: "10px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                    Pacing {clip.energy_level}/5
                  </span>
                  <div style={{ display: "flex", gap: "3px", width: "70px" }}>
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        style={{
                          flex: 1,
                          height: "4px",
                          borderRadius: "1px",
                          backgroundColor: lvl <= clip.energy_level ? "#F59E0B" : "#222228",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAnalyzeClipFit(clip.clip_id)}
                  disabled={isAnalyzingFit}
                  className="btn-secondary"
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "11px",
                    padding: "6px 8px",
                  }}
                >
                  <Target size={12} style={{ color: "#F59E0B" }} />
                  Analyze StoryBeat Fit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. AI StoryBeat Fit Recommender Modal Overlay */}
      {selectedClipFitAnalysis && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={onCloseFitModal}
        >
          <div
            className="studio-card"
            style={{
              width: "920px",
              maxWidth: "96vw",
              maxHeight: "90vh",
              backgroundColor: "#0D0D11",
              border: "1px solid #27272A",
              borderRadius: "8px",
              padding: "0",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.85)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #1C1C22",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#111116",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "5px",
                    backgroundColor: "#1C1C22",
                    border: "1px solid #27272A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#F59E0B",
                  }}
                >
                  <Target size={16} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#F4F4F6", letterSpacing: "-0.01em" }}>
                      AI STORYBEAT FIT RECOMMENDER
                    </span>
                    <span className="tech-tag" style={{ textTransform: "uppercase" }}>
                      {selectedClipFitAnalysis.shot_type}
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#71717A", margin: "2px 0 0" }}>
                    Clip: <strong style={{ color: "#A1A1AA" }}>{selectedClipFitAnalysis.filename}</strong> ({selectedClipFitAnalysis.duration.toFixed(1)}s, Energy {selectedClipFitAnalysis.energy_level}/5)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCloseFitModal}
                style={{
                  background: "none",
                  border: "none",
                  color: "#71717A",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.35fr",
                gap: "0",
                overflowY: "auto",
                maxHeight: "calc(90vh - 70px)",
              }}
            >
              {/* Left Column: Video & Telemetry */}
              <div
                style={{
                  padding: "20px",
                  borderRight: "1px solid #1C1C22",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  backgroundColor: "#0A0A0D",
                }}
              >
                <div
                  style={{
                    aspectRatio: "16/9",
                    backgroundColor: "#000",
                    borderRadius: "5px",
                    overflow: "hidden",
                    position: "relative",
                    border: "1px solid #222228",
                  }}
                >
                  <video
                    src={backendMediaUrl(`/static/${selectedClipFitAnalysis.filename.includes("upload") ? selectedClipFitAnalysis.filename : `samples/${selectedClipFitAnalysis.filename}`}`)}
                    controls
                    autoPlay
                    loop
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div
                  style={{
                    backgroundColor: "#121216",
                    border: "1px solid #1C1C22",
                    borderRadius: "5px",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#A1A1AA", letterSpacing: "0.04em" }}>
                      COMPUTER VISION & GEMINI METRICS
                    </span>
                    <span style={{ fontSize: "9.5px", color: "#10B981", fontFamily: "ui-monospace, monospace" }}>
                      CALIBRATED
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "2px" }}>
                    <div style={{ backgroundColor: "#18181D", padding: "6px 8px", borderRadius: "4px" }}>
                      <div style={{ fontSize: "9.5px", color: "#71717A" }}>Detected Shot Type</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#F4F4F6", textTransform: "capitalize" }}>
                        {selectedClipFitAnalysis.shot_type.replace("_", " ")}
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#18181D", padding: "6px 8px", borderRadius: "4px" }}>
                      <div style={{ fontSize: "9.5px", color: "#71717A" }}>Visual Pacing / Energy</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#F59E0B" }}>
                        Level {selectedClipFitAnalysis.energy_level}/5
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#18181D", padding: "6px 8px", borderRadius: "4px" }}>
                      <div style={{ fontSize: "9.5px", color: "#71717A" }}>Motion Score</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#06B6D4", fontFamily: "ui-monospace, monospace" }}>
                        {selectedClipFitAnalysis.motion_score.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#18181D", padding: "6px 8px", borderRadius: "4px" }}>
                      <div style={{ fontSize: "9.5px", color: "#71717A" }}>Edge Density</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#8B5CF6", fontFamily: "ui-monospace, monospace" }}>
                        {selectedClipFitAnalysis.edge_density || 0.08}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "10.5px", color: "#71717A", marginTop: "4px", lineHeight: 1.4 }}>
                    {selectedClipFitAnalysis.visual_summary}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                    {selectedClipFitAnalysis.tags?.map((t) => (
                      <span key={t} className="tech-tag" style={{ fontSize: "9px", padding: "1px 5px" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Ranked Recommendations */}
              <div
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  backgroundColor: "#0D0D11",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#A1A1AA", letterSpacing: "0.04em" }}>
                    NARRATIVE STORYBEAT COMPATIBILITY RANKING
                  </span>
                  <span style={{ fontSize: "10px", color: "#71717A" }}>
                    {selectedClipFitAnalysis.ranked_recommendations?.length || 4} Beats Evaluated
                  </span>
                </div>

                {selectedClipFitAnalysis.best_fit_beat && (
                  <div
                    style={{
                      backgroundColor: "#131318",
                      border: "1px solid #F59E0B",
                      borderRadius: "6px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      boxShadow: "0 4px 20px rgba(245, 158, 11, 0.08)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#09090B",
                          backgroundColor: "#F59E0B",
                          padding: "2px 7px",
                          borderRadius: "3px",
                          letterSpacing: "0.03em",
                        }}
                      >
                        #1 BEST FIT RECOMMENDATION
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#10B981",
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          padding: "2px 6px",
                          borderRadius: "3px",
                        }}
                      >
                        {selectedClipFitAnalysis.best_fit_beat.recommendation_tier}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6" }}>
                          Beat {selectedClipFitAnalysis.best_fit_beat.beat_index} — {selectedClipFitAnalysis.best_fit_beat.role_label}
                        </span>
                        <div style={{ fontSize: "11px", color: "#71717A", marginTop: "2px" }}>
                          Target Duration: {selectedClipFitAnalysis.best_fit_beat.target_duration}s • Required: {selectedClipFitAnalysis.best_fit_beat.required_shot_type}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "20px",
                          fontWeight: 800,
                          color: "#F59E0B",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {selectedClipFitAnalysis.best_fit_beat.fit_percentage}%
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: "11.5px",
                        color: "#D4D4D8",
                        lineHeight: 1.45,
                        margin: "2px 0",
                        backgroundColor: "#18181E",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        borderLeft: "2px solid #F59E0B",
                      }}
                    >
                      &quot;{selectedClipFitAnalysis.best_fit_beat.rationale}&quot;
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "10px" }}>
                      <span className="tech-tag">Shot Type: {selectedClipFitAnalysis.best_fit_beat.breakdown.shot_type_score}/40</span>
                      <span className="tech-tag">Pacing: {selectedClipFitAnalysis.best_fit_beat.breakdown.energy_score}/25</span>
                      <span className="tech-tag">Duration: {selectedClipFitAnalysis.best_fit_beat.breakdown.duration_score}/15</span>
                      {selectedClipFitAnalysis.best_fit_beat.breakdown.preference_bonus !== 0 && (
                        <span className="tech-tag" style={{ color: selectedClipFitAnalysis.best_fit_beat.breakdown.preference_bonus > 0 ? "#10B981" : "#EF4444" }}>
                          Taste Bonus: {selectedClipFitAnalysis.best_fit_beat.breakdown.preference_bonus > 0 ? "+" : ""}{selectedClipFitAnalysis.best_fit_beat.breakdown.preference_bonus}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAssignClipToBeat(
                          selectedClipFitAnalysis.clip_id,
                          selectedClipFitAnalysis.best_fit_beat.beat_index,
                          selectedClipFitAnalysis.best_fit_beat.beat_id
                        );
                      }}
                      disabled={isAssigningClip}
                      className="btn-primary"
                      style={{
                        marginTop: "4px",
                        justifyContent: "center",
                        gap: "8px",
                        fontWeight: 600,
                        fontSize: "12px",
                        padding: "8px 12px",
                      }}
                    >
                      <Check size={14} />
                      {isAssigningClip ? "Synthesizing New Timeline Edit..." : `Assign to Timeline as Beat ${selectedClipFitAnalysis.best_fit_beat.beat_index}`}
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <span style={{ fontSize: "10.5px", color: "#71717A", fontWeight: 600 }}>
                    ALTERNATIVE STORYBEAT MATCHES
                  </span>
                  {selectedClipFitAnalysis.ranked_recommendations?.slice(1).map((rec) => (
                    <div
                      key={rec.beat_id}
                      style={{
                        backgroundColor: "#111115",
                        border: "1px solid #1C1C22",
                        borderRadius: "5px",
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                            #{rec.rank}
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#F4F4F6" }}>
                            Beat {rec.beat_index}: {rec.role_label}
                          </span>
                          <span
                            className="tech-tag"
                            style={{
                              fontSize: "8.5px",
                              padding: "1px 4px",
                              color: rec.recommendation_tier === "STRONG FIT" ? "#06B6D4" : rec.recommendation_tier === "ALTERNATIVE FIT" ? "#A1A1AA" : "#EF4444",
                            }}
                          >
                            {rec.recommendation_tier}
                          </span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
                          {rec.fit_percentage}%
                        </span>
                      </div>

                      <div style={{ fontSize: "10.5px", color: "#71717A", lineHeight: 1.35 }}>
                        {rec.rationale}
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
                        <button
                          type="button"
                          onClick={() => onAssignClipToBeat(selectedClipFitAnalysis.clip_id, rec.beat_index, rec.beat_id)}
                          disabled={isAssigningClip}
                          className="btn-secondary"
                          style={{ fontSize: "10.5px", padding: "4px 8px", gap: "4px" }}
                        >
                          Assign to Beat {rec.beat_index}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Notification Toast HUD */}
      {toastNotice && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 200,
            backgroundColor: "#121217",
            border: "1px solid #10B981",
            borderRadius: "6px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          }}
        >
          <CheckCircle2 size={16} style={{ color: "#10B981", flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 500 }}>
            {toastNotice}
          </span>
          <button
            type="button"
            onClick={onCloseToast}
            style={{ background: "none", border: "none", color: "#71717A", cursor: "pointer", padding: "2px" }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
