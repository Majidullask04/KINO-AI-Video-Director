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
  BookOpen,
  Scissors,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Square,
  Circle,
  X,
  Key,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Grid,
  RotateCw,
  ZoomIn,
} from "lucide-react";
import {
  Project,
  CutDecision,
  EditVersion,
  GraphState,
  CreatorPreference,
  formatSMPTE,
  TimelineProjectState,
  TimelineClip,
  LocalAssetRecord,
} from "@/types";
import { BrandLogo, FrameyMascot } from "../BrandLogo";
import { StudioTimeline } from "../StudioTimeline";
import { CheckpointHistoryModal } from "../CheckpointHistoryModal";
import { HyperFramesLintModal } from "../HyperFramesLintModal";
import { BrandKitsDrawer } from "../BrandKitsDrawer";
import { SettingsDoctorModal } from "../SettingsDoctorModal";
import { API_BASE } from "@/utils/media";
import {
  getTimeline,
  saveTimeline,
  checkBackendAvailability,
  listAssets,
  saveAsset,
  getFile,
  saveFile,
} from "@/lib/storage-adapter";
import {
  renderTimelineInBrowser,
  triggerFileDownload,
  ExportProgress,
} from "@/lib/browser-exporter";
import {
  executeAiDirective,
  getByokSettings,
  saveByokSettings,
  ByokSettings,
} from "@/lib/ai-director";

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
  // ── Unified Timeline & Clip State ──
  const [timelineState, setTimelineState] = useState<TimelineProjectState | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Playback & Stage State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<"video" | "html5">("html5");
  const [compositionHtml, setCompositionHtml] = useState<string>("");
  const [activeVideoSrc, setActiveVideoSrc] = useState<string>(activePreviewUrl);
  const [stageZoom, setStageZoom] = useState<"fit" | "50%" | "100%" | "150%">("fit");

  // View & Island Layout State
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [centerTab, setCenterTab] = useState<"main" | "storyboard">("main");
  const [builderTab, setBuilderTab] = useState<"media" | "text" | "effects" | "shapes" | "canvas">("media");
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(true);

  // Project Title Inline Editing
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(activeProject?.title || "Untitled");

  // AI Director & BYOK State
  const [selectedAgent, setSelectedAgent] = useState<string>("gemini");
  const [agentInput, setAgentInput] = useState<string>("");
  const [isAgentBusy, setIsAgentBusy] = useState<boolean>(false);
  const [isStepAccordionOpen, setIsStepAccordionOpen] = useState<boolean>(false);
  const [byokSettings, setByokState] = useState<ByokSettings>({ provider: "gemini", apiKey: "" });
  const [isByokModalOpen, setIsByokModalOpen] = useState<boolean>(false);

  // Universal Video Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<"browser" | "local_cli">("browser");
  const [exportResolution, setExportResolution] = useState<"1080p" | "720p">("1080p");
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Canvas Interactive Drag & Transform State
  const [isDraggingClip, setIsDraggingClip] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialClipTransform, setInitialClipTransform] = useState<{ x: number; y: number } | null>(null);
  const [inlineEditingTextId, setInlineEditingTextId] = useState<string | null>(null);

  // Modals & Storage State
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState<boolean>(false);
  const [isLintModalOpen, setIsLintModalOpen] = useState<boolean>(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  // Script & Storyboard
  const [scriptContent, setScriptContent] = useState<string>("");
  const [isSavingScript, setIsSavingScript] = useState<boolean>(false);
  const [storyboardContent, setStoryboardContent] = useState<string>("");
  const [isSavingStoryboard, setIsSavingStoryboard] = useState<boolean>(false);
  const [storyboardViewMode, setStoryboardViewMode] = useState<"cards" | "editor">("editor");

  // Local Assets Manifest
  const [assetsList, setAssetsList] = useState<LocalAssetRecord[]>([]);

  // Agent Chat Messages
  const [agentMessages, setAgentMessages] = useState<AgentLogMessage[]>([
    {
      id: "msg-1",
      sender: "system",
      text: "KINO Hybrid Video Studio initialized. Manual editing and AI Director are active.",
    },
    {
      id: "msg-2",
      sender: "agent",
      durationText: "Engine Ready",
      steps: [
        "Loaded Timeline project state",
        "Initialized HTML5 stage preview",
        "Connected dual storage adapter",
      ],
      text: "You can manually drag clips, trim edges, edit text properties, or prompt the AI Director to generate changes.",
      recoveryOptions: ["Split clips 2.5s", "Add Kinetic Title", "Amber Serif Captions"],
    },
  ]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  const totalDuration = timelineState?.duration || activeProject?.target_duration || 12.0;

  // Selected Clip Helper
  const selectedClip = timelineState?.clips.find((c) => c.id === selectedClipId) || null;

  // ── 1. Initial Load & Sync ──
  useEffect(() => {
    checkBackendAvailability().then(setIsBackendOnline);
    setByokState(getByokSettings());
  }, []);

  useEffect(() => {
    if (activeProject) {
      setTitleInput(activeProject.title);
      loadProjectTimeline(activeProject.id);
      loadComposition();
      loadScriptFile();
      loadAssetsList();
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (activePreviewUrl) {
      setActiveVideoSrc(activePreviewUrl);
    }
  }, [activePreviewUrl]);

  const loadProjectTimeline = async (projectId: string) => {
    try {
      const state = await getTimeline(projectId);
      setTimelineState(state);
      if (state.clips && state.clips.length > 0 && !selectedClipId) {
        setSelectedClipId(state.clips[0].id);
      }
    } catch (e) {
      console.warn("Could not load timeline state:", e);
    }
  };

  const loadAssetsList = async () => {
    if (!activeProject) return;
    try {
      const list = await listAssets(activeProject.id);
      setAssetsList(list);
    } catch (e) {
      console.warn("Could not load assets:", e);
    }
  };

  const loadComposition = async () => {
    if (!activeProject) return;
    try {
      const html = await getFile(activeProject.id, "index.html");
      if (html) {
        const baseTag = `<base href="${API_BASE}/api/projects/${activeProject.id}/">`;
        let processed = html;
        if (!processed.includes("<base ")) {
          processed = processed.includes("<head>")
            ? processed.replace("<head>", `<head>\n    ${baseTag}`)
            : `${baseTag}\n${processed}`;
        }
        setCompositionHtml(processed);
      }
    } catch (e) {
      console.warn("Could not load composition html:", e);
    }
  };

  const loadScriptFile = async () => {
    if (!activeProject) return;
    try {
      const content = await getFile(activeProject.id, "SCRIPT.md");
      setScriptContent(content || "# Script\n\n[Hook] Enter script here.\n");
    } catch (e) {
      console.warn("Could not load SCRIPT.md:", e);
    }
  };

  // ── 2. Timeline Updates & Persistence ──
  const handleUpdateTimeline = async (nextTimeline: TimelineProjectState) => {
    setTimelineState(nextTimeline);
    if (activeProject) {
      await saveTimeline(activeProject.id, nextTimeline);
      // Post seek message to iframe if live
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: "SEEK", time: currentTime }, "*");
      }
    }
  };

  const handleUpdateSelectedClip = (updates: Partial<TimelineClip>) => {
    if (!timelineState || !selectedClipId) return;
    const nextClips = timelineState.clips.map((c) =>
      c.id === selectedClipId ? { ...c, ...updates } : c
    );
    handleUpdateTimeline({ ...timelineState, clips: nextClips });
  };

  const handleUpdateClipTransform = (updates: Partial<TimelineClip["transform"]>) => {
    if (!selectedClip) return;
    handleUpdateSelectedClip({
      transform: { ...selectedClip.transform, ...updates },
    });
  };

  const handleUpdateClipStyle = (updates: Partial<NonNullable<TimelineClip["style"]>>) => {
    if (!selectedClip) return;
    handleUpdateSelectedClip({
      style: { ...(selectedClip.style || {}), ...updates },
    });
  };

  // ── 3. Playback Loop ──
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

  // ── 4. AI Director Execution (BYOK, Local CLI, or Free Rules) ──
  const handleAgentSubmit = async (customPrompt?: string) => {
    const prompt = (customPrompt || agentInput).trim();
    if (!prompt || isAgentBusy || !activeProject || !timelineState) return;

    if (!customPrompt) setAgentInput("");
    setIsAgentBusy(true);

    const userMsg: AgentLogMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: prompt,
    };
    setAgentMessages((prev) => [...prev, userMsg]);

    try {
      const result = await executeAiDirective(activeProject.id, prompt, timelineState);
      await handleUpdateTimeline(result.updatedTimeline);

      const agentReply: AgentLogMessage = {
        id: `reply-${Date.now()}`,
        sender: "agent",
        durationText: result.source === "builtin_rule" ? "Instant (Free Rule)" : "Executed in 2.1s",
        steps: [
          `Directive processed via ${result.source}`,
          "Synchronized timeline and index.html",
          "Updated 0-cost canvas state",
        ],
        text: result.logMessage,
        recoveryOptions: ["Undo edit", "Split clips 2.5s", "Add Kinetic Title"],
      };

      setAgentMessages((prev) => [...prev, agentReply]);
      loadComposition();
    } catch (e: any) {
      console.error("AI Director error:", e);
      const errorMsg: AgentLogMessage = {
        id: `err-${Date.now()}`,
        sender: "agent",
        text: `Execution notice: ${e.message || "Failed to process directive."}. You can configure your Gemini key in BYOK Settings.`,
        recoveryOptions: ["Open BYOK Settings", "Use Built-in Rules"],
      };
      setAgentMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAgentBusy(false);
    }
  };

  // ── 5. Universal Video Export (Browser Canvas vs Local CLI) ──
  const handleStartExport = async () => {
    if (!activeProject || !timelineState) return;
    setIsExporting(true);
    setExportProgress({ progressPercent: 0, currentFrame: 0, totalFrames: 0, statusText: "Initializing export..." });

    try {
      if (exportMode === "browser") {
        // Render 100% in client browser using WebCodecs/Canvas
        const result = await renderTimelineInBrowser(timelineState, {
          resolution: exportResolution,
          onProgress: (p) => setExportProgress(p),
        });

        triggerFileDownload(result.url, `${activeProject.title || "kino-export"}.${result.filename.split(".").pop()}`);
        setExportProgress({
          progressPercent: 100,
          currentFrame: 360,
          totalFrames: 360,
          statusText: "Complete! Video downloaded.",
        });
        setTimeout(() => {
          setIsExportModalOpen(false);
          setIsExporting(false);
        }, 1200);
      } else {
        // Local Pro CLI Render (npx hyperframes render)
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
          alert("Local Pro Render Complete! Saved to output.mp4");
          setIsExportModalOpen(false);
        } else {
          alert(`Render failed:\n${data.stderr || data.stdout || "Error during compilation"}`);
        }
        setIsExporting(false);
      }
    } catch (e: any) {
      console.error("Export error:", e);
      alert(`Export error: ${e.message}`);
      setIsExporting(false);
    }
  };

  // ── 6. Manual Builder Insert Helpers ──
  const handleInsertTextPreset = (preset: "hero" | "subtitle" | "lower-third" | "pill") => {
    if (!timelineState) return;
    const clipId = `text-${Date.now()}`;

    let newClip: TimelineClip;
    if (preset === "hero") {
      newClip = {
        id: clipId,
        name: "Hero Title",
        type: "text",
        start: currentTime,
        duration: 3.0,
        trackIndex: 0,
        text: "BRING YOUR STORY TO LIFE",
        transform: { x: 0, y: 0, width: 90, height: 25, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 44, color: "#FFFFFF", fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center" },
        animation: { in: "pop", out: "fade", duration: 0.4 },
      };
    } else if (preset === "subtitle") {
      newClip = {
        id: clipId,
        name: "Amber Subtitle",
        type: "text",
        start: currentTime,
        duration: 3.5,
        trackIndex: 0,
        text: "Elegant subtitle narration line",
        transform: { x: 0, y: 35, width: 80, height: 15, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 28, color: "#FBBF24", fontWeight: 600, fontFamily: "Playfair Display, serif", textAlign: "center" },
        animation: { in: "word-reveal", out: "fade", duration: 0.5 },
      };
    } else if (preset === "lower-third") {
      newClip = {
        id: clipId,
        name: "Lower Third",
        type: "text",
        start: currentTime,
        duration: 4.0,
        trackIndex: 0,
        text: "KINO DIRECTOR — Studio Mode",
        transform: { x: -25, y: 38, width: 45, height: 12, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 20, color: "#FFFFFF", backgroundColor: "#181817", fontWeight: 600, fontFamily: "Inter, sans-serif" },
        animation: { in: "slide-up", out: "fade", duration: 0.4 },
      };
    } else {
      newClip = {
        id: clipId,
        name: "Neon Pill",
        type: "text",
        start: currentTime,
        duration: 3.0,
        trackIndex: 0,
        text: "100% LOCAL & FREE",
        transform: { x: 0, y: -38, width: 35, height: 10, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 18, color: "#000000", backgroundColor: "#34D399", fontWeight: 700, fontFamily: "Inter, sans-serif", textAlign: "center" },
        animation: { in: "pop", out: "fade", duration: 0.3 },
      };
    }

    const nextClips = [...timelineState.clips, newClip];
    handleUpdateTimeline({ ...timelineState, clips: nextClips });
    setSelectedClipId(clipId);
  };

  const handleInsertAssetToTimeline = (asset: LocalAssetRecord) => {
    if (!timelineState) return;
    const clipId = `media-${Date.now()}`;
    const newClip: TimelineClip = {
      id: clipId,
      name: asset.filename,
      type: asset.has_video !== false ? "video" : "audio",
      start: currentTime,
      duration: asset.duration || 4.0,
      trackIndex: asset.has_video !== false ? 1 : 3,
      sourceAsset: asset.filename,
      sourceUrl: asset.url,
      transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
    };

    const nextClips = [...timelineState.clips, newClip];
    handleUpdateTimeline({ ...timelineState, clips: nextClips });
    setSelectedClipId(clipId);
  };

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    if (onUpdateProjectTitle && titleInput.trim() && titleInput !== activeProject?.title) {
      await onUpdateProjectTitle(titleInput.trim());
    }
  };

  const isVertical = (timelineState?.aspectRatio || activeProject?.aspect_ratio) === "9:16";

  return (
    <div className="w-full h-screen bg-[#0F0F0E] p-3 flex flex-col text-[#F4F4F2] overflow-hidden select-none">
      {/* Hidden File Upload Input */}
      <input
        ref={fileUploadInputRef}
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/webm,audio/mp3,audio/wav,image/png,image/jpeg"
        style={{ display: "none" }}
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0 && activeProject) {
            for (let i = 0; i < e.target.files.length; i++) {
              await saveAsset(activeProject.id, e.target.files[i]);
            }
            await onUploadFootageFiles(e.target.files);
            await loadAssetsList();
          }
        }}
      />

      {/* ── Top Header Bar (h-12) ── */}
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

        {/* Center: Brand Logo Mark */}
        <div className="flex items-center">
          <BrandLogo />
        </div>

        {/* Right: Engine Status, Checkpoints, BYOK, Export */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              isBackendOnline
                ? "bg-emerald-950/60 text-[#34D399] border-emerald-500/30"
                : "bg-white/5 text-[#9E9E98] border-white/10"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendOnline ? "bg-[#34D399] animate-pulse" : "bg-[#9E9E98]"
              }`}
            />
            <span>{isBackendOnline ? "CLI Engine Online" : "Browser Mode (Free)"}</span>
          </div>

          {/* BYOK Settings Pill */}
          <button
            onClick={() => setIsByokModalOpen(true)}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
            title="Configure AI API Keys (Gemini, OpenAI)"
          >
            <Key size={12} className="text-[#34D399]" />
            <span>AI Keys</span>
          </button>

          {/* Checkpoints Pill */}
          <button
            onClick={() => setIsCheckpointModalOpen(true)}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
            title="Inspect Git checkpoints"
          >
            <History size={13} />
            <span>Checkpoints</span>
          </button>

          {/* Solid White Export Pill */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="pill-white text-xs px-4 py-1.5 font-medium flex items-center gap-1.5 shadow-md"
          >
            <Upload size={13} className="text-black" />
            <span>Export Video</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace: Left Icon Rail + 3 Islands ── */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden pt-1">
        {/* Far-Left Slim Icon Rail (w-11) */}
        <aside className="w-11 bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col items-center justify-between py-3 shrink-0">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onGoHome && onGoHome()}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Home"
            >
              <HomeIcon size={15} />
            </button>
            <button
              onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                !isLeftCollapsed ? "bg-white/[0.08] text-[#34D399]" : "text-[#9E9E98] hover:text-white"
              }`}
              title={isLeftCollapsed ? "Show AI Director" : "Hide AI Director"}
            >
              <Sparkles size={15} />
            </button>
            <button
              onClick={() => setPreviewMode(previewMode === "html5" ? "video" : "html5")}
              className={`w-8 h-8 rounded-xl ${
                previewMode === "html5" ? "bg-white/[0.08]" : "bg-[#34D399]/20"
              } text-white flex items-center justify-center transition-colors`}
              title={`Stage mode: ${previewMode.toUpperCase()}`}
            >
              <Video size={14} className="text-[#34D399]" />
            </button>
            <button
              onClick={onOpenTerminal}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Host Terminal"
            >
              <Terminal size={15} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setIsBrandKitOpen(true)}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Brand Kits"
            >
              <Palette size={15} />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-xl hover:bg-white/[0.06] text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
              title="Settings"
            >
              <Settings size={15} />
            </button>
          </div>
        </aside>

        {/* ── Island Workspace ── */}
        <div className="flex-1 flex gap-3 min-w-0 overflow-hidden">
          {/* A. Left Island: AI Director (Collapsible, w-[320px]) */}
          {!isLeftCollapsed && (
            <div className="w-[320px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between shrink-0 overflow-hidden shadow-xl">
              {/* Header: Hide Button + Agent Selector */}
              <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between bg-[#181817] shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-[#222220] rounded-xl px-2 py-1 border border-white/5 gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer"
                    >
                      <option value="gemini" className="bg-[#181817]">Gemini Free API</option>
                      <option value="antigravity" className="bg-[#181817]">Antigravity CLI</option>
                      <option value="claude" className="bg-[#181817]">Claude Code</option>
                      <option value="rules" className="bg-[#181817]">Built-in Rules (0-Key)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setIsLeftCollapsed(true)}
                  className="text-xs text-[#9E9E98] hover:text-white flex items-center gap-1 bg-[#222220] px-2 py-1 rounded-lg border border-white/5 transition-colors"
                  title="Hide AI panel for full manual editing"
                >
                  <span>&lt; Hide AI</span>
                </button>
              </div>

              {/* Chat Log & Fast Directives */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                {/* 100% Free Quick Actions Palette */}
                <div className="bg-[#222220]/60 border border-white/5 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[10px] font-mono text-[#686863] uppercase tracking-wider flex items-center justify-between">
                    <span>Quick Directives (100% Free)</span>
                    <Sparkles size={11} className="text-[#34D399]" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleAgentSubmit("Split video into 2.5s pacing cuts with dynamic rhythm.")}
                      className="text-left text-[11px] p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                    >
                      ✂️ Auto-Split 2.5s
                    </button>
                    <button
                      onClick={() => handleAgentSubmit("Add Amber Serif Glow Captions across the reel.")}
                      className="text-left text-[11px] p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                    >
                      ✨ Amber Captions
                    </button>
                    <button
                      onClick={() => handleAgentSubmit("Format composition to 9:16 vertical TikTok/Reels.")}
                      className="text-left text-[11px] p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                    >
                      📱 9:16 Vertical
                    </button>
                    <button
                      onClick={() => handleAgentSubmit("Format composition to 16:9 landscape YouTube.")}
                      className="text-left text-[11px] p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                    >
                      🖥️ 16:9 Landscape
                    </button>
                  </div>
                </div>

                {/* Message Log */}
                {agentMessages.map((msg) => (
                  <div key={msg.id} className="space-y-1.5">
                    {msg.sender === "system" && (
                      <div className="text-[10px] text-[#686863] text-center font-mono py-1">
                        {msg.text}
                      </div>
                    )}
                    {msg.sender === "agent" && (
                      <div className="bg-[#222220]/40 border border-white/5 p-2.5 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#34D399]">
                          <span>{msg.durationText || "Director Action"}</span>
                        </div>
                        <p className="text-xs text-[#F4F4F2] leading-relaxed">{msg.text}</p>
                      </div>
                    )}
                    {msg.sender === "user" && (
                      <div className="bg-[#222220] border border-white/10 p-2.5 rounded-xl text-xs text-white ml-4">
                        {msg.text}
                      </div>
                    )}
                  </div>
                ))}

                {isAgentBusy && (
                  <div className="flex items-center gap-2 text-xs text-[#34D399] bg-[#222220]/60 p-2.5 rounded-xl border border-white/5">
                    <RefreshCw size={13} className="animate-spin text-[#34D399]" />
                    <span>AI Director applying changes...</span>
                  </div>
                )}
              </div>

              {/* Input Prompt Box */}
              <div className="p-2.5 border-t border-white/[0.06] bg-[#181817]">
                <div className="bg-[#222220] border border-white/10 rounded-xl p-2.5 space-y-1.5 focus-within:border-white/20 transition-colors">
                  <textarea
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAgentSubmit();
                      }
                    }}
                    placeholder="Ask AI Director to cut, restyle, or retitle..."
                    rows={2}
                    className="w-full bg-transparent text-xs text-[#F4F4F2] placeholder-[#686863] resize-none outline-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setIsByokModalOpen(true)}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      <Key size={10} className="text-[#34D399]" />
                      <span>{byokSettings.apiKey ? "BYOK Active" : "No Key (Free Rules)"}</span>
                    </button>
                    <button
                      onClick={() => handleAgentSubmit()}
                      disabled={isAgentBusy || !agentInput.trim()}
                      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all disabled:opacity-30"
                    >
                      <ArrowUp size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. Center Island: OpenCut Stage Viewport (flex-1) */}
          <div className="flex-1 bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl min-w-0">
            {/* Header: Tabs + Stage Zoom + Collapsed Re-openers */}
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between bg-[#181817] shrink-0">
              <div className="flex items-center gap-2">
                {isLeftCollapsed && (
                  <button
                    onClick={() => setIsLeftCollapsed(false)}
                    className="pill-dark text-xs py-1 px-2.5 flex items-center gap-1.5 text-[#34D399]"
                    title="Open AI Director panel"
                  >
                    <Sparkles size={12} />
                    <span>Show AI</span>
                  </button>
                )}

                {/* Segmented Switch: Main Stage | Storyboard */}
                <div className="flex items-center bg-[#222220] p-0.5 rounded-xl border border-white/5">
                  <button
                    onClick={() => setCenterTab("main")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      centerTab === "main" ? "bg-[#181817] text-white shadow-sm" : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Stage
                  </button>
                  <button
                    onClick={() => setCenterTab("storyboard")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      centerTab === "storyboard" ? "bg-[#181817] text-white shadow-sm" : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Storyboard
                  </button>
                </div>
              </div>

              {/* Stage Controls: Zoom Dropdown + Collapse Right Drawer */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-[#222220] px-2 py-0.5 rounded-lg border border-white/5 text-xs text-zinc-300">
                  <ZoomIn size={12} className="text-zinc-500" />
                  <select
                    value={stageZoom}
                    onChange={(e) => setStageZoom(e.target.value as any)}
                    className="bg-transparent outline-none cursor-pointer text-[11px]"
                  >
                    <option value="fit" className="bg-[#181817]">Fit to Window</option>
                    <option value="50%" className="bg-[#181817]">50%</option>
                    <option value="100%" className="bg-[#181817]">100%</option>
                    <option value="150%" className="bg-[#181817]">150%</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
                  title={isRightCollapsed ? "Show Inspector / Builder" : "Collapse Right Panel"}
                >
                  <ChevronRight size={14} className={isRightCollapsed ? "rotate-180" : ""} />
                </button>
              </div>
            </div>

            {/* Viewport Canvas with Interactive Selection Overlay */}
            <div
              ref={stageContainerRef}
              className="flex-1 bg-[#0A0A09] relative flex items-center justify-center overflow-hidden p-4 min-h-[260px]"
            >
              {centerTab === "main" ? (
                <div
                  style={{
                    aspectRatio: isVertical ? "9/16" : "16/9",
                    height: isVertical ? (stageZoom === "fit" ? "100%" : stageZoom) : "auto",
                    width: isVertical ? "auto" : (stageZoom === "fit" ? "100%" : stageZoom),
                    maxHeight: "100%",
                    maxWidth: "100%",
                    transform: stageZoom !== "fit" ? `scale(${parseInt(stageZoom) / 100})` : undefined,
                  }}
                  className="relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl flex items-center justify-center select-none"
                  onClick={() => setSelectedClipId(null)}
                >
                  {/* Phone Notch for 9:16 */}
                  {isVertical && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full z-30 pointer-events-none" />
                  )}

                  {/* Mode A: Rendered MP4 */}
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
                        <p className="text-[11px] mt-1">Switch to Live DOM or click Export Video.</p>
                      </div>
                    )
                  ) : (
                    /* Mode B: HTML5 Live Stage Preview */
                    <iframe
                      ref={iframeRef}
                      srcDoc={compositionHtml}
                      title="KINO Live Stage"
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full h-full border-0 bg-black block pointer-events-none"
                    />
                  )}

                  {/* ── Interactive Stage Element Bounding Box ── */}
                  {selectedClip && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        setIsDraggingClip(true);
                        setDragStartPos({ x: e.clientX, y: e.clientY });
                        setInitialClipTransform({ x: selectedClip.transform.x, y: selectedClip.transform.y });
                      }}
                      style={{
                        position: "absolute",
                        left: `${50 + selectedClip.transform.x}%`,
                        top: `${50 + selectedClip.transform.y}%`,
                        width: `${selectedClip.transform.width}%`,
                        height: `${selectedClip.transform.height}%`,
                        transform: `translate(-50%, -50%) scale(${selectedClip.transform.scale}) rotate(${selectedClip.transform.rotation}deg)`,
                        opacity: selectedClip.transform.opacity,
                      }}
                      className="border-2 border-[#34D399] rounded cursor-move z-30 shadow-[0_0_15px_rgba(52,211,153,0.3)] group"
                    >
                      {/* Top Rotation Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const initialRot = selectedClip.transform.rotation;
                          const startX = e.clientX;
                          const onMove = (me: MouseEvent) => {
                            const delta = (me.clientX - startX) * 0.5;
                            handleUpdateClipTransform({ rotation: Math.round(initialRot + delta) });
                          };
                          const onUp = () => {
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                        className="absolute -top-7 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#34D399] border-2 border-black cursor-grab active:cursor-grabbing flex items-center justify-center shadow-md"
                        title="Drag to rotate"
                      >
                        <RotateCw size={8} className="text-black" />
                      </div>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-[#34D399]" />

                      {/* 8 Resize Handles */}
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-black rounded-sm cursor-nwse-resize" />
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-black rounded-sm cursor-ns-resize" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-black rounded-sm cursor-nesw-resize" />
                      <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-black rounded-sm cursor-ew-resize" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-black rounded-sm cursor-nwse-resize" />
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-black rounded-sm cursor-ns-resize" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-black rounded-sm cursor-nesw-resize" />
                      <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-black rounded-sm cursor-ew-resize" />

                      {/* Inline Text Content Editing */}
                      {selectedClip.type === "text" && (
                        <div
                          onDoubleClick={() => setInlineEditingTextId(selectedClip.id)}
                          className="w-full h-full flex items-center justify-center p-2 text-center overflow-hidden"
                          style={{
                            fontFamily: selectedClip.style?.fontFamily || "Inter, sans-serif",
                            fontSize: `${(selectedClip.style?.fontSize || 32) * 0.4}px`,
                            color: selectedClip.style?.color || "#FFFFFF",
                            fontWeight: selectedClip.style?.fontWeight || "normal",
                          }}
                        >
                          {inlineEditingTextId === selectedClip.id ? (
                            <input
                              type="text"
                              value={selectedClip.text || ""}
                              onChange={(e) => handleUpdateSelectedClip({ text: e.target.value })}
                              onBlur={() => setInlineEditingTextId(null)}
                              onKeyDown={(e) => e.key === "Enter" && setInlineEditingTextId(null)}
                              autoFocus
                              className="bg-black/80 border border-[#34D399] text-white px-2 py-1 rounded outline-none text-center w-full"
                            />
                          ) : (
                            <span className="truncate">{selectedClip.text}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Storyboard Editor View */
                <div className="w-full h-full p-4 overflow-y-auto space-y-3 flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <span className="text-xs font-semibold text-white">STORYBOARD.md</span>
                    <button
                      onClick={async () => {
                        if (!activeProject) return;
                        setIsSavingStoryboard(true);
                        await saveFile(activeProject.id, "STORYBOARD.md", storyboardContent);
                        setIsSavingStoryboard(false);
                      }}
                      disabled={isSavingStoryboard}
                      className="pill-mint text-[11px] py-1 px-3"
                    >
                      {isSavingStoryboard ? "Saving..." : "Save Storyboard"}
                    </button>
                  </div>
                  <textarea
                    value={storyboardContent}
                    onChange={(e) => setStoryboardContent(e.target.value)}
                    className="w-full flex-1 min-h-[300px] bg-[#222220] border border-white/10 rounded-xl p-3.5 text-xs text-[#F4F4F2] outline-none font-mono leading-relaxed resize-none"
                    placeholder="# Storyboard Narrative Beats..."
                  />
                </div>
              )}
            </div>

            {/* Stage Transport Footer */}
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

              {/* Transport Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewMode(previewMode === "html5" ? "video" : "html5")}
                    className="pill-mint text-[11px] py-1 px-2.5 font-semibold flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    <span>{previewMode === "html5" ? "Live Stage" : "MP4 View"}</span>
                  </button>
                </div>

                {/* Center: Play/Pause + Timecode */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlay}
                    className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-colors shadow-md"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5 fill-current" />}
                  </button>
                  <div className="font-mono text-xs text-[#F4F4F2] font-medium">
                    <span>{formatSMPTE(currentTime)}</span>
                    <span className="text-[#686863] mx-1">/</span>
                    <span className="text-[#9E9E98]">{formatSMPTE(totalDuration)}</span>
                  </div>
                </div>

                {/* Right: Audio, Speed, Loop */}
                <div className="flex items-center gap-2 text-[#9E9E98]">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-white transition-colors"
                    title="Mute"
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
                    title="Loop playback"
                  >
                    <Repeat size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* C. Right Island: Dynamic Inspector & Manual Builder (w-[320px]) */}
          {!isRightCollapsed && (
            <div className="w-[320px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between shrink-0 overflow-hidden shadow-xl">
              {/* DYNAMIC MODE A: CLIP PROPERTIES INSPECTOR (When a clip is selected) */}
              {selectedClip ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Inspector Header */}
                  <div className="p-3 border-b border-white/[0.06] flex items-center justify-between bg-[#181817] shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-white truncate">{selectedClip.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#34D399] uppercase shrink-0">
                        {selectedClip.type}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedClipId(null)}
                      className="w-6 h-6 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                      title="Deselect clip"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Inspector Controls Scroll Area */}
                  <div className="flex-1 p-3.5 overflow-y-auto space-y-4">
                    {/* Transform Section */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        Transform & Position
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-500">X Position (%)</label>
                          <input
                            type="number"
                            value={selectedClip.transform.x}
                            onChange={(e) => handleUpdateClipTransform({ x: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-[#222220] border border-white/10 rounded-lg px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500">Y Position (%)</label>
                          <input
                            type="number"
                            value={selectedClip.transform.y}
                            onChange={(e) => handleUpdateClipTransform({ y: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-[#222220] border border-white/10 rounded-lg px-2 py-1 text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Scale & Rotation Sliders */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Scale ({selectedClip.transform.scale}x)</span>
                          <input
                            type="range"
                            min="0.2"
                            max="3.0"
                            step="0.1"
                            value={selectedClip.transform.scale}
                            onChange={(e) => handleUpdateClipTransform({ scale: parseFloat(e.target.value) })}
                            className="w-28 accent-[#34D399]"
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Rotation ({selectedClip.transform.rotation}°)</span>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            step="5"
                            value={selectedClip.transform.rotation}
                            onChange={(e) => handleUpdateClipTransform({ rotation: parseInt(e.target.value) })}
                            className="w-28 accent-[#34D399]"
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Opacity ({Math.round(selectedClip.transform.opacity * 100)}%)</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={selectedClip.transform.opacity}
                            onChange={(e) => handleUpdateClipTransform({ opacity: parseFloat(e.target.value) })}
                            className="w-28 accent-[#34D399]"
                          />
                        </div>
                      </div>

                      {/* 9-Point Alignment Grid */}
                      <div className="pt-1">
                        <label className="text-[10px] text-zinc-500 block mb-1">Canvas Alignment</label>
                        <div className="grid grid-cols-3 gap-1 bg-[#222220] p-1.5 rounded-lg border border-white/5 w-28 mx-auto">
                          {[
                            { label: "TL", x: -30, y: -30 }, { label: "TC", x: 0, y: -30 }, { label: "TR", x: 30, y: -30 },
                            { label: "ML", x: -30, y: 0 }, { label: "C", x: 0, y: 0 }, { label: "MR", x: 30, y: 0 },
                            { label: "BL", x: -30, y: 30 }, { label: "BC", x: 0, y: 30 }, { label: "BR", x: 30, y: 30 },
                          ].map((pos) => (
                            <button
                              key={pos.label}
                              onClick={() => handleUpdateClipTransform({ x: pos.x, y: pos.y })}
                              className="w-7 h-5 rounded bg-white/5 hover:bg-[#34D399]/20 hover:text-[#34D399] text-[9px] font-mono text-zinc-400 flex items-center justify-center transition-colors"
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Text Styling Section (If text clip) */}
                    {selectedClip.type === "text" && (
                      <div className="space-y-2.5 pt-2 border-t border-white/10">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Typography & Styling
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500">Text Content</label>
                          <textarea
                            value={selectedClip.text || ""}
                            onChange={(e) => handleUpdateSelectedClip({ text: e.target.value })}
                            rows={2}
                            className="w-full bg-[#222220] border border-white/10 rounded-lg p-2 text-xs text-white outline-none resize-none"
                          />
                        </div>

                        {/* Font Family Selector */}
                        <div>
                          <label className="text-[10px] text-zinc-500">Font Family</label>
                          <select
                            value={selectedClip.style?.fontFamily || "Inter, sans-serif"}
                            onChange={(e) => handleUpdateClipStyle({ fontFamily: e.target.value })}
                            className="w-full bg-[#222220] border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
                          >
                            <option value="Inter, sans-serif">Inter (Modern Clean)</option>
                            <option value="'Playfair Display', serif">Playfair Display (Luxury Serif)</option>
                            <option value="'Cinzel', serif">Cinzel (Cinematic Title)</option>
                            <option value="'Montserrat', sans-serif">Montserrat (Bold Impact)</option>
                            <option value="'JetBrains Mono', monospace">JetBrains Mono (Tech Code)</option>
                          </select>
                        </div>

                        {/* Font Size & Swatches */}
                        <div>
                          <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                            <span>Font Size ({selectedClip.style?.fontSize || 32}px)</span>
                          </div>
                          <input
                            type="range"
                            min="16"
                            max="120"
                            value={selectedClip.style?.fontSize || 32}
                            onChange={(e) => handleUpdateClipStyle({ fontSize: parseInt(e.target.value) })}
                            className="w-full accent-[#34D399]"
                          />
                        </div>

                        {/* Color Swatches */}
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-1">Text Color</label>
                          <div className="flex items-center gap-1.5">
                            {["#FFFFFF", "#FBBF24", "#34D399", "#38BDF8", "#F87171", "#A78BFA"].map((hex) => (
                              <button
                                key={hex}
                                onClick={() => handleUpdateClipStyle({ color: hex })}
                                style={{ backgroundColor: hex }}
                                className={`w-5 h-5 rounded-full border ${
                                  selectedClip.style?.color === hex ? "border-white ring-2 ring-white/40" : "border-black"
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Entrance Animation */}
                        <div>
                          <label className="text-[10px] text-zinc-500 block mb-1">Entrance Animation</label>
                          <select
                            value={selectedClip.animation?.in || "pop"}
                            onChange={(e) =>
                              handleUpdateSelectedClip({
                                animation: {
                                  in: e.target.value as any,
                                  out: "fade",
                                  duration: 0.4,
                                },
                              })
                            }
                            className="w-full bg-[#222220] border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
                          >
                            <option value="pop">Pop In Scale</option>
                            <option value="fade">Smooth Fade In</option>
                            <option value="slide-up">Slide Up</option>
                            <option value="typewriter">Typewriter</option>
                            <option value="word-reveal">Word By Word Reveal</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Media Timing Section */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        Clip Timing & Audio
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-500">Start Time (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedClip.start}
                            onChange={(e) => handleUpdateSelectedClip({ start: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full bg-[#222220] border border-white/10 rounded-lg px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500">Duration (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedClip.duration}
                            onChange={(e) => handleUpdateSelectedClip({ duration: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
                            className="w-full bg-[#222220] border border-white/10 rounded-lg px-2 py-1 text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Volume Slider if media */}
                      {(selectedClip.type === "video" || selectedClip.type === "audio") && (
                        <div className="pt-1">
                          <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                            <span>Audio Volume ({selectedClip.audio?.volume ?? 100}%)</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={selectedClip.audio?.volume ?? 100}
                            onChange={(e) =>
                              handleUpdateSelectedClip({
                                audio: {
                                  volume: parseInt(e.target.value),
                                  muted: parseInt(e.target.value) === 0,
                                  fadeIn: 0.3,
                                  fadeOut: 0.3,
                                  speed: 1,
                                },
                              })
                            }
                            className="w-full accent-[#34D399]"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inspector Footer Actions */}
                  <div className="p-3 border-t border-white/[0.06] bg-[#181817] flex items-center justify-between shrink-0">
                    <button
                      onClick={() => {
                        const splitOffset = currentTime - selectedClip.start;
                        if (splitOffset <= 0.1 || selectedClip.duration - splitOffset <= 0.1) return;
                        const firstHalf: TimelineClip = { ...selectedClip, duration: Math.round(splitOffset * 100) / 100 };
                        const secondHalf: TimelineClip = {
                          ...selectedClip,
                          id: `${selectedClip.id}-split-${Date.now()}`,
                          start: Math.round(currentTime * 100) / 100,
                          duration: Math.round((selectedClip.duration - splitOffset) * 100) / 100,
                        };
                        const nextClips = timelineState!.clips.filter((c) => c.id !== selectedClip.id).concat([firstHalf, secondHalf]);
                        handleUpdateTimeline({ ...timelineState!, clips: nextClips });
                      }}
                      className="pill-dark text-xs py-1 px-2.5 flex items-center gap-1 text-zinc-300 hover:text-white"
                      title="Split clip at playhead"
                    >
                      <Scissors size={12} />
                      <span>Split</span>
                    </button>

                    <button
                      onClick={() => {
                        const copy: TimelineClip = {
                          ...selectedClip,
                          id: `clip-copy-${Date.now()}`,
                          name: `${selectedClip.name} (Copy)`,
                          start: Math.min(totalDuration - selectedClip.duration, selectedClip.start + selectedClip.duration),
                        };
                        handleUpdateTimeline({ ...timelineState!, clips: [...timelineState!.clips, copy] });
                        setSelectedClipId(copy.id);
                      }}
                      className="pill-dark text-xs py-1 px-2.5 flex items-center gap-1 text-zinc-300 hover:text-white"
                    >
                      <Copy size={12} />
                      <span>Duplicate</span>
                    </button>

                    <button
                      onClick={() => {
                        const nextClips = timelineState!.clips.filter((c) => c.id !== selectedClip.id);
                        handleUpdateTimeline({ ...timelineState!, clips: nextClips });
                        setSelectedClipId(null);
                      }}
                      className="pill-dark text-xs py-1 px-2.5 flex items-center gap-1 text-rose-400 hover:text-rose-300 hover:border-rose-500/40"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* DYNAMIC MODE B: STUDIO BUILDER TABS (When no clip is selected) */
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Builder Tabs Header */}
                  <div className="p-3 border-b border-white/[0.06] bg-[#181817] shrink-0 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Studio Builder</span>
                      <span className="text-[10px] font-mono text-[#34D399]">100% Free Mode</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 bg-[#222220] p-1 rounded-xl border border-white/5">
                      {[
                        { id: "media", label: "Media", icon: Video },
                        { id: "text", label: "Text", icon: Type },
                        { id: "effects", label: "Styles", icon: Sparkles },
                        { id: "canvas", label: "Canvas", icon: Layers },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setBuilderTab(t.id as any)}
                          className={`py-1 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 transition-all ${
                            builderTab === t.id ? "bg-[#181817] text-white shadow-sm" : "text-[#9E9E98] hover:text-white"
                          }`}
                        >
                          <t.icon size={11} />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Builder Tab Content */}
                  <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                    {/* 1. Media Tab */}
                    {builderTab === "media" && (
                      <div className="space-y-3">
                        <button
                          onClick={() => fileUploadInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus size={14} className="text-[#34D399]" />
                          <span>Upload Local Media</span>
                        </button>

                        <div className="space-y-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                            Local Project Assets ({assetsList.length})
                          </div>
                          {assetsList.length === 0 ? (
                            <div className="text-center py-6 text-[#9E9E98] text-xs">
                              No footage added yet. Click Upload to insert clips into your project.
                            </div>
                          ) : (
                            assetsList.map((a) => (
                              <div
                                key={a.filename}
                                className="bg-[#222220] border border-white/5 hover:border-white/20 p-2.5 rounded-xl flex items-center justify-between transition-colors"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="text-xs font-semibold text-white truncate">{a.filename}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                    {a.duration.toFixed(1)}s • {a.has_video !== false ? "Video" : "Audio"}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleInsertAssetToTimeline(a)}
                                  className="pill-mint text-[10px] py-1 px-2 font-medium shrink-0"
                                >
                                  + Insert
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Text Kinetic Presets Tab */}
                    {builderTab === "text" && (
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          Kinetic Typography Presets
                        </div>
                        {[
                          { id: "hero", title: "Big Hero Title", desc: "Bold uppercase scale intro", preset: "hero" as const },
                          { id: "subtitle", title: "Amber Serif Glow", desc: "Elegant gold reveal subtitle", preset: "subtitle" as const },
                          { id: "lower-third", title: "Minimal Lower Third", desc: "Clean speaker name and handle bar", preset: "lower-third" as const },
                          { id: "pill", title: "Neon Mint Badge", desc: "High contrast mint pill badge", preset: "pill" as const },
                        ].map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleInsertTextPreset(item.preset)}
                            className="bg-[#222220] border border-white/5 hover:border-[#34D399]/50 p-3 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white group-hover:text-[#34D399] transition-colors">
                                {item.title}
                              </span>
                              <Plus size={13} className="text-[#34D399]" />
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. Visual Styles / Effects Tab */}
                    {builderTab === "effects" && (
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          Visual Themes
                        </div>
                        {[
                          { title: "Amber Luxury", prompt: "Apply Amber Serif Glow typography with warm gold highlights." },
                          { title: "Cyber Neon", prompt: "Add neon cyan and emerald glowing outline accents." },
                          { title: "Noir Vintage", prompt: "Apply monochrome black-and-white grade with film grain." },
                          { title: "Clean Corporate", prompt: "Use minimal Helvetica typography with clean white pill badges." },
                        ].map((eff) => (
                          <div
                            key={eff.title}
                            onClick={() => handleAgentSubmit(eff.prompt)}
                            className="bg-[#222220] border border-white/5 hover:border-white/20 p-3 rounded-xl cursor-pointer transition-colors"
                          >
                            <div className="text-xs font-bold text-white">{eff.title}</div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">{eff.prompt}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 4. Canvas Tab */}
                    {builderTab === "canvas" && (
                      <div className="space-y-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          Canvas Settings
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Aspect Ratio</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                if (timelineState) {
                                  handleUpdateTimeline({
                                    ...timelineState,
                                    aspectRatio: "16:9",
                                    width: 1920,
                                    height: 1080,
                                  });
                                }
                              }}
                              className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                                !isVertical ? "bg-[#34D399]/15 border-[#34D399] text-[#34D399]" : "bg-[#222220] border-white/10 text-zinc-400"
                              }`}
                            >
                              16:9 Landscape
                            </button>
                            <button
                              onClick={() => {
                                if (timelineState) {
                                  handleUpdateTimeline({
                                    ...timelineState,
                                    aspectRatio: "9:16",
                                    width: 1080,
                                    height: 1920,
                                  });
                                }
                              }}
                              className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                                isVertical ? "bg-[#34D399]/15 border-[#34D399] text-[#34D399]" : "bg-[#222220] border-white/10 text-zinc-400"
                              }`}
                            >
                              9:16 Vertical
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Background Color</label>
                          <div className="flex items-center gap-2">
                            {["#000000", "#0F0F0E", "#181817", "#0A0A10", "#1E1B4B"].map((c) => (
                              <button
                                key={c}
                                onClick={() => {
                                  if (timelineState) {
                                    handleUpdateTimeline({
                                      ...timelineState,
                                      background: { type: "color", value: c },
                                    });
                                  }
                                }}
                                style={{ backgroundColor: c }}
                                className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Section: OpenCut Multitrack Timeline ── */}
      <footer className="pt-2 shrink-0">
        {!isTimelineExpanded ? (
          <div className="h-10 bg-[#181817] border border-white/[0.07] rounded-2xl px-4 flex items-center justify-between shadow-lg">
            <span className="text-xs text-[#9E9E98] font-mono">
              {timelineState?.width || 1920}×{timelineState?.height || 1080} • 30 FPS • {timelineState?.clips.length || 0} Clips
            </span>
            <button
              onClick={() => setIsTimelineExpanded(true)}
              className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5 text-[#F4F4F2]"
            >
              <Sliders size={12} />
              <span>Show Multitrack Timeline</span>
            </button>
          </div>
        ) : (
          <div className="h-[240px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="h-8 px-4 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#181817]">
              <span className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Multitrack Editor</span>
                <span className="text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded">
                  2-Way Deterministic Sync
                </span>
              </span>
              <button
                onClick={() => setIsTimelineExpanded(false)}
                className="text-[11px] text-[#9E9E98] hover:text-white"
              >
                Hide timeline
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <StudioTimeline
                timeline={timelineState || undefined}
                onUpdateTimeline={handleUpdateTimeline}
                selectedClipId={selectedClipId}
                onSelectClip={(id) => setSelectedClipId(id)}
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

      {/* ── Universal Video Export Modal ── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181817] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload size={16} className="text-[#34D399]" />
                <span>Export Production Video</span>
              </h3>
              <button
                onClick={() => !isExporting && setIsExportModalOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Rendering Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportMode("browser")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportMode === "browser"
                      ? "bg-[#34D399]/15 border-[#34D399] text-white"
                      : "bg-[#222220] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>Browser On-Device</span>
                    <span className="text-[9px] bg-[#34D399] text-black px-1.5 py-0.2 rounded font-mono">Free</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">Zero cost, instant client rendering via Canvas/WebCodecs</div>
                </button>

                <button
                  onClick={() => isBackendOnline && setExportMode("local_cli")}
                  disabled={!isBackendOnline}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !isBackendOnline
                      ? "opacity-40 cursor-not-allowed bg-[#222220] border-white/5 text-zinc-500"
                      : exportMode === "local_cli"
                      ? "bg-[#34D399]/15 border-[#34D399] text-white"
                      : "bg-[#222220] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">Local Pro CLI</div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    {isBackendOnline ? "HyperFrames headless Chrome + FFmpeg" : "Requires local FastAPI server"}
                  </div>
                </button>
              </div>
            </div>

            {/* Resolution Selector */}
            {exportMode === "browser" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Quality</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportResolution("1080p")}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-mono ${
                      exportResolution === "1080p" ? "bg-white text-black font-bold" : "bg-[#222220] border-white/10 text-zinc-400"
                    }`}
                  >
                    1080p Full HD
                  </button>
                  <button
                    onClick={() => setExportResolution("720p")}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-mono ${
                      exportResolution === "720p" ? "bg-white text-black font-bold" : "bg-[#222220] border-white/10 text-zinc-400"
                    }`}
                  >
                    720p HD (Fastest)
                  </button>
                </div>
              </div>
            )}

            {/* Progress Bar (During export) */}
            {isExporting && exportProgress && (
              <div className="space-y-2 bg-[#222220] p-3 rounded-xl border border-white/10">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#34D399]">{exportProgress.statusText}</span>
                  <span className="text-white font-bold">{exportProgress.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${exportProgress.progressPercent}%` }}
                    className="h-full bg-[#34D399] transition-all duration-150"
                  />
                </div>
              </div>
            )}

            {/* Export Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
                className="pill-dark text-xs py-2 px-4 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleStartExport}
                disabled={isExporting}
                className="pill-mint text-xs py-2 px-5 font-bold flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>Render &amp; Download</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BYOK API Key Settings Modal ── */}
      {isByokModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181817] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key size={16} className="text-[#34D399]" />
                <span>AI Director Settings (BYOK)</span>
              </h3>
              <button
                onClick={() => setIsByokModalOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              KINO works 100% free with deterministic offline rules. To unlock unrestricted autonomous generative AI editing on Vercel, paste your Gemini API key below.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Provider</label>
                <select
                  value={byokSettings.provider}
                  onChange={(e) => setByokState({ ...byokSettings, provider: e.target.value as any })}
                  className="w-full bg-[#222220] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="gemini">Google Gemini (Recommended / Free Tier Available)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="local_cli">Local CLI Agent (Antigravity/Claude)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy... or sk-..."
                  value={byokSettings.apiKey}
                  onChange={(e) => setByokState({ ...byokSettings, apiKey: e.target.value })}
                  className="w-full bg-[#222220] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setByokState({ provider: "gemini", apiKey: "" });
                  saveByokSettings({ provider: "gemini", apiKey: "" });
                  setIsByokModalOpen(false);
                }}
                className="pill-dark text-xs py-2 px-3 text-zinc-400 hover:text-rose-400"
              >
                Clear Key
              </button>
              <button
                onClick={() => {
                  saveByokSettings(byokSettings);
                  setIsByokModalOpen(false);
                }}
                className="pill-mint text-xs py-2 px-4 font-bold"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Contract Verification Modal */}
      {activeProject && (
        <HyperFramesLintModal
          isOpen={isLintModalOpen}
          onClose={() => setIsLintModalOpen(false)}
          projectId={activeProject.id}
        />
      )}

      {/* Settings Doctor Modal */}
      <SettingsDoctorModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
