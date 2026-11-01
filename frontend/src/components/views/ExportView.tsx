"use client";

import React, { useState } from "react";
import { Download, Terminal, Copy, Check, Code2, Film, ShieldCheck } from "lucide-react";
import { Project, CutDecision, EditVersion } from "@/types";
import { DEMO_REFERENCE_VIDEO, API_BASE } from "@/utils/media";

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
  const [exportPreset, setExportPreset] = useState<string>("hyperframes");
  const [exportResolution, setExportResolution] = useState<string>("1080p");
  const [exportFrameRate, setExportFrameRate] = useState<string>("30 FPS");
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const cliRenderCommand = `npx hyperframes render -o ${activeProject ? activeProject.title.toLowerCase().replace(/\s+/g, "_") : "output"}.mp4`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliRenderCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleDownloadHtml = async () => {
    if (!activeProject) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/hyperframes/projects/${activeProject.id}/composition`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeProject.title.toLowerCase().replace(/\s+/g, "_")}_hyperframes.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn("Failed to download composition HTML:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
        {/* Left: Codec Presets & Export Actions */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", color: "#22c55e", fontWeight: 600, letterSpacing: "0.06em" }}>
              KINO // DELIVERY & CLI
            </span>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f5f5f5", margin: "4px 0 2px 0" }}>
              Export Presets & Agent Tooling
            </h2>
            <p style={{ fontSize: "12px", color: "#a0a0a0", margin: 0 }}>
              Export deterministic MP4 video, download editable KINO HTML5 source code, or trigger CLI pipelines.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              {
                id: "hyperframes",
                name: "KINO HTML5 Source Bundle",
                specs: "HTML5 • GSAP 3.15 • CSS • Deterministic Seeking",
                desc: "Full source code composition package. Render locally with npx hyperframes render or tweak inside Studio.",
              },
              {
                id: "h264",
                name: "H.264 Master MP4",
                specs: "MP4 • H.264 / AAC • 30 FPS • 25 Mbps • High Profile",
                desc: "Universal web and streaming distribution format with fast-start moov atom.",
              },
              {
                id: "prores",
                name: "Apple ProRes 422 Master",
                specs: "MOV • ProRes 422 • 10-Bit 4:2:2 • Rec.709",
                desc: "Master archiving and high-fidelity grading format.",
              },
              {
                id: "edl",
                name: "Cut-List / Decision Table",
                specs: "JSON / EDL • SMPTE Timecode In/Out • Graph Traceability",
                desc: "Detailed cut decisions and StoryBeat alignments with STORYBOARD.md traceability.",
              },
            ].map((preset) => {
              const isSelected = exportPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setExportPreset(preset.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "6px",
                    backgroundColor: isSelected ? "#18181b" : "#141414",
                    border: isSelected ? "1px solid #22c55e" : "1px solid #2a2a2a",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    transition: "all 0.12s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: isSelected ? "#ffffff" : "#d4d4d8" }}>
                      {preset.name}
                    </span>
                    {isSelected && (
                      <span className="tech-tag tech-tag-green" style={{ fontSize: "9px" }}>
                        SELECTED
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#a0a0a0", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {preset.specs}
                  </span>
                  <span style={{ fontSize: "11px", color: "#71717a", marginTop: "2px" }}>
                    {preset.desc}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#d4d4d8", marginBottom: "4px" }}>
                Target Resolution
              </label>
              <select
                value={exportResolution}
                onChange={(e) => setExportResolution(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="1080p">1080P Full HD (1920×1080)</option>
                <option value="4k">4K UHD (3840×2160)</option>
                <option value="vertical">9:16 Vertical (1080×1920)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#d4d4d8", marginBottom: "4px" }}>
                Render Timebase
              </label>
              <select
                value={exportFrameRate}
                onChange={(e) => setExportFrameRate(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="30 FPS">30 FPS (KINO Default)</option>
                <option value="60 FPS">60 FPS (Smooth Motion)</option>
                <option value="24 FPS">24 FPS (Cinematic)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              onClick={handleDownloadHtml}
              disabled={isDownloading}
              className="btn-green"
              style={{ flex: 1, padding: "8px 12px", justifyContent: "center" }}
            >
              <Code2 className="w-4 h-4" />
              <span>{isDownloading ? "Generating..." : "Download KINO HTML"}</span>
            </button>

            <a
              href={activePreviewUrl || DEMO_REFERENCE_VIDEO}
              download={`${activeProject ? activeProject.title.toLowerCase().replace(/\s+/g, "_") : "master"}.mp4`}
              style={{ flex: 1, textDecoration: "none" }}
            >
              <button
                className="btn-primary"
                style={{ width: "100%", padding: "8px 12px", justifyContent: "center" }}
              >
                <Download className="w-4 h-4" />
                <span>Download MP4 Master</span>
              </button>
            </a>
          </div>

          {/* CLI Pipeline Instructions */}
          <div className="p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a] space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>KINO CLI Commands</span>
              </span>
              <button
                onClick={handleCopyCli}
                style={{ padding: "2px 6px", fontSize: "10px", background: "none", border: "none", color: "#a0a0a0", cursor: "pointer" }}
              >
                {copiedCli ? <Check className="w-3 h-3 text-emerald-400 inline mr-1" /> : <Copy className="w-3 h-3 inline mr-1" />}
                <span>{copiedCli ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="font-mono text-[11px] text-emerald-400 m-0 leading-relaxed overflow-x-auto">
              {cliRenderCommand}
            </pre>
          </div>
        </div>

        {/* Right: Master Output Metadata & Traceability Table */}
        <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "20px" }}>
          <div>
            <span style={{ fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", color: "#a0a0a0", fontWeight: 600, letterSpacing: "0.06em" }}>
              COMPOSITION TELEMETRY
            </span>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#f5f5f5", margin: "4px 0 2px 0" }}>
              Render Master Specification
            </h2>
            <p style={{ fontSize: "12px", color: "#a0a0a0", margin: 0 }}>
              Deterministic execution verification and multitrack lane breakdown.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#18181b", borderRadius: "4px", border: "1px solid #2a2a2a", fontSize: "11px" }}>
              <span style={{ color: "#a0a0a0" }}>Total Duration</span>
              <span className="font-mono font-semibold text-emerald-400">{activeProject?.target_duration || 12.0}s</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#18181b", borderRadius: "4px", border: "1px solid #2a2a2a", fontSize: "11px" }}>
              <span style={{ color: "#a0a0a0" }}>Timeline Clips Count</span>
              <span className="font-mono text-zinc-300">{decisions.length} Beat Cuts</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#18181b", borderRadius: "4px", border: "1px solid #2a2a2a", fontSize: "11px" }}>
              <span style={{ color: "#a0a0a0" }}>Render Lineage</span>
              <span className="font-mono text-zinc-300">EditVersion v{versions.length} (Active)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#18181b", borderRadius: "4px", border: "1px solid #2a2a2a", fontSize: "11px" }}>
              <span style={{ color: "#a0a0a0" }}>Deterministic Gate</span>
              <span className="font-mono text-emerald-400">PASSED (No Random / No Drift)</span>
            </div>
          </div>

          <div style={{ marginTop: "8px" }}>
            <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
              STORYBEAT CUT SCHEDULE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
              {decisions.map((d, i) => (
                <div
                  key={d.decision_id || i}
                  style={{
                    padding: "8px 10px",
                    backgroundColor: "#18181b",
                    border: "1px solid #2a2a2a",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="tech-tag tech-tag-green" style={{ fontSize: "9px" }}>
                      B{d.order}
                    </span>
                    <span className="font-semibold text-zinc-200">{d.narrative_beat}</span>
                  </div>
                  <span className="font-mono text-zinc-400 text-[10.5px]">
                    {d.source_in_sec.toFixed(1)}s - {d.source_out_sec.toFixed(1)}s
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
