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
  Tv
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
    <div className="flex h-screen bg-[#050508] text-zinc-100 overflow-hidden font-sans">
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
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-studio-grid">
        {/* Top Program Header */}
        <header className="h-14 border-b border-white/[0.06] bg-[#09090f]/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]" />
              {activeProject ? activeProject.title : "Director.AI Pro Creative Studio"}
            </h2>
            {activeProject && (
              <>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#12121c] text-zinc-300 font-mono border border-white/10">
                  {activeProject.category}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 font-mono border border-violet-800/80">
                  {activeProject.aspect_ratio} Cinema
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Workflow Stepper */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400">
              <span
                onClick={() => setCurrentScreen("reference")}
                className={`cursor-pointer px-2 py-1 rounded transition-colors ${
                  currentScreen === "reference" ? "text-violet-300 font-bold bg-violet-950" : "hover:text-zinc-200"
                }`}
              >
                1. Ref Beats
              </span>
              <span>➔</span>
              <span
                onClick={() => setCurrentScreen("footage")}
                className={`cursor-pointer px-2 py-1 rounded transition-colors ${
                  currentScreen === "footage" ? "text-violet-300 font-bold bg-violet-950" : "hover:text-zinc-200"
                }`}
              >
                2. Footage
              </span>
              <span>➔</span>
              <span
                onClick={() => setCurrentScreen("studio")}
                className={`cursor-pointer px-2 py-1 rounded transition-colors ${
                  currentScreen === "studio" ? "text-violet-300 font-bold bg-violet-950" : "hover:text-zinc-200"
                }`}
              >
                3. NLE Studio
              </span>
              <span>➔</span>
              <span
                onClick={() => setCurrentScreen("revisions")}
                className={`cursor-pointer px-2 py-1 rounded transition-colors ${
                  currentScreen === "revisions" ? "text-violet-300 font-bold bg-violet-950" : "hover:text-zinc-200"
                }`}
              >
                4. A/B Diff
              </span>
            </div>

            {/* Synthesize Edit Button */}
            {activeProject && (
              <button
                onClick={handleGeneratePlan}
                disabled={isLoading}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-violet-900/40 border border-violet-400/30 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoading ? "Synthesizing..." : "Synthesize Edit (v1)"}</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Studio Views Router */}
        <div className="p-6 flex-1">
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
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Projects Library</h2>
                  <p className="text-xs text-zinc-400">
                    All video projects stored as (:Project) nodes in FalkorDB.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentScreen("wizard")}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ New Project</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="studio-panel-interactive rounded-xl p-5 space-y-4 shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/80">
                        {p.category}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{p.id}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">{p.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2 font-mono">
                        <span>Ratio: {p.aspect_ratio}</span>
                        <span>•</span>
                        <span>{p.target_duration}s Target</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {p.version_count || 1} EditVersions
                      </span>
                      <button
                        onClick={() => {
                          loadProjectDetails(p);
                          setCurrentScreen("studio");
                        }}
                        className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1"
                      >
                        <span>Open Studio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
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

              <form onSubmit={handleCreateProjectSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-zinc-300 block mb-1">Project Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Autonomous Agent Video Studio — Product Reveal"
                    required
                    className="w-full bg-[#07070b] border border-white/10 text-zinc-200 rounded-lg p-2.5 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-zinc-300 block mb-1">Production Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-[#07070b] border border-white/10 text-zinc-200 rounded-lg p-2.5 focus:border-violet-500"
                    >
                      <option>YouTube Long-Form (16:9)</option>
                      <option>Podcast Highlight</option>
                      <option>Educational Course</option>
                      <option>Documentary Short</option>
                      <option>Product Reveal</option>
                      <option>Vertical Shorts / Reels (9:16)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-300 block mb-1">Aspect Ratio</label>
                    <select
                      value={newAspectRatio}
                      onChange={(e) => setNewAspectRatio(e.target.value)}
                      className="w-full bg-[#07070b] border border-white/10 text-zinc-200 rounded-lg p-2.5 focus:border-violet-500"
                    >
                      <option value="16:9">16:9 Landscape</option>
                      <option value="9:16">9:16 Vertical</option>
                      <option value="1:1">1:1 Square</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-zinc-300 block mb-1">Target Duration (sec)</label>
                    <input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(parseFloat(e.target.value))}
                      min={6}
                      max={120}
                      className="w-full bg-[#07070b] border border-white/10 text-zinc-200 rounded-lg p-2.5 focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-300 block mb-1">Audio Mood</label>
                    <select
                      value={newMood}
                      onChange={(e) => setNewMood(e.target.value)}
                      className="w-full bg-[#07070b] border border-white/10 text-zinc-200 rounded-lg p-2.5 focus:border-violet-500"
                    >
                      <option value="upbeat">Upbeat & Inspiring</option>
                      <option value="dramatic">Dramatic & Cinematic</option>
                      <option value="conversational">Conversational</option>
                      <option value="calm">Calm & Minimal</option>
                    </select>
                  </div>
                </div>

                {/* Persistent Memory Status */}
                <div className="p-3 rounded-lg bg-[#0e0e16] border border-white/[0.06] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-violet-400 flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5" /> Track 02 Memory Active
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    {preferences.length > 0
                      ? `${preferences.length} standing CreatorPreferences stored in FalkorDB will automatically influence clip selection for this project.`
                      : "No prior style rules recorded. You can state standing preferences in the assistant anytime."}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors"
                >
                  {isLoading ? "Writing Project Node to FalkorDB..." : "Create Project & Continue ➔"}
                </button>
              </form>
            </div>
          )}

          {/* SCREEN 4: REFERENCE VIDEO IMPORT & ANALYSIS */}
          {currentScreen === "reference" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="studio-panel rounded-xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <FileVideo className="w-5 h-5 text-violet-400" />
                      <span>Reference Video Import & Narrative Decomposition</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Extract cut pacing, average cut duration, and narrative rhythm into a (:StoryBeat) chain in FalkorDB.
                    </p>
                  </div>
                  <button
                    onClick={handleAnalyzeReference}
                    disabled={isLoading}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md transition-all"
                  >
                    {isLoading ? "Analyzing..." : "Run PySceneDetect & Graph Decomposition"}
                  </button>
                </div>

                {/* Clean Fallback URL Card */}
                <div className="p-3 rounded-lg bg-[#0e0e16] border border-white/[0.06] text-xs text-zinc-400 flex items-center justify-between">
                  <span>
                    💡 You can upload an MP4 or use the pre-loaded reference video.
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    Local MP4 / Direct Stream
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[#07070b] border border-white/10 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 block">Upload Reference MP4</label>
                    <input
                      type="file"
                      accept="video/mp4,video/*"
                      onChange={(e) => setRefFile(e.target.files?.[0] || null)}
                      className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white"
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-[#07070b] border border-white/10 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 block">Reference Video URL</label>
                    <input
                      type="text"
                      value={refUrl}
                      onChange={(e) => setRefUrl(e.target.value)}
                      placeholder="https://example.com/sample_reference.mp4"
                      className="w-full text-xs bg-[#12121c] border border-white/10 text-zinc-200 rounded p-2 focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* SVG Pacing & Energy Rhythm Chart */}
              <div className="studio-panel rounded-xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Reference Pacing Signature & Energy Curve</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Avg Cut Length: 3.0s • High Energy Rapid Cut
                  </span>
                </div>

                {/* SVG Energy Curve Graph */}
                <div className="w-full h-24 bg-[#06060a] rounded-lg border border-white/[0.08] p-2 flex items-center justify-center">
                  <svg viewBox="0 0 500 80" className="w-full h-full">
                    {/* Grid lines */}
                    <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

                    {/* Energy Curve */}
                    <path
                      d="M 50 15 C 100 20, 150 50, 190 50 C 230 50, 270 30, 310 30 C 350 30, 400 20, 460 20"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                      fill="none"
                    />

                    {/* Beat Dots */}
                    <circle cx="50" cy="15" r="4" fill="#8b5cf6" />
                    <text x="50" y="75" fill="#a1a1aa" fontSize="8" textAnchor="middle" fontFamily="monospace">Beat 1 (5/5)</text>

                    <circle cx="190" cy="50" r="4" fill="#06b6d4" />
                    <text x="190" y="75" fill="#a1a1aa" fontSize="8" textAnchor="middle" fontFamily="monospace">Beat 2 (3/5)</text>

                    <circle cx="310" cy="30" r="4" fill="#10b981" />
                    <text x="310" y="75" fill="#a1a1aa" fontSize="8" textAnchor="middle" fontFamily="monospace">Beat 3 (4/5)</text>

                    <circle cx="460" cy="20" r="4" fill="#f59e0b" />
                    <text x="460" y="75" fill="#a1a1aa" fontSize="8" textAnchor="middle" fontFamily="monospace">Beat 4 (4/5)</text>
                  </svg>
                </div>
              </div>

              {/* StoryBeat Graph Chain Display */}
              <div className="studio-panel rounded-xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-violet-400" />
                    <span>StoryBeat Sequential Chain (:StoryBeat)-[:NEXT_BEAT]-&gt;(:StoryBeat)</span>
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {referenceBeats.length} Detected Narrative Beats
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {referenceBeats.map((beat) => (
                    <div
                      key={beat.id}
                      className="p-3 rounded-lg bg-[#07070b] border border-white/10 space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-violet-300">
                          Beat #{beat.beat_index}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">
                          {beat.target_duration}s
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white uppercase">{beat.role}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                        <span>Shot: {beat.required_shot_type}</span>
                        <span className="text-violet-400">⚡ {beat.energy_level}/5</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {beat.required_tags?.map((t) => (
                          <span
                            key={t}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-[#12121c] text-zinc-300 border border-white/5"
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
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="studio-panel rounded-xl p-5 shadow-2xl flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Film className="w-5 h-5 text-violet-400" />
                    <span>Source Footage & Segmented Clip Index</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Raw clips are segmented into (:VideoClip) sub-clips with multimodal tags in FalkorDB.
                  </p>
                </div>
                <button
                  onClick={handleLoadDemoFootage}
                  disabled={isLoading}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load 1-Click Demo Footage Pack (5 Clips)</span>
                </button>
              </div>

              {/* Cinema Contact-Sheet Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourceClips.map((clip) => (
                  <div
                    key={clip.clip_id}
                    className="studio-panel-interactive rounded-xl overflow-hidden shadow-xl"
                  >
                    {/* Top Filmstrip Header */}
                    <div className="h-2 filmstrip-sprockets opacity-40 bg-[#151522]" />

                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141420] text-violet-300 border border-violet-500/30">
                          {clip.shot_type}
                        </span>
                        <span className="font-mono text-zinc-400 text-[10px]">
                          {clip.clip_duration?.toFixed(1)}s
                        </span>
                      </div>

                      <div className="font-mono text-xs text-white truncate font-bold">
                        {clip.filename || clip.asset_id}
                      </div>

                      <div className="text-[11px] text-zinc-300 italic bg-[#07070b] p-2.5 rounded-lg border border-white/[0.05] line-clamp-2">
                        &quot;{clip.transcript || "Visual B-roll clip"}&quot;
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {clip.tags?.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-800/50"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span className="text-zinc-400">Energy: ⚡ {clip.energy_level}/5</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> FalkorDB Indexed
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
            <div className="flex flex-col h-[calc(100vh-100px)] gap-4 select-none">
              {/* Top Half: Broadcast Program Monitor + FalkorDB Graph Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[370px]">
                {/* Top Left: Pro Broadcast Program Monitor Frame */}
                <div className="lg:col-span-7 bg-[#0b0b12] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col shadow-2xl relative">
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

                {/* Top Right: Graph Traceability & Cypher Inspector */}
                <div className="lg:col-span-5 h-full">
                  <GraphInspector
                    selectedDecision={selectedDecision}
                    graphState={graphState}
                    onRefreshGraph={() => {
                      if (activeProject) refreshGraphState(activeProject.id);
                    }}
                  />
                </div>
              </div>

              {/* Bottom Half: Multitrack Timeline + Revision Assistant Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-64 shrink-0">
                {/* Timeline */}
                <div className="lg:col-span-8 h-full">
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

                {/* Assistant Sidebar */}
                <div className="lg:col-span-4 h-full">
                  <DirectorChat
                    onSendRevision={handleSendRevision}
                    isRevising={isRevising}
                    activeVersionNum={versions.length > 0 ? versions[versions.length - 1].version_num : 1}
                    creatorPreferences={preferences}
                  />
                </div>
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
            <div className="max-w-3xl mx-auto studio-panel rounded-xl p-6 shadow-2xl space-y-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-violet-400" />
                  <span>Master Render Export & Timeline Cut-List</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Download rendered MP4 preview or export the FalkorDB EditVersion cut decision list (EDL/JSON).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-[#07070b] rounded-lg border border-white/10 space-y-1">
                  <label className="text-zinc-400 font-semibold block">Master Resolution</label>
                  <select className="w-full bg-[#12121c] border border-white/10 rounded p-2 text-zinc-200">
                    <option>1080p Full HD (1920x1080)</option>
                    <option>4K Ultra HD (3840x2160)</option>
                    <option>720p Social Web (1280x720)</option>
                  </select>
                </div>

                <div className="p-3 bg-[#07070b] rounded-lg border border-white/10 space-y-1">
                  <label className="text-zinc-400 font-semibold block">Video Codec</label>
                  <select className="w-full bg-[#12121c] border border-white/10 rounded p-2 text-zinc-200">
                    <option>H.264 / AVC (Broad Compatibility)</option>
                    <option>Apple ProRes 422 (Broadcast)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {activePreviewUrl ? (
                  <a
                    href={activePreviewUrl}
                    download="director_ai_master.mp4"
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs shadow-md transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Master MP4</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex-1 bg-zinc-800 text-zinc-500 font-semibold py-2.5 rounded-lg text-xs"
                  >
                    No Render Available
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
                  className="px-4 bg-[#12121c] hover:bg-[#1a1a28] text-zinc-200 border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <span>Export Cut-List JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 9: SOCIAL ACCOUNTS & HUMAN-IN-THE-LOOP PUBLISHING */}
          {currentScreen === "publishing" && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="studio-panel rounded-xl p-6 shadow-2xl space-y-4">
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
                </div>

                {/* Explicit Human Approval Toggle (ON by default) */}
                <div className="p-4 rounded-lg bg-violet-950/40 border border-violet-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Require Human Approval Before Publishing
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      When enabled, autonomous agent runs will never push directly to production channels without manual verification.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireHumanApproval}
                    onChange={(e) => setRequireHumanApproval(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </div>

                {/* Channel Cards */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { name: "YouTube Channel", handle: "@AutonomousCreator", status: "Sandbox Mode" },
                    { name: "Vimeo Enterprise", handle: "DirectorAI Studio", status: "Sandbox Mode" },
                    { name: "LinkedIn Video", handle: "Product Showcase", status: "Sandbox Mode" },
                    { name: "Instagram Reels", handle: "@director_ai", status: "Sandbox Mode" },
                  ].map((ch) => (
                    <div key={ch.name} className="p-3 bg-[#07070b] rounded-lg border border-white/10 space-y-1">
                      <div className="flex items-center justify-between font-semibold text-zinc-200">
                        <span>{ch.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
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
                    className="w-full bg-[#141420] hover:bg-[#1a1a2a] text-white font-bold py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 border border-white/10"
                  >
                    <span>Push to Platform Sandbox for Preview</span>
                  </button>
                  {sandboxPushed && (
                    <div className="mt-2 p-2.5 rounded bg-[#091510] border border-emerald-800/80 text-[11px] text-emerald-300 font-mono text-center">
                      ✓ Sandbox Confirmation Queued: Human approval required before production release.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 10: USER SETTINGS & PERSISTENT GRAPH MEMORY (TRACK 02) */}
          {currentScreen === "settings" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Creator Profile */}
              <div className="studio-panel rounded-xl p-5 shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                    AC
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Alex Chen (Creator)</h3>
                    <p className="text-xs text-zinc-400 font-mono">Creator ID: creator_default • FalkorDB Multi-Session Profile</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                  Pro Studio Tier
                </span>
              </div>

              {/* Persistent FalkorDB Memory Manager (Track 02 Core) */}
              <div className="studio-panel rounded-xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span>Persistent Creator Memory Nodes (:CreatorPreference)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Learned procedural and aesthetic rules that survive across different projects and sessions.
                    </p>
                  </div>
                  <span className="text-[10px] text-violet-400 font-mono font-bold">
                    Track 02 Agent Memory
                  </span>
                </div>

                {/* Preference List */}
                <div className="space-y-2.5">
                  {preferences.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500 text-xs">
                      No persistent preferences recorded yet.
                    </div>
                  ) : (
                    preferences.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-lg bg-[#07070b] border border-white/10 flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/50">
                            {p.category}
                          </span>
                          <p className="text-zinc-200 font-medium">{p.rule_text}</p>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            Reinforced in {p.reinforced_sessions || 1} sessions • Weight: {p.weight}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeletePreference(p.id)}
                          className="text-zinc-600 hover:text-rose-400 p-1.5 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Preference Form */}
                <form
                  onSubmit={handleAddPreference}
                  className="pt-3 border-t border-white/[0.06] flex gap-2 text-xs"
                >
                  <input
                    type="text"
                    value={newPrefRule}
                    onChange={(e) => setNewPrefRule(e.target.value)}
                    placeholder="Add a new standing editing preference rule..."
                    className="flex-1 bg-[#07070b] border border-white/10 rounded p-2 text-zinc-200 focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2 rounded shadow-md transition-colors"
                  >
                    + Save Rule
                  </button>
                </form>
              </div>

              {/* Workspace Resource Meter */}
              <div className="studio-panel rounded-xl p-5 shadow-2xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Workspace Telemetry Meter
                </h4>
                <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-[#07070b] rounded border border-white/10">
                    <div className="text-zinc-500 text-[10px]">FalkorDB Nodes</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {graphState?.nodes.length || 18} Nodes
                    </div>
                  </div>
                  <div className="p-3 bg-[#07070b] rounded border border-white/10">
                    <div className="text-zinc-500 text-[10px]">Active Lineage Edges</div>
                    <div className="text-lg font-bold text-violet-400 mt-1">
                      {graphState?.edges.length || 24} Edges
                    </div>
                  </div>
                  <div className="p-3 bg-[#07070b] rounded border border-white/10">
                    <div className="text-zinc-500 text-[10px]">Rendered Video Cache</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {versions.length} MP4 Versions
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
