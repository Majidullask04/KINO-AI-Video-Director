"use client";

import React, { useState } from "react";

interface WizardViewProps {
  isLoading: boolean;
  onCreateProject: (projectData: {
    title: string;
    category: string;
    target_duration: number;
    mood: string;
    aspect_ratio: string;
  }) => Promise<void>;
}

export const WizardView: React.FC<WizardViewProps> = ({
  isLoading,
  onCreateProject,
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Technical Explainer");
  const [newDuration, setNewDuration] = useState(12.0);
  const [newMood, setNewMood] = useState("upbeat");
  const [newAspectRatio, setNewAspectRatio] = useState("16:9");
  const [newFrameRate, setNewFrameRate] = useState("24 FPS Film");
  const [newEditorialDirection, setNewEditorialDirection] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateProject({
      title: newTitle,
      category: newCategory,
      target_duration: newDuration,
      mood: newMood,
      aspect_ratio: newAspectRatio,
    });
  };

  return (
    <div className="page-scroll-container">
      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
        {/* Left Column: Production Brief */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
              SPECIFICATION SHEET // 01
            </span>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
              Production Brief & Content Scope
            </h2>
            <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
              Define core project metadata. A dedicated (:Project) node will be committed to the FalkorDB property graph.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Production Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Neo-Tokyo Commercial / Fall 2026 Director's Cut"
              required
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Format Preset
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
              {[
                "Documentary / Essay",
                "Technical Explainer",
                "Product Reveal",
                "Podcast / Interview",
                "Vertical Short",
              ].map((cat) => {
                const isSelected = newCategory === cat;
                return (
                  <div
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "5px",
                      backgroundColor: isSelected ? "#1C1C24" : "#101014",
                      border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 600, color: isSelected ? "#F4F4F6" : "#A1A1AA" }}>
                      {cat}
                    </span>
                    <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                      Template Rule Chain
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Target Duration: <strong style={{ color: "#F59E0B" }}>{newDuration}s</strong>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[10.0, 12.0, 15.0, 30.0, 60.0].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setNewDuration(dur)}
                  style={{
                    flex: 1,
                    backgroundColor: newDuration === dur ? "#F59E0B" : "#121215",
                    color: newDuration === dur ? "#09090B" : "#A1A1AA",
                    border: newDuration === dur ? "1px solid #F59E0B" : "1px solid #222228",
                    fontWeight: 600,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {dur}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Editorial Direction & Pacing Mandates
            </label>
            <textarea
              value={newEditorialDirection}
              onChange={(e) => setNewEditorialDirection(e.target.value)}
              placeholder="e.g. High energy opening hook under 2.5s. Prioritize code closeups over talking head..."
              rows={3}
              style={{ width: "100%", resize: "none" }}
            />
          </div>
        </div>

        {/* Right Column: Technical Raster & Graph Schema */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
              SPECIFICATION SHEET // 02
            </span>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
              Technical Raster & Graph Schema
            </h2>
            <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
              Configure resolution constraints, frame pacing, and audio emotional resonance.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Canvas Aspect Ratio
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {[
                { id: "16:9", title: "16:9 Widescreen", sub: "1920×1080", width: 28, height: 16 },
                { id: "9:16", title: "9:16 Vertical", sub: "1080×1920", width: 14, height: 25 },
                { id: "1:1", title: "1:1 Square", sub: "1080×1080", width: 20, height: 20 },
              ].map((item) => {
                const isSelected = newAspectRatio === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setNewAspectRatio(item.id)}
                    style={{
                      padding: "12px 10px",
                      borderRadius: "5px",
                      backgroundColor: isSelected ? "#1C1C24" : "#101014",
                      border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: `${item.width}px`,
                        height: `${item.height}px`,
                        border: isSelected ? "1.5px solid #F59E0B" : "1.5px solid #3F3F46",
                        backgroundColor: isSelected ? "rgba(245, 158, 11, 0.15)" : "#16161A",
                        borderRadius: "2px",
                      }}
                    />
                    <div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: isSelected ? "#F4F4F6" : "#A1A1AA" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "9.5px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                        {item.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Master Timebase & Frame Rate
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {["24 FPS Film", "30 FPS Broadcast", "60 FPS High-Motion"].map((fps) => {
                const isSelected = newFrameRate === fps;
                return (
                  <button
                    key={fps}
                    type="button"
                    onClick={() => setNewFrameRate(fps)}
                    style={{
                      backgroundColor: isSelected ? "#1C1C24" : "#121215",
                      color: isSelected ? "#F4F4F6" : "#A1A1AA",
                      border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                      fontSize: "11px",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {fps}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
              Audio Mood & Pacing Profile
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              {["Upbeat", "Cinematic", "Conversational", "Dramatic"].map((mood) => {
                const isSelected = newMood.toLowerCase() === mood.toLowerCase();
                return (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setNewMood(mood.toLowerCase())}
                    style={{
                      backgroundColor: isSelected ? "#1C1C24" : "#121215",
                      color: isSelected ? "#F4F4F6" : "#A1A1AA",
                      border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                      fontSize: "11px",
                      padding: "6px 8px",
                    }}
                  >
                    {mood}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: "12px" }}>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: "100%", padding: "10px" }}
            >
              {isLoading ? "Writing Graph Nodes..." : "Initialize Production Graph"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
