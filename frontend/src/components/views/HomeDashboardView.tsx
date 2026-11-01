"use client";

import React, { useState, useRef } from "react";
import {
  Search,
  Plus,
  Home as HomeIcon,
  Palette,
  Folder,
  Layers,
  Download,
  Archive,
  BookOpen,
  Sparkles,
  Settings,
  Tv,
  ArrowUp,
  MessageSquare,
  Video,
  List,
  Film,
  ExternalLink,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { Project } from "@/types";
import { BrandLogo, FrameyMascot } from "../BrandLogo";
import { BrandKitsDrawer } from "../BrandKitsDrawer";
import { SettingsDoctorModal } from "../SettingsDoctorModal";
import { API_BASE } from "@/utils/media";

interface HomeDashboardViewProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenStudio: () => void;
  onCreateNewProject: (prompt: string, cuts: string[]) => Promise<void>;
  onRefreshProjects: () => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenStudio,
  onCreateNewProject,
  onRefreshProjects,
}) => {
  const [activeTab, setActiveTab] = useState<"projects" | "remix">("projects");
  const [promptText, setPromptText] = useState<string>("");
  const [selectedCuts, setSelectedCuts] = useState<string[]>(["Hook", "Proof", "Turn", "CTA"]);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [starterMode, setStarterMode] = useState<"make" | "record" | "script">("make");
  const homeFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleHomeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const names = Array.from(files).map((f) => f.name).join(", ");
      setPromptText((prev) => (prev ? `${prev} (Footage: ${names})` : `Direct production with local clips: ${names}`));
    }
  };

  const toggleCut = (cut: string) => {
    if (selectedCuts.includes(cut)) {
      setSelectedCuts(selectedCuts.filter((c) => c !== cut));
    } else {
      setSelectedCuts([...selectedCuts, cut]);
    }
  };

  const handleLetsGo = async () => {
    setIsCreating(true);
    try {
      await onCreateNewProject(promptText || "Untitled Production", selectedCuts);
      onOpenStudio();
    } catch (e) {
      console.error("Error creating project:", e);
    } finally {
      setIsCreating(false);
    }
  };

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleArchiveProject = async (projectId: string) => {
    setOpenMenuId(null);
    await fetch(`${API_BASE}/api/projects/${projectId}`, { method: "DELETE" })
      .catch(() => {}); // Best effort
    onRefreshProjects();
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-screen bg-[#0F0F0E] p-3 flex gap-3 text-[#F4F4F2] overflow-hidden select-none">
      {/* 1. Left Navigation Panel (240px rounded-2xl island) */}
      <aside className="w-[240px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between p-3.5 shrink-0 overflow-y-auto">
        <div className="space-y-4">
          {/* Logo & Quick Actions */}
          <div className="flex items-center justify-between pb-1">
            <BrandLogo />
            <div className="flex items-center gap-1 text-[#9E9E98]">
              <button
                onClick={() => setSearchQuery(searchQuery ? "" : " ")}
                className="w-7 h-7 rounded-lg hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"
                title="Search projects"
              >
                <Search size={14} />
              </button>
              <button
                onClick={handleLetsGo}
                className="w-7 h-7 rounded-lg hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"
                title="New project"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Search Input when activated */}
          {searchQuery !== "" && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                autoFocus
                className="w-full bg-[#222220] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-[#F4F4F2] placeholder-[#686863] outline-none"
              />
            </div>
          )}

          {/* Primary Nav Links */}
          <nav className="space-y-0.5">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.06] text-white font-medium text-xs">
              <HomeIcon size={14} className="text-[#34D399]" />
              <span>Home</span>
            </button>
            <button
              onClick={() => setIsBrandKitOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9E9E98] hover:text-white hover:bg-white/[0.04] text-xs transition-colors"
            >
              <Palette size={14} />
              <span>Brand kits</span>
            </button>
          </nav>

          {/* Projects Folder & List */}
          <div className="pt-2">
            <div className="flex items-center justify-between px-2 text-[11px] font-medium text-[#686863] uppercase tracking-wider mb-1">
              <span>Projects</span>
              <MoreHorizontal size={13} className="cursor-pointer hover:text-white" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#9E9E98] hover:bg-white/[0.04] cursor-pointer">
                <Folder size={13} />
                <span className="truncate">video editing</span>
              </div>

              {filteredProjects.map((p) => {
                const isActive = activeProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProject(p);
                      onOpenStudio();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? "bg-white/[0.08] text-white font-medium"
                        : "text-[#9E9E98] hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3.5 h-3.5 rounded bg-zinc-800 border border-white/10 shrink-0 flex items-center justify-center">
                        <Video size={9} className={isActive ? "text-[#34D399]" : "text-zinc-400"} />
                      </div>
                      <span className="truncate">{p.title}</span>
                    </div>
                    <span className="text-[10px] text-[#686863] font-mono shrink-0">1d</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Left Bottom Section Links */}
        <div className="space-y-1 pt-3 border-t border-white/[0.06] text-[#9E9E98]">
          <div
            onClick={() => {
              setActiveTab("projects");
              setSearchQuery("");
            }}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers size={13} />
              <span>All projects ({projects.length})</span>
            </div>
          </div>

          <div
            onClick={onRefreshProjects}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer text-xs text-[#34D399]"
          >
            <div className="flex items-center gap-2">
              <Download size={13} />
              <span className="font-medium">Refresh projects ({projects.length})</span>
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab("projects");
              setSearchQuery(searchQuery === "archive" ? "" : "archive");
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-white/[0.04] cursor-pointer"
          >
            <Archive size={13} />
            <span>Archived (0)</span>
          </div>

          <div
            onClick={() => window.open("https://github.com/heygen-com/hyperframes", "_blank")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-white/[0.04] cursor-pointer"
          >
            <BookOpen size={13} />
            <span>Learn KINO</span>
            <ExternalLink size={11} className="ml-auto opacity-50" />
          </div>

          <div
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-[#686863] hover:text-[#9E9E98] cursor-pointer transition-colors"
            title="Local Free Tier — Deterministic ARM64 Runtime"
          >
            <span>Free · Local Native</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <Settings size={13} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Dashboard Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header: Centered "Make something." + Right Discord */}
        <header className="h-14 flex items-center justify-between px-4 shrink-0">
          <div className="w-[120px]" />
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F4F2]">
            Make something.
          </h1>
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#9E9E98] hover:text-white transition-colors"
          >
            <MessageSquare size={13} />
            <span>Talk to the team</span>
          </a>
        </header>

        {/* Content Area: Center Starter Card + Right Projects Grid */}
        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
          {/* A. Center Starter Card (380px rounded-2xl island) */}
          <div className="w-[380px] bg-[#181817] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between shrink-0 shadow-xl overflow-y-auto">
            <div className="space-y-4">
              {/* Top Mode Segmented Switch */}
              <div className="flex items-center gap-1 bg-[#222220] p-1 rounded-xl w-fit border border-white/5">
                <button
                  onClick={() => setStarterMode("make")}
                  className={`text-xs px-3 py-1 flex items-center gap-1.5 rounded-lg transition-all ${
                    starterMode === "make" ? "pill-mint" : "text-[#9E9E98] hover:text-white"
                  }`}
                  title="Prompt to Video"
                >
                  <Sparkles size={12} />
                  <span>Make</span>
                </button>
                <button
                  onClick={() => {
                    setStarterMode("record");
                    homeFileInputRef.current?.click();
                  }}
                  className={`px-3 py-1 text-xs rounded-lg transition-all flex items-center gap-1 ${
                    starterMode === "record" ? "pill-mint" : "text-[#9E9E98] hover:text-white"
                  }`}
                  title="Footage & Screen (Click to pick files)"
                >
                  <Video size={13} />
                </button>
                <button
                  onClick={() => setStarterMode("script")}
                  className={`px-3 py-1 text-xs rounded-lg transition-all flex items-center gap-1 ${
                    starterMode === "script" ? "pill-mint" : "text-[#9E9E98] hover:text-white"
                  }`}
                  title="Script-First Direction"
                >
                  <List size={13} />
                </button>
              </div>

              {/* Clean Textarea Input Box */}
              <div className="bg-[#222220] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between min-h-[170px] focus-within:border-white/20 transition-colors">
                <input
                  type="file"
                  ref={homeFileInputRef}
                  onChange={handleHomeFileSelect}
                  multiple
                  accept="video/*,audio/*,image/*"
                  className="hidden"
                />
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={
                    starterMode === "make"
                      ? "Describe your video or paste a TikTok, Instagram or YouTube link."
                      : starterMode === "record"
                      ? "Direct raw footage clips (click + to select files)..."
                      : "Write your video narration script..."
                  }
                  rows={4}
                  className="w-full bg-transparent text-sm text-[#F4F4F2] placeholder-[#686863] resize-none outline-none leading-relaxed"
                />

                {/* Bottom Row Inside Box: + media, brand kit pill, arrow button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => homeFileInputRef.current?.click()}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
                      title="Upload local media into assets/"
                    >
                      <Plus size={13} />
                    </button>

                    <button
                      onClick={() => setIsBrandKitOpen(true)}
                      className="pill-dark text-[11px] py-1 px-2.5 flex items-center gap-1.5 text-[#9E9E98] hover:text-white"
                    >
                      <Palette size={11} className="text-[#34D399]" />
                      <span>No brand kit</span>
                    </button>
                  </div>

                  <button
                    onClick={handleLetsGo}
                    disabled={isCreating}
                    className="w-7 h-7 rounded-full bg-white/15 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all"
                  >
                    <ArrowUp size={14} />
                  </button>
                </div>
              </div>

              {/* Your cuts (optional) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#9E9E98]">
                  <Film size={12} />
                  <span>Your cuts (optional)</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {["Hook", "Proof", "Turn", "CTA"].map((cut) => {
                    const isSelected = selectedCuts.includes(cut);
                    return (
                      <button
                        key={cut}
                        onClick={() => toggleCut(cut)}
                        className={`py-2 text-[11px] font-medium rounded-xl border text-center transition-all ${
                          isSelected
                            ? "bg-[#222220] border-[#34D399]/40 text-[#34D399] shadow-[0_0_12px_rgba(52,211,153,0.1)]"
                            : "bg-[#222220]/60 border-white/5 text-[#686863] hover:text-[#9E9E98]"
                        }`}
                      >
                        {cut}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Primary Action */}
            <div className="pt-4 space-y-2.5">
              <button
                onClick={handleLetsGo}
                disabled={isCreating}
                className="w-full bg-[#34D399] hover:bg-[#2DD4BF] text-[#0F0F0E] font-semibold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(52,211,153,0.25)] hover:shadow-[0_6px_25px_rgba(52,211,153,0.35)]"
              >
                {isCreating ? (
                  <span>Scaffolding KINO Project...</span>
                ) : (
                  <span>Let&apos;s go</span>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-[#686863] px-1">
                <span>Add an API key to make voiceovers, av...</span>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-[#9E9E98] hover:text-white underline font-medium"
                >
                  Add key
                </button>
              </div>
            </div>
          </div>

          {/* B. Right Projects & Inspiration Island (flex-1 rounded-2xl island) */}
          <div className="flex-1 bg-[#181817] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between overflow-y-auto shadow-xl">
            <div className="space-y-5">
              {/* Top Promo Tip Card */}
              <div className="bg-[#222220] border border-white/5 rounded-xl p-4 flex items-center justify-between relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-[#34D399] rounded-full" />
                  <span className="text-xs text-[#9E9E98]">
                    Framey clicks and types in your apps for you.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-1 bg-white rounded-full" />
                    <span className="w-1 h-1 bg-white/30 rounded-full" />
                    <span className="w-1 h-1 bg-white/30 rounded-full" />
                    <span className="w-1 h-1 bg-white/30 rounded-full" />
                  </div>
                  <FrameyMascot size={22} />
                </div>
              </div>

              {/* Segmented Tabs: Your Projects | Remix Inspiration */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("projects")}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeTab === "projects"
                        ? "bg-white text-black"
                        : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Your Projects
                  </button>
                  <button
                    onClick={() => setActiveTab("remix")}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeTab === "remix"
                        ? "bg-white text-black"
                        : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Remix Inspiration
                  </button>
                </div>
              </div>

              {/* Visual Project Cards Grid */}
              {activeTab === "projects" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {projects.map((p) => {
                    const isVertical = p.aspect_ratio === "9:16";
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p);
                          onOpenStudio();
                        }}
                        className="group bg-[#222220] border border-white/5 hover:border-white/20 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md flex flex-col"
                      >
                        {/* Aspect Ratio Video Preview Area */}
                        <div className="w-full aspect-video bg-[#0F0F0E] relative overflow-hidden flex items-center justify-center">
                          {/* Ambient glow */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                          <div className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-[#34D399] group-hover:text-black flex items-center justify-center transition-colors z-20">
                            <Video size={16} />
                          </div>
                          <span className="absolute bottom-2 right-2 text-[10px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded z-20">
                            {p.aspect_ratio || "16:9"}
                          </span>
                        </div>

                        {/* Title & Metadata & Action */}
                        <div className="p-3 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-semibold text-[#F4F4F2] group-hover:text-[#34D399] transition-colors truncate">
                              {p.title}
                            </h3>
                            <p className="text-[10px] text-[#686863] mt-0.5 font-mono">
                              {p.duration ? `${p.duration}s` : "12s"} • {p.aspect_ratio || "16:9"}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete project "${p.title}" from disk?`)) {
                                handleArchiveProject(p.id);
                              }
                            }}
                            className="w-6 h-6 rounded hover:bg-white/10 text-[#686863] hover:text-red-400 flex items-center justify-center transition-colors ml-2 shrink-0"
                            title="Delete project"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Remix Inspiration Templates */
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { title: "Viral Hook Reel", desc: "Kinetic typography over talking head", format: "9:16" },
                    { title: "SaaS Product Reveal", desc: "Dark UI card showcase with split-screens", format: "16:9" },
                    { title: "Social Stat Comparison", desc: "Side-by-side animated count-up cards", format: "9:16" },
                    { title: "Antique Serif Title", desc: "Minimalist glowing typography overlay", format: "16:9" },
                  ].map((tpl) => (
                    <div
                      key={tpl.title}
                      onClick={() => {
                        setPromptText(`Create a ${tpl.title}: ${tpl.desc}`);
                      }}
                      className="bg-[#222220] border border-white/5 hover:border-[#34D399]/40 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col justify-between min-h-[110px]"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-[#F4F4F2]">{tpl.title}</h4>
                          <span className="text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-1.5 py-0.5 rounded">
                            {tpl.format}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9E9E98] mt-1">{tpl.desc}</p>
                      </div>
                      <span className="text-[10px] text-[#34D399] font-medium flex items-center gap-1 mt-2">
                        Use template <ChevronRight size={10} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Update Pill & App Status */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] text-xs">
              <div className="flex items-center gap-2 bg-[#222220] px-3 py-1.5 rounded-full border border-white/5">
                <FrameyMascot size={16} />
                <span className="text-[11px] text-[#9E9E98]">
                  There&apos;s a new update. <strong className="text-white cursor-pointer hover:underline">Click here.</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="pill-mint text-[11px] py-1.5 px-3 flex items-center gap-1.5 font-medium"
                >
                  <span>Update the app</span>
                </button>
                <a
                  href="https://github.com/heygen-com/hyperframes"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#9E9E98] hover:text-white transition-colors"
                >
                  Feedback
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Brand Kit Slide-Over Drawer */}
      <BrandKitsDrawer
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
        activeProject={activeProject || projects[0] || null}
        onBrandKitSaved={onRefreshProjects}
      />

      {/* Settings / CLI Doctor Modal */}
      <SettingsDoctorModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

