"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Code2,
  Save,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  Sparkles
} from "lucide-react";
import { CutDecision, Project } from "@/types";
import { API_BASE } from "@/utils/media";

interface ProjectDirectivesInspectorProps {
  activeProject: Project | null;
  selectedDecision: CutDecision | null;
  onFileSaved?: () => void;
}

type DirectiveFile = "STORYBOARD.md" | "frame.md" | "HANDOFF.md" | "index.html" | "meta.json";

export const ProjectDirectivesInspector: React.FC<ProjectDirectivesInspectorProps> = ({
  activeProject,
  selectedDecision,
  onFileSaved,
}) => {
  const [activeFile, setActiveFile] = useState<DirectiveFile>("STORYBOARD.md");
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // CLI Action State
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [cliOutput, setCliOutput] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject) {
      loadFile(activeFile);
    }
  }, [activeProject?.id, activeFile]);

  const loadFile = async (filename: DirectiveFile) => {
    if (!activeProject) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/${filename}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || "");
        setIsDirty(false);
      } else {
        setFileContent(`// File ${filename} not found or empty on disk.`);
      }
    } catch (e) {
      console.error(`Failed to load ${filename}:`, e);
      setFileContent(`// Error loading ${filename}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFile = async () => {
    if (!activeProject) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/${activeFile}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fileContent }),
      });
      if (res.ok) {
        setIsDirty(false);
        setStatusMessage("Saved to disk");
        if (onFileSaved) onFileSaved();
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage("Failed to save");
      }
    } catch (e) {
      console.error(`Failed to save ${activeFile}:`, e);
      setStatusMessage("Save error");
    } finally {
      setIsSaving(false);
    }
  };

  const runHyperFramesCheck = async () => {
    if (!activeProject) return;
    setIsChecking(true);
    setCliOutput(null);
    try {
      const res = await fetch(`${API_BASE}/api/cli/hyperframes/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: activeProject.id }),
      });
      const data = await res.json();
      setCliOutput(data.stdout || data.stderr || "Check executed with code " + data.exit_code);
    } catch (e) {
      setCliOutput("Error executing npx hyperframes check: " + String(e));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px", padding: "12px" }}>
      {/* Top File Switcher Rail */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", overflowX: "auto" }}>
          {(["STORYBOARD.md", "frame.md", "HANDOFF.md", "index.html", "meta.json"] as DirectiveFile[]).map((f) => {
            const isActive = activeFile === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFile(f)}
                style={{
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  backgroundColor: isActive ? "#22c55e18" : "#141416",
                  color: isActive ? "#22c55e" : "#8E8E98",
                  border: isActive ? "1px solid #22c55e40" : "1px solid #222228",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {f.endsWith(".md") ? <FileText size={10} /> : <Code2 size={10} />}
                <span>{f}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => loadFile(activeFile)}
            disabled={isLoading}
            title="Reload from disk"
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              backgroundColor: "#18181B",
              border: "1px solid #27272A",
              color: "#A1A1AA",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
            <span>Reload</span>
          </button>

          <button
            onClick={saveFile}
            disabled={isSaving || !isDirty}
            title="Save changes to disk"
            style={{
              padding: "4px 10px",
              fontSize: "10px",
              backgroundColor: isDirty ? "#F59E0B" : "#27272A",
              border: "none",
              color: isDirty ? "#000" : "#71717A",
              fontWeight: 600,
              borderRadius: "4px",
              cursor: isDirty ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Save size={11} />
            <span>{isSaving ? "Saving..." : "Save File"}</span>
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#71717A", fontFamily: "'IBM Plex Mono', monospace" }}>
        <span>
          Editing: <strong style={{ color: "#F4F4F6" }}>{activeFile}</strong> {isDirty && <span style={{ color: "#F59E0B" }}>(modified)</span>}
        </span>
        {statusMessage && (
          <span style={{ color: "#10B981", display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={11} />
            {statusMessage}
          </span>
        )}
      </div>

      {/* Editor Surface */}
      <div style={{ flex: 1, minHeight: "180px", position: "relative", display: "flex", flexDirection: "column" }}>
        <textarea
          value={fileContent}
          onChange={(e) => {
            setFileContent(e.target.value);
            setIsDirty(true);
          }}
          disabled={isLoading}
          style={{
            flex: 1,
            width: "100%",
            backgroundColor: "#0A0A0C",
            border: "1px solid #1F1F24",
            borderRadius: "6px",
            color: "#E4E4E7",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            lineHeight: 1.5,
            padding: "10px",
            resize: "none",
            outline: "none",
          }}
          placeholder="Loading file from disk..."
        />
      </div>

      {/* Quick HyperFrames CLI Actions */}
      <div style={{ borderTop: "1px solid #1F1F24", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", color: "#8E8E98" }}>
            CLI VERIFICATION
          </span>
          <button
            onClick={runHyperFramesCheck}
            disabled={isChecking}
            style={{
              padding: "3px 8px",
              fontSize: "10px",
              fontFamily: "'IBM Plex Mono', monospace",
              backgroundColor: "#18181B",
              border: "1px solid #22c55e40",
              color: "#22c55e",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Terminal size={10} />
            <span>{isChecking ? "Checking..." : "npx hyperframes check"}</span>
          </button>
        </div>

        {cliOutput && (
          <div
            style={{
              maxHeight: "100px",
              overflowY: "auto",
              backgroundColor: "#070709",
              border: "1px solid #1C1C22",
              borderRadius: "4px",
              padding: "6px 8px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9.5px",
              color: "#10B981",
              whiteSpace: "pre-wrap",
            }}
          >
            {cliOutput}
          </div>
        )}
      </div>
    </div>
  );
};

