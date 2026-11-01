"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Play,
  RotateCcw,
  Square,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  ShieldCheck
} from "lucide-react";
import { Project } from "@/types";
import { API_BASE } from "@/utils/media";

interface CliTerminalDrawerProps {
  activeProject: Project | null;
  isOpen: boolean;
  onToggle: () => void;
  onCheckpointCreated?: () => void;
}

interface PlanStage {
  id: string;
  name: string;
  status: "idle" | "running" | "passed" | "warning";
}

export const CliTerminalDrawer: React.FC<CliTerminalDrawerProps> = ({
  activeProject,
  isOpen,
  onToggle,
  onCheckpointCreated,
}) => {
  const [drawerMode, setDrawerMode] = useState<"plan" | "command">("plan");
  const [selectedPlan, setSelectedPlan] = useState<string>("full_production");
  const [selectedAgent, setSelectedAgent] = useState<string>("claude");
  const [briefInput, setBriefInput] = useState<string>("High-energy product reveal video with kinetic typography and smooth GSAP zooms");
  const [commandInput, setCommandInput] = useState<string>("npx hyperframes check");
  const [logs, setLogs] = useState<string[]>([
    "KINO Local Host CLI & Autonomous Agent Engine initialized.",
    "Ready for autonomous workflows.",
  ]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeStageIndex, setActiveStageIndex] = useState<number>(-1);
  const [stages, setStages] = useState<PlanStage[]>([
    { id: "script_storyboard", name: "1. Narrative & Storyboard", status: "idle" },
    { id: "design_tokens", name: "2. Brand Tokens (frame.md)", status: "idle" },
    { id: "composition", name: "3. KINO HTML/GSAP Scene", status: "idle" },
    { id: "verify_heal", name: "4. Quality Gate & Self-Healing", status: "idle" },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // WebSocket Connection
  useEffect(() => {
    if (!activeProject) return;

    const wsUrl = API_BASE.replace(/^http/, "ws") + `/api/cli/ws/${activeProject.id}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch {
          setLogs((prev) => [...prev, event.data]);
        }
      };

      ws.onclose = () => {
        logger("WebSocket disconnected");
      };
    } catch (e) {
      console.warn("WebSocket connection error:", e);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeProject?.id]);

  const logger = (msg: string) => {
    setLogs((prev) => [...prev, `[System] ${msg}`]);
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case "stdout":
        setLogs((prev) => [...prev, data.text]);
        break;
      case "stage_start":
        setActiveStageIndex(data.stage_index);
        setStages((prev) =>
          prev.map((s, idx) =>
            idx === data.stage_index ? { ...s, status: "running" } : s
          )
        );
        break;
      case "stage_complete":
        setStages((prev) =>
          prev.map((s, idx) =>
            idx === data.stage_index ? { ...s, status: data.passed !== false ? "passed" : "warning" } : s
          )
        );
        break;
      case "checkpoint_created":
        setLogs((prev) => [...prev, `\n💾 [Git Checkpoint] Workspace committed: ${data.commit_hash || "HEAD"}`]);
        if (onCheckpointCreated) onCheckpointCreated();
        break;
      case "plan_complete":
        setIsRunning(false);
        setActiveStageIndex(-1);
        setLogs((prev) => [...prev, "\n✨ [Plan Complete] Autonomous execution finished successfully!"]);
        break;
      case "cancelled":
        setIsRunning(false);
        setLogs((prev) => [...prev, "\n🛑 [Cancelled] Process was stopped by user."]);
        break;
      case "error":
        setLogs((prev) => [...prev, `\n❌ [Error] ${data.message}`]);
        setIsRunning(false);
        break;
    }
  };

  const runPlan = () => {
    if (!activeProject) return;
    setIsRunning(true);
    setLogs((prev) => [
      ...prev,
      `\n🚀 [Autonomous Plan] Starting "${selectedPlan}" with Agent [${selectedAgent.toUpperCase()}]...`,
      `Brief: "${briefInput}"`,
    ]);
    setStages([
      { id: "script_storyboard", name: "1. Narrative & Storyboard", status: "idle" },
      { id: "design_tokens", name: "2. Brand Tokens (frame.md)", status: "idle" },
      { id: "composition", name: "3. KINO HTML/GSAP Scene", status: "idle" },
      { id: "verify_heal", name: "4. Quality Gate & Self-Healing", status: "idle" },
    ]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "run_plan",
          plan_id: selectedPlan,
          agent_id: selectedAgent,
          brief: briefInput,
        })
      );
    } else {
      // Fallback to REST execution
      fetch(`${API_BASE}/api/cli/agent/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.id,
          agent_id: selectedAgent,
          prompt: briefInput,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          setLogs((prev) => [...prev, d.stdout || d.stderr || "Executed"]);
          setIsRunning(false);
        })
        .catch((e) => {
          setLogs((prev) => [...prev, `Error: ${String(e)}`]);
          setIsRunning(false);
        });
    }
  };

  const killProcess = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "kill" }));
    }
    if (activeProject) {
      fetch(`${API_BASE}/api/cli/kill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: activeProject.id }),
      });
    }
    setIsRunning(false);
  };

  const runSingleCommand = () => {
    if (!commandInput.trim() || !activeProject) return;
    setIsRunning(true);
    setLogs((prev) => [...prev, `\n$ ${commandInput}`]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "run_command",
          command: commandInput,
        })
      );
      setIsRunning(false);
    } else {
      fetch(`${API_BASE}/api/cli/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: commandInput,
          project_id: activeProject.id,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.stdout) setLogs((prev) => [...prev, data.stdout]);
          if (data.stderr) setLogs((prev) => [...prev, `[stderr] ${data.stderr}`]);
          setLogs((prev) => [...prev, `[Exit Code ${data.exit_code}]`]);
        })
        .finally(() => setIsRunning(false));
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: "fixed",
          bottom: "16px",
          right: "24px",
          zIndex: 50,
          backgroundColor: "#121215",
          border: "1px solid #27272A",
          color: "#10B981",
          borderRadius: "6px",
          padding: "7px 16px",
          fontSize: "11px",
          fontFamily: "'IBM Plex Mono', monospace",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
        }}
      >
        <Terminal size={14} />
        <span>Autonomous Plan & CLI Drawer</span>
        <ChevronUp size={14} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "220px",
        right: 0,
        height: "320px",
        backgroundColor: "#070709",
        borderTop: "1px solid #222228",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.8)",
      }}
    >
      {/* Top Controls Rail */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          backgroundColor: "#0D0D11",
          borderBottom: "1px solid #1C1C22",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Terminal size={14} color="#10B981" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#F4F4F6", fontFamily: "'IBM Plex Mono', monospace" }}>
              AUTONOMOUS PLAN ENGINE
            </span>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: "flex", backgroundColor: "#141418", borderRadius: "4px", padding: "1px", border: "1px solid #27272A" }}>
            <button
              onClick={() => setDrawerMode("plan")}
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                backgroundColor: drawerMode === "plan" ? "#22c55e20" : "transparent",
                color: drawerMode === "plan" ? "#22c55e" : "#71717A",
                border: "none",
                borderRadius: "3px",
                fontWeight: drawerMode === "plan" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Plan Sequencer
            </button>
            <button
              onClick={() => setDrawerMode("command")}
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                backgroundColor: drawerMode === "command" ? "#22c55e20" : "transparent",
                color: drawerMode === "command" ? "#22c55e" : "#71717A",
                border: "none",
                borderRadius: "3px",
                fontWeight: drawerMode === "command" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Direct Shell ($)
            </button>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isRunning ? (
            <button
              onClick={killProcess}
              style={{
                padding: "4px 10px",
                fontSize: "10px",
                backgroundColor: "#EF444420",
                border: "1px solid #EF444440",
                color: "#EF4444",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}
            >
              <Square size={11} fill="#EF4444" />
              <span>Abort Process</span>
            </button>
          ) : (
            drawerMode === "plan" && (
              <button
                onClick={runPlan}
                style={{
                  padding: "4px 12px",
                  fontSize: "10.5px",
                  backgroundColor: "#10B981",
                  border: "none",
                  color: "#000",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                }}
              >
                <Sparkles size={12} />
                <span>Run Autonomous Plan</span>
              </button>
            )
          )}

          <button
            onClick={() => setLogs([])}
            style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer", padding: "4px" }}
            title="Clear terminal"
          >
            <RotateCcw size={12} />
          </button>

          <button
            onClick={onToggle}
            style={{ background: "transparent", border: "none", color: "#8E8E98", cursor: "pointer", padding: "4px" }}
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      {/* Plan Configuration Sub-Bar (When in Plan Mode) */}
      {drawerMode === "plan" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 16px",
            backgroundColor: "#0A0A0D",
            borderBottom: "1px solid #1A1A20",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "'IBM Plex Mono', monospace" }}>PLAN:</span>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              disabled={isRunning}
              style={{
                backgroundColor: "#141418",
                border: "1px solid #27272A",
                color: "#F4F4F6",
                fontSize: "10.5px",
                fontFamily: "'IBM Plex Mono', monospace",
                padding: "3px 8px",
                borderRadius: "4px",
              }}
            >
              <option value="full_production">Full Video Production Plan</option>
              <option value="kinetic_typography">Kinetic Typography & Captions Plan</option>
              <option value="social_vertical">Social 9:16 Vertical Reflow Plan</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "'IBM Plex Mono', monospace" }}>AGENT:</span>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={isRunning}
              style={{
                backgroundColor: "#141418",
                border: "1px solid #27272A",
                color: "#10B981",
                fontSize: "10.5px",
                fontFamily: "'IBM Plex Mono', monospace",
                padding: "3px 8px",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              <option value="claude">Claude Code (claude)</option>
              <option value="gemini">Gemini CLI (gemini)</option>
              <option value="opencode">OpenCode (opencode)</option>
              <option value="codex">Codex CLI (codex)</option>
              <option value="custom">Shell Script (sh)</option>
            </select>
          </div>

          <input
            type="text"
            value={briefInput}
            onChange={(e) => setBriefInput(e.target.value)}
            disabled={isRunning}
            placeholder="Creative brief or prompt directive..."
            style={{
              flex: 1,
              minWidth: "220px",
              backgroundColor: "#121216",
              border: "1px solid #222228",
              borderRadius: "4px",
              color: "#E4E4E7",
              fontSize: "11px",
              padding: "4px 8px",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Stage Progression Status Chips (When in Plan Mode) */}
      {drawerMode === "plan" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            backgroundColor: "#050507",
            borderBottom: "1px solid #141418",
            overflowX: "auto",
          }}
        >
          {stages.map((stg, idx) => {
            const isCurrent = activeStageIndex === idx;
            const isPassed = stg.status === "passed";
            return (
              <div
                key={stg.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  padding: "2px 8px",
                  borderRadius: "3px",
                  backgroundColor: isCurrent ? "#10B98120" : "#0D0D12",
                  border: isCurrent ? "1px solid #10B981" : "1px solid #1F1F26",
                  color: isPassed ? "#10B981" : isCurrent ? "#F4F4F6" : "#71717A",
                  whiteSpace: "nowrap",
                }}
              >
                {isPassed ? (
                  <CheckCircle2 size={10} color="#10B981" />
                ) : isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                )}
                <span>{stg.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Real-time Streaming Log Terminal View */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 16px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10.5px",
          lineHeight: 1.5,
          color: "#A1A1AA",
          whiteSpace: "pre-wrap",
          backgroundColor: "#060608",
        }}
      >
        {logs.map((line, idx) => (
          <div
            key={idx}
            style={{
              color: line.startsWith("$")
                ? "#10B981"
                : line.includes("[Quality Gate PASSED]") || line.includes("[Git Checkpoint]") || line.includes("[Plan Complete]")
                ? "#10B981"
                : line.includes("[Error]") || line.includes("[stderr]") || line.includes("❌")
                ? "#EF4444"
                : line.includes("⚠️") || line.includes("[Self-Healing Loop]")
                ? "#F59E0B"
                : "#D4D4D8",
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Direct Command Bar (When in Direct Command Mode) */}
      {drawerMode === "command" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSingleCommand();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: "#0D0D10",
            borderTop: "1px solid #1C1C22",
          }}
        >
          <span style={{ color: "#10B981", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700 }}>
            $
          </span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type host or hyperframes command (e.g. npx hyperframes check)..."
            disabled={isRunning}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              color: "#F4F4F6",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={isRunning}
            style={{
              padding: "4px 12px",
              backgroundColor: isRunning ? "#27272A" : "#10B981",
              border: "none",
              borderRadius: "4px",
              color: isRunning ? "#71717A" : "#000",
              fontSize: "10.5px",
              fontWeight: 700,
              cursor: isRunning ? "default" : "pointer",
            }}
          >
            Execute
          </button>
        </form>
      )}
    </div>
  );
};
