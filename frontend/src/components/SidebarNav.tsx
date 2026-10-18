"use client";

import React from "react";
import {
  Compass,
  Film,
  PlusCircle,
  Activity,
  Video,
  SlidersHorizontal,
  GitCompare,
  Download,
  Share2,
  Database,
  FolderKanban
} from "lucide-react";
import { Project } from "@/types";
import { BrandLogo } from "./BrandLogo";

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
  }[];
}

const SECTIONS: NavSection[] = [
  {
    title: "WORKSPACE",
    items: [
      { id: "landing", label: "Overview", icon: Compass, shortcut: "⌘1" },
      { id: "dashboard", label: "Productions", icon: FolderKanban, shortcut: "⌘2" },
      { id: "wizard", label: "New Production", icon: PlusCircle, shortcut: "⌘3" },
    ],
  },
  {
    title: "INGEST & ANALYSIS",
    items: [
      { id: "reference", label: "Reference Pacing", icon: Activity, shortcut: "⌘4" },
      { id: "footage", label: "Media Bin & Upload", icon: Video, shortcut: "⌘5" },
    ],
  },
  {
    title: "EDITORIAL NLE",
    items: [
      { id: "studio", label: "Timeline Studio", icon: SlidersHorizontal, shortcut: "⌘6" },
      { id: "revisions", label: "Version Compare", icon: GitCompare, shortcut: "⌘7" },
    ],
  },
  {
    title: "DELIVERY & SYSTEM",
    items: [
      { id: "export", label: "Master Export", icon: Download, shortcut: "⌘8" },
      { id: "publishing", label: "Channels", icon: Share2, shortcut: "⌘9" },
      { id: "settings", label: "Graph Memory", icon: Database, shortcut: "⌘0" },
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
  nodeCount = 17,
  edgeCount = 16,
}) => {
  return (
    <aside className="sidebar-rail select-none shrink-0 sticky top-0 z-40">
      {/* 1. Brand Logo */}
      <div className="px-1 py-1">
        <BrandLogo />
      </div>

      {/* 2. Project Selector */}
      <div className="pt-1 pb-1">
        <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-500 px-1 mb-1.5">
          PRODUCTION
        </div>
        <select
          value={activeProject?.id || ""}
          onChange={(e) => {
            const found = projects.find((p) => p.id === e.target.value);
            if (found) onSelectProject(found);
          }}
          className="w-full text-xs font-medium truncate"
          style={{ width: "100%" }}
        >
          {projects.length === 0 ? (
            <option value="">No productions loaded</option>
          ) : (
            projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))
          )}
        </select>
      </div>

      {/* 3. Navigation Groups */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5">
        {SECTIONS.map((section) => (
          <div key={section.title} className="nav-group">
            <div className="nav-group-title">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectScreen(item.id)}
                  className={`nav-btn ${isActive ? "active" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-amber-400" : "text-zinc-500"
                      }`}
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {item.shortcut}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 4. Bottom Footer Actions & Telemetry */}
      <div className="pt-2 border-t border-[#222228] space-y-2">
        <button
          onClick={onSeedDemo}
          disabled={isSeeding}
          className="btn-amber"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <span>{isSeeding ? "Loading..." : "Load Sample Production"}</span>
        </button>

        <div className="px-2 py-1.5 rounded bg-[#09090b] border border-[#1e1e24] font-mono text-[10px] leading-relaxed text-zinc-400">
          <div className="flex items-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="text-zinc-300 flex items-center gap-1.5" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>FalkorDB 6379</span>
            </span>
            <span className="text-emerald-400">Connected</span>
          </div>
          <div className="text-zinc-500 text-[9.5px] mt-0.5">
            {nodeCount} Nodes • {edgeCount} Edges • 0.4ms
          </div>
        </div>
      </div>
    </aside>
  );
};
