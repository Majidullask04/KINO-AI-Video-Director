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
  PlayCircle
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
}

const NAV_ITEMS: { id: ScreenId; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "landing", label: "Overview & Guide", icon: Sparkles },
  { id: "dashboard", label: "Projects Library", icon: LayoutDashboard },
  { id: "wizard", label: "New Project Wizard", icon: PlusCircle },
  { id: "reference", label: "Reference Beats", icon: FileVideo, badge: "Graph" },
  { id: "footage", label: "Source Footage", icon: Film, badge: "Indexed" },
  { id: "studio", label: "AI Editing Studio", icon: SlidersHorizontal, badge: "Core" },
  { id: "revisions", label: "Revision DAG & Diff", icon: GitBranch, badge: "Query 4" },
  { id: "export", label: "Export & Cut-List", icon: Download },
  { id: "publishing", label: "Publishing & Approvals", icon: Share2, badge: "HITL" },
  { id: "settings", label: "Persistent Memory", icon: Brain, badge: "Track 02" },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentScreen,
  onSelectScreen,
  projects,
  activeProject,
  onSelectProject,
  onSeedDemo,
  isSeeding,
}) => {
  return (
    <aside className="w-64 bg-[#121217] border-r border-zinc-800/80 flex flex-col justify-between h-screen select-none shrink-0 sticky top-0 z-40">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-zinc-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-900/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-1.5">
                Director.AI
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/60">
                  FalkorDB
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400">Contextual Agent Studio</p>
            </div>
          </div>

          {/* Quick Active Project Selector */}
          <div className="mt-3.5">
            <label className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase mb-1 block">
              Active Project
            </label>
            <select
              value={activeProject?.id || ""}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="w-full text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-violet-500 transition-colors"
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

        {/* 10-Screen Navigation List */}
        <div className="px-2 py-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-270px)]">
          <div className="text-[10px] uppercase font-bold text-zinc-400 px-2.5 py-1 tracking-wider">
            Studio Views (10 Screens)
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectScreen(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-violet-400" : "text-zinc-500"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                      isActive
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                        : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/40"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Details & Fast Action */}
      <div className="p-3 border-t border-zinc-800/70 space-y-2.5 bg-zinc-950/60">
        {/* 1-Click Judge Demo Seeder */}
        <button
          onClick={onSeedDemo}
          disabled={isSeeding}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-medium py-2 px-3 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>{isSeeding ? "Seeding Graph..." : "1-Click Demo Seed"}</span>
        </button>

        {/* Real-time FalkorDB Status */}
        <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>FalkorDB Engine</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Port 6379
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>Graph Name:</span>
            <span className="font-mono text-zinc-300">ai_video_director</span>
          </div>
        </div>

        {/* Hackathon Tracks Declaration */}
        <div className="text-[9px] text-zinc-400 border border-zinc-800/60 rounded p-1.5 bg-zinc-900/40 space-y-0.5">
          <div className="text-zinc-400 font-medium">Graph Hacks 2026:</div>
          <div className="text-violet-400">✓ Track 01: Connected Data Action</div>
          <div className="text-indigo-400">✓ Track 02: Agent Memory & DAG</div>
        </div>
      </div>
    </aside>
  );
};
