"use client";

import React, { useState, useEffect } from "react";
import { SidebarNav, ScreenId } from "@/components/SidebarNav";
import {
  Project,
  StoryBeat,
  VideoClip,
  CutDecision,
  EditVersion,
  CreatorPreference,
  GraphState,
  FeedbackSummary,
  ClipFitAnalysis,
  VersionDiffItem,
} from "@/types";
import { Cpu, ShieldCheck, History } from "lucide-react";
import { API_BASE, backendMediaUrl } from "@/utils/media";
import {
  listProjects,
  createProject,
  getProjectDetails,
  saveAsset,
  checkBackendAvailability,
} from "@/lib/storage-adapter";

// Modular Studio Views
import { HomeDashboardView } from "@/components/views/HomeDashboardView";
import { LandingView } from "@/components/views/LandingView";
import { DashboardView } from "@/components/views/DashboardView";
import { WizardView } from "@/components/views/WizardView";
import { ReferenceView } from "@/components/views/ReferenceView";
import { FootageView } from "@/components/views/FootageView";
import { StudioView } from "@/components/views/StudioView";
import { RegistryView } from "@/components/views/RegistryView";
import { ExportView } from "@/components/views/ExportView";
import { PublishingView } from "@/components/views/PublishingView";
import { SettingsView } from "@/components/views/SettingsView";
import { VersionDiffView } from "@/components/VersionDiffView";
import { HyperFramesLintModal } from "@/components/HyperFramesLintModal";
import { CheckpointHistoryModal } from "@/components/CheckpointHistoryModal";
import { CliTerminalDrawer } from "@/components/CliTerminalDrawer";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("landing");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [referenceBeats, setReferenceBeats] = useState<StoryBeat[]>([]);
  const [sourceClips, setSourceClips] = useState<VideoClip[]>([]);
  const [versions, setVersions] = useState<EditVersion[]>([]);
  const [decisions, setDecisions] = useState<CutDecision[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<CutDecision | null>(null);
  const [graphState, setGraphState] = useState<GraphState | null>(null);
  const [preferences, setPreferences] = useState<CreatorPreference[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false);

  const [activePreviewUrl, setActivePreviewUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isRevising, setIsRevising] = useState<boolean>(false);

  // Customer Feedback & Taste Learning (Track 02)
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [isLearningTaste, setIsLearningTaste] = useState<boolean>(false);

  // Video Clip Upload & Beat Fit Analysis State
  const [isUploadingFootage, setIsUploadingFootage] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [selectedClipFitAnalysis, setSelectedClipFitAnalysis] = useState<ClipFitAnalysis | null>(null);
  const [isAnalyzingFit, setIsAnalyzingFit] = useState<boolean>(false);
  const [isAssigningClip, setIsAssigningClip] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [directorBriefing, setDirectorBriefing] = useState<string | null>(null);

  // Version Diff State
  const [diffItems, setDiffItems] = useState<VersionDiffItem[]>([]);
  const [isGlobalLintModalOpen, setIsGlobalLintModalOpen] = useState<boolean>(false);
  const [isGlobalCheckpointModalOpen, setIsGlobalCheckpointModalOpen] = useState<boolean>(false);

  // Publishing Human-in-the-Loop Toggle
  const [requireHumanApproval, setRequireHumanApproval] = useState<boolean>(true);
  const [sandboxPushed, setSandboxPushed] = useState<boolean>(false);

  // Settings New Preference Form State
  const [newPrefCategory, setNewPrefCategory] = useState("Pacing & Style");
  const [newPrefRule, setNewPrefRule] = useState("");

  // 1. Initial Load: Projects & Creator Memory
  useEffect(() => {
    fetchProjects();
    fetchCreatorPreferences();
    fetchFeedbackSummary();
  }, []);

  const fetchFeedbackSummary = async () => {
    const isOnline = await checkBackendAvailability();
    if (!isOnline) return;
    try {
      const res = await fetch(`${API_BASE}/api/creator/feedback`);
      if (res.ok) {
        const data = await res.json();
        setFeedbackSummary(data);
      }
    } catch (e) {
      console.warn("Could not fetch feedback summary:", e);
    }
  };

  const fetchProjects = async () => {
    try {
      const projs = await listProjects();
      setProjects(projs);
      if (projs && projs.length > 0) {
        const currentValid = projs.find((p) => p.id === activeProject?.id);
        if (!currentValid) {
          loadProjectDetails(projs[0]);
        }
      }
    } catch (e) {
      console.warn("Could not fetch projects:", e);
    }
  };

  const fetchCreatorPreferences = async () => {
    const isOnline = await checkBackendAvailability();
    if (!isOnline) return;
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
      const details = await getProjectDetails(proj.id);
      if (details.project) {
        setActiveProject(details.project);
      }
      setDecisions(details.decisions || []);
      setSourceClips(details.assets as any || []);
      refreshGraphState(proj.id);
    } catch (e) {
      console.error("Error loading project details:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshGraphState = async (projId: string) => {
    const isOnline = await checkBackendAvailability();
    if (!isOnline) return;
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

  const handleFetchVersionDiff = async (v1Id: string, v2Id: string) => {
    if (!activeProject || !v1Id || !v2Id) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${activeProject.id}/diff?v1=${v1Id}&v2=${v2Id}`
      );
      if (res.ok) {
        const data = await res.json();
        setDiffItems(data.beat_diffs || []);
      }
    } catch (e) {
      console.warn("Could not fetch version diff:", e);
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
          setActivePreviewUrl(backendMediaUrl(data.version_v1.preview_url));
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
          setActivePreviewUrl(backendMediaUrl(plan.preview_url));
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
          setActivePreviewUrl(backendMediaUrl(rev.preview_url));
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

  // 6. Wizard Project Submit
  const handleCreateProjectSubmit = async (projectData: {
    title: string;
    category: string;
    target_duration: number;
    mood: string;
    aspect_ratio: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchProjects();
        setActiveProject(data.project);
        setCurrentScreen("reference");
      }
    } catch (e) {
      console.error("Error creating project:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Analyze Reference Video
  const handleAnalyzeReference = async (urlOrPath: string) => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      if (urlOrPath.startsWith("http")) {
        formData.append("video_url", urlOrPath);
      } else {
        formData.append("video_path", urlOrPath);
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

  // 8. Upload Raw Video Footage & Analyze Beat Fit
  const handleUploadFootageFiles = async (files: FileList | File[]) => {
    const targetProject = activeProject || projects[0];
    if (!targetProject) return;

    setIsUploadingFootage(true);
    setUploadStatusText("Checking ingestion environment...");
    try {
      const isOnline = await checkBackendAvailability();

      if (!isOnline) {
        setUploadStatusText("Saving media locally into browser IndexedDB...");
        for (const file of Array.from(files)) {
          await saveAsset(targetProject.id, file);
        }
        await loadProjectDetails(targetProject);
        setCurrentScreen("studio");
        setToastNotice("Footage saved locally! Opening Studio timeline...");
        setTimeout(() => setToastNotice(null), 4000);
        return;
      }

      setUploadStatusText("Uploading video footage to media ingest server...");
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      setUploadStatusText("Running frame differencing & edge density analysis...");
      const res = await fetch(`${API_BASE}/api/projects/${targetProject.id}/upload-footage`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadStatusText("Synthesizing timeline edit in STORYBOARD.md...");
        const data = await res.json();
        await loadProjectDetails(targetProject);

        if (data.plan) {
          if (data.plan.traceability && data.plan.traceability.length > 0) {
            setDecisions(data.plan.traceability);
            setSelectedDecision(data.plan.traceability[0]);
          }
          if (data.plan.preview_url) {
            setActivePreviewUrl(backendMediaUrl(data.plan.preview_url));
          }
        }

        if (data.assistant_briefing) {
          setDirectorBriefing(data.assistant_briefing);
        }

        setSelectedClipFitAnalysis(null);
        setCurrentScreen("studio");

        setToastNotice(`Footage uploaded & analyzed! AI Director synthesized timeline cut v${data.plan?.version_num || 1}.`);
        setTimeout(() => setToastNotice(null), 5000);
      }
    } catch (e) {
      console.error("Error uploading footage:", e);
      setToastNotice("Error uploading video footage. Please verify backend connection.");
      setTimeout(() => setToastNotice(null), 5000);
    } finally {
      setIsUploadingFootage(false);
      setUploadStatusText("");
    }
  };

  // Quick Ingest Sample Footage Pack
  const handleLoadDemoFootage = async () => {
    const targetProject = activeProject || projects[0];
    if (!targetProject) return;
    setIsUploadingFootage(true);
    setUploadStatusText("Ingesting sample video pack and synthesizing timeline...");
    try {
      const formData = new FormData();
      const res = await fetch(`${API_BASE}/api/projects/${targetProject.id}/upload-footage`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        await loadProjectDetails(targetProject);

        if (data.plan) {
          if (data.plan.traceability && data.plan.traceability.length > 0) {
            setDecisions(data.plan.traceability);
            setSelectedDecision(data.plan.traceability[0]);
          }
          if (data.plan.preview_url) {
            setActivePreviewUrl(backendMediaUrl(data.plan.preview_url));
          }
        }

        if (data.assistant_briefing) {
          setDirectorBriefing(data.assistant_briefing);
        }

        setSelectedClipFitAnalysis(null);
        setCurrentScreen("studio");

        setToastNotice(`Sample footage indexed! AI Director synthesized timeline cut v${data.plan?.version_num || 1}.`);
        setTimeout(() => setToastNotice(null), 5000);
      }
    } catch (e) {
      console.error("Error indexing footage:", e);
    } finally {
      setIsUploadingFootage(false);
      setUploadStatusText("");
    }
  };

  // Analyze Beat Fit for any clip in the media bin
  const handleAnalyzeClipFit = async (clipId: string) => {
    const targetProject = activeProject || projects[0];
    if (!targetProject) return;
    setIsAnalyzingFit(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${targetProject.id}/clips/${clipId}/best-fit`);
      if (res.ok) {
        const data: ClipFitAnalysis = await res.json();
        setSelectedClipFitAnalysis(data);
      }
    } catch (e) {
      console.error("Error analyzing clip beat fit:", e);
    } finally {
      setIsAnalyzingFit(false);
    }
  };

  // Assign clip directly to a story beat in the project timeline
  const handleAssignClipToBeat = async (clipId: string, beatIndex: number, beatId?: string) => {
    const targetProject = activeProject || projects[0];
    if (!targetProject) return;
    setIsAssigningClip(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${targetProject.id}/assign-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clip_id: clipId,
          beat_index: beatIndex,
          beat_id: beatId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadProjectDetails(targetProject);
        const resolvedPreview = data.version?.preview_url || data.preview_url;
        const resolvedTraceability = data.version?.traceability || data.traceability;
        if (resolvedPreview) {
          setActivePreviewUrl(backendMediaUrl(resolvedPreview));
        }
        if (resolvedTraceability) {
          setDecisions(resolvedTraceability);
          if (resolvedTraceability.length > 0) {
            setSelectedDecision(resolvedTraceability[0]);
          }
        }
        setSelectedClipFitAnalysis(null);
        setCurrentScreen("studio");
        setToastNotice(`Assigned clip to Beat ${beatIndex}! Branched timeline to EditVersion v${data.version_num}.`);
        setTimeout(() => setToastNotice(null), 5000);
      }
    } catch (e) {
      console.error("Error assigning clip to beat:", e);
    } finally {
      setIsAssigningClip(false);
    }
  };

  // Creator Preference CRUD
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

  // Customer Taste Feedback & Learning Handlers (Track 02)
  const handleSubmitFeedback = async (
    decision: CutDecision,
    action: "keep" | "replace" | "reject",
    reason?: string
  ) => {
    if (!activeProject) return;
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${activeProject.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          clip_id: decision.clip_id,
          beat_id: decision.beat_id,
          decision_id: decision.decision_id,
          reason: reason || `Customer marked suggestion as ${action}`,
          creator_id: "creator_default"
        })
      });
      if (res.ok) {
        await fetchCreatorPreferences();
        await fetchFeedbackSummary();
        if (action === "replace" || action === "reject") {
          await handleSendRevision(`Replace Cut #${decision.order} (${decision.narrative_beat}) with an alternative clip.`);
        }
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleTriggerTasteLearning = async () => {
    setIsLearningTaste(true);
    try {
      const res = await fetch(`${API_BASE}/api/creator/learn-taste`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchCreatorPreferences();
        await fetchFeedbackSummary();
      }
    } catch (err) {
      console.error("Error learning taste:", err);
    } finally {
      setIsLearningTaste(false);
    }
  };

  const handleCreateNewProject = async (prompt: string, cuts: string[]) => {
    const title = prompt.slice(0, 32).trim() || "Untitled Production";
    try {
      const newProj = await createProject({
        title,
        target_duration: cuts.length > 0 ? cuts.length * 3.0 : 12.0,
        aspect_ratio: "16:9",
        category: "Social / Explainer",
        mood: "energetic",
      });

      await fetchProjects();
      await loadProjectDetails(newProj);
      setCurrentScreen("studio");
    } catch (e) {
      console.error("Error creating project:", e);
    }
  };

  const handleUpdateProjectTitle = async (newTitle: string) => {
    if (!activeProject) return;
    try {
      const metaRes = await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/meta.json`);
      let meta: any = {};
      if (metaRes.ok) {
        const d = await metaRes.json();
        try {
          meta = JSON.parse(d.content);
        } catch {}
      }
      meta = { ...meta, title: newTitle };
      await fetch(`${API_BASE}/api/projects/${activeProject.id}/files/meta.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify(meta, null, 2) }),
      });
      await fetchProjects();
      setActiveProject((prev) => (prev ? { ...prev, title: newTitle } : null));
    } catch (e) {
      console.warn("Could not update project title:", e);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#0F0F0E] overflow-hidden select-none">
      {currentScreen === "landing" ? (
        <HomeDashboardView
          projects={projects}
          activeProject={activeProject}
          onSelectProject={(p) => loadProjectDetails(p)}
          onOpenStudio={() => setCurrentScreen("studio")}
          onCreateNewProject={handleCreateNewProject}
          onRefreshProjects={fetchProjects}
        />
      ) : (
        <StudioView
          activeProject={activeProject}
          activePreviewUrl={activePreviewUrl}
          versions={versions}
          decisions={decisions}
          selectedDecision={selectedDecision}
          graphState={graphState}
          preferences={preferences}
          directorBriefing={directorBriefing}
          isRevising={isRevising}
          isUploadingFootage={isUploadingFootage}
          uploadStatusText={uploadStatusText}
          isSubmittingFeedback={isSubmittingFeedback}
          onSelectDecision={setSelectedDecision}
          onSendRevision={handleSendRevision}
          onRefreshGraph={() => activeProject && refreshGraphState(activeProject.id)}
          onSubmitFeedback={handleSubmitFeedback}
          onUploadFootageFiles={handleUploadFootageFiles}
          onGoHome={() => setCurrentScreen("landing")}
          onOpenTerminal={() => setIsTerminalOpen(true)}
          onUpdateProjectTitle={handleUpdateProjectTitle}
        />
      )}

      {/* Integrated Host CLI & Agent Runner Drawer */}
      <CliTerminalDrawer
        activeProject={activeProject}
        isOpen={isTerminalOpen}
        onToggle={() => setIsTerminalOpen(!isTerminalOpen)}
      />
    </div>
  );
}
