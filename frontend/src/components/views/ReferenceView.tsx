"use client";

import React, { useState } from "react";
import { FileVideo, Activity, Layers } from "lucide-react";
import { StoryBeat } from "@/types";
import { DEMO_REFERENCE_VIDEO } from "@/utils/media";

interface ReferenceViewProps {
  referenceBeats: StoryBeat[];
  isLoading: boolean;
  onAnalyzeReference: (urlOrPath: string) => Promise<void>;
}

export const ReferenceView: React.FC<ReferenceViewProps> = ({
  referenceBeats,
  isLoading,
  onAnalyzeReference,
}) => {
  const [refUrl, setRefUrl] = useState("");

  const handleAnalyze = () => {
    onAnalyzeReference(refUrl);
  };

  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top 2-Column Split */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "18px" }}>
        {/* Left: Reference Video Monitor */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FileVideo size={15} strokeWidth={1.6} color="#F59E0B" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                Reference Video Monitor
              </span>
            </div>
            <span className="tech-tag">
              PySceneDetect Ready
            </span>
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
              src={DEMO_REFERENCE_VIDEO}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          {/* File / URL Import Bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Import URL or reference media path..."
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? "Analyzing..." : "Analyze Cuts"}
              </button>
            </div>
            <span style={{ fontSize: "10.5px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
              Note: URLs outside local network automatically fall back to bundled high-energy reference cuts.
            </span>
          </div>
        </div>

        {/* Right: Pacing Signature & SVG Energy Waveform Card */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={15} strokeWidth={1.6} color="#10B981" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                Pacing Signature & Energy Curve
              </span>
            </div>
            <span className="tech-tag-emerald">
              Dynamic High-Tempo
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
              <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>AVG CUT LENGTH</span>
              <div style={{ fontSize: "13px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                3.0s
              </div>
            </div>
            <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
              <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>TOTAL STORY BEATS</span>
              <div style={{ fontSize: "13px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                {referenceBeats.length || 4} Beats
              </div>
            </div>
            <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
              <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>PACING PROFILE</span>
              <div style={{ fontSize: "13px", color: "#F59E0B", fontWeight: 600, marginTop: "2px" }}>
                Aggressive
              </div>
            </div>
          </div>

          {/* Crisp SVG Area/Step Chart */}
          <div
            style={{
              height: "140px",
              backgroundColor: "#070709",
              border: "1px solid #1A1A22",
              borderRadius: "5px",
              padding: "10px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <svg viewBox="0 0 500 120" style={{ width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="amberWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <line x1="0" y1="30" x2="500" y2="30" stroke="#1F1F28" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="#1F1F28" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="#1F1F28" strokeDasharray="3 3" />

              <path
                d="M 40 25 L 140 25 L 140 75 L 260 75 L 260 45 L 380 45 L 380 20 L 460 20 L 460 110 L 40 110 Z"
                fill="url(#amberWaveGrad)"
              />

              <path
                d="M 40 25 L 140 25 L 140 75 L 260 75 L 260 45 L 380 45 L 380 20 L 460 20"
                stroke="#F59E0B"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
              />

              <circle cx="40" cy="25" r="3.5" fill="#F59E0B" />
              <circle cx="140" cy="75" r="3.5" fill="#06B6D4" />
              <circle cx="260" cy="45" r="3.5" fill="#10B981" />
              <circle cx="380" cy="20" r="3.5" fill="#F59E0B" />

              <text x="40" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:00 (Hook • 5/5)</text>
              <text x="140" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:03 (Setup • 3/5)</text>
              <text x="260" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:06 (Demo • 4/5)</text>
              <text x="380" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:09 (Climax • 5/5)</text>
            </svg>
          </div>

          <p style={{ fontSize: "11px", color: "#71717A", margin: 0, lineHeight: 1.4 }}>
            Energy levels derived from optical flow delta and shot cut frequency. High scores trigger DirectorAgent B-roll prioritization.
          </p>
        </div>
      </div>

      {/* Bottom Section: StoryBeat Decomposition Strip */}
      <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={15} strokeWidth={1.6} color="#F59E0B" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
              StoryBeat Decomposition Strip
            </span>
          </div>
          <span className="tech-tag">
            (:StoryBeat)-[:NEXT_BEAT]-&gt;(:StoryBeat)
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
          {(referenceBeats.length > 0 ? referenceBeats : [
            { id: "b1", beat_index: 1, role: "hook", target_duration: 2.5, energy_level: 5, required_shot_type: "talking_head", transition: "cut", required_tags: ["HOOK", "EXPLAINER", "FACE"] },
            { id: "b2", beat_index: 2, role: "problem", target_duration: 3.5, energy_level: 3, required_shot_type: "talking_head", transition: "cut", required_tags: ["PROBLEM", "DIALOG"] },
            { id: "b3", beat_index: 3, role: "demonstration", target_duration: 4.0, energy_level: 4, required_shot_type: "product_shot", transition: "cut", required_tags: ["DEMO", "CODE", "SCREEN"] },
            { id: "b4", beat_index: 4, role: "call_to_action", target_duration: 3.0, energy_level: 4, required_shot_type: "broll", transition: "fade_out", required_tags: ["CTA", "LIFESTYLE"] },
          ]).map((b, i) => (
            <div
              key={b.id || i}
              style={{
                backgroundColor: "#0C0C0E",
                border: "1px solid #1F1F26",
                borderRadius: "5px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9.5px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, textTransform: "uppercase" }}>
                  BEAT {b.beat_index || i + 1} // {b.role}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#A1A1AA" }}>
                  {b.target_duration}s
                </span>
              </div>

              {/* 5-bar energy indicator */}
              <div style={{ display: "flex", gap: "3px" }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <div
                    key={lvl}
                    style={{
                      flex: 1,
                      height: "4px",
                      borderRadius: "1px",
                      backgroundColor: lvl <= b.energy_level ? "#F59E0B" : "#222228",
                    }}
                  />
                ))}
              </div>

              <div style={{ fontSize: "11px", color: "#F4F4F6", fontWeight: 500 }}>
                Shot: <strong style={{ color: "#06B6D4" }}>{b.required_shot_type}</strong>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "auto" }}>
                {(b.required_tags || [b.role]).map((tag) => (
                  <span key={tag} className="tech-tag" style={{ fontSize: "9px", padding: "1px 4px" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
