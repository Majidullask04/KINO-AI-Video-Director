"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  RotateCw,
  ZoomIn,
  Music,
  ExternalLink,
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
  deleteAsset,
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
  testApiKey,
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
  // ── Unified Reactive Timeline & Clip State ──
  const [timelineState, setTimelineState] = useState<TimelineProjectState | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<TimelineProjectState[]>([]);
  const [redoStack, setRedoStack] = useState<TimelineProjectState[]>([]);

  // Playback & Stage State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [stageZoom, setStageZoom] = useState<"fit" | "50%" | "100%" | "125%">("fit");

  // View & Island Layout State
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [centerTab, setCenterTab] = useState<"main" | "storyboard">("main");
  const [builderTab, setBuilderTab] = useState<"media" | "text" | "effects" | "canvas">("media");
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(true);

  // Project Title Inline Editing
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(activeProject?.title || "Untitled");

  // Drag & Drop Highlight State
  const [isDragOverStage, setIsDragOverStage] = useState<boolean>(false);

  // AI Director & BYOK State
  const [selectedAgent, setSelectedAgent] = useState<string>("gemini");
  const [agentInput, setAgentInput] = useState<string>("");
  const [isAgentBusy, setIsAgentBusy] = useState<boolean>(false);
  const [byokSettings, setByokState] = useState<ByokSettings>({ provider: "gemini", apiKey: "" });
  const [isByokModalOpen, setIsByokModalOpen] = useState<boolean>(false);
  const [byokStatusText, setByokStatusText] = useState<string>("");
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);

  // Universal Video Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<"browser" | "local_cli">("browser");
  const [exportResolution, setExportResolution] = useState<"1080p" | "720p">("1080p");
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Stage Interactive Drag & Transform State
  const [isDraggingClip, setIsDraggingClip] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialTransform, setInitialTransform] = useState<{ x: number; y: number } | null>(null);
  const [inlineEditingTextId, setInlineEditingTextId] = useState<string | null>(null);

  // Modals & Storage State
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState<boolean>(false);
  const [isLintModalOpen, setIsLintModalOpen] = useState<boolean>(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  // Storyboard Markdown State
  const [storyboardContent, setStoryboardContent] = useState<string>("");
  const [isSavingStoryboard, setIsSavingStoryboard] = useState<boolean>(false);

  // Local Media Assets Bin
  const [assetsList, setAssetsList] = useState<LocalAssetRecord[]>([]);
  const [isUploadingLocalMedia, setIsUploadingLocalMedia] = useState<boolean>(false);

  // Agent Chat Messages
  const [agentMessages, setAgentMessages] = useState<AgentLogMessage[]>([
    {
      id: "msg-1",
      sender: "system",
      text: "KINO Studio Engine Ready. Drag & drop videos, edit clips directly on stage, or prompt the AI Director.",
    },
  ]);

  // Refs for Media Elements & Dragging
  const t1VideoRef = useRef<HTMLVideoElement | null>(null);
  const t2VideoRef = useRef<HTMLVideoElement | null>(null);
  const t3AudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);

  const totalDuration = timelineState?.duration || activeProject?.target_duration || 12.0;

  // Selected Clip Helper
  const selectedClip = timelineState?.clips.find((c) => c.id === selectedClipId) || null;

  // ── 1. Initial Load & Sync ──
  useEffect(() => {
    checkBackendAvailability().then(setIsBackendOnline);
    const savedByok = getByokSettings();
    setByokState(savedByok);
  }, []);

  useEffect(() => {
    if (activeProject) {
      setTitleInput(activeProject.title);
      loadProjectTimeline(activeProject.id);
      loadAssetsList();
      loadStoryboardFile();
    }
  }, [activeProject?.id]);

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

  const loadStoryboardFile = async () => {
    if (!activeProject) return;
    try {
      const content = await getFile(activeProject.id, "STORYBOARD.md");
      setStoryboardContent(content || "# Storyboard\n\n## Scene 1\nIntro beat...\n");
    } catch (e) {
      console.warn("Could not load STORYBOARD.md:", e);
    }
  };

  // ── 2. Reactive Timeline State Updates & Persistence ──
  const handleUpdateTimeline = useCallback(
    async (nextTimeline: TimelineProjectState, recordUndo = true) => {
      if (recordUndo && timelineState) {
        setUndoStack((prev) => [...prev.slice(-30), timelineState]);
        setRedoStack([]);
      }
      setTimelineState(nextTimeline);
      if (activeProject) {
        await saveTimeline(activeProject.id, nextTimeline);
      }
    },
    [activeProject, timelineState]
  );

  const handleUndo = () => {
    if (undoStack.length === 0 || !timelineState) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, timelineState]);
    handleUpdateTimeline(previous, false);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !timelineState) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, timelineState]);
    handleUpdateTimeline(next, false);
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

  const handleUpdateClipFilters = (
    filter: TimelineClip["filter"],
    adjustments?: TimelineClip["filterAdjustments"]
  ) => {
    if (!selectedClip) return;
    handleUpdateSelectedClip({
      filter,
      filterAdjustments: adjustments ? { ...(selectedClip.filterAdjustments || {}), ...adjustments } : selectedClip.filterAdjustments,
    });
  };

  // ── 3. File Upload & Ingestion (Phase 1) ──
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!activeProject || !timelineState) return;
    setIsUploadingLocalMedia(true);

    try {
      const fileArray = Array.from(files);
      const newAssets: LocalAssetRecord[] = [];

      for (const file of fileArray) {
        const asset = await saveAsset(activeProject.id, file);
        newAssets.push(asset);
      }

      await loadAssetsList();

      // Step E (Auto-Place on First Upload): If T1 is empty and we have a video
      const t1Clips = timelineState.clips.filter((c) => c.type === "video" && c.trackIndex === 1);
      const firstVideo = newAssets.find((a) => a.has_video !== false);

      if (t1Clips.length === 0 && firstVideo) {
        const videoClip: TimelineClip = {
          id: `clip-video-${Date.now()}`,
          name: firstVideo.filename,
          type: "video",
          start: 0.0,
          duration: firstVideo.duration || 5.0,
          trimStart: 0,
          trimEnd: 0,
          trackIndex: 1,
          sourceAsset: firstVideo.filename,
          sourceUrl: firstVideo.url,
          transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
          audio: { volume: 100, muted: false, fadeIn: 0, fadeOut: 0, speed: 1 },
        };

        const updatedTimeline: TimelineProjectState = {
          ...timelineState,
          duration: Math.max(timelineState.duration, firstVideo.duration || 5.0),
          clips: [...timelineState.clips, videoClip],
        };

        await handleUpdateTimeline(updatedTimeline);
        setSelectedClipId(videoClip.id);
        setCurrentTime(0.0);
      }
    } catch (e: any) {
      console.error("Upload error:", e);
      alert(`Media upload failed: ${e.message}`);
    } finally {
      setIsUploadingLocalMedia(false);
    }
  };

  // ── 4. Drag & Drop Handlers for Center Stage & Workspace ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverStage(true);
  };

  const handleDragLeave = () => {
    setIsDragOverStage(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverStage(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // ── 5. Real-Time Compositor Transport & Playback Loop (Phase 2) ──
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (t1VideoRef.current && !t1VideoRef.current.paused) t1VideoRef.current.pause();
      if (t2VideoRef.current && !t2VideoRef.current.paused) t2VideoRef.current.pause();
      if (t3AudioRef.current && !t3AudioRef.current.paused) t3AudioRef.current.pause();
      return;
    }

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
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isLooping, totalDuration, playbackSpeed]);

  // Synchronize Media Elements with Playhead
  useEffect(() => {
    if (!timelineState) return;

    // Track 1 Video Sync
    const activeT1Clip = timelineState.clips.find(
      (c) => c.trackIndex === 1 && currentTime >= c.start && currentTime < c.start + c.duration
    );
    if (t1VideoRef.current && activeT1Clip && activeT1Clip.type === "video") {
      const clipLocalTime = (currentTime - activeT1Clip.start) * (activeT1Clip.audio?.speed || 1) + (activeT1Clip.trimStart || 0);
      if (Math.abs(t1VideoRef.current.currentTime - clipLocalTime) > 0.18) {
        t1VideoRef.current.currentTime = clipLocalTime;
      }
      if (isPlaying && t1VideoRef.current.paused) {
        t1VideoRef.current.play().catch(() => {});
      } else if (!isPlaying && !t1VideoRef.current.paused) {
        t1VideoRef.current.pause();
      }
    }

    // Track 2 B-Roll Video Sync
    const activeT2Clip = timelineState.clips.find(
      (c) => c.trackIndex === 2 && currentTime >= c.start && currentTime < c.start + c.duration
    );
    if (t2VideoRef.current && activeT2Clip && activeT2Clip.type === "video") {
      const clipLocalTime = (currentTime - activeT2Clip.start) * (activeT2Clip.audio?.speed || 1) + (activeT2Clip.trimStart || 0);
      if (Math.abs(t2VideoRef.current.currentTime - clipLocalTime) > 0.18) {
        t2VideoRef.current.currentTime = clipLocalTime;
      }
      if (isPlaying && t2VideoRef.current.paused) {
        t2VideoRef.current.play().catch(() => {});
      } else if (!isPlaying && !t2VideoRef.current.paused) {
        t2VideoRef.current.pause();
      }
    }

    // Track 3 Audio Sync
    const activeT3Clip = timelineState.clips.find(
      (c) => c.trackIndex === 3 && currentTime >= c.start && currentTime < c.start + c.duration
    );
    if (t3AudioRef.current && activeT3Clip) {
      const clipLocalTime = currentTime - activeT3Clip.start + (activeT3Clip.trimStart || 0);
      if (Math.abs(t3AudioRef.current.currentTime - clipLocalTime) > 0.2) {
        t3AudioRef.current.currentTime = clipLocalTime;
      }
      if (isPlaying && t3AudioRef.current.paused) {
        t3AudioRef.current.play().catch(() => {});
      } else if (!isPlaying && !t3AudioRef.current.paused) {
        t3AudioRef.current.pause();
      }
    }
  }, [currentTime, isPlaying, timelineState]);

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Keyboard Spacebar Shortcut for Transport
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlaying, undoStack, redoStack]);

  // ── 6. Stage Drag-to-Position for Layers ──
  useEffect(() => {
    if (!isDraggingClip || !selectedClip || !initialTransform) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!stageViewportRef.current) return;
      const rect = stageViewportRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragStartPos.x) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartPos.y) / rect.height) * 100;

      let newX = Math.round(initialTransform.x + deltaXPercent);
      let newY = Math.round(initialTransform.y + deltaYPercent);

      // Snap to canvas center
      if (Math.abs(newX) < 2) newX = 0;
      if (Math.abs(newY) < 2) newY = 0;

      handleUpdateClipTransform({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingClip(false);
      setInitialTransform(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingClip, selectedClip, initialTransform, dragStartPos]);

  // ── 7. AI Director Execution (Phase 5) ──
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
        durationText: result.source === "builtin_rule" ? "Free Rule Applied" : "AI Execution Success",
        steps: [
          `Directive processed via ${result.source}`,
          "Updated Timeline & Stage Compositor",
          "Synchronized state to IndexedDB",
        ],
        text: result.logMessage,
      };

      setAgentMessages((prev) => [...prev, agentReply]);
    } catch (e: any) {
      console.error("AI Director error:", e);
      const errorMsg: AgentLogMessage = {
        id: `err-${Date.now()}`,
        sender: "agent",
        text: `Notice: ${e.message || "Failed to execute directive."}`,
      };
      setAgentMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAgentBusy(false);
    }
  };

  // Test & Save API Key Helper
  const handleTestAndSaveKey = async () => {
    setIsTestingKey(true);
    setByokStatusText("Testing connection...");
    try {
      const res = await testApiKey(byokSettings);
      setByokStatusText(res.message);
      if (res.ok) {
        saveByokSettings(byokSettings);
        setTimeout(() => {
          setIsByokModalOpen(false);
          setByokStatusText("");
        }, 1200);
      }
    } catch (e: any) {
      setByokStatusText(`Validation failed: ${e.message}`);
    } finally {
      setIsTestingKey(false);
    }
  };

  // ── 8. Universal Video Export (Phase 6) ──
  const handleStartExport = async () => {
    if (!activeProject || !timelineState) return;
    setIsExporting(true);
    setExportProgress({
      progressPercent: 0,
      currentFrame: 0,
      totalFrames: 0,
      statusText: "Initializing offscreen renderer...",
    });

    try {
      if (exportMode === "browser") {
        const result = await renderTimelineInBrowser(timelineState, {
          resolution: exportResolution,
          onProgress: (p) => setExportProgress(p),
        });

        triggerFileDownload(result.url, `${activeProject.title || "kino-export"}.${result.filename.split(".").pop()}`);
        setExportProgress({
          progressPercent: 100,
          currentFrame: 360,
          totalFrames: 360,
          statusText: "Export Complete! Video downloaded to your computer.",
        });
        setTimeout(() => {
          setIsExportModalOpen(false);
          setIsExporting(false);
        }, 1200);
      } else {
        const res = await fetch(`${API_BASE}/api/cli/hyperframes/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: activeProject.id, output_filename: "output.mp4" }),
        });
        const data = await res.json();
        if (res.ok && data.returncode === 0) {
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

  // ── 9. Quick Add Presets Helpers (Phase 3) ──
  const handleAddTextPreset = (type: "heading" | "amber" | "subtitle" | "lower_third" | "cta") => {
    if (!timelineState) return;
    const clipId = `text-${Date.now()}`;

    let newClip: TimelineClip;
    if (type === "heading") {
      newClip = {
        id: clipId,
        name: "Main Heading",
        type: "text",
        start: currentTime,
        duration: 3.5,
        trackIndex: 0,
        text: "BRING YOUR STORY TO LIFE",
        transform: { x: 0, y: 0, width: 90, height: 24, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 44, color: "#FFFFFF", fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center" },
        animation: { in: "pop", out: "fade", duration: 0.4 },
      };
    } else if (type === "amber") {
      newClip = {
        id: clipId,
        name: "Amber Serif Caption",
        type: "text",
        start: currentTime,
        duration: 4.0,
        trackIndex: 0,
        text: "Luxury Amber Serif Caption",
        transform: { x: 0, y: 34, width: 85, height: 16, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 32, color: "#FBBF24", fontWeight: 700, fontFamily: "'Playfair Display', serif", textAlign: "center", shadow: "0 0 20px rgba(251, 191, 36, 0.5)" },
        animation: { in: "word-reveal", out: "fade", duration: 0.5 },
      };
    } else if (type === "subtitle") {
      newClip = {
        id: clipId,
        name: "Kinetic Subtitle",
        type: "text",
        start: currentTime,
        duration: 3.5,
        trackIndex: 0,
        text: "Punchy modern subtitle narration",
        transform: { x: 0, y: 36, width: 80, height: 14, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 26, color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.75)", fontWeight: 600, fontFamily: "Inter, sans-serif", textAlign: "center" },
        animation: { in: "slide-up", out: "fade", duration: 0.3 },
      };
    } else if (type === "lower_third") {
      newClip = {
        id: clipId,
        name: "Lower Third",
        type: "text",
        start: currentTime,
        duration: 4.0,
        trackIndex: 0,
        text: "KINO DIRECTOR — Studio Mode",
        transform: { x: -25, y: 36, width: 45, height: 12, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 20, color: "#34D399", backgroundColor: "#181817", fontWeight: 600, fontFamily: "Inter, sans-serif", textAlign: "left" },
        animation: { in: "slide-up", out: "fade", duration: 0.4 },
      };
    } else {
      newClip = {
        id: clipId,
        name: "CTA Pill",
        type: "text",
        start: currentTime,
        duration: 3.0,
        trackIndex: 0,
        text: "100% FREE · NO KEY NEEDED",
        transform: { x: 0, y: -38, width: 40, height: 10, scale: 1, rotation: 0, opacity: 1 },
        style: { fontSize: 18, color: "#000000", backgroundColor: "#34D399", fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center" },
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
    const isVideo = asset.has_video !== false;

    // Determine target track: T1 if T1 is empty, otherwise T2 for video/image, T3 for audio
    const t1HasClips = timelineState.clips.some((c) => c.trackIndex === 1);
    const targetTrack = !isVideo ? 3 : !t1HasClips ? 1 : 2;

    const newClip: TimelineClip = {
      id: clipId,
      name: asset.filename,
      type: isVideo ? "video" : "audio",
      start: currentTime,
      duration: asset.duration || 4.0,
      trimStart: 0,
      trimEnd: 0,
      trackIndex: targetTrack,
      sourceAsset: asset.filename,
      sourceUrl: asset.url,
      transform: {
        x: targetTrack === 2 ? 20 : 0,
        y: targetTrack === 2 ? -20 : 0,
        width: targetTrack === 2 ? 35 : 100,
        height: targetTrack === 2 ? 35 : 100,
        scale: 1,
        rotation: 0,
        opacity: 1,
      },
      audio: { volume: 100, muted: false, fadeIn: 0, fadeOut: 0, speed: 1 },
    };

    const nextClips = [...timelineState.clips, newClip];
    const newDuration = Math.max(timelineState.duration, currentTime + (asset.duration || 4.0));
    handleUpdateTimeline({ ...timelineState, duration: newDuration, clips: nextClips });
    setSelectedClipId(clipId);
  };

  const handleDeleteAsset = async (assetIdOrFilename: string) => {
    if (!activeProject) return;
    if (confirm("Delete this asset from your project?")) {
      await deleteAsset(activeProject.id, assetIdOrFilename);
      await loadAssetsList();
    }
  };

  // Active Clips at current playhead for the Center Stage Compositor
  const activeT1Clip = timelineState?.clips.find(
    (c) => c.trackIndex === 1 && currentTime >= c.start && currentTime < c.start + c.duration
  );
  const activeT2Clips = timelineState?.clips.filter(
    (c) => c.trackIndex === 2 && currentTime >= c.start && currentTime < c.start + c.duration
  ) || [];
  const activeT0Clips = timelineState?.clips.filter(
    (c) => c.trackIndex === 0 && currentTime >= c.start && currentTime < c.start + c.duration
  ) || [];
  const activeT3Clip = timelineState?.clips.find(
    (c) => c.trackIndex === 3 && currentTime >= c.start && currentTime < c.start + c.duration
  );

  // Track lock & visibility status helpers
  const getTrack = (idx: number) => timelineState?.tracks?.find((t) => t.index === idx);
  const t0Hidden = getTrack(0)?.hidden;
  const t1Hidden = getTrack(1)?.hidden;
  const t2Hidden = getTrack(2)?.hidden;
  const t3Muted = getTrack(3)?.muted;

  // Aspect ratio helper
  const aspectRatio = timelineState?.aspectRatio || "16:9";
  const isVertical = aspectRatio === "9:16";
  const isSquare = aspectRatio === "1:1";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-screen bg-[#0F0F0E] p-3 flex flex-col text-[#F4F4F2] overflow-hidden select-none transition-colors ${
        isDragOverStage ? "ring-2 ring-[#34D399]/60" : ""
      }`}
    >
      {/* Hidden Universal File Upload Input */}
      <input
        ref={fileUploadInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.mp4,.mov,.webm,.mp3,.wav,.png,.jpg,.jpeg"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesUpload(e.target.files);
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
              onBlur={async () => {
                setIsEditingTitle(false);
                if (onUpdateProjectTitle && titleInput.trim() && titleInput !== activeProject?.title) {
                  await onUpdateProjectTitle(titleInput.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
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

          {/* AI Keys Pill */}
          <button
            onClick={() => setIsByokModalOpen(true)}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
            title="Configure AI API Keys (Gemini, OpenAI)"
          >
            <Key size={12} className="text-[#34D399]" />
            <span>{byokSettings.apiKey ? "AI Keys Active" : "AI Keys"}</span>
          </button>

          {/* Checkpoints Pill */}
          <button
            onClick={() => setIsCheckpointModalOpen(true)}
            className="pill-dark text-xs py-1 px-3 flex items-center gap-1.5"
            title="Inspect & Create Checkpoint Snapshots"
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

      {/* ── Main Workspace: Far-Left Icon Rail + 3 Islands ── */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden pt-1">
        {/* Slim Left Navigation Rail (w-11) */}
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

        {/* ── 3-Island Layout Workspace ── */}
        <div className="flex-1 flex gap-3 min-w-0 overflow-hidden">
          {/* A. Left Island: AI Director (Collapsible, w-[320px]) */}
          {!isLeftCollapsed && (
            <div className="w-[320px] bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between shrink-0 overflow-hidden shadow-xl">
              {/* Header: Hide Button + Agent Selector */}
              <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between bg-[#181817] shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-[#222220] rounded-xl px-2.5 py-1 border border-white/5 gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer"
                    >
                      <option value="gemini" className="bg-[#181817]">Google Gemini API</option>
                      <option value="openai" className="bg-[#181817]">OpenAI (GPT-4o)</option>
                      <option value="rules" className="bg-[#181817]">Free Offline Rules</option>
                      <option value="local_cli" className="bg-[#181817]">Local CLI Bridge</option>
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

              {/* Chat Log & Quick Directives */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                {/* 100% Free Quick Directives Palette */}
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

              {/* Chat Input Box with Upload (+) Trigger */}
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => fileUploadInputRef.current?.click()}
                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
                        title="Upload local media file"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        onClick={() => setIsByokModalOpen(true)}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                      >
                        <Key size={10} className="text-[#34D399]" />
                        <span>{byokSettings.apiKey ? "Key Active" : "Free Mode"}</span>
                      </button>
                    </div>

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

          {/* B. Center Island: Real-Time Multi-Layer Compositor & Transport (flex-1) */}
          <div className="flex-1 bg-[#181817] border border-white/[0.07] rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl min-w-0">
            {/* Header: Tabs + Stage Zoom + Re-openers */}
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

                {/* Undo / Redo Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="w-7 h-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-30"
                    title="Undo (Cmd+Z)"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="w-7 h-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-30"
                    title="Redo (Cmd+Shift+Z)"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Segmented Switch: Stage | Storyboard */}
                <div className="flex items-center bg-[#222220] p-0.5 rounded-xl border border-white/5">
                  <button
                    onClick={() => setCenterTab("main")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      centerTab === "main" ? "bg-[#181817] text-white shadow-sm" : "text-[#9E9E98] hover:text-white"
                    }`}
                  >
                    Stage Compositor
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
                    <option value="fit" className="bg-[#181817]">Fit Window</option>
                    <option value="50%" className="bg-[#181817]">50%</option>
                    <option value="100%" className="bg-[#181817]">100%</option>
                    <option value="125%" className="bg-[#181817]">125%</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 text-[#9E9E98] hover:text-white flex items-center justify-center transition-colors"
                  title={isRightCollapsed ? "Show Builder / Inspector" : "Collapse Right Panel"}
                >
                  <ChevronRight size={14} className={isRightCollapsed ? "rotate-180" : ""} />
                </button>
              </div>
            </div>

            {/* ── Real-Time Multi-Layer Stage Viewport ── */}
            <div
              ref={stageViewportRef}
              className="flex-1 bg-[#0A0A09] relative flex items-center justify-center overflow-hidden p-4 min-h-[260px]"
            >
              {centerTab === "main" ? (
                <div
                  style={{
                    aspectRatio: isVertical ? "9/16" : isSquare ? "1/1" : "16/9",
                    height: isVertical ? (stageZoom === "fit" ? "100%" : stageZoom) : "auto",
                    width: isVertical ? "auto" : (stageZoom === "fit" ? "100%" : stageZoom),
                    maxHeight: "100%",
                    maxWidth: "100%",
                    background:
                      timelineState?.background?.type === "gradient"
                        ? timelineState.background.value
                        : timelineState?.background?.value || "#000000",
                  }}
                  className="relative rounded-2xl overflow-hidden border border-white/15 bg-black shadow-2xl flex items-center justify-center select-none"
                  onClick={() => setSelectedClipId(null)}
                >
                  {/* Phone Notch indicator for 9:16 Vertical format */}
                  {isVertical && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full z-40 pointer-events-none" />
                  )}

                  {/* ── LAYER 1: TRACK 1 (PRIMARY VIDEO / A-ROLL) ── */}
                  {!t1Hidden && activeT1Clip && activeT1Clip.sourceUrl && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        transform: `translate(${activeT1Clip.transform.x}%, ${activeT1Clip.transform.y}%) scale(${activeT1Clip.transform.scale}) rotate(${activeT1Clip.transform.rotation}deg)`,
                        opacity: activeT1Clip.transform.opacity,
                        filter: `${
                          activeT1Clip.filter === "bw"
                            ? "grayscale(100%)"
                            : activeT1Clip.filter === "vintage"
                            ? "sepia(45%) contrast(110%)"
                            : activeT1Clip.filter === "glow"
                            ? "drop-shadow(0 0 20px rgba(52,211,153,0.6))"
                            : activeT1Clip.filter === "contrast"
                            ? "contrast(140%)"
                            : activeT1Clip.filter === "teal"
                            ? "hue-rotate(150deg)"
                            : "none"
                        } brightness(${activeT1Clip.filterAdjustments?.brightness ?? 100}%) contrast(${
                          activeT1Clip.filterAdjustments?.contrast ?? 100
                        }%) saturate(${activeT1Clip.filterAdjustments?.saturation ?? 100}%) blur(${
                          activeT1Clip.filterAdjustments?.blur ?? 0
                        }px)`,
                      }}
                      className="w-full h-full flex items-center justify-center overflow-hidden z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(activeT1Clip.id);
                      }}
                    >
                      {activeT1Clip.type === "video" ? (
                        <video
                          ref={t1VideoRef}
                          src={activeT1Clip.sourceUrl}
                          playsInline
                          muted={isMuted || t1Hidden || activeT1Clip.audio?.muted}
                          className="w-full h-full object-cover block"
                        />
                      ) : (
                        <img
                          src={activeT1Clip.sourceUrl}
                          alt={activeT1Clip.name}
                          className="w-full h-full object-cover block"
                        />
                      )}
                    </div>
                  )}

                  {/* ── LAYER 2: TRACK 2 (B-ROLL & PIP OVERLAYS) ── */}
                  {!t2Hidden &&
                    activeT2Clips.map((clip) => (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                        }}
                        style={{
                          position: "absolute",
                          left: `${50 + clip.transform.x}%`,
                          top: `${50 + clip.transform.y}%`,
                          width: `${clip.transform.width}%`,
                          height: `${clip.transform.height}%`,
                          transform: `translate(-50%, -50%) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`,
                          opacity: clip.transform.opacity,
                        }}
                        className="rounded-xl overflow-hidden shadow-2xl z-20 cursor-move border border-white/20"
                      >
                        {clip.type === "video" ? (
                          <video
                            ref={t2VideoRef}
                            src={clip.sourceUrl}
                            playsInline
                            muted={isMuted || t2Hidden || clip.audio?.muted}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={clip.sourceUrl}
                            alt={clip.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}

                  {/* ── LAYER 0: TRACK 0 (OVERLAYS, TEXT & CAPTIONS) ── */}
                  {!t0Hidden &&
                    activeT0Clips.map((clip) => {
                      const isSelected = selectedClipId === clip.id;
                      return (
                        <div
                          key={clip.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                          }}
                          onMouseDown={(e) => {
                            if (isSelected) {
                              setIsDraggingClip(true);
                              setDragStartPos({ x: e.clientX, y: e.clientY });
                              setInitialTransform({ x: clip.transform.x, y: clip.transform.y });
                            }
                          }}
                          style={{
                            position: "absolute",
                            left: `${50 + clip.transform.x}%`,
                            top: `${50 + clip.transform.y}%`,
                            width: `${clip.transform.width}%`,
                            transform: `translate(-50%, -50%) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`,
                            opacity: clip.transform.opacity,
                          }}
                          className={`z-30 p-2 rounded-xl transition-all cursor-move flex items-center justify-center ${
                            isSelected
                              ? "border-2 border-[#34D399] shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                              : "hover:border border-white/20"
                          }`}
                        >
                          {/* Selected Bounding Box Rotation & Resize Handles */}
                          {isSelected && (
                            <>
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const initialRot = clip.transform.rotation;
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
                                title="Rotate"
                              >
                                <RotateCw size={8} className="text-black" />
                              </div>
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-[#34D399]" />
                              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-black rounded-sm" />
                              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-black rounded-sm" />
                              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-black rounded-sm" />
                              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-black rounded-sm" />
                            </>
                          )}

                          {/* Render Text Content */}
                          {inlineEditingTextId === clip.id ? (
                            <input
                              type="text"
                              value={clip.text || ""}
                              onChange={(e) => handleUpdateSelectedClip({ text: e.target.value })}
                              onBlur={() => setInlineEditingTextId(null)}
                              onKeyDown={(e) => e.key === "Enter" && setInlineEditingTextId(null)}
                              autoFocus
                              className="bg-black/90 border border-[#34D399] text-white px-2 py-1 rounded-lg text-center w-full outline-none font-bold"
                            />
                          ) : (
                            <div
                              onDoubleClick={() => setInlineEditingTextId(clip.id)}
                              style={{
                                fontFamily: clip.style?.fontFamily || "Inter, sans-serif",
                                fontSize: `${(clip.style?.fontSize || 32) * (isVertical ? 0.35 : 0.45)}px`,
                                color: clip.style?.color || "#FFFFFF",
                                fontWeight: clip.style?.fontWeight || 700,
                                backgroundColor: clip.style?.backgroundColor || "transparent",
                                textShadow: clip.style?.shadow || "none",
                                textAlign: clip.style?.textAlign || "center",
                                padding: clip.style?.backgroundColor ? "4px 12px" : "0",
                                borderRadius: clip.style?.backgroundColor ? "9999px" : "0",
                              }}
                              className="w-full text-center leading-tight drop-shadow-md select-none"
                            >
                              {clip.text}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* ── LAYER 3: TRACK 3 (MASTER AUDIO BED) ── */}
                  {!t3Muted && activeT3Clip && activeT3Clip.sourceUrl && (
                    <audio
                      ref={t3AudioRef}
                      src={activeT3Clip.sourceUrl}
                      muted={isMuted || t3Muted || activeT3Clip.audio?.muted}
                    />
                  )}

                  {/* Empty Stage Placeholder Guide */}
                  {!activeT1Clip && activeT2Clips.length === 0 && activeT0Clips.length === 0 && (
                    <div className="text-center p-6 text-[#9E9E98] pointer-events-none">
                      <Film size={32} className="mx-auto mb-2 text-zinc-600" />
                      <p className="text-xs font-bold text-white">No active media at this timestamp</p>
                      <p className="text-[11px] mt-1 text-zinc-500">
                        Drop a video from your computer or click &quot;+ Upload Local Media&quot;.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Storyboard Editor Tab */
                <div className="w-full h-full p-4 overflow-y-auto space-y-3 flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <span className="text-xs font-semibold text-white">STORYBOARD.md Directives</span>
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

            {/* ── Stage Transport Bar ── */}
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
                  className="h-full bg-[#34D399] rounded-full relative"
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Transport Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="pill-mint text-[10.5px] py-0.5 px-2 font-mono">
                    {aspectRatio}
                  </span>
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
                    <span className="text-[#34D399]">{formatSMPTE(currentTime)}</span>
                    <span className="text-[#686863] mx-1">/</span>
                    <span className="text-[#9E9E98]">{formatSMPTE(totalDuration)}</span>
                  </div>
                </div>

                {/* Right: Audio, Speed, Loop */}
                <div className="flex items-center gap-2 text-[#9E9E98]">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-white transition-colors"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      const speeds = [0.5, 1, 1.5, 2];
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

          {/* C. Right Island: Dynamic Inspector & Studio Builder (w-[320px]) */}
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
                        Transform &amp; Position
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
                          Typography &amp; Styling
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
                                animation: { in: e.target.value as any, out: "fade", duration: 0.4 },
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

                    {/* Video Filters & Color Grading (If video clip) */}
                    {selectedClip.type === "video" && (
                      <div className="space-y-2.5 pt-2 border-t border-white/10">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Color Grade &amp; Effects
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: "none", label: "None" },
                            { id: "bw", label: "Noir B&W" },
                            { id: "vintage", label: "Vintage" },
                            { id: "contrast", label: "Contrast" },
                            { id: "glow", label: "Glow" },
                            { id: "teal", label: "Cool Teal" },
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => handleUpdateClipFilters(f.id as any)}
                              className={`py-1 text-[10px] rounded-lg border font-mono transition-colors ${
                                (selectedClip.filter || "none") === f.id
                                  ? "bg-[#34D399]/20 border-[#34D399] text-[#34D399]"
                                  : "bg-[#222220] border-white/5 text-zinc-400 hover:text-white"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        {/* Brightness, Contrast, Saturation sliders */}
                        <div className="space-y-1.5 text-xs pt-1">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Brightness ({selectedClip.filterAdjustments?.brightness ?? 100}%)</span>
                            <input
                              type="range"
                              min="50"
                              max="150"
                              value={selectedClip.filterAdjustments?.brightness ?? 100}
                              onChange={(e) =>
                                handleUpdateClipFilters(selectedClip.filter, { brightness: parseInt(e.target.value) })
                              }
                              className="w-24 accent-[#34D399]"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Contrast ({selectedClip.filterAdjustments?.contrast ?? 100}%)</span>
                            <input
                              type="range"
                              min="50"
                              max="150"
                              value={selectedClip.filterAdjustments?.contrast ?? 100}
                              onChange={(e) =>
                                handleUpdateClipFilters(selectedClip.filter, { contrast: parseInt(e.target.value) })
                              }
                              className="w-24 accent-[#34D399]"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Saturation ({selectedClip.filterAdjustments?.saturation ?? 100}%)</span>
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={selectedClip.filterAdjustments?.saturation ?? 100}
                              onChange={(e) =>
                                handleUpdateClipFilters(selectedClip.filter, { saturation: parseInt(e.target.value) })
                              }
                              className="w-24 accent-[#34D399]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Media Timing Section */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        Clip Timing &amp; Audio
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

                      {/* Volume Slider */}
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
                                  fadeIn: 0.2,
                                  fadeOut: 0.2,
                                  speed: selectedClip.audio?.speed || 1,
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
                          trimStart: (selectedClip.trimStart || 0) + splitOffset,
                        };
                        const nextClips = timelineState!.clips.filter((c) => c.id !== selectedClip.id).concat([firstHalf, secondHalf]);
                        handleUpdateTimeline({ ...timelineState!, clips: nextClips });
                      }}
                      className="pill-dark text-xs py-1 px-2.5 flex items-center gap-1 text-zinc-300 hover:text-white"
                      title="Split clip at playhead (S)"
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
                      title="Duplicate (Cmd+D)"
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
                      title="Delete (Delete / Backspace)"
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
                          disabled={isUploadingLocalMedia}
                          className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                        >
                          {isUploadingLocalMedia ? (
                            <>
                              <RefreshCw size={14} className="animate-spin text-[#34D399]" />
                              <span>Importing media...</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} className="text-[#34D399]" />
                              <span>+ Upload Local Media</span>
                            </>
                          )}
                        </button>

                        <div className="space-y-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                            Local Project Assets ({assetsList.length})
                          </div>
                          {assetsList.length === 0 ? (
                            <div className="text-center py-6 text-[#9E9E98] text-xs leading-relaxed">
                              No footage added yet. Drag and drop any video, image, or audio from your computer.
                            </div>
                          ) : (
                            assetsList.map((a) => (
                              <div
                                key={a.id || a.filename}
                                className="bg-[#222220] border border-white/5 hover:border-white/20 p-2 rounded-xl flex items-center justify-between transition-colors gap-2"
                              >
                                {/* Thumbnail Frame Preview */}
                                <div className="w-14 h-10 rounded-lg bg-black/60 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                                  {a.thumbnailUrl ? (
                                    <img src={a.thumbnailUrl} alt={a.filename} className="w-full h-full object-cover" />
                                  ) : a.has_video !== false ? (
                                    <Video size={16} className="text-[#34D399]" />
                                  ) : (
                                    <Music size={16} className="text-teal-400" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-white truncate">{a.filename}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                    {a.duration.toFixed(1)}s • {a.width ? `${a.width}×${a.height}` : "Audio"}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleInsertAssetToTimeline(a)}
                                    className="pill-mint text-[10px] py-1 px-2 font-bold"
                                    title="Add to timeline at playhead"
                                  >
                                    + Add
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAsset(a.id || a.filename)}
                                    className="w-6 h-6 rounded-lg hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                                    title="Delete asset"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Text Tab */}
                    {builderTab === "text" && (
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          One-Click Text Presets
                        </div>
                        {[
                          { id: "heading", title: "Add Heading", desc: "Bold cinematic title", type: "heading" as const },
                          { id: "amber", title: "Add Amber Serif Caption", desc: "Luxury gold subtitle reveal", type: "amber" as const },
                          { id: "subtitle", title: "Add Kinetic Subtitle", desc: "Punchy subtitle bar with box", type: "subtitle" as const },
                          { id: "lower_third", title: "Add Lower Third", desc: "Speaker name & badge", type: "lower_third" as const },
                          { id: "cta", title: "Add Call-to-Action Pill", desc: "Mint green button badge", type: "cta" as const },
                        ].map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleAddTextPreset(item.type)}
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

                    {/* 3. Styles Tab */}
                    {builderTab === "effects" && (
                      <div className="space-y-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          Caption &amp; Motion Presets
                        </div>
                        {[
                          { title: "Amber Serif Glow", prompt: "Apply Amber Serif Glow typography with warm gold highlights." },
                          { title: "Bold Hormozi Pop", prompt: "Apply bold yellow and white text pop with high contrast outline." },
                          { title: "Clean Lower Third", prompt: "Insert minimal slide-in speaker lower-third badge." },
                          { title: "Typewriter Terminal", prompt: "Apply green monospace typewriter letter reveal." },
                          { title: "Neon Cyber", prompt: "Apply glowing mint outline card styles." },
                        ].map((eff) => (
                          <div
                            key={eff.title}
                            onClick={() => handleAgentSubmit(eff.prompt)}
                            className="bg-[#222220] border border-white/5 hover:border-white/20 p-2.5 rounded-xl cursor-pointer transition-colors"
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
                          Aspect Ratio &amp; Canvas
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "16:9 Landscape", ratio: "16:9", w: 1920, h: 1080 },
                            { label: "9:16 Vertical Reel", ratio: "9:16", w: 1080, h: 1920 },
                            { label: "1:1 Square Feed", ratio: "1:1", w: 1080, h: 1080 },
                            { label: "4:5 Social", ratio: "4:5", w: 1080, h: 1350 },
                          ].map((ar) => (
                            <button
                              key={ar.ratio}
                              onClick={() => {
                                if (timelineState) {
                                  handleUpdateTimeline({
                                    ...timelineState,
                                    aspectRatio: ar.ratio,
                                    width: ar.w,
                                    height: ar.h,
                                  });
                                }
                              }}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                                aspectRatio === ar.ratio
                                  ? "bg-[#34D399]/15 border-[#34D399] text-[#34D399]"
                                  : "bg-[#222220] border-white/10 text-zinc-400"
                              }`}
                            >
                              <div className="font-bold">{ar.label}</div>
                              <div className="text-[9px] font-mono text-zinc-500">{ar.w}×{ar.h}</div>
                            </button>
                          ))}
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Canvas Background</label>
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

                        <div className="pt-2 border-t border-white/10">
                          <label className="text-[10px] text-zinc-400 block mb-1">Project Duration (s)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.5"
                              value={timelineState?.duration || 12.0}
                              onChange={(e) => {
                                if (timelineState) {
                                  handleUpdateTimeline({
                                    ...timelineState,
                                    duration: Math.max(1, parseFloat(e.target.value) || 12.0),
                                  });
                                }
                              }}
                              className="w-24 bg-[#222220] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                            />
                            <button
                              onClick={() => {
                                if (!timelineState) return;
                                const maxEnd = Math.max(
                                  1.0,
                                  ...timelineState.clips.map((c) => c.start + c.duration)
                                );
                                handleUpdateTimeline({ ...timelineState, duration: Math.round(maxEnd * 10) / 10 });
                              }}
                              className="pill-dark text-[10px] py-1 px-2.5 text-zinc-300 hover:text-white"
                            >
                              Fit to Clips
                            </button>
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

      {/* ── Bottom Multitrack Editor Bar ── */}
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
                  Live Stage Sync
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

      {/* ── Universal Video Export Modal (Phase 6) ── */}
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
                  <div className="text-[10px] text-zinc-400 mt-1">Zero cost, instant client rendering via Canvas</div>
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
                    720p HD
                  </button>
                </div>
              </div>
            )}

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
                    <span>Render &amp; Download Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BYOK API Key Settings Modal (Phase 5) ── */}
      {isByokModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181817] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key size={16} className="text-[#34D399]" />
                <span>AI Director API Keys (BYOK)</span>
              </h3>
              <button
                onClick={() => setIsByokModalOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <div className="text-xs text-zinc-400 leading-relaxed bg-[#222220] p-3 rounded-xl border border-white/5 space-y-1">
              <p className="text-white font-semibold">100% Free Gemini API Available</p>
              <p>
                Get a free API key from Google AI Studio in 10 seconds.
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#34D399] hover:underline flex items-center gap-1 font-mono text-[11px] pt-1"
              >
                <span>Get Free Gemini Key (aistudio.google.com)</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Provider</label>
                <select
                  value={byokSettings.provider}
                  onChange={(e) => setByokState({ ...byokSettings, provider: e.target.value as any })}
                  className="w-full bg-[#222220] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="gemini">Google Gemini (Default: gemini-2.5-flash / Free)</option>
                  <option value="openai">OpenAI (gpt-4o / gpt-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="openrouter">OpenRouter (Groq / Open Weights)</option>
                  <option value="local_cli">Local CLI Bridge (FastAPI @ localhost)</option>
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

              {byokStatusText && (
                <div className="text-xs font-mono p-2 rounded-lg bg-[#222220] text-zinc-300 border border-white/5">
                  {byokStatusText}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setByokState({ provider: "gemini", apiKey: "" });
                  saveByokSettings({ provider: "gemini", apiKey: "" });
                  setByokStatusText("Cleared. Running on free rules.");
                }}
                className="pill-dark text-xs py-2 px-3 text-zinc-400 hover:text-rose-400"
              >
                Clear Key
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestAndSaveKey}
                  disabled={isTestingKey}
                  className="pill-mint text-xs py-2 px-4 font-bold flex items-center gap-1.5"
                >
                  {isTestingKey && <RefreshCw size={12} className="animate-spin" />}
                  <span>Test &amp; Save Key</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoints History & Snapshot Modal (Phase 6) */}
      <CheckpointHistoryModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        activeProject={activeProject}
        currentTimeline={timelineState}
        onRestoreTimeline={(tl) => {
          setTimelineState(tl);
          setSelectedClipId(tl.clips?.[0]?.id || null);
        }}
        onRestored={() => {
          if (activeProject) loadProjectTimeline(activeProject.id);
        }}
      />

      {/* Slide-over Brand Kits Drawer */}
      <BrandKitsDrawer
        isOpen={isBrandKitOpen}
        onClose={() => setIsBrandKitOpen(false)}
        activeProject={activeProject}
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
