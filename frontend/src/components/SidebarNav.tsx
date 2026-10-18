"use client";

import React from "react";
import {
  Sparkles,
  LayoutDashboard,
  PlusCircle,
  FileVideo,
  Film,
  SlidersHorizontal,
  GitBranch,
  Download,
  Share2,
  Brain,
  Database,
  Zap,
  Radio,
  FolderGit2
} from "lucide-react";
import { Project } from "@/types";

export type ScreenId =
  | "landing"
  | "dashboard"
  | "wizard"
  | "reference"
  | "footage"
  | "studio"
  | "revisions"
  | "export"
  | "publishing"
  | "settings";

interface SidebarNavProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onSeedDemo: () => void;
  isSeeding: boolean;
  nodeCount?: number;
  edgeCount?: number;
}

interface NavSection {
  title: string;
  items: {
    id: ScreenId;
    label: string;
    icon: React.ElementType;
    shortcut: string;
    badge?: string;
    isLive?: boolean;
  }[];
}

const SECTIONS: NavSection[] = [
  {
    title: "WORKSPACE",
    items: [
      { id: "landing", label: "Overview & Launch", icon: Sparkles, shortcut: "⌘1" },
      { id: "dashboard", label: "Project Library", icon: LayoutDashboard, shortcut: "⌘2" },
      { id: "wizard", label: "New Project Wizard", icon: PlusCircle, shortcut: "⌘3" },
    ],
  },
  {
    title: "INGEST & GRAPH",
    items: [
      { id: "reference", label: "Reference Beats", icon: FileVideo, shortcut: "⌘4", badge: "Graph" },
      { id: "footage", label: "Media Bin & Clips", icon: Film, shortcut: "⌘5", badge: "Indexed" },
    ],
  },
  {
    title: "PRODUCTION NLE",
    items: [
      { id: "studio", label: "AI Director Studio", icon: SlidersHorizontal, shortcut: "⌘6", isLive: true },
      { id: "revisions", label: "Revision DAG & Diff", icon: GitBranch, shortcut: "⌘7", badge: "Query 4" },
    ],
  },
  {
    title: "DELIVERY & MEMORY",
    items: [
      { id: "export", label: "Master Render Export", icon: Download, shortcut: "⌘8" },
      { id: "publishing", label: "Social Publishing Gate", icon: Share2, shortcut: "⌘9", badge: "HITL" },
      { id: "settings", label: "Graph Memory & Settings", icon: Brain, shortcut: "⌘0", badge: "Track 02" },
    ],
  },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentScreen,
  onSelectScreen,
  projects,
  activeProject,
  onSelectProject,
  onSeedDemo,
  isSeeding,
  nodeCount = 18,
  edgeCount = 24,
}) => {
  return (
    <aside className="sidebar-rail w-64 bg-[#08080d] border-r border-white/[0.07] flex flex-col justify-between h-screen select-none shrink-0 sticky top-0 z-40">
      {/* Brand & Project Selector */}
      <div>
        <div className="p-3 border-b border-white/[0.06] bg-[#0c0c14]/80 rounded-xl mb-3">
          <div className="flex items-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="flex items-center gap-2.5" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-violet-400 flex items-center justify-center shadow-lg shadow-violet-900/40 border border-violet-400/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Director.AI</span>
                  <span className="badge-pill text-[9px] uppercase font-mono font-extrabold px-1.5 py-0.2">
                    Pro
                  </span>
                </h1>
                <p className="text-[10px] text-zinc-400 font-mono">FalkorDB NLE Core</p>
              </div>
            </div>
          </div>

          {/* Project Switcher */}
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="flex items-center gap-1" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <FolderGit2 className="w-3 h-3 text-violet-400" />
                <span>Active Project</span>
              </span>
              <span className="font-mono text-zinc-400">&nbsp;{projects.length} Total</span>
            </div>
            <select
              value={activeProject?.id || ""}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="w-full text-xs bg-[#12121c] border border-white/10 text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500 font-medium truncate"
            >
              {projects.length === 0 ? (
                <option value="">No projects loaded</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* 4 Studio Sections Navigation */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-340px)]">
          {SECTIONS.map((section) => (
            <div key={section.title} className="nav-group space-y-0.5">
              <div className="nav-group-title text-[9px] font-bold tracking-wider text-zinc-400 uppercase px-2 py-1">
                {section.title}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectScreen(item.id)}
                    className={isActive ? "nav-btn active" : "nav-btn"}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-violet-400"
                            : "text-zinc-500"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {item.isLive && (
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-mono font-bold animate-pulse">
                          <Radio className="w-2.5 h-2.5" />
                          <span>LIVE</span>
                        </span>
                      )}
                      {item.badge && !item.isLive && (
                        <span
                          className={`badge-pill text-[9px] px-1.5 py-0.2 font-mono font-medium ${
                            isActive
                              ? "bg-violet-500/25 text-violet-200 border-violet-500/40"
                              : "bg-white/[0.05] text-zinc-400 border-white/[0.05]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <span className="text-[9px] font-mono text-zinc-400 hidden lg:inline-block">
                        &nbsp;{item.shortcut}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Telemetry & 1-Click Action */}
      <div className="pt-3 border-t border-white/[0.06] space-y-2.5 bg-[#0a0a10]">
        {/* 1-Click Demo Seed Button */}
        <button
          onClick={onSeedDemo}
          disabled={isSeeding}
          className="btn-primary w-full text-xs font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2"
          style={{ width: "100%" }}
        >
          <Zap className={`w-3.5 h-3.5 ${isSeeding ? "animate-spin" : "fill-current"}`} />
          <span>{isSeeding ? "Seeding FalkorDB..." : "⚡ 1-Click Demo Seed"}</span>
        </button>

        {/* FalkorDB Telemetry Card */}
        <div className="studio-card p-2.5 rounded-lg text-[11px] space-y-1.5">
          <div className="flex items-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>FalkorDB Engine</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-semibold" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Connected</span>
            </span>
          </div>

          <div className="text-[10px] text-zinc-400 font-mono truncate">
            redis://localhost:6379 • <span className="text-violet-400">ai_video_director</span>
          </div>

          <div
            className="flex items-center justify-between text-[9px] font-mono text-zinc-400 pt-1 border-t border-white/[0.05]"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}
          >
            <span>Nodes:&nbsp;<strong className="text-zinc-200">{nodeCount}</strong></span>
            <span>Edges:&nbsp;<strong className="text-violet-300">{edgeCount}</strong></span>
            <span className="text-emerald-400">&nbsp;0.4ms</span>
          </div>
        </div>

        {/* Track Claims Badge */}
        <div
          className="text-[9px] text-zinc-400 border border-white/[0.06] rounded p-1.5 bg-[#08080e] flex items-center justify-between font-mono"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span className="text-violet-400 font-bold">Track 01 & Track 02</span>
          <span className="text-zinc-400">&nbsp;WeMakeDevs 2026</span>
        </div>
      </div>
    </aside>
  );
};
