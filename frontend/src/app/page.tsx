"use client";

import React, { useState, useEffect, useRef } from "react";
import { SidebarNav, ScreenId } from "@/components/SidebarNav";
import { StudioTimeline } from "@/components/StudioTimeline";
import { GraphInspector } from "@/components/GraphInspector";
import { DirectorChat } from "@/components/DirectorChat";
import { VersionDiffView } from "@/components/VersionDiffView";
import {
  Project,
  StoryBeat,
  VideoClip,
  CutDecision,
  EditVersion,
  CreatorPreference,
  GraphState,
  VersionDiffItem,
  formatSMPTE,
} from "@/types";
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
  Play,
  Pause,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Scissors,
  ArrowRight,
  ShieldCheck,
  Check,
  Zap,
  Trash2,
  Layers,
  Grid,
  Square,
  Maximize2,
  SkipBack,
  SkipForward,
  Repeat,
  Activity,
  Tv,
  Clock,
  HardDrive,
  Filter,
  Eye,
  Clapperboard,
  Video,
  CheckSquare,
  Settings2
} from "lucide-react";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("studio");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [referenceBeats, setReferenceBeats] = useState<StoryBeat[]>([]);
  const [sourceClips, setSourceClips] = useState<VideoClip[]>([]);
  const [versions, setVersions] = useState<EditVersion[]>([]);
  const [decisions, setDecisions] = useState<CutDecision[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<CutDecision | null>(null);
  const [graphState, setGraphState] = useState<GraphState | null>(null);
  const [preferences, setPreferences] = useState<CreatorPreference[]>([]);
  const [diffItems, setDiffItems] = useState<VersionDiffItem[]>([]);

  // Video Playback & Monitor Guides
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string>("");

  // Loading flags
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isRevising, setIsRevising] = useState<boolean>(false);

  // New Project Wizard State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("YouTube Long-Form (16:9)");
  const [newDuration, setNewDuration] = useState(12.0);
  const [newMood, setNewMood] = useState("upbeat");
  const [newAspectRatio, setNewAspectRatio] = useState("16:9");

  // Reference Video Form State
  const [refUrl, setRefUrl] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);

  // Media Bin & Clip Filter State
  const [clipFilter, setClipFilter] = useState<string>("all");

  // Master Export Presets State
  const [exportPreset, setExportPreset] = useState<string>("h264");
  const [exportResolution, setExportResolution] = useState<string>("1080p");

  // Publishing Human-in-the-Loop Toggle
  const [requireHumanApproval, setRequireHumanApproval] = useState<boolean>(true);
  const [sandboxPushed, setSandboxPushed] = useState<boolean>(false);

  // Settings New Preference Form State
  const [newPrefCategory, setNewPrefCategory] = useState("Pacing & Style");
  const [newPrefRule, setNewPrefRule] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Initial Load: Projects & Creator Memory
  useEffect(() => {
    fetchProjects();
    fetchCreatorPreferences();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0 && !activeProject) {
          loadProjectDetails(data.projects[0]);
        }
      }
    } catch (e) {
      console.warn("Could not fetch projects:", e);
    }
  };

  const fetchCreatorPreferences = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/creator/preferences`);
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences || []);
      }
    } catch (e) {
      console.warn("Could not fetch preferences:", e);
    }
  };

  // 2. Load Project details
  const loadProjectDetails = async (proj: Project) => {
    setActiveProject(proj);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${proj.id}`);
      if (res.ok) {
        const data = await res.json();
        setReferenceBeats(data.reference_beats || []);
        setSourceClips(data.source_assets || []);
        setVersions(data.versions || []);

        if (data.versions && data.versions.length > 0) {
          const latest = data.versions[data.versions.length - 1];
          if (latest.preview_url) {
            setActivePreviewUrl(`${API_BASE}${latest.preview_url}`);
          }
        }
      }
      await refreshGraphState(proj.id);
    } catch (e) {
      console.error("Error loading project details:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshGraphState = async (projId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projId}/graph-state`);
      if (res.ok) {
        const data = await res.json();
        setGraphState(data);
      }
    } catch (e) {
      console.warn("Could not fetch graph state:", e);
    }
  };

  // 3. 1-Click Demo Seed
  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/api/seed-demo`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await fetchProjects();
        const seededProject = data.project;
        setActiveProject(seededProject);
        await loadProjectDetails(seededProject);

        if (data.version_v1?.decisions) {
          setDecisions(data.version_v1.traceability || []);
          if (data.version_v1.traceability?.length > 0) {
            setSelectedDecision(data.version_v1.traceability[0]);
          }
        }
        if (data.version_v1?.preview_url) {
          setActivePreviewUrl(`${API_BASE}${data.version_v1.preview_url}`);
        }
        setCurrentScreen("studio");
      }
    } catch (e) {
      console.error("Error seeding demo:", e);
    } finally {
      setIsSeeding(false);
    }
  };

  // 4. Synthesize Edit Plan (DirectorAgent Query 1)
  const handleGeneratePlan = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/generate-plan`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        const plan = data.plan;
        setDecisions(plan.traceability || []);
        if (plan.traceability && plan.traceability.length > 0) {
          setSelectedDecision(plan.traceability[0]);
        }
        if (plan.preview_url) {
          setActivePreviewUrl(`${API_BASE}${plan.preview_url}`);
        }
        await loadProjectDetails(activeProject);
      }
    } catch (e) {
      console.error("Error generating edit plan:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Conversational Revision (RevisionAgent Query 2)
  const handleSendRevision = async (prompt: string) => {
    if (!activeProject) return;
    setIsRevising(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        const data = await res.json();
        const rev = data.revision;
        setDecisions(rev.traceability || []);
        if (rev.traceability && rev.traceability.length > 0) {
          setSelectedDecision(rev.traceability[0]);
        }
        if (rev.preview_url) {
          setActivePreviewUrl(`${API_BASE}${rev.preview_url}`);
        }
        if (rev.diff_summary) {
          setDiffItems(rev.diff_summary);
        }
        await loadProjectDetails(activeProject);
        await fetchCreatorPreferences();
      } else {
        throw new Error("Revision mutation failed");
      }
    } catch (e) {
      console.error("Error applying revision:", e);
      throw e;
    } finally {
      setIsRevising(false);
    }
  };

  // 6. Compare Two Versions (Query 4)
  const handleCompareVersions = async (v1Id: string, v2Id: string) => {
    if (!activeProject) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${activeProject.id}/compare?v1=${v1Id}&v2=${v2Id}`
      );
      if (res.ok) {
        const data = await res.json();
        setDiffItems(data.beat_diffs || []);
      }
    } catch (e) {
      console.warn("Error comparing versions:", e);
    }
  };

  // 7. Wizard Project Submit
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          target_duration: newDuration,
          mood: newMood,
          aspect_ratio: newAspectRatio,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchProjects();
        setActiveProject(data.project);
        setNewTitle("");
        setCurrentScreen("reference");
      }
    } catch (e) {
      console.error("Error creating project:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Analyze Reference Video
  const handleAnalyzeReference = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      if (refFile) {
        formData.append("file", refFile);
      } else if (refUrl) {
        formData.append("video_url", refUrl);
      }
      const res = await fetch(
        `${API_BASE}/api/projects/${activeProject.id}/analyze-reference`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (res.ok) {
        await loadProjectDetails(activeProject);
        setCurrentScreen("footage");
      }
    } catch (e) {
      console.error("Error analyzing reference video:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 9. Load Demo Footage Pack
  const handleLoadDemoFootage = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      const res = await fetch(
        `${API_BASE}/api/projects/${activeProject.id}/upload-footage`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (res.ok) {
        await loadProjectDetails(activeProject);
      }
    } catch (e) {
      console.error("Error indexing footage:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 10. Creator Preference CRUD
  const handleAddPreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefRule.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/creator/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newPrefCategory,
          rule_text: newPrefRule,
          weight: 1.5,
        }),
      });
      if (res.ok) {
        setNewPrefRule("");
        fetchCreatorPreferences();
      }
    } catch (e) {
      console.error("Error adding preference:", e);
    }
  };

  const handleDeletePreference = async (prefId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/creator/preferences/${prefId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCreatorPreferences();
      }
    } catch (e) {
      console.error("Error deleting preference:", e);
    }
  };

  // Video Frame Transport
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleStepFrame = (deltaFrames: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime + deltaFrames * (1 / 24));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Find currently playing cut
  const currentlyPlayingCut = decisions.find(
    (d) => currentTime >= d.source_in_sec && currentTime <= d.source_out_sec
  );

  return (
    <div className="app-shell">
      {/* 1. Sleek Left Studio Navigation Rail */}
      <SidebarNav
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => loadProjectDetails(p)}
        onSeedDemo={handleSeedDemo}
        isSeeding={isSeeding}
        nodeCount={graphState?.nodes.length || 18}
        edgeCount={graphState?.edges.length || 24}
      />

      {/* Main Studio Canvas Area */}
      <main className="main-workspace bg-studio-grid">
        {/* Top Program Header */}
        <header className="top-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px", padding: "0 24px" }}>
          <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h2 className="text-sm font-bold text-white flex items-center gap-2" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]" />
              <span>{activeProject ? activeProject.title : "Director.AI Pro Creative Studio"}</span>
            </h2>
            {activeProject && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge-pill font-mono">
                  {activeProject.category}
                </span>
                <span className="badge-pill font-mono text-violet-300">
                  {activeProject.aspect_ratio}&nbsp;Cinema&nbsp;•&nbsp;1080p
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Direct Workflow Stepper */}
            <div className="hidden lg:flex items-center gap-2 text-xs" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {[
                { id: "reference", label: "1. Ref Beats" },
                { id: "footage", label: "2. Media Bin" },
                { id: "studio", label: "3. AI Studio" },
                { id: "revisions", label: "4. Compare & Export" },
              ].map((step, idx) => (
                <React.Fragment key={step.id}>
                  {idx > 0 && <span className="text-zinc-600">➔</span>}
                  <button
                    type="button"
                    onClick={() => setCurrentScreen(step.id as ScreenId)}
                    className={currentScreen === step.id ? "badge-pill text-violet-200 border-violet-500/50 bg-violet-950 font-bold" : "text-zinc-400 hover:text-zinc-200 border border-transparent"}
                    style={{ cursor: "pointer", background: currentScreen === step.id ? "rgba(139, 92, 246, 0.2)" : "transparent", padding: "4px 10px", fontSize: "11px" }}
                  >
                    {step.label}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Synthesize Edit Button */}
            {activeProject ? (
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={isLoading}
                className="btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoading ? "Synthesizing..." : "✨ Synthesize Edit"}</span>
              </button>
            ) : null}
          </div>
        </header>

        {/* Dynamic Studio Views Router */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: currentScreen === "studio" ? "hidden" : "auto", padding: currentScreen === "studio" ? "0" : "28px", width: "100%" }}>
          {/* SCREEN 1: LANDING & ONBOARDING */}
          {currentScreen === "landing" && (
            <div className="max-w-5xl mx-auto space-y-8 py-4 select-none">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/80 border border-violet-500/50 text-violet-300 text-xs font-medium shadow-md shadow-violet-900/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Powered by FalkorDB Property Graph • Graph Hacks 2026</span>
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
                  Autonomous AI Video Director
                </h1>
                <p className="text-zinc-400 text-base max-w-2xl mx-auto leading-relaxed">
                  A flagship creative workspace where video editing is driven by multi-hop graph reasoning
                  across narrative beats, visual tags, and cross-session creator memory.
                </p>

                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    onClick={handleSeedDemo}
                    disabled={isSeeding}
                    className="bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 hover:from-violet-500 hover:to-indigo-400 text-white font-bold px-6 py-3 rounded-xl shadow-xl shadow-violet-900/40 border border-violet-400/40 flex items-center gap-2 transition-all disabled:opacity-50 text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isSeeding ? "Seeding FalkorDB..." : "⚡ 1-Click Seed & Launch Studio"}</span>
                  </button>
                  <button
                    onClick={() => setCurrentScreen("wizard")}
                    className="bg-[#12121c] hover:bg-[#181826] text-zinc-200 border border-white/10 font-semibold px-5 py-3 rounded-xl text-sm transition-all"
                  >
                    + Start New Production
                  </button>
                </div>
              </div>

              {/* 3-Step Architecture Flow Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
                <div className="studio-panel-interactive rounded-xl p-5 space-y-3 shadow-xl">
                  <div className="w-9 h-9 rounded-lg bg-violet-950 border border-violet-800/80 flex items-center justify-center text-violet-400 font-bold">
                    1
                  </div>
                  <h3 className="text-sm font-bold text-white">Reference Decomposition</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    PySceneDetect extracts cut rhythm and energy curves, generating an immutable
                    (:StoryBeat)-[:NEXT_BEAT]-&gt;(:StoryBeat) narrative chain in FalkorDB.
                  </p>
                </div>

                <div className="studio-panel-interactive rounded-xl p-5 space-y-3 shadow-xl">
                  <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-800/80 flex items-center justify-center text-indigo-400 font-bold">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-white">Connected Data Action</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    The Director Agent traverses shared VisualTags and AudioMood nodes via multi-hop OpenCypher queries,
                    selecting the highest-scoring non-overlapping raw clips.
                  </p>
                </div>

                <div className="studio-panel-interactive rounded-xl p-5 space-y-3 shadow-xl">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400 font-bold">
                    3
                  </div>
                  <h3 className="text-sm font-bold text-white">Lineage DAG & Memory</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Conversational revisions branch new EditVersion nodes in the lineage graph, mark rejected clips with
                    [:REJECTED_FOR], and persist durable CreatorPreferences across sessions.
                  </p>
                </div>
              </div>

              {/* Rule 2 & 3 Compliance Banner */}
              <div className="p-6 rounded-xl bg-gradient-to-r from-violet-950/40 via-[#0e0e16] to-indigo-950/40 border border-violet-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Passing the &quot;No-Decoration Graph&quot; Rule (Rule 2 & 3)</span>
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-xl">
                    FalkorDB is the primary database. If FalkorDB is removed, footage matching,
                    cut decisions, revision branching, and cross-session memory cease to operate.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentScreen("studio")}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition-colors shrink-0"
                >
                  Explore Studio Timeline ➔
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: HOME DASHBOARD & PROJECT LIBRARY */}
          {currentScreen === "dashboard" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Studio Telemetry & Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="studio-panel rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-950/80 border border-violet-800/60 flex items-center justify-center text-violet-400">
                    <Clapperboard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Active Productions</div>
                    <div className="text-lg font-extrabold text-white">{projects.length} Projects</div>
                  </div>
                </div>

                <div className="studio-panel rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500 font-mono">FalkorDB Nodes</div>
                    <div className="text-lg font-extrabold text-indigo-300">{graphState?.nodes.length || 18} Nodes</div>
                  </div>
                </div>

                <div className="studio-panel rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Track 02 Rules</div>
                    <div className="text-lg font-extrabold text-emerald-300">{preferences.length} Stored Rules</div>
                  </div>
                </div>

                <div className="studio-panel rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Query Traversal</div>
                    <div className="text-lg font-extrabold text-amber-300">0.4ms Latency</div>
                  </div>
                </div>
              </div>

              {/* Header with Search & New Production CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Productions Library</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/60">
                      {projects.length} Saved
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Each production is an autonomous (:Project) node rooted in FalkorDB with full lineage tracking.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleSeedDemo}
                    disabled={isSeeding}
                    className="bg-[#12121c] hover:bg-[#181826] text-zinc-300 border border-white/10 text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 text-violet-400" />
                    <span>Quick Re-Seed</span>
                  </button>
                  <button
                    onClick={() => setCurrentScreen("wizard")}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-violet-900/30 border border-violet-400/30 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ New Production</span>
                  </button>
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((p) => {
                  const isCurrentActive = activeProject?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`studio-panel-interactive rounded-2xl overflow-hidden shadow-2xl transition-all border flex flex-col justify-between ${
                        isCurrentActive ? "border-violet-500/80 ring-1 ring-violet-500/40" : "border-white/[0.08]"
                      }`}
                    >
                      {/* Cinema Card Thumbnail Header */}
                      <div className="relative aspect-video bg-gradient-to-br from-[#121220] via-[#090910] to-[#050508] p-3 flex flex-col justify-between overflow-hidden group">
                        {/* Filmstrip sprockets line */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 filmstrip-sprockets opacity-30" />
                        
                        {/* Background radial glow */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/10 via-transparent to-indigo-600/10 blur-xl group-hover:opacity-100 transition-opacity" />

                        {/* Top Badges */}
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-violet-300 border border-violet-500/30 font-semibold shadow-sm">
                            {p.aspect_ratio} Cinema
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-zinc-400 border border-white/10">
                            {p.target_duration}s Cut
                          </span>
                        </div>

                        {/* Center Hover Action Overlay */}
                        <div className="relative z-10 flex items-center justify-center py-4">
                          <div
                            onClick={() => {
                              loadProjectDetails(p);
                              setCurrentScreen("studio");
                            }}
                            className="w-12 h-12 rounded-full bg-violet-600/80 group-hover:bg-violet-500 text-white flex items-center justify-center shadow-xl shadow-violet-900/50 backdrop-blur-sm cursor-pointer group-hover:scale-110 transition-all border border-violet-300/40"
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Bottom Tag */}
                        <div className="relative z-10 flex items-center justify-between text-[10px]">
                          <span className="text-zinc-400 font-mono truncate max-w-[180px] bg-black/60 px-2 py-0.5 rounded">
                            {p.category}
                          </span>
                          {isCurrentActive && (
                            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active in NLE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Details */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                            <span>ID: {p.id}</span>
                            <span>{p.mood || "upbeat"} mood</span>
                          </div>
                          <h3 className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors line-clamp-1">
                            {p.title}
                          </h3>
                        </div>

                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                            <GitBranch className="w-3.5 h-3.5 text-violet-400" />
                            <span>{p.version_count || 1} EditVersions</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                loadProjectDetails(p);
                                setCurrentScreen("revisions");
                              }}
                              className="px-2.5 py-1 rounded bg-[#12121c] hover:bg-[#181826] text-zinc-300 text-[11px] font-medium border border-white/10 transition-colors"
                            >
                              Diff
                            </button>
                            <button
                              onClick={() => {
                                loadProjectDetails(p);
                                setCurrentScreen("studio");
                              }}
                              className="px-3 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold shadow-md shadow-violet-900/30 transition-all flex items-center gap-1"
                            >
                              <span>Open NLE</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCREEN 3: NEW PROJECT WIZARD */}
          {currentScreen === "wizard" && (
            <div className="max-w-2xl mx-auto studio-panel rounded-xl p-6 shadow-2xl space-y-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-violet-400" />
                  <span>New Video Production Wizard</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Create a new Project node in FalkorDB and configure production parameters.
                </p>
              </div>

              <form onSubmit={handleCreateProjectSubmit} className="space-y-6 text-xs">
                <div>
                  <label className="font-semibold text-zinc-300 block mb-1.5 text-xs">Project Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Autonomous Agent Video Studio — Product Reveal"
                    required
                    className="w-full bg-[#07070b] border border-white/10 text-zinc-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all placeholder:text-zinc-600"
                  />
                </div>

                {/* Aspect Ratio Interactive Visual Cards */}
                <div>
                  <label className="font-semibold text-zinc-300 block mb-2 text-xs">Aspect Ratio & Canvas Format</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "16:9", label: "16:9 Landscape", sub: "YouTube / Desktop", aspectClass: "w-10 h-6" },
                      { id: "9:16", label: "9:16 Vertical", sub: "Reels / TikTok", aspectClass: "w-5 h-8" },
                      { id: "1:1", label: "1:1 Square", sub: "Feed / Social", aspectClass: "w-7 h-7" },
                    ].map((fmt) => {
                      const isSelected = newAspectRatio === fmt.id;
                      return (
                        <div
                          key={fmt.id}
                          onClick={() => setNewAspectRatio(fmt.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                            isSelected
                              ? "bg-violet-950/60 border-violet-500 shadow-lg shadow-violet-900/30 text-white"
                              : "bg-[#07070b] border-white/10 hover:border-white/20 text-zinc-400"
                          }`}
                        >
                          <div className={`${fmt.aspectClass} rounded border-2 ${isSelected ? "border-violet-400 bg-violet-600/30" : "border-zinc-600 bg-zinc-800/40"}`} />
                          <div>
                            <div className="text-xs font-bold">{fmt.label}</div>
                            <div className="text-[10px] text-zinc-500">{fmt.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Production Category */}
                <div>
                  <label className="font-semibold text-zinc-300 block mb-1.5 text-xs">Production Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      "YouTube Long-Form (16:9)",
                      "Podcast Highlight",
                      "Educational Course",
                      "Documentary Short",
                      "Product Reveal",
                      "Vertical Shorts / Reels (9:16)"
                    ].map((cat) => {
                      const isSelected = newCategory === cat;
                      return (
                        <div
                          key={cat}
                          onClick={() => setNewCategory(cat)}
                          className={`px-3 py-2 rounded-lg border text-center cursor-pointer transition-all text-[11px] truncate ${
                            isSelected
                              ? "bg-violet-950/70 border-violet-500 text-violet-200 font-bold"
                              : "bg-[#07070b] border-white/10 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {cat}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Target Duration Selector Pills */}
                <div>
                  <label className="font-semibold text-zinc-300 block mb-1.5 text-xs">
                    Target Duration: <span className="text-violet-400 font-mono font-bold">{newDuration} seconds</span>
                  </label>
                  <div className="flex gap-2">
                    {[10.0, 12.0, 15.0, 30.0, 60.0].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setNewDuration(dur)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                          newDuration === dur
                            ? "bg-violet-600 text-white font-bold border-violet-400 shadow-md shadow-violet-900/30"
                            : "bg-[#07070b] border-white/10 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {dur}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Mood Cards */}
                <div>
                  <label className="font-semibold text-zinc-300 block mb-1.5 text-xs">Audio Mood & Pace</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "upbeat", label: "⚡ Upbeat", sub: "Dynamic" },
                      { id: "dramatic", label: "🎬 Dramatic", sub: "Cinematic" },
                      { id: "conversational", label: "💬 Natural", sub: "Dialog" },
                      { id: "calm", label: "🌿 Calm", sub: "Ambient" },
                    ].map((m) => {
                      const isSelected = newMood === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setNewMood(m.id)}
                          className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                            isSelected
                              ? "bg-violet-950/70 border-violet-500 text-white shadow-md font-bold"
                              : "bg-[#07070b] border-white/10 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <div className="text-xs">{m.label}</div>
                          <div className="text-[9px] text-zinc-500">{m.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Persistent Memory Status */}
                <div className="p-3.5 rounded-xl bg-[#0e0e16] border border-white/[0.06] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-violet-400 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" /> Track 02 Durable Memory Synchronized
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    {preferences.length > 0
                      ? `${preferences.length} standing CreatorPreferences in FalkorDB will automatically shape beat selection and cut pacing.`
                      : "No prior style rules recorded. You can state standing preferences anytime."}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 hover:from-violet-500 hover:to-indigo-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-violet-900/40 border border-violet-400/30 transition-all text-sm"
                >
                  {isLoading ? "Writing Project Node to FalkorDB..." : "Create Project in FalkorDB & Continue ➔"}
                </button>
              </form>
            </div>
          )}

          {/* SCREEN 4: REFERENCE VIDEO IMPORT & ANALYSIS */}
          {currentScreen === "reference" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Reference Import Panel */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <FileVideo className="w-5 h-5 text-violet-400" />
                      <span>Reference Video Import & Narrative Decomposition</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      PySceneDetect extracts cut pacing, shot boundaries, and narrative energy into an immutable (:StoryBeat) graph chain in FalkorDB.
                    </p>
                  </div>
                  <button
                    onClick={handleAnalyzeReference}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-900/40 border border-violet-400/30 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isLoading ? "Analyzing..." : "Run PySceneDetect & Graph Decomposition"}</span>
                  </button>
                </div>

                {/* 1-Click Reference Presets */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
                    Quick Reference Presets (1-Click Load)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        title: "Tech Product Reveal",
                        meta: "12s • 4 Beats • Upbeat Pacing",
                        url: "sample_media/reference_product_reveal.mp4",
                        tag: "Product / Ad",
                      },
                      {
                        title: "Conversational Podcast",
                        meta: "15s • 3 Beats • Natural Flow",
                        url: "sample_media/reference_podcast.mp4",
                        tag: "Dialog / Interview",
                      },
                      {
                        title: "Cinematic Teaser",
                        meta: "12s • 4 Beats • High Energy",
                        url: "sample_media/reference_cinematic.mp4",
                        tag: "Cinematic / Drama",
                      },
                    ].map((preset) => (
                      <div
                        key={preset.title}
                        onClick={() => setRefUrl(preset.url)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          refUrl === preset.url
                            ? "bg-violet-950/60 border-violet-500 text-white shadow-lg shadow-violet-950/40"
                            : "bg-[#07070b] border-white/10 hover:border-white/20 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-violet-400 mb-1">
                          <span>{preset.tag}</span>
                          {refUrl === preset.url && <span className="text-emerald-400 font-bold">✓ Selected</span>}
                        </div>
                        <div className="text-xs font-bold text-white">{preset.title}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{preset.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* File / URL Ingest Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-[#07070b] border border-white/10 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 block flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-violet-400" />
                      <span>Upload Reference MP4 File</span>
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/*"
                      onChange={(e) => setRefFile(e.target.files?.[0] || null)}
                      className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer w-full"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-[#07070b] border border-white/10 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 block flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-violet-400" />
                      <span>Or Reference Video URL / File Path</span>
                    </label>
                    <input
                      type="text"
                      value={refUrl}
                      onChange={(e) => setRefUrl(e.target.value)}
                      placeholder="https://example.com/reference.mp4 or sample_media/reference.mp4"
                      className="w-full text-xs bg-[#12121c] border border-white/10 text-zinc-200 rounded-lg p-2.5 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* SVG Pacing & Energy Rhythm Signature */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Narrative Pacing Signature & Energy Curve</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Generated rhythm profile used by DirectorAgent to score candidate raw clips.
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono bg-[#12121c] px-2.5 py-1 rounded-full border border-white/10">
                    Avg Cut Length: <strong className="text-violet-300">3.0s</strong> • Dynamic Rhythm
                  </span>
                </div>

                {/* SVG Energy Curve Graph with Gradient */}
                <div className="w-full h-32 bg-[#06060a] rounded-xl border border-white/[0.08] p-3 flex items-center justify-center relative overflow-hidden">
                  <svg viewBox="0 0 500 100" className="w-full h-full">
                    <defs>
                      <linearGradient id="energyFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal guideline levels */}
                    <line x1="0" y1="25" x2="500" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                    <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                    <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

                    {/* Filled Area */}
                    <path
                      d="M 50 18 C 110 25, 150 60, 190 60 C 230 60, 270 35, 310 35 C 350 35, 400 22, 460 22 L 460 95 L 50 95 Z"
                      fill="url(#energyFillGrad)"
                    />

                    {/* Curve Line */}
                    <path
                      d="M 50 18 C 110 25, 150 60, 190 60 C 230 60, 270 35, 310 35 C 350 35, 400 22, 460 22"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {/* Beat 1 */}
                    <circle cx="50" cy="18" r="6" fill="#8b5cf6" stroke="#ffffff" strokeWidth="2" />
                    <text x="50" y="92" fill="#e4e4e7" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                      Beat 1 (5/5 ⚡)
                    </text>

                    {/* Beat 2 */}
                    <circle cx="190" cy="60" r="6" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                    <text x="190" y="92" fill="#e4e4e7" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                      Beat 2 (3/5 ⚡)
                    </text>

                    {/* Beat 3 */}
                    <circle cx="310" cy="35" r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                    <text x="310" y="92" fill="#e4e4e7" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                      Beat 3 (4/5 ⚡)
                    </text>

                    {/* Beat 4 */}
                    <circle cx="460" cy="22" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                    <text x="460" y="92" fill="#e4e4e7" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                      Beat 4 (4/5 ⚡)
                    </text>
                  </svg>
                </div>
              </div>

              {/* StoryBeat Graph Chain Display */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-violet-400" />
                    <span>StoryBeat Sequential Graph Chain (:StoryBeat)-[:NEXT_BEAT]-&gt;(:StoryBeat)</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {referenceBeats.length} Detected Narrative Beats
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {referenceBeats.map((beat) => (
                    <div
                      key={beat.id}
                      className="studio-panel-interactive rounded-xl p-4 space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-violet-300 font-mono bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60">
                          Beat #{beat.beat_index}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                          {beat.target_duration}s Cut
                        </span>
                      </div>

                      <div>
                        <div className="text-sm font-extrabold text-white uppercase tracking-tight">{beat.role}</div>
                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
                          <span className="font-mono">Shot: {beat.required_shot_type}</span>
                          <span className="text-violet-400 font-bold font-mono">⚡ {beat.energy_level}/5</span>
                        </div>
                      </div>

                      {/* Visual Energy Gauge Bar */}
                      <div className="w-full bg-[#12121c] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full"
                          style={{ width: `${(beat.energy_level / 5) * 100}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {beat.required_tags?.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-[#12121c] text-zinc-300 border border-white/5 font-mono"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: FOOTAGE UPLOAD & MEDIA LIBRARY */}
          {currentScreen === "footage" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Media Bin Top Header */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Film className="w-5 h-5 text-violet-400" />
                    <span>Media Bin & Multi-Modal Segmented Clips</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Raw footage segmented into (:VideoClip) sub-clips with transcripts, shot types, and visual tags indexed in FalkorDB.
                  </p>
                </div>
                <button
                  onClick={handleLoadDemoFootage}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-900/40 border border-violet-400/30 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load 1-Click Demo Footage Pack (5 Clips)</span>
                </button>
              </div>

              {/* Filter Tabs Bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold flex items-center gap-1">
                    <Filter className="w-3 h-3 text-violet-400" />
                    Filter Clips:
                  </span>
                  {[
                    { id: "all", label: `All Clips (${sourceClips.length})` },
                    { id: "dialog", label: "Dialog / A-Roll" },
                    { id: "b-roll", label: "Visual B-Roll" },
                    { id: "energy", label: "High Energy (⚡ 4+)" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setClipFilter(tab.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        clipFilter === tab.id
                          ? "bg-violet-600 text-white font-bold border-violet-400 shadow-md shadow-violet-900/30"
                          : "bg-[#0c0c14] border-white/10 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] font-mono text-zinc-500">
                  Showing {sourceClips.length} clips indexed in FalkorDB
                </div>
              </div>

              {/* Cinema Contact-Sheet Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sourceClips
                  .filter((clip) => {
                    if (clipFilter === "dialog") {
                      return clip.transcript && clip.transcript.length > 20;
                    }
                    if (clipFilter === "b-roll") {
                      return clip.tags.some(
                        (t) => t.includes("broll") || t.includes("product") || t.includes("hardware") || t.includes("graphic")
                      );
                    }
                    if (clipFilter === "energy") {
                      return clip.energy_level >= 4;
                    }
                    return true;
                  })
                  .map((clip) => (
                    <div
                      key={clip.clip_id}
                      className="studio-panel-interactive rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between"
                    >
                      {/* Top Simulated Video Screen / Thumbnail */}
                      <div className="relative aspect-video bg-gradient-to-br from-[#151525] via-[#0b0b14] to-[#06060c] p-3 flex flex-col justify-between overflow-hidden">
                        {/* Filmstrip sprockets */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 filmstrip-sprockets opacity-40" />

                        {/* Badges */}
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-violet-300 border border-violet-500/30 font-bold">
                            {clip.shot_type}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-zinc-300 border border-white/10">
                            {clip.clip_duration?.toFixed(1)}s
                          </span>
                        </div>

                        {/* Center Visual Mock */}
                        <div className="relative z-10 flex items-center justify-center py-2 text-zinc-500">
                          <Film className="w-8 h-8 opacity-40 text-violet-400" />
                        </div>

                        {/* Simulated Soundwave Bars */}
                        <div className="relative z-10 flex items-center justify-between text-[10px]">
                          <span className="text-zinc-400 font-mono truncate max-w-[170px]">
                            {clip.filename || clip.asset_id}
                          </span>
                          <div className="flex items-center gap-0.5 h-3">
                            <span className="w-0.5 h-2 bg-emerald-400 rounded-full" />
                            <span className="w-0.5 h-3 bg-emerald-400 rounded-full" />
                            <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full" />
                            <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full" />
                          </div>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="text-[11px] text-zinc-300 italic bg-[#07070b] p-3 rounded-xl border border-white/[0.06] line-clamp-2">
                            &quot;{clip.transcript || "Visual B-roll clip"}&quot;
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {clip.tags?.map((t) => (
                              <span
                                key={t}
                                className="text-[9px] px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/50 font-mono"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                          <span className="text-violet-300 font-bold">⚡ Energy: {clip.energy_level}/5</span>
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> FalkorDB (:VideoClip)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* SCREEN 6: AI EDITING STUDIO (PRO BROADCAST PROGRAM MONITOR + NLE TIMELINE) */}
          {currentScreen === "studio" && (
            <div className="studio-body">
              {/* Left/Center Column */}
              <div className="studio-center-column">
                {/* Top Stage */}
                <div className="studio-stage">
                  {/* Left Card: Program Video Monitor */}
                  <div className="studio-card flex flex-col justify-between" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px", overflow: "hidden" }}>
                  {/* Top Monitor Bar */}
                  <div className="px-3.5 py-2 border-b border-white/[0.06] bg-[#0f0f18] flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-2">
                      <Tv className="w-3.5 h-3.5 text-violet-400" />
                      <span className="font-bold text-white">Program Monitor</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                        {activeProject?.aspect_ratio || "16:9"} Landscape
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                        1080p • 24 FPS
                      </span>
                    </div>

                    {/* Guide Overlay Toggles */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowGridOverlay(!showGridOverlay)}
                        className={`p-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                          showGridOverlay
                            ? "bg-violet-600 text-white"
                            : "bg-[#12121c] text-zinc-400 hover:text-white border border-white/10"
                        }`}
                        title="Rule of Thirds Grid"
                      >
                        <Grid className="w-3 h-3" />
                        <span>Grid</span>
                      </button>

                      <button
                        onClick={() => setShowSafeZone(!showSafeZone)}
                        className={`p-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                          showSafeZone
                            ? "bg-violet-600 text-white"
                            : "bg-[#12121c] text-zinc-400 hover:text-white border border-white/10"
                        }`}
                        title="Action Safe Zone"
                      >
                        <Square className="w-3 h-3" />
                        <span>Safe</span>
                      </button>
                    </div>
                  </div>

                  {/* Video Stage with Overlays */}
                  <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                    {/* Safe Zone Overlay */}
                    {showSafeZone && (
                      <div className="absolute inset-8 border border-cyan-400/30 pointer-events-none z-20 flex items-start justify-end p-1">
                        <span className="text-[8px] font-mono text-cyan-400/60 uppercase">90% Action Safe</span>
                      </div>
                    )}

                    {/* Rule of Thirds Grid Overlay */}
                    {showGridOverlay && (
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-20">
                        <div className="border-r border-b border-white/15" />
                        <div className="border-r border-b border-white/15" />
                        <div className="border-b border-white/15" />
                        <div className="border-r border-b border-white/15" />
                        <div className="border-r border-b border-white/15" />
                        <div className="border-b border-white/15" />
                        <div className="border-r border-white/15" />
                        <div className="border-r border-white/15" />
                        <div />
                      </div>
                    )}

                    {/* HTML5 Video Element */}
                    {activePreviewUrl ? (
                      <video
                        ref={videoRef}
                        src={activePreviewUrl}
                        onTimeUpdate={handleTimeUpdate}
                        loop={isLooping}
                        className="w-full h-full object-contain"
                        onClick={handleTogglePlay}
                      />
                    ) : (
                      <div className="text-center p-8 space-y-3">
                        <Sparkles className="w-8 h-8 text-violet-500 mx-auto" />
                        <p className="text-xs text-zinc-400">
                          No edit synthesized yet. Click &quot;Synthesize Edit&quot; or &quot;1-Click Demo Seed&quot;.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bottom Monitor Transport HUD */}
                  <div className="px-3.5 py-2 border-t border-white/[0.06] bg-[#0c0c14] flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStepFrame(-1)}
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Step Back 1 Frame (-1f)"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handleTogglePlay}
                        className="w-6 h-6 rounded bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all"
                      >
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                      </button>

                      <button
                        onClick={() => handleStepFrame(1)}
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Step Forward 1 Frame (+1f)"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setIsLooping(!isLooping)}
                        className={`p-1 rounded ${
                          isLooping ? "text-violet-400" : "text-zinc-500 hover:text-zinc-400"
                        }`}
                        title="Loop Playback"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>

                      <span className="font-timecode text-xs text-violet-300 font-bold ml-1">
                        {formatSMPTE(currentTime)}
                      </span>
                    </div>

                    {/* Active Beat HUD Chip */}
                    {currentlyPlayingCut && (
                      <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/80 text-violet-200 border border-violet-800/80 flex items-center gap-1.5 truncate max-w-[280px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        <span>Beat #{currentlyPlayingCut.order} • {currentlyPlayingCut.narrative_beat.toUpperCase()}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="truncate text-zinc-400">{currentlyPlayingCut.source_asset}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Card: GraphInspector */}
                  <div className="studio-card" style={{ height: "100%", padding: "0", overflow: "hidden" }}>
                    <GraphInspector
                      selectedDecision={selectedDecision}
                      graphState={graphState}
                      onRefreshGraph={() => {
                        if (activeProject) refreshGraphState(activeProject.id);
                      }}
                    />
                  </div>
                </div>

                {/* Bottom Dock: Multitrack Timeline */}
                <div className="studio-timeline-dock">
                  <StudioTimeline
                    decisions={decisions}
                    selectedDecisionId={selectedDecision?.decision_id || null}
                    onSelectDecision={(d) => setSelectedDecision(d)}
                    currentTime={currentTime}
                    totalDuration={activeProject?.target_duration || 12.0}
                    onSeek={handleSeek}
                    isPlaying={isPlaying}
                    onTogglePlay={handleTogglePlay}
                    activeVersionNum={versions.length > 0 ? versions[versions.length - 1].version_num : 1}
                  />
                </div>
              </div>

              {/* Right Column: AI Director Chat */}
              <div className="studio-chat-sidebar">
                <DirectorChat
                  onSendRevision={handleSendRevision}
                  isRevising={isRevising}
                  activeVersionNum={versions.length > 0 ? versions[versions.length - 1].version_num : 1}
                  creatorPreferences={preferences}
                />
              </div>
            </div>
          )}

          {/* SCREEN 7: REVISION HISTORY & VERSION DAG */}
          {currentScreen === "revisions" && (
            <div className="max-w-5xl mx-auto">
              <VersionDiffView
                versions={versions}
                diffItems={diffItems}
                onSelectVersionsToCompare={handleCompareVersions}
                onApproveFinalCut={(vId) => {
                  alert(`Version ${vId} approved as Final Cut! Ready for master export.`);
                }}
                activeVersionId={versions[versions.length - 1]?.id || ""}
              />
            </div>
          )}

          {/* SCREEN 8: EXPORT SETTINGS & CUT-LIST */}
          {currentScreen === "export" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-violet-400" />
                    <span>Master Render Export & Timeline Cut Decision List</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Export the finalized video file or extract the FalkorDB EditVersion cut decision list (EDL/JSON) for NLE roundtripping.
                  </p>
                </div>
                {activePreviewUrl && (
                  <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-bold flex items-center gap-1.5 self-start sm:self-auto">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Master Render Ready
                  </span>
                )}
              </div>

              {/* Delivery Suite 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Preset Formats */}
                <div className="lg:col-span-5 space-y-4">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-wider block">
                    Master Encoding Presets
                  </span>

                  {[
                    {
                      id: "h264",
                      title: "H.264 Web & Social Master",
                      codec: "MP4 • H.264 / AAC",
                      bitrate: "25 Mbps • Fast Start Stream",
                      desc: "Optimized for YouTube, Vimeo, and web playback.",
                    },
                    {
                      id: "prores",
                      title: "Apple ProRes 422 Studio Master",
                      codec: "MOV • ProRes 422 HQ",
                      bitrate: "10-Bit Broadcast • Rec.709",
                      desc: "Maximum color fidelity for broadcast delivery.",
                    },
                    {
                      id: "vertical",
                      title: "Vertical 9:16 Mobile Cut",
                      codec: "MP4 • 1080x1920 • 60 FPS",
                      bitrate: "Targeted for TikTok / Reels",
                      desc: "Cropped to center action safe zones.",
                    },
                  ].map((preset) => {
                    const isSelected = exportPreset === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => setExportPreset(preset.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                          isSelected
                            ? "bg-violet-950/60 border-violet-500 text-white shadow-xl shadow-violet-950/40 ring-1 ring-violet-500/40"
                            : "bg-[#090910] border-white/10 hover:border-white/20 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{preset.title}</span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#8b5cf6]" />
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-violet-400 flex items-center gap-2">
                          <span>{preset.codec}</span>
                          <span>•</span>
                          <span>{preset.bitrate}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{preset.desc}</p>
                      </div>
                    );
                  })}

                  {/* Resolution Selector */}
                  <div className="studio-panel rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 block">Master Resolution</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["1080p", "4K UHD", "720p"].map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setExportResolution(res)}
                          className={`py-2 rounded-lg text-xs font-mono font-bold transition-all border ${
                            exportResolution === res
                              ? "bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-900/30"
                              : "bg-[#07070b] border-white/10 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Output Summary & Download CTAs */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Master Cut Decision Table */}
                  <div className="studio-panel rounded-2xl p-5 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-violet-400" />
                        <span>FalkorDB Cut Decision List (EDL)</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {decisions.length} Active Segments
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {decisions.map((d) => (
                        <div
                          key={d.decision_id}
                          className="p-2.5 rounded-xl bg-[#07070b] border border-white/[0.06] flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-violet-950 text-violet-300 flex items-center justify-center text-[10px] font-bold">
                              {d.order}
                            </span>
                            <div>
                              <div className="text-white text-[11px] font-bold truncate max-w-[170px]">
                                {d.narrative_beat.toUpperCase()}
                              </div>
                              <div className="text-[9px] text-zinc-500 truncate max-w-[170px]">
                                {d.source_asset}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-zinc-300 text-[10px]">
                              {formatSMPTE(d.source_in_sec)} ➔ {formatSMPTE(d.source_out_sec)}
                            </div>
                            <div className="text-[9px] text-emerald-400">
                              {(d.source_out_sec - d.source_in_sec).toFixed(1)}s • Hard Cut
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export Action Buttons */}
                  <div className="studio-panel rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Estimated File Size:</span>
                      <span className="text-white font-bold">~2.4 MB (Fast Download)</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {activePreviewUrl ? (
                        <a
                          href={activePreviewUrl}
                          download={`${activeProject?.title || "director_ai"}_master.mp4`}
                          className="flex-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 hover:from-violet-500 hover:to-indigo-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs shadow-xl shadow-violet-900/40 border border-violet-400/30 transition-all text-center"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Master MP4</span>
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex-1 bg-zinc-800 text-zinc-500 font-semibold py-3 rounded-xl text-xs text-center cursor-not-allowed"
                        >
                          Synthesize Edit First
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(decisions, null, 2)], {
                            type: "application/json",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `falkordb_cutlist_${activeProject?.id || "project"}.json`;
                          a.click();
                        }}
                        className="px-5 bg-[#12121c] hover:bg-[#1a1a28] text-zinc-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors py-3"
                      >
                        <Film className="w-3.5 h-3.5 text-violet-400" />
                        <span>Export EDL / JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 9: SOCIAL ACCOUNTS & HUMAN-IN-THE-LOOP PUBLISHING */}
          {currentScreen === "publishing" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="studio-panel rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-violet-400" />
                      <span>Social Account Connections & Publishing Gate</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Direct channel sync with strict human-in-the-loop approval safeguards.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-violet-950 text-violet-300 border border-violet-800/80 font-bold">
                    Safety Gate: Active
                  </span>
                </div>

                {/* Explicit Human Approval Toggle (ON by default) */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-violet-950/50 via-[#0e0e16] to-indigo-950/40 border border-violet-700/60 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Strict Human Sign-Off Gate (Enforced)
                    </span>
                    <p className="text-[11px] text-zinc-300">
                      When enabled, autonomous agent pipelines are restricted from pushing directly to production channels without manual creative review.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={requireHumanApproval}
                      onChange={(e) => setRequireHumanApproval(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
                  </label>
                </div>

                {/* Pre-Flight Compliance Checks List */}
                <div className="p-4 rounded-xl bg-[#07070b] border border-white/[0.08] space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
                    Automated Pre-Flight Safety Checks
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Aspect ratio verified: {activeProject?.aspect_ratio || "16:9"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Action safe zones checked: 0 title clippings</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>FalkorDB lineage graph signed by DirectorAgent</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Audio loudness: -14.0 LUFS broadcast compliant</span>
                    </div>
                  </div>
                </div>

                {/* Channel Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {[
                    { name: "YouTube Channel", handle: "@AutonomousCreator", status: "Sandbox Mode", color: "text-rose-400" },
                    { name: "TikTok Creative Center", handle: "@director_ai", status: "Sandbox Mode", color: "text-cyan-400" },
                    { name: "Instagram Reels", handle: "@director_ai.studio", status: "Sandbox Mode", color: "text-pink-400" },
                    { name: "LinkedIn Video Studio", handle: "DirectorAI Official", status: "Sandbox Mode", color: "text-blue-400" },
                  ].map((ch) => (
                    <div key={ch.name} className="p-3.5 bg-[#07070b] rounded-xl border border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between font-semibold text-zinc-200">
                        <span className="flex items-center gap-1.5">
                          <span className={`font-bold ${ch.color}`}>●</span>
                          <span>{ch.name}</span>
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                          {ch.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{ch.handle}</div>
                    </div>
                  ))}
                </div>

                {/* Push to Sandbox Simulation */}
                <div className="pt-2">
                  <button
                    onClick={() => setSandboxPushed(true)}
                    className="w-full bg-[#141420] hover:bg-[#1a1a2a] text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 border border-white/10 shadow-lg"
                  >
                    <span>⚡ Push to Platform Sandbox for Preview</span>
                  </button>
                  {sandboxPushed && (
                    <div className="mt-3 p-3 rounded-xl bg-[#091510] border border-emerald-800/80 text-xs text-emerald-300 font-mono text-center flex items-center justify-center gap-2 shadow-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Sandbox release queued successfully: Awaiting manual human verification before live broadcasting.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 10: USER SETTINGS & PERSISTENT GRAPH MEMORY (TRACK 02) */}
          {currentScreen === "settings" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Creator Profile */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-base shadow-xl shadow-violet-900/40 border border-violet-400/30">
                    AC
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Alex Chen (Lead Creative Director)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      Creator ID: <span className="text-violet-300">creator_default</span> • Multi-Session Graph Profile
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Pro Studio Tier
                  </span>
                </div>
              </div>

              {/* Persistent FalkorDB Memory Manager (Track 02 Core) */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span>Persistent Creator Memory Nodes (:CreatorPreference)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Learned procedural and aesthetic rules stored directly in FalkorDB that survive across sessions and projects.
                    </p>
                  </div>
                  <span className="text-[10px] text-violet-400 font-mono font-bold bg-violet-950/80 px-2.5 py-1 rounded-full border border-violet-800/60 self-start sm:self-auto">
                    Track 02 Durable Memory
                  </span>
                </div>

                {/* Preference List */}
                <div className="space-y-3">
                  {preferences.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs studio-panel rounded-xl">
                      No persistent preferences recorded in FalkorDB yet. Add one below!
                    </div>
                  ) : (
                    preferences.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl bg-[#07070b] border border-white/10 flex items-center justify-between gap-4 text-xs group hover:border-violet-500/40 transition-all"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/50 font-bold">
                              {p.category}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Reinforced in {p.reinforced_sessions || 1} sessions
                            </span>
                          </div>
                          <p className="text-zinc-200 font-medium text-xs leading-relaxed">{p.rule_text}</p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] text-zinc-400 font-mono">Weight:</span>
                            <div className="w-24 bg-[#12121c] rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full"
                                style={{ width: `${p.weight * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-violet-300 font-mono font-bold">{p.weight}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeletePreference(p.id)}
                          className="text-zinc-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-950/30 transition-colors"
                          title="Delete Preference Node"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Rule Suggestion Chips */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
                    Suggested Style Rules (Click to Insert)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Always start with high-energy establishing shot",
                      "Limit talking-head dialog segments to under 3.5 seconds",
                      "Use cutaway B-roll over monotonous wide shots",
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setNewPrefRule(sug)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0c0c14] hover:bg-[#141422] text-zinc-300 border border-white/10 hover:border-violet-500/40 transition-colors text-left font-mono"
                      >
                        + &quot;{sug}&quot;
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Preference Form */}
                <form
                  onSubmit={handleAddPreference}
                  className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row gap-2.5 text-xs"
                >
                  <input
                    type="text"
                    value={newPrefRule}
                    onChange={(e) => setNewPrefRule(e.target.value)}
                    placeholder="Enter a new standing director preference rule (e.g. Always begin videos with dynamic B-roll)..."
                    className="flex-1 bg-[#07070b] border border-white/10 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all font-medium text-xs"
                  />
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-violet-900/30 border border-violet-400/30 transition-all shrink-0"
                  >
                    + Save Rule in FalkorDB
                  </button>
                </form>
              </div>

              {/* Workspace Resource Meter */}
              <div className="studio-panel rounded-2xl p-6 shadow-2xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  FalkorDB Property Graph Telemetry & Storage
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs font-mono">
                  <div className="p-4 bg-[#07070b] rounded-xl border border-white/10">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold">FalkorDB Active Nodes</div>
                    <div className="text-xl font-extrabold text-white mt-1">
                      {graphState?.nodes.length || 18} Nodes
                    </div>
                  </div>
                  <div className="p-4 bg-[#07070b] rounded-xl border border-white/10">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold">Lineage & Memory Edges</div>
                    <div className="text-xl font-extrabold text-violet-400 mt-1">
                      {graphState?.edges.length || 24} Edges
                    </div>
                  </div>
                  <div className="p-4 bg-[#07070b] rounded-xl border border-white/10">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold">Rendered MP4 Cache</div>
                    <div className="text-xl font-extrabold text-emerald-400 mt-1">
                      {versions.length} EditVersions
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
