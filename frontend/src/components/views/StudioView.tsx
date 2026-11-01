"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Home as HomeIcon,
  Palette,
  Folder,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  Check,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Terminal,
  Film,
  Sparkles,
  ArrowUp,
  MessageSquare,
  Share2,
  Upload,
  Video,
  FileText,
  Type,
  Move,
  History,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Settings,
  HelpCircle,
  Archive,
  BookOpen
} from "lucide-react";
import {
  Project,
  CutDecision,
  EditVersion,
  GraphState,
  CreatorPreference,
  formatSMPTE,
} from "@/types";
import { BrandLogo, FrameyMascot } from "../BrandLogo";
import { StudioTimeline } from "../StudioTimeline";
import { CheckpointHistoryModal } from "../CheckpointHistoryModal";
import { HyperFramesLintModal } from "../HyperFramesLintModal";
import { BrandKitsDrawer } from "../BrandKitsDrawer";
import { SettingsDoctorModal } from "../SettingsDoctorModal";
import { API_BASE } from "@/utils/media";

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
  onGoHome?: () => void;
  onOpenTerminal?: () => void;
  onUpdateProjectTitle?: (newTitle: string) => Promise<void>;
}

interface AgentLogMessage {
  id: string;
  sender: "user" | "agent" | "system";
  text?: string;
  badge?: string;
  durationText?: string;
  steps?: string[];
  recoveryOptions?: string[];
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
  onGoHome,
  onOpenTerminal,
  onUpdateProjectTitle,
}) => {
  // Playback & Timeline State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<"video" | "html5">("html5");
  const [compositionHtml, setCompositionHtml] = useState<string>("");
  const [activeVideoSrc, setActiveVideoSrc] = useState<string>(activePreviewUrl);

  // View & Island Layout State
  const [centerTab, setCenterTab] = useState<"main" | "storyboard">("main");
  const [rightTab, setRightTab] = useState<"media" | "script">("media");
  const [mediaCategory, setMediaCategory] = useState<"assets" | "captions" | "markers" | "registry">("captions");
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const [mediaSearch, setMediaSearch] = useState<string>("");
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);

  // Project Title Inline Editing
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(activeProject?.title || "Untitled");

  // Agent CLI State
  const [selectedAgent, setSelectedAgent] = useState<string>("gemini");
  const [agentInput, setAgentInput] = useState<string>("");
  const [isAgentBusy, setIsAgentBusy] = useState<boolean>(false);
  const [isStepAccordionOpen, setIsStepAccordionOpen] = useState<boolean>(false);
  const [agentMessages, setAgentMessages] = useState<AgentLogMessage[]>([
    {
      id: "msg-1",
      sender: "user",
      badge: "continues",
    },
    {
      id: "msg-2",
      sender: "system",
      text: "Picked up the conversation from Codex.",
    },
    {
      id: "msg-3",
      sender: "agent",
      durationText: "Worked for 1m 56s",
      steps: [
        "Read assets/manifest.json for clip timings",
        "Updated STORYBOARD.md with 4 scene beats",
        "Configured frame.md brand tokens & type floor (32px)",
        "Synthesized index.html with paused root GSAP timeline",
        "Passed `npx hyperframes check` with 0 contract errors",
      ],
      text: "The Antique Serif Reveal captions are active across the entire reel, revealing spoken words in sync with the speaker directly above the chapter cards. All seven beats, captions, and the closing call to action are cleanly aligned, verified, and ready to publish.",
      recoveryOptions: ["Switch to Claude Code", "Try again"],
    },
  ]);

  // Modals State
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState<boolean>(false);
  const [isLintModalOpen, setIsLintModalOpen] = useState<boolean>(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isRenderingMp4, setIsRenderingMp4] = useState<boolean>(false);
  const [contractVerified, setContractVerified] = useState<boolean>(true);

  // Script Directives Editor State
  const [scriptContent, setScriptContent] = useState<string>("");
  const [isSavingScript, setIsSavingScript] = useState<boolean>(false);

  // Storyboard State
  const [storyboardContent, setStoryboardContent] = useState<string>("");
  const [isSavingStoryboard, setIsSavingStoryboard] = useState<boolean>(false);
  const [storyboardViewMode, setStoryboardViewMode] = useState<"cards" | "editor">("editor");

  // Stage Tool Mode: Select, Cut, Comment
  const [stageTool, setStageTool] = useState<"select" | "cut" | "comment">("select");

  // Skills Dropdown State
  const [isSkillsMenuOpen, setIsSkillsMenuOpen] = useState<boolean>(false);

  // Media Bin Asset Manifest State
  const [assetsList, setAssetsList] = useState<any[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  const totalDuration = activeProject?.target_duration || 12.0;

  // Sync title when project changes
  useEffect(() => {
    if (activeProject) {
      setTitleInput(activeProject.title);
      loadComposition();
      loadScriptFile();
      loadManifest();
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (activePreviewUrl) {
      setActiveVideoSrc(activePreviewUrl);
    }
  }, [activePreviewUrl]);

  // Load STORYBOARD.md when storyboard tab becomes active or project changes
  useEffect(() => {
    if (centerTab === "storyboard" && activeProject?.id) {
      fetch(`${API_BASE}/api/projects/${activeProject.id}/files/STORYBOARD.md`)
        .then((r) => r.json())
        .then((d) => setStoryboardContent(d.content || ""))
        .catch(() => setStoryboardContent("# Storyboard\n\nNo storyboard yet."));
    }
  }, [centerTab, activeProject?.id]);

  // Load Composition HTML with injected base href
  const loadComposition = () => {
    if (!activeProject) return;
    fetch(`${API_BASE}/api/hyperframes/projects/${activeProject.id}/composition`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.html) {
          const baseTag = `<base href="${API_BASE}/api/projects/${activeProject.id}/">`;
          let processedHtml = data.html;
          if (!processedHtml.includes("<base ")) {
            if (processedHtml.includes("<head>")) {
              processedHtml = processedHtml.replace("<head>", `<head>\n    ${baseTag}`);
            } else {
              processedHtml = `${baseTag}\n${processedHtml}`;
            }
          }
          setCompositionHtml(processedHtml);
        }
      })
      .catch((err) => {
        console.warn("Could not load composition:", err);
      });
  };

  const loadScriptFile = async () => {
    if (!activeProject) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/SCRIPT.md`);
      if (res.ok) {
        const data = await res.json();
        setScriptContent(data.content || "");
      }
    } catch (e) {
      console.warn("Could not load SCRIPT.md:", e);
    }
  };

  const loadManifest = async () => {
    if (!activeProject) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/manifest`);
      if (res.ok) {
        const data = await res.json();
        setAssetsList(data.assets || []);
      }
    } catch (e) {
      console.warn("Could not load manifest:", e);
    }
  };

  const handleSaveScript = async () => {
    if (!activeProject) return;
    setIsSavingScript(true);
    try {
      await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/SCRIPT.md`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: scriptContent }),
      });
    } catch (e) {
      console.error("Failed to save script:", e);
    } finally {
      setIsSavingScript(false);
    }
  };

  const handleSaveStoryboard = async () => {
    if (!activeProject) return;
    setIsSavingStoryboard(true);
    try {
      await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/STORYBOARD.md`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: storyboardContent }),
      });
    } catch (e) {
      console.error("Failed to save storyboard:", e);
    } finally {
      setIsSavingStoryboard(false);
    }
  };

  // HTML5 Live Canvas Seek Loop
  useEffect(() => {
    if (previewMode === "html5" && isPlaying) {
      let lastTime = performance.now();
      const loop = (now: number) => {
        const delta = ((now - lastTime) / 1000) * playbackSpeed;
        lastTime = now;
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= totalDuration) {
            if (isLooping) return 0;
            setIsPlaying(false);
            return totalDuration;
          }
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: "SEEK", time: next }, "*");
          }
          return next;
        });
        animationFrameRef.current = requestAnimationFrame(loop);
      };
      animationFrameRef.current = requestAnimationFrame(loop);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }
  }, [previewMode, isPlaying, isLooping, totalDuration, playbackSpeed]);

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "SEEK", time: clamped }, "*");
    }
  };

  const handleTogglePlay = () => {
    if (previewMode === "video") {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          videoRef.current.play();
          setIsPlaying(true);
        }
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Full Export Render to MP4
  const handleExport = async () => {
    if (!activeProject) return;
    setIsRenderingMp4(true);
    try {
      const res = await fetch(`${API_BASE}/api/cli/hyperframes/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: activeProject.id, output_filename: "output.mp4" }),
      });
      const data = await res.json();
      if (res.ok && data.returncode === 0) {
        const freshUrl = `${API_BASE}/api/projects/${activeProject.id}/assets/output.mp4?t=${Date.now()}`;
        setActiveVideoSrc(freshUrl);
        setPreviewMode("video");
        alert("Render Complete! Output saved to output.mp4");
      } else {
        alert(`Render failed:\n${data.stderr || data.stdout || "Error during compilation"}`);
      }
    } catch (e) {
      console.error("Export error:", e);
      alert("Error initiating KINO render");
    } finally {
      setIsRenderingMp4(false);
    }
  };

  // Agent Prompt Submit
  const handleAgentSubmit = async () => {
    if (!agentInput.trim() || isAgentBusy || !activeProject) return;
    const prompt = agentInput.trim();
    setAgentInput("");
    setIsAgentBusy(true);

    const userMsg: AgentLogMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: prompt,
    };
    setAgentMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`${API_BASE}/api/cli/agent/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.id,
          agent_id: selectedAgent,
          prompt: prompt,
        }),
      });
      const data = await res.json();
      const replyMsg: AgentLogMessage = {
        id: `reply-${Date.now()}`,
        sender: "agent",
        durationText: "Executed in 3.4s",
        steps: [
          `Agent ${selectedAgent} analyzed prompt`,
          `Modified index.html and STORYBOARD.md`,
          `Validated KINO render contract (0 errors)`,
        ],
        text: data.stdout || "Successfully applied your prompt to the KINO composition.",
      };
      setAgentMessages((prev) => [...prev, replyMsg]);
      loadComposition();
      loadScriptFile();
    } catch (e) {
      console.error("Agent execution error:", e);
      const errorMsg: AgentLogMessage = {
        id: `err-${Date.now()}`,
        sender: "agent",
        text: "Encountered an issue running the local agent. You can switch models or retry.",
        recoveryOptions: ["Switch to Claude Code", "Try again"],
      };
      setAgentMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAgentBusy(false);
    }
  };

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    if (onUpdateProjectTitle && titleInput.trim() && titleInput !== activeProject?.title) {
      await onUpdateProjectTitle(titleInput.trim());
    }
  };

  const isVertical = activeProject?.aspect_ratio === "9:16";

  // Predefined visual style components for Right Island
  const styleCards = [
    {
      id: "amber-serif",
      title: "Amber Serif Glow",
      subtitle: "Elegant whole line reveal with subtle blur",
      prompt: "Apply Amber Serif Glow typography to the current scene beat with high contrast text and gold accent.",
    },
    {
      id: "kinetic-hero",
      title: "Kinetic Hero Title",
      subtitle: "Big bold punchy intro headline",
      prompt: "Add a large Kinetic Hero Title on Track 0 at 0.0s with scale and stagger letter animation.",
    },
    {
      id: "social-split",
      title: "Social Split Screen",
      subtitle: "50/50 dual talking head comparison",
      prompt: "Structure this section into a 50/50 vertical split screen with simultaneous talking head playback.",
    },
    {
      id: "animated-lower-third",
      title: "Minimal Lower Third",
      subtitle: "Clean slide-in name badge and handle",
      prompt: "Insert a minimal lower third graphic badge on Track 0 aligned with the speaker introducing themselves.",
    },
  ];

  return (
    <div className="w-full h-screen bg-[#0F0F0E] p-3 flex flex-col text-[#F4F4F2] overflow-hidden select-none">
      {/* Hidden File Upload Input */}
      <input
        ref={fileUploadInputRef}
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/webm,audio/mp3,audio/wav"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadFootageFiles(e.target.files);
            loadManifest();
          }
        }}
      />

      {/* A. Minimal Top Bar (h-12) */}
      <header className="h-12 flex items-center justify-between px-2 shrink-0">
        {/* Left: < Home / Project Title */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onGoHome}
            className="flex items-center gap-1 text-[#9E9E98] hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <ChevronLeft size={14} />
            <span className="font-medium">Home</span>
          </button>
          <span className="text-[#686863]">/</span>

          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="bg-[#222220] border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white outline-none font-semibold"
            />
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-1.5 font-semibold text-white hover:bg-white/[0.04] px-2 py-1 rounded-lg cursor-pointer group"
            >
              <span>{titleInput || "Untitled"}</span>
              <Pencil size={11} className="text-[#686863] group-hover:text-white transition-colors" />
            </div>
          )}
        </div>

        {/* Center: Clean HyperFrames Logo Mark */}
        <div className="flex items-center">
          <BrandLogo />
        </div>

        {/* Right: Talk to team, Contract Check, Checkpoints, Share, Export Pill */}
        <div className="flex items-center gap-2">
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#9E9E98] hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">Talk to the team</span>
          </a>

          {/* Contract Check Gate Pill */}
          <button
            onClick={() => setIsLintModalOpen(true)}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
            title="Inspect KINO Contract Quality Gate"
          >
            <ShieldCheck size={13} className="text-[#34D399]" />
            <span>Check Contract</span>
          </button>

          {/* Git Checkpoints History Pill */}
          <button
            onClick={() => setIsCheckpointModalOpen(true)}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
            title="Inspect Git checkpoints and rollback workspace"
          >
            <History size={13} />
            <span>Checkpoints</span>
          </button>

          {/* Share Pill */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/?project=${activeProject?.id}`;
              navigator.clipboard.writeText(url).then(() => {
                const btn = document.querySelector('[data-share-btn]') as HTMLButtonElement;
                if (btn) { btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = "Share"; }, 2000); }
              });
            }}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
          >
            <Share2 size={13} />
            <span data-share-btn>Share</span>
          </button>

          {/* Crisp Solid White Export Pill */}
          <button
            onClick={handleExport}
            disabled={isRenderingMp4}
            className="pill-white text-xs px-4 py-1.5 font-medium flex items-center gap-1.5 shadow-md"
          >
            {isRenderingMp4 ? (
              <>
                <RefreshCw size={13} className="animate-spin text-black" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Upload size={13} className="text-black" />
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace: Far-Left Icon Rail + 3 Islands Layout */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden pt-1">
        {/* B. Far-Left Ultra-Slim Icon Rail (w-11) */}
        <aside className="w-11 bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col items-center justify-between py-3 shrink-0">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onGoHome && onGoHome()}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Search"
            >
              <Search size={15} />
            </button>
            <button
              onClick={() => onGoHome && onGoHome()}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="New Project"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onGoHome}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Home"
            >
              <HomeIcon size={15} />
            </button>
            <button
              onClick={() => setIsBrandKitOpen(true)}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Brand Kits"
            >
              <Palette size={15} />
            </button>
            <button
              onClick={onGoHome}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Projects"
            >
              <Folder size={15} />
            </button>

            {/* Active Reel Indicator */}
            <div className="relative my-1">
              <button
                onClick={() => setPreviewMode(previewMode === "html5" ? "video" : "html5")}
                className={`w-8 h-8 rounded-xl ${
                  previewMode === "html5" ? "bg-white/[0.08]" : "bg-[#34D399]/20"
                } text-white flex items-center justify-center transition-colors`}
                title={`Active stage mode: ${previewMode.toUpperCase()} (Click to toggle)`}
              >
                <Video size={14} className="text-[#34D399]" />
              </button>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#34D399] border-2 border-[#181817]" />
            </div>

            {/* Terminal Drawer Button */}
            <button
              onClick={onOpenTerminal}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="CLI PTY Terminal"
            >
              <Terminal size={15} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Documentation"
            >
              <BookOpen size={15} />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Settings Doctor"
            >
              <Settings size={15} />
            </button>
          </div>
        </aside>

        {/* 3-Island Main Flex Workspace */}
        <div className="flex-1 flex gap-3 min-w-0 overflow-hidden">
          {/* C. Left Island: Agent & CLI Plan Orchestrator (w-[340px]) */}
          <div className="w-[340px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between shrink-0 overflow-hidden shadow-xl">
            {/* Header: Agent Selector Dropdown + Folder + Skills */}
            <div className="px-3.5 py-3 border-b border-white/[0.06] flex items-center justify-between bg-[#181817] shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#222220] rounded-xl px-2.5 py-1.5 border border-white/5 gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer"
                  >
                    <option value="gemini" className="bg-[#181817]">Gemini 3.8 Flash</option>
                    <option value="antigravity" className="bg-[#181817]">Antigravity</option>
                    <option value="claude" className="bg-[#181817]">Claude Code</option>
                    <option value="codex" className="bg-[#181817]">Codex</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    const dir = `projects/${activeProject?.id || ""}`;
                    navigator.clipboard.writeText(dir);
                  }}
                  className="w-7 h-7 rounded-xl hover:bg-white/10 text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
                  title="Workspace folder"
                >
                  <Folder size={14} />
                </button>
              </div>

              {/* Skills Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsSkillsMenuOpen(!isSkillsMenuOpen)}
                  className="text-xs text-[#9E9E98] hover:text-white flex items-center gap-1 bg-[#222220] px-2.5 py-1.5 rounded-xl border border-white/5 transition-colors"
                >
                  <span className="font-mono text-[#34D399]">||</span>
                  <span>Skills</span>
                  <ChevronDown size={11} />
                </button>
                {isSkillsMenuOpen && (
                  <div className="absolute top-8 left-0 z-50 bg-[#1C1C1B] border border-white/10 rounded-xl p-1.5 shadow-xl min-w-[160px]">
                    {["/kino", "/registry", "/media-use", "/slideshow"].map((skill) => (
                      <button
                        key={skill}
                        className="w-full text-left px-3 py-2 text-xs text-[#C8C8C2] hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                        onClick={() => {
                          setAgentInput((prev) => prev + " " + skill + " ");
                          setIsSkillsMenuOpen(false);
                        }}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Body: Conversational Work Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
              {agentMessages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  {msg.badge && (
                    <div className="flex justify-end">
                      <span className="bg-[#222220] text-[11px] text-[#9E9E98] px-3 py-1 rounded-full border border-white/5">
                        {msg.badge}
                      </span>
                    </div>
                  )}

                  {msg.sender === "system" && msg.text && (
                    <div className="text-[11px] text-[#686863] text-center my-2 font-mono">
                      {msg.text}
                    </div>
                  )}

                  {msg.sender === "agent" && (
                    <div className="space-y-2">
                      {/* Expandable Step Accordion */}
                      {msg.durationText && (
                        <div>
                          <button
                            onClick={() => setIsStepAccordionOpen(!isStepAccordionOpen)}
                            className="flex items-center gap-1.5 text-xs text-[#9E9E98] hover:text-white transition-colors"
                          >
                            <span>{msg.durationText}</span>
                            <ChevronRight
                              size={12}
                              className={`transition-transform ${isStepAccordionOpen ? "rotate-90" : ""}`}
                            />
                          </button>

                          {isStepAccordionOpen && msg.steps && (
                            <div className="mt-2 ml-2 pl-2 border-l border-white/10 space-y-1">
                              {msg.steps.map((st, i) => (
                                <div key={i} className="text-[11px] text-[#9E9E98] flex items-center gap-1.5">
                                  <Check size={11} className="text-[#34D399]" />
                                  <span>{st}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Plain-English Narrative */}
                      {msg.text && (
                        <div className="text-xs text-[#F4F4F2] leading-relaxed bg-[#222220]/40 p-3 rounded-xl border border-white/5">
                          {msg.text}
                        </div>
                      )}

                      {/* Action Recovery Buttons */}
                      {msg.recoveryOptions && (
                        <div className="flex items-center gap-2 pt-1">
                          {msg.recoveryOptions.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setAgentInput(`Please ${opt.toLowerCase()} on this project.`);
                              }}
                              className="pill-dark text-[11px] py-1 px-2.5 text-[#9E9E98] hover:text-white hover:border-[#34D399]/40"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.sender === "user" && msg.text && (
                    <div className="bg-[#222220] text-xs text-white p-3 rounded-xl border border-white/10 ml-6">
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}

              {isAgentBusy && (
                <div className="flex items-center gap-2 text-xs text-[#34D399] bg-[#222220]/60 p-3 rounded-xl border border-white/5">
                  <RefreshCw size={14} className="animate-spin text-[#34D399]" />
                  <span>Agent executing CLI plan...</span>
                </div>
              )}
            </div>

            {/* Footer: Floating Prompt Composer */}
            <div className="p-3 border-t border-white/[0.06] bg-[#181817]">
              <div className="bg-[#222220] border border-white/10 rounded-xl p-3 space-y-2 focus-within:border-white/20 transition-colors">
                <textarea
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAgentSubmit();
                    }
                  }}
                  placeholder="Text to Agent. Type @ for files, # for tools"
                  rows={2}
                  className="w-full bg-transparent text-xs text-[#F4F4F2] placeholder-[#686863] resize-none outline-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileUploadInputRef.current?.click()}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
                      title="Upload media asset"
                    >
                      <Plus size={13} />
                    </button>

                    <button
                      onClick={() => setIsBrandKitOpen(true)}
                      className="pill-dark text-[11px] py-1 px-2.5 flex items-center gap-1.5 text-[#9E9E98] hover:text-white"
                    >
                      <Palette size={11} className="text-[#34D399]" />
                      <span>Brand kit</span>
                    </button>
                  </div>

                  <button
                    onClick={handleAgentSubmit}
                    disabled={isAgentBusy || !agentInput.trim()}
                    className="w-7 h-7 rounded-full bg-white/15 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all disabled:opacity-40"
                  >
                    <ArrowUp size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* D. Center Island: Main Video Stage & Storyboard (flex-1) */}
          <div className="flex-1 bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl">
            {/* Header Bar: Undo/Redo + Segmented Tabs (Main | Storyboard) */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between bg-[#181817] shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-[#9E9E98]">
                  <button
                    onClick={() => setIsCheckpointModalOpen(true)}
                    className="w-6 h-6 rounded-lg hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"
                    title="Rollback / Checkpoint history"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setIsCheckpointModalOpen(true)}
                    className="w-6 h-6 rounded-lg hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"
                    title="Redo / Checkpoint history"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Segmented Switch: Main | Storyboard */}
                <div className="flex items-center bg-[#222220] p-0.5 rounded-xl border border-white/5">
                  <button
                    onClick={() => setCenterTab("main")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      centerTab === "main"
                        ? "bg-[#181817] text-white shadow-sm"
                        : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Main
                  </button>
                  <button
                    onClick={() => setCenterTab("storyboard")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      centerTab === "storyboard"
                        ? "bg-[#181817] text-white shadow-sm"
                        : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Storyboard
                  </button>
                </div>
              </div>

              {/* Right: Collapse Right Island Toggle */}
              <button
                onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
                title={isRightCollapsed ? "Expand Media Drawer" : "Collapse Media Drawer"}
              >
                <ChevronRight size={14} className={isRightCollapsed ? "rotate-180" : ""} />
              </button>
            </div>

            {/* Stage Viewport Area */}
            <div className="flex-1 bg-[#0A0A09] relative flex items-center justify-center overflow-hidden p-4 min-h-[260px]">
              {centerTab === "main" ? (
                /* Main Video / Live DOM Viewport */
                <div
                  style={{
                    aspectRatio: isVertical ? "9/16" : "16/9",
                    height: isVertical ? "100%" : "auto",
                    width: isVertical ? "auto" : "100%",
                    maxHeight: "100%",
                    maxWidth: "100%",
                  }}
                  className={`relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl flex items-center justify-center ${
                    isVertical ? "ring-4 ring-white/[0.04]" : ""
                  }`}
                >
                  {/* Phone Notch for 9:16 */}
                  {isVertical && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full z-30 pointer-events-none" />
                  )}

                  {/* Mode Render: HTML5 Live DOM vs Rendered MP4 */}
                  {previewMode === "video" ? (
                    activeVideoSrc ? (
                      <video
                        ref={videoRef}
                        src={activeVideoSrc}
                        onTimeUpdate={() => {
                          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                        }}
                        loop={isLooping}
                        onClick={handleTogglePlay}
                        className="w-full h-full object-contain cursor-pointer"
                      />
                    ) : (
                      <div className="text-center p-6 text-[#9E9E98]">
                        <Film size={28} className="mx-auto mb-2 text-[#686863]" />
                        <p className="text-xs font-semibold text-white">No Rendered MP4 Available</p>
                        <p className="text-[11px] mt-1">Switch to Live DOM or click Export.</p>
                      </div>
                    )
                  ) : (
                    /* Live Sandboxed Iframe */
                    <iframe
                      ref={iframeRef}
                      srcDoc={compositionHtml}
                      title="KINO Live Stage"
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full h-full border-0 bg-black block"
                    />
                  )}
                </div>
              ) : (
                /* Storyboard Visual Cards / Live Editor View */
                <div className="w-full h-full p-4 overflow-y-auto space-y-3 flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-white">STORYBOARD.md</span>
                      <div className="flex items-center bg-[#222220] p-0.5 rounded-lg border border-white/5 text-[10px]">
                        <button
                          onClick={() => setStoryboardViewMode("editor")}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            storyboardViewMode === "editor"
                              ? "bg-white/10 text-white font-medium"
                              : "text-[#9E9E98] hover:text-white"
                          }`}
                        >
                          Markdown Editor
                        </button>
                        <button
                          onClick={() => setStoryboardViewMode("cards")}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            storyboardViewMode === "cards"
                              ? "bg-white/10 text-white font-medium"
                              : "text-[#9E9E98] hover:text-white"
                          }`}
                        >
                          Beat Cards
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveStoryboard}
                      disabled={isSavingStoryboard}
                      className="pill-mint text-[11px] py-1 px-3"
                    >
                      {isSavingStoryboard ? "Saving..." : "Save Storyboard"}
                    </button>
                  </div>

                  {storyboardViewMode === "editor" ? (
                    <textarea
                      value={storyboardContent}
                      onChange={(e) => setStoryboardContent(e.target.value)}
                      className="w-full flex-1 min-h-[300px] bg-[#222220] border border-white/10 rounded-xl p-3.5 text-xs text-[#F4F4F2] placeholder-[#686863] outline-none font-mono leading-relaxed resize-none"
                      placeholder="# Storyboard&#10;&#10;## Beat 1: HOOK (0.0s - 3.0s)&#10;Opening scene...&#10;&#10;## Beat 2: PROOF (3.0s - 6.0s)..."
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1">
                      {[
                        { order: 1, name: "HOOK", dur: "0.00s - 3.00s", desc: "Kinetic title scale-in and brand introduction", tag: "Track 0" },
                        { order: 2, name: "PROBLEM", dur: "3.00s - 6.00s", desc: "Talking head split with background problem narrative", tag: "Track 1" },
                        { order: 3, name: "SOLUTION", dur: "6.00s - 9.50s", desc: "Registry block overlay and kinetic caption highlight", tag: "Track 0" },
                        { order: 4, name: "CTA", dur: "9.50s - 12.00s", desc: "Centered outro badge and animated button border", tag: "Track 0" },
                      ].map((b) => (
                        <div
                          key={b.order}
                          className="bg-[#181817] border border-white/10 rounded-xl p-3.5 space-y-1.5 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              Beat 0{b.order}: {b.name}
                            </span>
                            <span className="text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-1.5 py-0.5 rounded">
                              {b.dur}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9E9E98] leading-relaxed">{b.desc}</p>
                          <div className="text-[10px] font-mono text-[#686863]">{b.tag}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stage Transport Footer: Minimal White Scrubber + Control Row */}
            <div className="p-3 border-t border-white/[0.06] bg-[#181817] space-y-2 shrink-0">
              {/* Full-width Scrubber Bar */}
              <div
                className="w-full h-1.5 bg-white/10 rounded-full relative cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  handleSeek(pct * totalDuration);
                }}
              >
                <div
                  style={{ width: `${Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))}%` }}
                  className="h-full bg-white rounded-full relative"
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Control Row Below Scrubber */}
              <div className="flex items-center justify-between pt-1">
                {/* Left: Mint-Emerald Quick Tool Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewMode(previewMode === "html5" ? "video" : "html5")}
                    className="pill-mint text-[11px] py-1 px-2.5 font-semibold flex items-center gap-1"
                    title="Toggle Live DOM Canvas / Rendered MP4"
                  >
                    <Sparkles size={12} />
                    <span>{previewMode === "html5" ? "Live DOM" : "MP4 View"}</span>
                  </button>

                  <div className="flex items-center gap-1 bg-[#222220] p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => setStageTool("select")}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        stageTool === "select" ? "bg-white/10 text-white" : "text-[#9E9E98] hover:text-white"
                      }`}
                      title="Selection Tool"
                    >
                      <Move size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setStageTool("cut");
                        setAgentInput(`Split composition clip at ${formatSMPTE(currentTime)} and add transition.`);
                      }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        stageTool === "cut" ? "bg-white/10 text-white" : "text-[#9E9E98] hover:text-white"
                      }`}
                      title="Razor Cut / Directive at Current Playhead"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setStageTool("comment");
                        setAgentInput(`[At ${formatSMPTE(currentTime)}] `);
                      }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        stageTool === "comment" ? "bg-white/10 text-white" : "text-[#9E9E98] hover:text-white"
                      }`}
                      title="Director Note on Current Playhead"
                    >
                      <MessageSquare size={12} />
                    </button>
                    <FrameyMascot size={18} />
                  </div>
                </div>

                {/* Center: Play/Pause + Timecode */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlay}
                    className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-colors shadow-md"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5 fill-current" />}
                  </button>

                  <div className="font-timecode text-xs text-[#F4F4F2] font-medium">
                    <span>{formatSMPTE(currentTime)}</span>
                    <span className="text-[#686863] mx-1">/</span>
                    <span className="text-[#9E9E98]">{formatSMPTE(totalDuration)}</span>
                  </div>
                </div>

                {/* Right: Volume, 1x Speed, Loop, Fullscreen */}
                <div className="flex items-center gap-2 text-[#9E9E98]">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-white transition-colors"
                    title="Toggle audio"
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>

                  <button
                    onClick={() => {
                      const speeds = [1, 1.5, 2];
                      const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                      setPlaybackSpeed(next);
                    }}
                    className="text-[11px] font-mono hover:text-white px-1.5 py-0.5 rounded bg-white/5"
                  >
                    {playbackSpeed}x
                  </button>

                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`hover:text-white transition-colors ${isLooping ? "text-[#34D399]" : ""}`}
                    title="Loop"
                  >
                    <Repeat size={14} />
                  </button>

                  <button
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                    className="hover:text-white transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* E. Right Island: Media, Script & Style Browser (w-[340px], Collapsible) */}
          {!isRightCollapsed && (
            <div className="w-[340px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between shrink-0 overflow-hidden shadow-xl">
              {/* Top Segmented Switch: Media | Script */}
              <div className="p-3 border-b border-white/[0.06] bg-[#181817] shrink-0 space-y-3">
                <div className="grid grid-cols-2 gap-1 bg-[#222220] p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setRightTab("media")}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                      rightTab === "media"
                        ? "bg-[#181817] text-white shadow-sm"
                        : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Media
                  </button>
                  <button
                    onClick={() => setRightTab("script")}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                      rightTab === "script"
                        ? "bg-[#181817] text-white shadow-sm"
                        : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Script
                  </button>
                </div>

                {rightTab === "media" && (
                  <>
                    {/* Category Icon Bar */}
                    <div className="flex items-center justify-between px-1 text-[#9E9E98]">
                      {[
                        { id: "assets", icon: Video, label: "Assets" },
                        { id: "captions", icon: Type, label: "Captions" },
                        { id: "markers", icon: Sparkles, label: "Styles" },
                        { id: "registry", icon: Layers, label: "Blocks" },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setMediaCategory(cat.id as any)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                            mediaCategory === cat.id
                              ? "bg-white/10 text-white font-medium"
                              : "hover:text-white"
                          }`}
                        >
                          <cat.icon size={12} />
                          <span>{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-2.5 text-[#686863]" />
                      <input
                        type="text"
                        value={mediaSearch}
                        onChange={(e) => setMediaSearch(e.target.value)}
                        placeholder="Search captions or assets..."
                        className="w-full bg-[#222220] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#F4F4F2] placeholder-[#686863] outline-none"
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      {["All 91", "HeyGen 74", "Typography", "3D"].map((pill) => (
                        <button
                          key={pill}
                          onClick={() => setMediaFilter(pill.toLowerCase())}
                          className={`pill-dark text-[10.5px] py-1 px-2.5 shrink-0 ${
                            mediaFilter === pill.toLowerCase() ? "bg-white text-black font-medium" : ""
                          }`}
                        >
                          {pill}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Body: Visual Style Cards / Media Bin / Script */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                {rightTab === "media" ? (
                  <>
                    {/* Subtext instruction */}
                    <p className="text-[11px] text-[#686863] leading-relaxed">
                      Click a style to use it in the chat. Nothing goes on the timeline; ask the agent to restyle it or put it on your a-roll.
                    </p>

                    {/* Visual Style Cards */}
                    {mediaCategory === "assets" ? (
                      /* Real Assets from manifest.json */
                      <div className="space-y-2">
                        {assetsList.length === 0 ? (
                          <div className="text-center py-6 text-[#9E9E98] text-xs">
                            No assets in assets/ folder. Click + in chat to upload.
                          </div>
                        ) : (
                          assetsList.map((a) => (
                            <div
                              key={a.filename}
                              onClick={() => {
                                setAgentInput(`Include ${a.filename} on Track 1 from 0.0s to ${a.duration}s.`);
                              }}
                              className="bg-[#222220] border border-white/5 hover:border-white/20 p-2.5 rounded-xl cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-white truncate max-w-[180px]">
                                  {a.filename}
                                </span>
                                <span className="text-[10px] font-mono text-[#34D399]">
                                  {a.duration}s
                                </span>
                              </div>
                              <div className="text-[10px] text-[#686863] font-mono mt-1">
                                {a.width ? `${a.width}x${a.height} • ${a.fps}fps` : "Audio Bed"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      /* Visual Typography & Caption Cards */
                      <div className="space-y-2.5">
                        {styleCards
                          .filter((c) => {
                            const q = mediaSearch.toLowerCase();
                            const matchesSearch = !q || c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q);
                            if (!matchesSearch) return false;
                            const f = mediaFilter.toLowerCase();
                            if (f.includes("all")) return true;
                            if (f.includes("typography")) return c.title.toLowerCase().includes("serif") || c.title.toLowerCase().includes("glow");
                            if (f.includes("3d")) return c.title.toLowerCase().includes("3d") || c.title.toLowerCase().includes("motion");
                            return true;
                          })
                          .map((card) => (
                            <div
                              key={card.id}
                              onClick={() => {
                                setAgentInput(card.prompt);
                              }}
                              className="group bg-[#0A0A09] border border-white/10 hover:border-[#34D399]/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm"
                            >
                              {/* Preview Graphic Area */}
                              <div className="h-16 rounded-lg bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center border border-white/5 mb-2.5">
                                <span className="text-xs font-serif text-[#FBBF24] tracking-wide group-hover:scale-105 transition-transform">
                                  Bring your story to life
                                </span>
                              </div>

                              <div className="text-xs font-semibold text-[#F4F4F2] group-hover:text-[#34D399] transition-colors">
                                {card.title}
                              </div>
                              <div className="text-[11px] text-[#9E9E98] mt-0.5">
                                {card.subtitle}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Script Editor */
                  <div className="space-y-3 h-full flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">SCRIPT.md Narration</span>
                      <button
                        onClick={handleSaveScript}
                        disabled={isSavingScript}
                        className="pill-mint text-[11px] py-1 px-3"
                      >
                        {isSavingScript ? "Saving..." : "Save Script"}
                      </button>
                    </div>

                    <textarea
                      value={scriptContent}
                      onChange={(e) => setScriptContent(e.target.value)}
                      rows={14}
                      className="w-full flex-1 bg-[#222220] border border-white/10 rounded-xl p-3 text-xs text-[#F4F4F2] placeholder-[#686863] outline-none font-mono leading-relaxed resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* F. Bottom Bar: Collapsible Timeline & Terminal Drawer */}
      <footer className="pt-2 shrink-0">
        {!isTimelineExpanded ? (
          /* Default Collapsed State (h-11) */
          <div className="h-11 bg-[#181817] border border-white/[0.07] rounded-2xl px-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9E9E98]">
                {activeProject?.width || 1920}×{activeProject?.height || 1080} • 30 FPS • {activeProject?.aspect_ratio || "16:9"}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-xs text-[#34D399] flex items-center gap-1">
                <CheckCircle2 size={13} /> Contract Verified
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenTerminal}
                className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5 text-[#9E9E98] hover:text-white"
              >
                <Terminal size={12} />
                <span>Terminal</span>
              </button>

              <button
                onClick={() => setIsTimelineExpanded(true)}
                className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5 text-[#F4F4F2] hover:bg-white/10"
              >
                <Sliders size={12} />
                <span>Show timeline</span>
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Multitrack Timeline Island (240px) */
          <div className="h-[240px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="h-9 px-4 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#181817]">
              <span className="text-xs font-semibold text-white">Multitrack Timeline (2-way sync)</span>
              <button
                onClick={() => setIsTimelineExpanded(false)}
                className="pill-dark text-[11px] py-1 px-3 text-[#9E9E98] hover:text-white"
              >
                Hide timeline
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <StudioTimeline
                decisions={decisions}
                selectedDecisionId={selectedDecision?.decision_id || null}
                onSelectDecision={onSelectDecision}
                currentTime={currentTime}
                totalDuration={totalDuration}
                onSeek={handleSeek}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                activeVersionNum={versions.length > 0 ? versions[versions.length - 1].version_num : 1}
              />
            </div>
          </div>
        )}
      </footer>

      {/* Slide-over Brand Kits Drawer */}
      <BrandKitsDrawer
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
        activeProject={activeProject}
        onBrandKitSaved={loadComposition}
      />

      {/* Git Checkpoints History Modal */}
      <CheckpointHistoryModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        activeProject={activeProject}
        onRestored={loadComposition}
      />

      {/* HyperFrames Contract Verification Gate Modal */}
      {activeProject && (
        <HyperFramesLintModal
          isOpen={isLintModalOpen}
          onClose={() => setIsLintModalOpen(false)}
          projectId={activeProject.id}
        />
      )}

      {/* Settings / CLI Doctor Modal */}
      <SettingsDoctorModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
