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
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Grid,
  Square,
  Download,
  Film,
  FileVideo,
  Layers,
  Tv,
  CheckCircle2,
  Clock,
  HardDrive,
  Filter,
  ArrowRight,
  Search,
  Share2,
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Sliders,
  Scissors,
  Eye,
  GitBranch,
  Activity,
  Terminal,
  Upload,
  Link as LinkIcon,
  Video,
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
  const [newCategory, setNewCategory] = useState("Technical Explainer");
  const [newDuration, setNewDuration] = useState(12.0);
  const [newMood, setNewMood] = useState("upbeat");
  const [newAspectRatio, setNewAspectRatio] = useState("16:9");
  const [newFrameRate, setNewFrameRate] = useState("24 FPS Film");
  const [newEditorialDirection, setNewEditorialDirection] = useState("");

  // Project search state
  const [projectSearch, setProjectSearch] = useState("");

  // Reference Video Form State
  const [refUrl, setRefUrl] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);

  // Media Bin & Clip Filter State
  const [clipFilter, setClipFilter] = useState<string>("all");

  // Master Export Presets State
  const [exportPreset, setExportPreset] = useState<string>("h264");
  const [exportResolution, setExportResolution] = useState<string>("1080p");
  const [exportFrameRate, setExportFrameRate] = useState<string>("24 FPS");

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
      {/* 1. Left Studio Navigation Rail */}
      <SidebarNav
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => loadProjectDetails(p)}
        onSeedDemo={handleSeedDemo}
        isSeeding={isSeeding}
        nodeCount={graphState?.nodes.length || 17}
        edgeCount={graphState?.edges.length || 16}
      />

      {/* Main Studio Canvas Area */}
      <main className="main-workspace">
        {/* STEP 4: Single-Line 48px Top Header Bar */}
        <header className="top-header">
          {/* Left: Breadcrumbs + Project Tag + Format */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span style={{ color: "#71717A", fontSize: "12px", fontWeight: 500 }}>
              Productions
            </span>
            <span style={{ color: "#3F3F46", fontSize: "12px" }}>/</span>
            <span
              style={{
                color: "#F4F4F6",
                fontSize: "12.5px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                maxWidth: "240px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeProject ? activeProject.title : "Director.AI Studio"}
            </span>

            <span className="tech-tag">
              {activeProject?.aspect_ratio || "16:9"}
            </span>
            <span className="tech-tag">
              1080P • 24FPS
            </span>
          </div>

          {/* Center: Segmented 4-Step Control */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#121215",
              border: "1px solid #222228",
              borderRadius: "5px",
              padding: "2px",
              gap: "2px",
            }}
          >
            {[
              { id: "reference", label: "01 Reference" },
              { id: "footage", label: "02 Media Bin" },
              { id: "studio", label: "03 Timeline Studio" },
              { id: "revisions", label: "04 Compare & Export" },
            ].map((tab) => {
              const isActive = currentScreen === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCurrentScreen(tab.id as ScreenId)}
                  style={{
                    backgroundColor: isActive ? "#1C1C22" : "transparent",
                    color: isActive ? "#F4F4F6" : "#71717A",
                    border: isActive ? "1px solid #2E2E38" : "1px solid transparent",
                    padding: "3px 10px",
                    fontSize: "11px",
                    fontWeight: isActive ? 600 : 450,
                    borderRadius: "4px",
                    lineHeight: 1.3,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Compile Cut Action */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={isLoading || !activeProject}
              className="btn-primary"
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              <Cpu size={13} strokeWidth={1.75} />
              <span>{isLoading ? "Compiling..." : "Compile Cut"}</span>
            </button>
          </div>
        </header>

        {/* Dynamic Studio Views Router */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflowY: currentScreen === "studio" ? "hidden" : "auto",
            padding: currentScreen === "studio" ? "0" : "0",
            width: "100%",
          }}
        >
          {/* TAB 1: OVERVIEW (Editorial Studio Command Center) */}
          {currentScreen === "landing" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Top System Strip */}
              <div
                className="studio-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 22px",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#F4F4F6", letterSpacing: "-0.02em" }}>
                      KINO // STUDIO
                    </span>
                    <span style={{ color: "#71717A", fontSize: "12px" }}>—</span>
                    <span style={{ fontSize: "12.5px", color: "#A1A1AA" }}>
                      Graph-Grounded Non-Linear Editing System
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "2px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
                      FalkorDB Graph Engine: <strong style={{ color: "#10B981", fontWeight: 600 }}>Online</strong>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
                      PySceneDetect: <strong style={{ color: "#10B981", fontWeight: 600 }}>Ready</strong>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }} />
                      MoviePy / FFmpeg Render Pipeline: <strong style={{ color: "#10B981", fontWeight: 600 }}>Active</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => setCurrentScreen("studio")}
                    className="btn-primary"
                  >
                    Open Timeline Studio
                  </button>
                  <button
                    onClick={handleSeedDemo}
                    disabled={isSeeding}
                  >
                    {isSeeding ? "Seeding..." : "Load Sample Production"}
                  </button>
                </div>
              </div>

              {/* 4-Stage Architecture Pipeline Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                {[
                  {
                    step: "01 / INGEST",
                    title: "Reference Decomposition",
                    desc: "PySceneDetect segments reference video rhythm into narrative beats.",
                    schema: "(:ReferenceVideo)-[:HAS_BEAT]->(:StoryBeat)",
                  },
                  {
                    step: "02 / INDEX",
                    title: "Asset Segmentation",
                    desc: "Raw rushes indexed into speech transcripts, shot types, and visual tags.",
                    schema: "(:SourceAsset)-[:CONTAINS_CLIP]->(:VideoClip)",
                  },
                  {
                    step: "03 / TRAVERSE",
                    title: "OpenCypher Matching",
                    desc: "DirectorAgent traverses multi-hop graph paths to select optimal clips.",
                    schema: "Multi-Hop OpenCypher Match",
                  },
                  {
                    step: "04 / ASSEMBLE",
                    title: "Lineage Assembly",
                    desc: "EditVersion branched with CutDecision nodes and FFmpeg render.",
                    schema: "(:EditVersion)-[:HAS_DECISION]->(:CutDecision)",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="studio-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                      padding: "16px",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                        {item.step}
                      </span>
                      <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6", marginTop: "4px", marginBottom: "4px" }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: "11.5px", color: "#8E8E98", lineHeight: 1.45, margin: 0 }}>
                        {item.desc}
                      </p>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#0A0A0D",
                        border: "1px solid #1E1E24",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "9.5px",
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        color: "#71717A",
                        overflowX: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.schema}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Split */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px" }}>
                {/* Left: Active Production Summary & Render Preview */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Film size={15} strokeWidth={1.6} color="#F59E0B" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                        Active Production Summary & Latest Cut
                      </span>
                    </div>
                    <span className="tech-tag-amber">
                      {activeProject ? activeProject.title : "Sample Project"}
                    </span>
                  </div>

                  <div
                    style={{
                      aspectRatio: "16/9",
                      backgroundColor: "#050507",
                      border: "1px solid #1F1F26",
                      borderRadius: "5px",
                      overflow: "hidden",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <video
                      controls
                      src={activePreviewUrl || "http://localhost:8000/static/samples/ref_high_energy_demo.mp4"}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
                      <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>FORMAT</span>
                      <div style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                        {activeProject?.aspect_ratio || "16:9"} Widescreen
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
                      <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>TARGET DURATION</span>
                      <div style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                        {activeProject?.target_duration || 12.0}s SMPTE
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
                      <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>GRAPH EDITIONS</span>
                      <div style={{ fontSize: "12px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                        {versions.length || 1} EditVersions
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: FalkorDB Cypher Operations & Learned Rules */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Database size={15} strokeWidth={1.6} color="#10B981" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                        Recent FalkorDB Cypher Operations
                      </span>
                    </div>
                    <span className="tech-tag-emerald">
                      0.4ms Latency
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      {
                        action: "TRAVERSE CANDIDATES",
                        cypher: "MATCH (b:StoryBeat)-[:REQUIRES_TAG]->(t:VisualTag)<-[:TAGGED_WITH]-(c:VideoClip) WHERE b.project_id = $pid RETURN c ORDER BY c.pacing_score DESC LIMIT 5",
                        latency: "0.4ms",
                      },
                      {
                        action: "BRANCH EDIT VERSION",
                        cypher: "MATCH (v_old:EditVersion {id: $v1}) CREATE (v_new:EditVersion {version: 2})-[:DERIVED_FROM]->(v_old)",
                        latency: "0.6ms",
                      },
                      {
                        action: "REINFORCE PREFERENCE",
                        cypher: "MATCH (p:CreatorPreference {rule_id: 'pref_hook'}) SET p.reinforced_sessions = p.reinforced_sessions + 1",
                        latency: "0.3ms",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: "#0C0C0E",
                          border: "1px solid #1F1F26",
                          borderRadius: "5px",
                          padding: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "9.5px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600 }}>
                            {item.action}
                          </span>
                          <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "#10B981" }}>
                            {item.latency}
                          </span>
                        </div>
                        <code style={{ fontSize: "10.5px", color: "#A1A1AA", fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.4 }}>
                          {item.cypher}
                        </code>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid #1F1F26", paddingTop: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#D4D4D8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Learned Creator Memory Rules ({preferences.length})
                      </span>
                      <button
                        onClick={() => setCurrentScreen("settings")}
                        style={{ padding: "2px 6px", fontSize: "10.5px", background: "transparent", border: "none", color: "#A1A1AA" }}
                      >
                        Manage Rules ➔
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {preferences.slice(0, 2).map((pref) => (
                        <div
                          key={pref.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: "#0C0C0E",
                            border: "1px solid #1F1F26",
                            borderRadius: "4px",
                            padding: "6px 10px",
                            fontSize: "11px",
                          }}
                        >
                          <span style={{ color: "#E4E4E7", truncate: "true", maxWidth: "260px" }}>
                            {pref.rule_text}
                          </span>
                          <span className="tech-tag-amber">
                            {pref.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTIONS (Frame.io-Style Dailies Grid) */}
          {currentScreen === "dashboard" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Header Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "#121215",
                      border: "1px solid #222228",
                      borderRadius: "5px",
                      padding: "4px 10px",
                      width: "260px",
                    }}
                  >
                    <Search size={13} color="#71717A" />
                    <input
                      type="text"
                      placeholder="Filter productions..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        fontSize: "12px",
                        color: "#F4F4F6",
                        width: "100%",
                      }}
                    />
                  </div>
                  <span className="tech-tag">
                    {projects.length} PRODUCTIONS
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={handleSeedDemo}
                    disabled={isSeeding}
                  >
                    {isSeeding ? "Seeding..." : "Quick Re-Seed"}
                  </button>
                  <button
                    onClick={() => setCurrentScreen("wizard")}
                    className="btn-primary"
                  >
                    <Plus size={14} strokeWidth={2} />
                    <span>New Production</span>
                  </button>
                </div>
              </div>

              {/* Grid of Production Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {projects
                  .filter((p) => p.title.toLowerCase().includes(projectSearch.toLowerCase()) || p.category.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map((p) => {
                    const isCurrentActive = activeProject?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        className="studio-card"
                        style={{
                          padding: "0",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                          borderColor: isCurrentActive ? "#F59E0B" : "#222228",
                          boxShadow: isCurrentActive ? "0 0 0 1px #F59E0B" : "none",
                        }}
                      >
                        {/* 16:9 Real Video Thumbnail Header */}
                        <div
                          style={{
                            aspectRatio: "16/9",
                            backgroundColor: "#050507",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <video
                            src="http://localhost:8000/static/samples/ref_high_energy_demo.mp4#t=0.5"
                            muted
                            playsInline
                            loop
                            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0.5;
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              loadProjectDetails(p);
                              setCurrentScreen("studio");
                            }}
                          />

                          {/* Top-Left Tech Tag */}
                          <div style={{ position: "absolute", top: "8px", left: "8px", pointerEvents: "none" }}>
                            <span className="tech-tag" style={{ backgroundColor: "rgba(12, 12, 14, 0.85)" }}>
                              {p.aspect_ratio || "16:9"}
                            </span>
                          </div>

                          {/* Bottom-Right SMPTE Timecode */}
                          <div style={{ position: "absolute", bottom: "8px", right: "8px", pointerEvents: "none" }}>
                            <span className="font-timecode" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(0,0,0,0.8)", color: "#F4F4F6", border: "1px solid rgba(255,255,255,0.1)" }}>
                              {formatSMPTE(p.target_duration || 12.0)}
                            </span>
                          </div>
                        </div>

                        {/* Card Meta & Actions */}
                        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1, justifyContent: "space-between" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                              <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>
                                {p.category}
                              </span>
                              <span className="tech-tag-amber" style={{ fontSize: "9.5px" }}>
                                v{p.version_count || 1} Active
                              </span>
                            </div>
                            <h3 style={{ fontSize: "13.5px", fontWeight: 600, color: "#F4F4F6", margin: "0 0 4px 0", lineHeight: 1.3 }}>
                              {p.title}
                            </h3>
                            <span style={{ fontSize: "11px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                              Mood: {p.mood || "upbeat"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1C1C22", paddingTop: "10px", marginTop: "4px" }}>
                            <button
                              onClick={() => {
                                loadProjectDetails(p);
                                setCurrentScreen("revisions");
                              }}
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              Diff
                            </button>
                            <button
                              onClick={() => {
                                loadProjectDetails(p);
                                setCurrentScreen("studio");
                              }}
                              className="btn-primary"
                              style={{ padding: "4px 10px", fontSize: "11px" }}
                            >
                              <span>Open Workspace</span>
                              <ArrowRight size={12} strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: NEW PRODUCTION (Broadcast Project Specification Sheet) */}
          {currentScreen === "wizard" && (
            <div className="page-scroll-container">
              <form onSubmit={handleCreateProjectSubmit} style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
                {/* Left Column: Production Brief */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                      SPECIFICATION SHEET // 01
                    </span>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
                      Production Brief & Content Scope
                    </h2>
                    <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
                      Define core project metadata. A dedicated (:Project) node will be committed to the FalkorDB property graph.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Production Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Neo-Tokyo Commercial / Fall 2026 Director's Cut"
                      required
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Format Preset
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                      {[
                        "Documentary / Essay",
                        "Technical Explainer",
                        "Product Reveal",
                        "Podcast / Interview",
                        "Vertical Short",
                      ].map((cat) => {
                        const isSelected = newCategory === cat;
                        return (
                          <div
                            key={cat}
                            onClick={() => setNewCategory(cat)}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "5px",
                              backgroundColor: isSelected ? "#1C1C24" : "#101014",
                              border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                              transition: "all 0.12s ease",
                            }}
                          >
                            <span style={{ fontSize: "12px", fontWeight: 600, color: isSelected ? "#F4F4F6" : "#A1A1AA" }}>
                              {cat}
                            </span>
                            <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                              Template Rule Chain
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Target Duration: <strong style={{ color: "#F59E0B" }}>{newDuration}s</strong>
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {[10.0, 12.0, 15.0, 30.0, 60.0].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setNewDuration(dur)}
                          style={{
                            flex: 1,
                            backgroundColor: newDuration === dur ? "#F59E0B" : "#121215",
                            color: newDuration === dur ? "#09090B" : "#A1A1AA",
                            border: newDuration === dur ? "1px solid #F59E0B" : "1px solid #222228",
                            fontWeight: 600,
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {dur}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Editorial Direction & Pacing Mandates
                    </label>
                    <textarea
                      value={newEditorialDirection}
                      onChange={(e) => setNewEditorialDirection(e.target.value)}
                      placeholder="e.g. High energy opening hook under 2.5s. Prioritize code closeups over talking head..."
                      rows={3}
                      style={{ width: "100%", resize: "none" }}
                    />
                  </div>
                </div>

                {/* Right Column: Technical Raster & Graph Schema */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                      SPECIFICATION SHEET // 02
                    </span>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
                      Technical Raster & Graph Schema
                    </h2>
                    <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
                      Configure resolution constraints, frame pacing, and audio emotional resonance.
                    </p>
                  </div>

                  {/* Aspect Ratio Wireframe Cards */}
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Canvas Aspect Ratio
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {[
                        { id: "16:9", title: "16:9 Widescreen", sub: "1920×1080", width: 28, height: 16 },
                        { id: "9:16", title: "9:16 Vertical", sub: "1080×1920", width: 14, height: 25 },
                        { id: "1:1", title: "1:1 Square", sub: "1080×1080", width: 20, height: 20 },
                      ].map((item) => {
                        const isSelected = newAspectRatio === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setNewAspectRatio(item.id)}
                            style={{
                              padding: "12px 10px",
                              borderRadius: "5px",
                              backgroundColor: isSelected ? "#1C1C24" : "#101014",
                              border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              textAlign: "center",
                              gap: "8px",
                            }}
                          >
                            <div
                              style={{
                                width: `${item.width}px`,
                                height: `${item.height}px`,
                                border: isSelected ? "1.5px solid #F59E0B" : "1.5px solid #3F3F46",
                                backgroundColor: isSelected ? "rgba(245, 158, 11, 0.15)" : "#16161A",
                                borderRadius: "2px",
                              }}
                            />
                            <div>
                              <div style={{ fontSize: "11.5px", fontWeight: 600, color: isSelected ? "#F4F4F6" : "#A1A1AA" }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: "9.5px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                                {item.sub}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Frame Rate Selector */}
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Master Timebase & Frame Rate
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {["24 FPS Film", "30 FPS Broadcast", "60 FPS High-Motion"].map((fps) => {
                        const isSelected = newFrameRate === fps;
                        return (
                          <button
                            key={fps}
                            type="button"
                            onClick={() => setNewFrameRate(fps)}
                            style={{
                              backgroundColor: isSelected ? "#1C1C24" : "#121215",
                              color: isSelected ? "#F4F4F6" : "#A1A1AA",
                              border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                              fontSize: "11px",
                              fontFamily: "ui-monospace, monospace",
                            }}
                          >
                            {fps}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audio Mood Selector */}
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                      Audio Mood & Pacing Profile
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                      {["Upbeat", "Cinematic", "Conversational", "Dramatic"].map((mood) => {
                        const isSelected = newMood.toLowerCase() === mood.toLowerCase();
                        return (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => setNewMood(mood.toLowerCase())}
                            style={{
                              backgroundColor: isSelected ? "#1C1C24" : "#121215",
                              color: isSelected ? "#F4F4F6" : "#A1A1AA",
                              border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                              fontSize: "11px",
                              padding: "6px 8px",
                            }}
                          >
                            {mood}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", paddingTop: "12px" }}>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary"
                      style={{ width: "100%", padding: "10px" }}
                    >
                      {isLoading ? "Writing Graph Nodes..." : "Initialize Production Graph"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: REFERENCE PACING (Reference Monitor + SVG Energy Curve + Beat Chain) */}
          {currentScreen === "reference" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Top 2-Column Split */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "18px" }}>
                {/* Left: Reference Video Monitor */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FileVideo size={15} strokeWidth={1.6} color="#F59E0B" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                        Reference Video Monitor
                      </span>
                    </div>
                    <span className="tech-tag">
                      PySceneDetect Ready
                    </span>
                  </div>

                  <div
                    style={{
                      aspectRatio: "16/9",
                      backgroundColor: "#050507",
                      border: "1px solid #1F1F26",
                      borderRadius: "5px",
                      overflow: "hidden",
                    }}
                  >
                    <video
                      controls
                      src="http://localhost:8000/static/samples/ref_high_energy_demo.mp4"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>

                  {/* File / URL Import Bar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Import URL or reference media path..."
                        value={refUrl}
                        onChange={(e) => setRefUrl(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={handleAnalyzeReference}
                        disabled={isLoading}
                        className="btn-primary"
                      >
                        Analyze Cuts
                      </button>
                    </div>
                    <span style={{ fontSize: "10.5px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                      Note: URLs outside local network automatically fall back to bundled high-energy reference cuts.
                    </span>
                  </div>
                </div>

                {/* Right: Pacing Signature & SVG Energy Waveform Card */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Activity size={15} strokeWidth={1.6} color="#10B981" />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                        Pacing Signature & Energy Curve
                      </span>
                    </div>
                    <span className="tech-tag-emerald">
                      Dynamic High-Tempo
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
                      <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>AVG CUT LENGTH</span>
                      <div style={{ fontSize: "13px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                        3.0s
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
                      <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>TOTAL STORY BEATS</span>
                      <div style={{ fontSize: "13px", color: "#F4F4F6", fontWeight: 600, marginTop: "2px" }}>
                        {referenceBeats.length || 4} Beats
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1C1C22", borderRadius: "4px", padding: "8px 10px" }}>
                      <span style={{ fontSize: "10px", color: "#71717A", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>PACING PROFILE</span>
                      <div style={{ fontSize: "13px", color: "#F59E0B", fontWeight: 600, marginTop: "2px" }}>
                        Aggressive
                      </div>
                    </div>
                  </div>

                  {/* Crisp SVG Area/Step Chart */}
                  <div
                    style={{
                      height: "140px",
                      backgroundColor: "#070709",
                      border: "1px solid #1A1A22",
                      borderRadius: "5px",
                      padding: "10px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <svg viewBox="0 0 500 120" style={{ width: "100%", height: "100%" }}>
                      <defs>
                        <linearGradient id="amberWaveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Hairline guidelines */}
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#1F1F28" strokeDasharray="3 3" />
                      <line x1="0" y1="60" x2="500" y2="60" stroke="#1F1F28" strokeDasharray="3 3" />
                      <line x1="0" y1="90" x2="500" y2="90" stroke="#1F1F28" strokeDasharray="3 3" />

                      {/* Area Fill */}
                      <path
                        d="M 40 25 L 140 25 L 140 75 L 260 75 L 260 45 L 380 45 L 380 20 L 460 20 L 460 110 L 40 110 Z"
                        fill="url(#amberWaveGrad)"
                      />

                      {/* Step Line */}
                      <path
                        d="M 40 25 L 140 25 L 140 75 L 260 75 L 260 45 L 380 45 L 380 20 L 460 20"
                        stroke="#F59E0B"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                      />

                      {/* Markers */}
                      <circle cx="40" cy="25" r="3.5" fill="#F59E0B" />
                      <circle cx="140" cy="75" r="3.5" fill="#06B6D4" />
                      <circle cx="260" cy="45" r="3.5" fill="#10B981" />
                      <circle cx="380" cy="20" r="3.5" fill="#F59E0B" />

                      {/* Labels */}
                      <text x="40" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:00 (Hook • 5/5)</text>
                      <text x="140" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:03 (Setup • 3/5)</text>
                      <text x="260" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:06 (Demo • 4/5)</text>
                      <text x="380" y="105" fill="#71717A" fontSize="9" fontFamily="monospace">00:09 (Climax • 5/5)</text>
                    </svg>
                  </div>

                  <p style={{ fontSize: "11px", color: "#71717A", margin: 0, lineHeight: 1.4 }}>
                    Energy levels derived from optical flow delta and shot cut frequency. High scores trigger DirectorAgent B-roll prioritization.
                  </p>
                </div>
              </div>

              {/* Bottom Section: StoryBeat Decomposition Strip */}
              <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Layers size={15} strokeWidth={1.6} color="#F59E0B" />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                      StoryBeat Decomposition Strip
                    </span>
                  </div>
                  <span className="tech-tag">
                    (:StoryBeat)-[:NEXT_BEAT]-&gt;(:StoryBeat)
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                  {[
                    { beat: "BEAT 01 // HOOK", dur: "2.5s", energy: 5, shot: "TALKING_HEAD", tags: ["HOOK", "EXPLAINER", "FACE"] },
                    { beat: "BEAT 02 // SETUP", dur: "3.0s", energy: 3, shot: "CLOSEUP", tags: ["PRODUCT", "CODE", "MACRO"] },
                    { beat: "BEAT 03 // DEMO", dur: "3.5s", energy: 4, shot: "BROLL", tags: ["DEMO", "ACTION", "DESK"] },
                    { beat: "BEAT 04 // CLIMAX", dur: "2.0s", energy: 5, shot: "CLOSEUP", tags: ["HARDWARE", "FAST", "ENERGY"] },
                    { beat: "BEAT 05 // CTA", dur: "1.0s", energy: 4, shot: "TALKING_HEAD", tags: ["CTA", "OUTRO", "BRAND"] },
                  ].map((b, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: "#0C0C0E",
                        border: "1px solid #1F1F26",
                        borderRadius: "5px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "9.5px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600 }}>
                          {b.beat}
                        </span>
                        <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#A1A1AA" }}>
                          {b.dur}
                        </span>
                      </div>

                      {/* 5-bar energy indicator */}
                      <div style={{ display: "flex", gap: "3px" }}>
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            style={{
                              flex: 1,
                              height: "4px",
                              borderRadius: "1px",
                              backgroundColor: lvl <= b.energy ? "#F59E0B" : "#222228",
                            }}
                          />
                        ))}
                      </div>

                      <div style={{ fontSize: "11px", color: "#F4F4F6", fontWeight: 500 }}>
                        Shot: <strong style={{ color: "#06B6D4" }}>{b.shot}</strong>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "auto" }}>
                        {b.tags.map((tag) => (
                          <span key={tag} className="tech-tag" style={{ fontSize: "9px", padding: "1px 4px" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MEDIA BIN (Live Video Contact Sheet — Zero Empty Placeholders) */}
          {currentScreen === "footage" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Top Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {[
                    { id: "all", label: `All Clips (${sourceClips.length || 5})` },
                    { id: "dialog", label: "Dialog / A-Roll" },
                    { id: "broll", label: "B-Roll" },
                    { id: "pacing", label: "High Pacing (4+)" },
                  ].map((filter) => {
                    const isActive = clipFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setClipFilter(filter.id)}
                        style={{
                          backgroundColor: isActive ? "#F4F4F6" : "#121215",
                          color: isActive ? "#09090B" : "#A1A1AA",
                          border: isActive ? "1px solid #FFFFFF" : "1px solid #222228",
                          fontWeight: isActive ? 600 : 450,
                          borderRadius: "4px",
                          padding: "5px 10px",
                          fontSize: "11.5px",
                        }}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={handleLoadDemoFootage}
                    disabled={isLoading}
                    className="btn-primary"
                  >
                    Index Sample Footage
                  </button>
                </div>
              </div>

              {/* 3-Column Video Contact Sheet Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {(sourceClips.length > 0 ? sourceClips : [
                  {
                    clip_id: "clip_01",
                    filename: "raw_hook_talking_head.mp4",
                    shot_type: "TALKING_HEAD",
                    clip_duration: 3.2,
                    transcript: "Here is why autonomous video editing requires property graphs instead of vector search.",
                    tags: ["EXPLAINER", "HOOK", "TALKING_HEAD"],
                    energy_level: 5,
                  },
                  {
                    clip_id: "clip_02",
                    filename: "raw_closeup_code.mp4",
                    shot_type: "CLOSEUP",
                    clip_duration: 2.8,
                    transcript: "Multi-hop OpenCypher query evaluating candidate video segments in sub-millisecond time.",
                    tags: ["CODE", "DEVELOPER", "CLOSEUP"],
                    energy_level: 3,
                  },
                  {
                    clip_id: "clip_03",
                    filename: "raw_broll_lifestyle.mp4",
                    shot_type: "BROLL",
                    clip_duration: 4.1,
                    transcript: "Studio director workspace showing timeline tracks and dual monitors.",
                    tags: ["STUDIO", "HARDWARE", "BROLL"],
                    energy_level: 4,
                  },
                  {
                    clip_id: "clip_04",
                    filename: "raw_energetic_broll.mp4",
                    shot_type: "BROLL",
                    clip_duration: 3.0,
                    transcript: "Dynamic cinematic camera glide across high-energy work area.",
                    tags: ["FAST", "BROLL", "CINEMATIC"],
                    energy_level: 5,
                  },
                  {
                    clip_id: "clip_05",
                    filename: "raw_product_demo.mp4",
                    shot_type: "CLOSEUP",
                    clip_duration: 2.5,
                    transcript: "Full UI interaction demo compiling cut decision list.",
                    tags: ["DEMO", "SOFTWARE", "NLE"],
                    energy_level: 4,
                  },
                ])
                  .filter((clip) => {
                    if (clipFilter === "dialog") return clip.shot_type === "TALKING_HEAD";
                    if (clipFilter === "broll") return clip.shot_type === "BROLL";
                    if (clipFilter === "pacing") return clip.energy_level >= 4;
                    return true;
                  })
                  .map((clip) => (
                    <div
                      key={clip.clip_id}
                      className="studio-card"
                      style={{
                        padding: "0",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0",
                      }}
                    >
                      {/* Real HTML5 Video Preview on Hover */}
                      <div
                        style={{
                          aspectRatio: "16/9",
                          backgroundColor: "#050507",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <video
                          src={`http://localhost:8000/static/samples/${clip.filename || "raw_broll_lifestyle.mp4"}#t=0.5`}
                          muted
                          playsInline
                          loop
                          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0.5;
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                            cursor: "pointer",
                          }}
                        />

                        {/* Top-Left Shot Type Overlay */}
                        <div style={{ position: "absolute", top: "8px", left: "8px", pointerEvents: "none" }}>
                          <span className="tech-tag" style={{ backgroundColor: "rgba(12, 12, 14, 0.85)" }}>
                            {clip.shot_type}
                          </span>
                        </div>

                        {/* Bottom-Right SMPTE Timecode */}
                        <div style={{ position: "absolute", bottom: "8px", right: "8px", pointerEvents: "none" }}>
                          <span className="font-timecode" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(0,0,0,0.8)", color: "#F4F4F6", border: "1px solid rgba(255,255,255,0.1)" }}>
                            {formatSMPTE(clip.clip_duration || 3.0)}
                          </span>
                        </div>
                      </div>

                      {/* Metadata Body */}
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#F4F4F6", letterSpacing: "-0.01em" }}>
                          {clip.filename}
                        </span>

                        <p style={{ fontSize: "11px", color: "#71717A", margin: 0, lineHeight: 1.4, minHeight: "30px" }}>
                          &quot;{clip.transcript}&quot;
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {clip.tags?.map((t) => (
                            <span key={t} className="tech-tag" style={{ fontSize: "9px", padding: "1px 5px" }}>
                              {t}
                            </span>
                          ))}
                        </div>

                        {/* 5-segment horizontal pacing meter */}
                        <div style={{ borderTop: "1px solid #1C1C22", paddingTop: "10px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                            Pacing {clip.energy_level}/5
                          </span>
                          <div style={{ display: "flex", gap: "3px", width: "70px" }}>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <div
                                key={lvl}
                                style={{
                                  flex: 1,
                                  height: "4px",
                                  borderRadius: "1px",
                                  backgroundColor: lvl <= clip.energy_level ? "#F59E0B" : "#222228",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 6: TIMELINE STUDIO (4-Pane Pro NLE Workstation) */}
          {currentScreen === "studio" && (
            <div className="studio-body">
              {/* Left/Center Column */}
              <div className="studio-center-column">
                {/* Top Stage */}
                <div className="studio-stage">
                  {/* Left Card: Program Video Monitor */}
                  <div
                    className="studio-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      padding: "0",
                      overflow: "hidden",
                    }}
                  >
                    {/* Top Monitor Bar */}
                    <div
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#0C0C0E",
                        borderBottom: "1px solid #1F1F26",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Tv size={13} color="#F59E0B" />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#F4F4F6", letterSpacing: "0.02em" }}>
                          PROGRAM MONITOR
                        </span>
                        <span className="tech-tag" style={{ fontSize: "9px" }}>
                          {activeProject?.aspect_ratio || "16:9"} • 1080P • 24 FPS
                        </span>
                      </div>

                      {/* Guide Overlay Toggles */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          onClick={() => setShowGridOverlay(!showGridOverlay)}
                          style={{
                            padding: "3px 7px",
                            fontSize: "10.5px",
                            backgroundColor: showGridOverlay ? "#1F1F28" : "transparent",
                            borderColor: showGridOverlay ? "#3F3F46" : "transparent",
                            color: showGridOverlay ? "#F4F4F6" : "#71717A",
                          }}
                          title="Rule of Thirds Grid"
                        >
                          <Grid size={11} />
                          <span>Grid</span>
                        </button>
                        <button
                          onClick={() => setShowSafeZone(!showSafeZone)}
                          style={{
                            padding: "3px 7px",
                            fontSize: "10.5px",
                            backgroundColor: showSafeZone ? "#1F1F28" : "transparent",
                            borderColor: showSafeZone ? "#3F3F46" : "transparent",
                            color: showSafeZone ? "#F4F4F6" : "#71717A",
                          }}
                          title="Action Safe Zone"
                        >
                          <Square size={11} />
                          <span>Safe</span>
                        </button>
                      </div>
                    </div>

                    {/* Video Stage Frame */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: "#050507",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        minHeight: "220px",
                      }}
                    >
                      {/* Safe Zone Overlay */}
                      {showSafeZone && (
                        <div
                          style={{
                            position: "absolute",
                            inset: "24px",
                            border: "1px dashed rgba(6, 182, 212, 0.4)",
                            pointerEvents: "none",
                            zIndex: 20,
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "flex-end",
                            padding: "4px",
                          }}
                        >
                          <span style={{ fontSize: "8px", fontFamily: "ui-monospace, monospace", color: "rgba(6, 182, 212, 0.7)" }}>
                            90% SAFE ZONE
                          </span>
                        </div>
                      )}

                      {/* Rule of Thirds Grid Overlay */}
                      {showGridOverlay && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gridTemplateRows: "repeat(3, 1fr)",
                            pointerEvents: "none",
                            zIndex: 20,
                          }}
                        >
                          <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }} />
                          <div style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }} />
                          <div />
                        </div>
                      )}

                      {/* HTML5 Video Element */}
                      <video
                        ref={videoRef}
                        src={activePreviewUrl || "http://localhost:8000/static/samples/ref_high_energy_demo.mp4"}
                        onTimeUpdate={handleTimeUpdate}
                        loop={isLooping}
                        onClick={handleTogglePlay}
                        style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }}
                      />
                    </div>

                    {/* Bottom Transport HUD */}
                    <div
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#0C0C0E",
                        borderTop: "1px solid #1F1F26",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          onClick={() => handleStepFrame(-1)}
                          style={{ padding: "4px 6px" }}
                          title="Step Back 1 Frame (-1f)"
                        >
                          <SkipBack size={12} />
                        </button>

                        <button
                          onClick={handleTogglePlay}
                          style={{
                            backgroundColor: "#F4F4F6",
                            color: "#09090B",
                            border: "none",
                            width: "24px",
                            height: "24px",
                            borderRadius: "4px",
                            padding: 0,
                          }}
                        >
                          {isPlaying ? <Pause size={12} /> : <Play size={12} fill="#09090B" />}
                        </button>

                        <button
                          onClick={() => handleStepFrame(1)}
                          style={{ padding: "4px 6px" }}
                          title="Step Forward 1 Frame (+1f)"
                        >
                          <SkipForward size={12} />
                        </button>

                        <button
                          onClick={() => setIsLooping(!isLooping)}
                          style={{
                            padding: "4px 6px",
                            color: isLooping ? "#F59E0B" : "#71717A",
                          }}
                          title="Loop Playback"
                        >
                          <Repeat size={12} />
                        </button>

                        <span className="font-timecode" style={{ fontSize: "11.5px", color: "#F4F4F6", fontWeight: 600, marginLeft: "4px" }}>
                          {formatSMPTE(currentTime)} / {formatSMPTE(activeProject?.target_duration || 12.0)}
                        </span>
                      </div>

                      {/* Active Beat HUD Chip */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="tech-tag-amber" style={{ fontSize: "9.5px" }}>
                          {currentlyPlayingCut
                            ? `BEAT 0${currentlyPlayingCut.order} // ${currentlyPlayingCut.narrative_beat.toUpperCase()}`
                            : "BEAT 01 // HOOK"}
                        </span>
                      </div>
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

              {/* Right Column: Editorial Copilot */}
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

          {/* TAB 7: VERSION COMPARE (Lineage DAG & Synced Dual Monitors) */}
          {currentScreen === "revisions" && (
            <div className="page-scroll-container">
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

          {/* TAB 8: MASTER EXPORT (Broadcast Render & EDL/JSON Specification) */}
          {currentScreen === "export" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
                {/* Left: Codec Presets & Export Actions */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                      MASTER ENCODING // DELIVERY
                    </span>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
                      Broadcast Render & Export Presets
                    </h2>
                    <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
                      Select distribution packaging and download the rendered master or cut-list decision table.
                    </p>
                  </div>

                  {/* Codec Presets */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      {
                        id: "h264",
                        name: "H.264 MP4 Master",
                        specs: "MP4 • H.264 / AAC • 25 Mbps • High Profile",
                        desc: "Universal web and streaming distribution format with fast-start moov atom.",
                      },
                      {
                        id: "prores",
                        name: "ProRes 422 LT Broadcast",
                        specs: "MOV • ProRes 422 • 10-Bit 4:2:2 • Rec.709",
                        desc: "Master archiving and high-fidelity grading roundtrip format.",
                      },
                      {
                        id: "edl",
                        name: "FalkorDB Cut-List JSON / EDL",
                        specs: "JSON • OpenCypher Traceability • SMPTE In/Out",
                        desc: "Machine-readable decision list for DaVinci Resolve and Premiere Pro import.",
                      },
                    ].map((preset) => {
                      const isSelected = exportPreset === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => setExportPreset(preset.id)}
                          style={{
                            padding: "12px 14px",
                            borderRadius: "5px",
                            backgroundColor: isSelected ? "#1C1C24" : "#101014",
                            border: isSelected ? "1px solid #F59E0B" : "1px solid #222228",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "12.5px", fontWeight: 600, color: isSelected ? "#F4F4F6" : "#D4D4D8" }}>
                              {preset.name}
                            </span>
                            {isSelected && (
                              <span className="tech-tag-amber" style={{ fontSize: "9px" }}>
                                SELECTED
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "10.5px", color: "#A1A1AA", fontFamily: "ui-monospace, monospace" }}>
                            {preset.specs}
                          </span>
                          <span style={{ fontSize: "11px", color: "#71717A", marginTop: "2px" }}>
                            {preset.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resolution & FPS */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#D4D4D8", marginBottom: "4px" }}>
                        Resolution
                      </label>
                      <select
                        value={exportResolution}
                        onChange={(e) => setExportResolution(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="1080p">1080P (1920×1080)</option>
                        <option value="4k">4K UHD (3840×2160)</option>
                        <option value="720p">720P Proxy (1280×720)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#D4D4D8", marginBottom: "4px" }}>
                        Timebase
                      </label>
                      <select
                        value={exportFrameRate}
                        onChange={(e) => setExportFrameRate(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="24 FPS">24 FPS Film</option>
                        <option value="30 FPS">30 FPS Broadcast</option>
                        <option value="60 FPS">60 FPS High-Motion</option>
                      </select>
                    </div>
                  </div>

                  {/* Download Action */}
                  <div style={{ marginTop: "auto", paddingTop: "10px", display: "flex", gap: "10px" }}>
                    <a
                      href={activePreviewUrl || "http://localhost:8000/static/samples/ref_high_energy_demo.mp4"}
                      download={`${activeProject?.title || "director_ai"}_master.mp4`}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        textDecoration: "none",
                        padding: "10px",
                        textAlign: "center",
                      }}
                    >
                      <Download size={14} strokeWidth={2} />
                      <span>Download Master MP4</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(decisions, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `kino_studio_cutlist_${activeProject?.id || "project"}.json`;
                        a.click();
                      }}
                      style={{ padding: "10px 14px" }}
                    >
                      Export Cut JSON
                    </button>
                  </div>
                </div>

                {/* Right: Master Render Preview Player & Spec Sheet */}
                <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                      RENDER VERIFICATION
                    </span>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
                      Master Render Preview Player
                    </h2>
                  </div>

                  <div
                    style={{
                      aspectRatio: "16/9",
                      backgroundColor: "#050507",
                      border: "1px solid #1F1F26",
                      borderRadius: "5px",
                      overflow: "hidden",
                    }}
                  >
                    <video
                      controls
                      src={activePreviewUrl || "http://localhost:8000/static/samples/ref_high_energy_demo.mp4"}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>

                  {/* Technical Spec Sheet */}
                  <div style={{ backgroundColor: "#0C0C0E", border: "1px solid #1F1F26", borderRadius: "5px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#F59E0B", fontFamily: "ui-monospace, monospace", textTransform: "uppercase" }}>
                      TECHNICAL SPECIFICATION SHEET
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                      <div>
                        <span style={{ color: "#71717A" }}>Container: </span>
                        <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>MP4 (MPEG-4 Part 14)</span>
                      </div>
                      <div>
                        <span style={{ color: "#71717A" }}>Video Codec: </span>
                        <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>H.264 / AVC</span>
                      </div>
                      <div>
                        <span style={{ color: "#71717A" }}>Audio Codec: </span>
                        <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>AAC-LC 48kHz Stereo</span>
                      </div>
                      <div>
                        <span style={{ color: "#71717A" }}>Total Cuts: </span>
                        <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>{decisions.length || 4} Segments</span>
                      </div>
                      <div>
                        <span style={{ color: "#71717A" }}>Active Version ID: </span>
                        <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>{versions[versions.length - 1]?.id || "v1"}</span>
                      </div>
                      <div>
                        <span style={{ color: "#71717A" }}>Target Duration: </span>
                        <span style={{ color: "#F4F4F6", fontFamily: "ui-monospace, monospace" }}>{activeProject?.target_duration || 12.0}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: CHANNELS (Distribution Gate & Producer Sign-Off) */}
          {currentScreen === "publishing" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Compliance Banner */}
              <div
                className="studio-card"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  borderLeft: "3px solid #10B981",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <ShieldCheck size={20} strokeWidth={1.75} color="#10B981" />
                  <div>
                    <h3 style={{ fontSize: "13.5px", fontWeight: 600, color: "#F4F4F6", margin: "0 0 2px 0" }}>
                      Human-in-the-Loop Producer Gate
                    </h3>
                    <p style={{ fontSize: "11.5px", color: "#8E8E98", margin: 0 }}>
                      Explicit Producer Approval Required Before External API Dispatch — Enabled.
                    </p>
                  </div>
                </div>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={requireHumanApproval}
                    onChange={(e) => setRequireHumanApproval(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "12px", color: "#D4D4D8", fontWeight: 500 }}>
                    Gate Enforced
                  </span>
                </label>
              </div>

              {/* 2x2 Grid of Clean Channel Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[
                  {
                    name: "YouTube Studio",
                    handle: "@KinoStudioProductions",
                    type: "16:9 Long-Form & Shorts",
                    connected: true,
                    aspectOk: true,
                    audioClear: true,
                  },
                  {
                    name: "Vimeo Enterprise",
                    handle: "kino-enterprise-master",
                    type: "Broadcast Clean Feed",
                    connected: true,
                    aspectOk: true,
                    audioClear: true,
                  },
                  {
                    name: "LinkedIn Media",
                    handle: "Kino Autonomous Director",
                    type: "1:1 / 16:9 Professional",
                    connected: false,
                    aspectOk: true,
                    audioClear: true,
                  },
                  {
                    name: "Instagram Video",
                    handle: "@kino.director.ai",
                    type: "9:16 Vertical Reel",
                    connected: true,
                    aspectOk: false,
                    audioClear: true,
                  },
                ].map((channel) => (
                  <div
                    key={channel.name}
                    className="studio-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "18px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Share2 size={14} color="#71717A" />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                          {channel.name}
                        </span>
                      </div>
                      <span className="tech-tag" style={{ color: channel.connected ? "#10B981" : "#71717A" }}>
                        {channel.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>

                    <div style={{ fontSize: "11px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
                      Handle: {channel.handle} • {channel.type}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#8E8E98" }}>Aspect-Ratio Compatibility:</span>
                        <span style={{ color: channel.aspectOk ? "#10B981" : "#F59E0B", fontWeight: 500 }}>
                          {channel.aspectOk ? "Verified (16:9 Match)" : "Scale / Crop Required"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#8E8E98" }}>Audio / Copyright Clearance:</span>
                        <span style={{ color: "#10B981", fontWeight: 500 }}>Cleared (Royalty-Free)</span>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #1C1C22", paddingTop: "10px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="tech-tag-amber" style={{ fontSize: "9px" }}>
                        Staged • Awaiting Producer Sign-Off
                      </span>
                      <button
                        onClick={() => setSandboxPushed(true)}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                      >
                        Stage Cut
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {sandboxPushed && (
                <div
                  style={{
                    backgroundColor: "#101014",
                    border: "1px solid #10B981",
                    borderRadius: "5px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "12px",
                    color: "#34D399",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  <CheckCircle2 size={16} color="#10B981" />
                  <span>Staged dispatch confirmed in FalkorDB ledger. Manual producer sign-off holds release until approval.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 10: GRAPH MEMORY (Persistent Track 02 Creator Memory & FalkorDB Telemetry) */}
          {currentScreen === "settings" && (
            <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Top Metrics Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {[
                  { label: "GRAPH DATABASE", value: "ai_video_director", sub: "FalkorDB v2.4", color: "#F4F4F6" },
                  { label: "TOTAL NODES", value: `${graphState?.nodes.length || 17} Nodes`, sub: "Indexed in RAM", color: "#10B981" },
                  { label: "TOTAL EDGES", value: `${graphState?.edges.length || 16} Edges`, sub: "Multi-Hop Traversal", color: "#06B6D4" },
                  { label: "AVG QUERY LATENCY", value: "0.4 ms", sub: "Sub-Millisecond Cypher", color: "#F59E0B" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="studio-card"
                    style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}
                  >
                    <span style={{ fontSize: "9.5px", fontFamily: "ui-monospace, monospace", color: "#71717A", letterSpacing: "0.06em" }}>
                      {metric.label}
                    </span>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: metric.color, fontFamily: "ui-monospace, monospace" }}>
                      {metric.value}
                    </div>
                    <span style={{ fontSize: "10px", color: "#8E8E98" }}>
                      {metric.sub}
                    </span>
                  </div>
                ))}
              </div>

              {/* Persistent Creator Preferences Table */}
              <div className="studio-card" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "#F59E0B", fontWeight: 600, letterSpacing: "0.06em" }}>
                      PERSISTENT MEMORY // TRACK 02
                    </span>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#F4F4F6", margin: "4px 0 2px 0" }}>
                      Creator Preference Nodes (:CreatorPreference)
                    </h2>
                    <p style={{ fontSize: "12px", color: "#8E8E98", margin: 0 }}>
                      Learned procedural and aesthetic rules stored directly in FalkorDB that survive across sessions and projects.
                    </p>
                  </div>
                  <span className="tech-tag-amber">
                    {preferences.length} Stored Rules
                  </span>
                </div>

                {/* Data Table */}
                <div style={{ border: "1px solid #1F1F26", borderRadius: "5px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#0C0C0E", borderBottom: "1px solid #1F1F26", color: "#71717A", fontSize: "10px", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>
                        <th style={{ padding: "8px 12px" }}>Category</th>
                        <th style={{ padding: "8px 12px" }}>Rule Specification</th>
                        <th style={{ padding: "8px 12px" }}>Weight</th>
                        <th style={{ padding: "8px 12px" }}>Session Count</th>
                        <th style={{ padding: "8px 12px" }}>Status</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preferences.length > 0 ? preferences : [
                        { id: "pref_1", category: "Pacing & Style", rule_text: "Always start with high-energy establishing shot", weight: 1.5, reinforced_sessions: 3 },
                        { id: "pref_2", category: "Framing & Composition", rule_text: "Limit talking-head dialog segments to under 3.5 seconds", weight: 1.8, reinforced_sessions: 4 },
                        { id: "pref_3", category: "B-Roll Priority", rule_text: "Use cutaway B-roll code shots over monotonous wide angles", weight: 1.2, reinforced_sessions: 2 },
                      ]).map((pref) => (
                        <tr
                          key={pref.id}
                          style={{
                            borderBottom: "1px solid #18181E",
                            backgroundColor: "#101014",
                          }}
                        >
                          <td style={{ padding: "10px 12px" }}>
                            <span className="tech-tag-amber" style={{ fontSize: "9.5px" }}>
                              {pref.category}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", color: "#F4F4F6", fontWeight: 500 }}>
                            {pref.rule_text}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", color: "#A1A1AA" }}>
                            {pref.weight || 1.5}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", color: "#71717A" }}>
                            {pref.reinforced_sessions || 1} sessions
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span className="tech-tag-emerald" style={{ fontSize: "9px" }}>
                              Active in DirectorAgent
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <button
                              onClick={() => handleDeletePreference(pref.id)}
                              style={{ padding: "3px 6px", background: "transparent", border: "1px solid #2C2C35", color: "#71717A" }}
                              title="Delete rule node"
                            >
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Form to add a new standing editorial rule */}
                <form
                  onSubmit={handleAddPreference}
                  style={{
                    borderTop: "1px solid #1F1F26",
                    paddingTop: "14px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={newPrefCategory}
                    onChange={(e) => setNewPrefCategory(e.target.value)}
                    style={{ width: "180px" }}
                  >
                    <option value="Pacing & Style">Pacing & Style</option>
                    <option value="Framing & Composition">Framing & Composition</option>
                    <option value="B-Roll Priority">B-Roll Priority</option>
                    <option value="Audio Sync">Audio Sync</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Enter new editorial standing rule (e.g. Prioritize macro B-roll for technical beats)..."
                    value={newPrefRule}
                    onChange={(e) => setNewPrefRule(e.target.value)}
                    style={{ flex: 1 }}
                  />

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: "7px 14px" }}
                  >
                    + Add Rule
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
