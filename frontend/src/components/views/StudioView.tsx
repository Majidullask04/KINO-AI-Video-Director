"use client";

import React, { useState, useRef } from "react";
import {
  Tv,
  Grid,
  Square,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Upload,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import {
  Project,
  CutDecision,
  EditVersion,
  GraphState,
  CreatorPreference,
  formatSMPTE,
} from "@/types";
import { StudioTimeline } from "@/components/StudioTimeline";
import { GraphInspector } from "@/components/GraphInspector";
import { DirectorChat } from "@/components/DirectorChat";
import { DEMO_REFERENCE_VIDEO } from "@/utils/media";

interface StudioViewProps {
  activeProject: Project | null;
  activePreviewUrl: string;
  versions: EditVersion[];
  decisions: CutDecision[];
  selectedDecision: CutDecision | null;
  graphState: GraphState | null;
  preferences: CreatorPreference[];
  directorBriefing: string | null;
  isRevising: boolean;
  isUploadingFootage: boolean;
  uploadStatusText: string;
  isSubmittingFeedback: boolean;
  onSelectDecision: (d: CutDecision) => void;
  onSendRevision: (prompt: string) => Promise<void>;
  onRefreshGraph: () => void;
  onSubmitFeedback: (decision: CutDecision, action: "keep" | "replace" | "reject", reason?: string) => Promise<void>;
  onUploadFootageFiles: (files: FileList | File[]) => Promise<void>;
}

export const StudioView: React.FC<StudioViewProps> = ({
  activeProject,
  activePreviewUrl,
  versions,
  decisions,
  selectedDecision,
  graphState,
  preferences,
  directorBriefing,
  isRevising,
  isUploadingFootage,
  uploadStatusText,
  isSubmittingFeedback,
  onSelectDecision,
  onSendRevision,
  onRefreshGraph,
  onSubmitFeedback,
  onUploadFootageFiles,
}) => {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [showGraphInspector, setShowGraphInspector] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleStepFrame = (deltaFrames: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime + deltaFrames * (1 / 24));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const currentlyPlayingCut = decisions.find(
    (d) => currentTime >= d.source_in_sec && currentTime <= d.source_out_sec
  );

  return (
    <div className="studio-body">
      {/* Left/Center Column */}
      <div className="studio-center-column">
        {/* Top Stage */}
        <div className="studio-stage" style={{ gridTemplateColumns: showGraphInspector ? "1fr 1fr" : "1fr" }}>
          {/* Left Card: Program Video Monitor */}
          <div
            className="studio-card"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              padding: "0",
              overflow: "hidden",
            }}
          >
            {/* Top Monitor Bar */}
            <div
              style={{
                padding: "8px 12px",
                backgroundColor: "#0C0C0E",
                borderBottom: "1px solid #1F1F26",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Tv size={13} color="#F59E0B" />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#F4F4F6", letterSpacing: "0.02em" }}>
                  PROGRAM MONITOR
                </span>
                <span className="tech-tag" style={{ fontSize: "9px" }}>
                  {activeProject?.aspect_ratio || "16:9"} • 1080P • 24 FPS
                </span>
              </div>

              {/* Hidden upload input for studio editor */}
              <input
                id="studio-footage-upload-input"
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

              {/* Guide Overlay Toggles & Footage Upload */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => document.getElementById("studio-footage-upload-input")?.click()}
                  disabled={isUploadingFootage}
                  className="btn-secondary"
                  style={{
                    padding: "3px 8px",
                    fontSize: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    color: "#F59E0B",
                    borderColor: "rgba(245, 158, 11, 0.3)",
                  }}
                  title="Upload video clips to this project without leaving the editor"
                >
                  <Upload size={11} />
                  <span>{isUploadingFootage ? "Ingesting..." : "+ Add Footage"}</span>
                </button>

                <button
                  onClick={() => setShowGridOverlay(!showGridOverlay)}
                  style={{
                    padding: "3px 7px",
                    fontSize: "10.5px",
                    backgroundColor: showGridOverlay ? "#1F1F28" : "transparent",
                    borderColor: showGridOverlay ? "#3F3F46" : "transparent",
                    color: showGridOverlay ? "#F4F4F6" : "#71717A",
                  }}
                  title="Rule of Thirds Grid"
                >
                  <Grid size={11} />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setShowSafeZone(!showSafeZone)}
                  style={{
                    padding: "3px 7px",
                    fontSize: "10.5px",
                    backgroundColor: showSafeZone ? "#1F1F28" : "transparent",
                    borderColor: showSafeZone ? "#3F3F46" : "transparent",
                    color: showSafeZone ? "#F4F4F6" : "#71717A",
                  }}
                  title="Action Safe Zone"
                >
                  <Square size={11} />
                  <span>Safe</span>
                </button>
                <button
                  onClick={() => setShowGraphInspector(!showGraphInspector)}
                  style={{
                    padding: "3px 7px",
                    fontSize: "10.5px",
                    backgroundColor: showGraphInspector ? "#1F1F28" : "transparent",
                    borderColor: showGraphInspector ? "#3F3F46" : "transparent",
                    color: showGraphInspector ? "#10B981" : "#71717A",
                  }}
                  title="Toggle FalkorDB Graph Inspector"
                >
                  <GitBranch size={11} />
                  <span>Graph Inspector</span>
                </button>
              </div>
            </div>

            {/* Video Stage Frame with Direct Drag & Drop Footage Ingest */}
            <div
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
                flex: 1,
                backgroundColor: "#050507",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                minHeight: "220px",
              }}
            >
              {isUploadingFootage && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(9, 9, 11, 0.88)",
                    backdropFilter: "blur(4px)",
                    zIndex: 35,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  <RefreshCw size={24} className="spin" style={{ color: "#F59E0B" }} />
                  <span style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600 }}>
                    {uploadStatusText || "Ingesting & Analyzing Video Footage with OpenCV & Gemini..."}
                  </span>
                  <span className="font-timecode" style={{ fontSize: "10px", color: "#A1A1AA" }}>
                    FRAME SAMPLING • GEMINI 2.5 FLASH • FALKORDB BEAT FIT • EDIT SYNTHESIS
                  </span>
                </div>
              )}

              {showSafeZone && (
                <div
                  style={{
                    position: "absolute",
                    inset: "24px",
                    border: "1px dashed rgba(6, 182, 212, 0.4)",
                    pointerEvents: "none",
                    zIndex: 20,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-end",
                    padding: "4px",
                  }}
                >
                  <span style={{ fontSize: "8px", fontFamily: "ui-monospace, monospace", color: "rgba(6, 182, 212, 0.7)" }}>
                    90% SAFE ZONE
                  </span>
                </div>
              )}

              {showGridOverlay && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gridTemplateRows: "repeat(3, 1fr)",
                    pointerEvents: "none",
                    zIndex: 20,
                  }}
                >
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }} />
                  <div />
                </div>
              )}

              <video
                ref={videoRef}
                src={activePreviewUrl || DEMO_REFERENCE_VIDEO}
                onTimeUpdate={handleTimeUpdate}
                loop={isLooping}
                onClick={handleTogglePlay}
                style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }}
              />
            </div>

            {/* Bottom Transport HUD */}
            <div
              style={{
                padding: "8px 12px",
                backgroundColor: "#0C0C0E",
                borderTop: "1px solid #1F1F26",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() => handleStepFrame(-1)}
                  style={{ padding: "4px 6px" }}
                  title="Step Back 1 Frame (-1f)"
                >
                  <SkipBack size={12} />
                </button>

                <button
                  onClick={handleTogglePlay}
                  style={{
                    backgroundColor: "#F4F4F6",
                    color: "#09090B",
                    border: "none",
                    width: "24px",
                    height: "24px",
                    borderRadius: "4px",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  {isPlaying ? <Pause size={12} /> : <Play size={12} fill="#09090B" />}
                </button>

                <button
                  onClick={() => handleStepFrame(1)}
                  style={{ padding: "4px 6px" }}
                  title="Step Forward 1 Frame (+1f)"
                >
                  <SkipForward size={12} />
                </button>

                <button
                  onClick={() => setIsLooping(!isLooping)}
                  style={{
                    padding: "4px 6px",
                    color: isLooping ? "#F59E0B" : "#71717A",
                  }}
                  title="Loop Playback"
                >
                  <Repeat size={12} />
                </button>

                <span className="font-timecode" style={{ fontSize: "11.5px", color: "#F4F4F6", fontWeight: 600, marginLeft: "4px" }}>
                  {formatSMPTE(currentTime)} / {formatSMPTE(activeProject?.target_duration || 12.0)}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="tech-tag-amber" style={{ fontSize: "9.5px" }}>
                  {currentlyPlayingCut
                    ? `BEAT 0${currentlyPlayingCut.order} // ${currentlyPlayingCut.narrative_beat.toUpperCase()}`
                    : "BEAT 01 // HOOK"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Card: GraphInspector (Togglable) */}
          {showGraphInspector && (
            <div className="studio-card" style={{ height: "100%", padding: "0", overflow: "hidden" }}>
              <GraphInspector
                selectedDecision={selectedDecision}
                graphState={graphState}
                onRefreshGraph={onRefreshGraph}
                onSubmitFeedback={onSubmitFeedback}
                isSubmittingFeedback={isSubmittingFeedback}
              />
            </div>
          )}
        </div>

        {/* Bottom Dock: Multitrack Timeline */}
        <div className="studio-timeline-dock">
          <StudioTimeline
            decisions={decisions}
            selectedDecisionId={selectedDecision?.decision_id || null}
            onSelectDecision={onSelectDecision}
            currentTime={currentTime}
            totalDuration={activeProject?.target_duration || 12.0}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            activeVersionNum={versions.length > 0 ? versions[versions.length - 1].version_num : 1}
          />
        </div>
      </div>

      {/* Right Column: Editorial Copilot */}
      <div className="studio-chat-sidebar">
        <DirectorChat
          onSendRevision={onSendRevision}
          isRevising={isRevising}
          activeVersionNum={versions.length > 0 ? versions[versions.length - 1].version_num : 1}
          creatorPreferences={preferences}
          initialBriefing={directorBriefing}
        />
      </div>
    </div>
  );
};
