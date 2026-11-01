export interface Project {
  id: string;
  title: string;
  category?: string;
  target_duration: number;
  mood?: string;
  aspect_ratio: string;
  status?: string;
  created_at: number;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  version_count?: number;
}

export interface StoryBeat {
  id: string;
  beat_index: number;
  role: string;
  target_duration: number;
  energy_level?: number;
  required_shot_type?: string;
  transition?: string;
  required_tags?: string[];
}

export interface VideoClip {
  clip_id: string;
  in_sec: number;
  out_sec: number;
  clip_duration: number;
  shot_type?: string;
  filename?: string;
  tags?: string[];
  video_url?: string;
  url?: string;
  energy_level?: number;
  edge_density?: number;
  visual_summary?: string;
  transcript?: string;
}

export interface CutDecision {
  decision_id: string;
  order: number;
  track: string;
  beat_id?: string;
  narrative_beat: string;
  source_asset: string;
  clip_id?: string;
  source_in_sec: number;
  source_out_sec: number;
  duration?: number;
  explanation?: string;
  shot_type?: string;
  energy_level?: number;
  match_confidence?: number;
  track_index?: number;
  track_kind?: string;
}

export interface EditVersion {
  id: string;
  version_num: number;
  prompt_summary?: string;
  created_at: number;
  preview_url?: string;
  parent_version_id?: string;
  traceability?: CutDecision[];
}

export interface CreatorPreference {
  id: string;
  category: string;
  rule_text: string;
  weight: number;
}

export interface FeedbackSummary {
  total_feedback: number;
  history?: any[];
}

export interface GraphState {
  nodes: any[];
  edges: any[];
}

export interface SystemPrerequisites {
  node_version: string;
  node_valid: boolean;
  ffmpeg_available: boolean;
  ffmpeg_version?: string;
  ffprobe_available: boolean;
  hyperframes_available: boolean;
  hyperframes_version?: string;
  platform: string;
  status: "ready" | "incomplete";
}

export function formatSMPTE(seconds: number, fps: number = 30): string {
  const safeSec = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safeSec / 60);
  const secs = Math.floor(safeSec % 60);
  const frames = Math.floor((safeSec % 1) * fps);
  return `00:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

// HyperFrames Integration Types
export interface HyperFramesComposition {
  project_id: string;
  project_title: string;
  format: string;
  resolution: { width: number; height: number };
  fps: number;
  duration: number;
  html: string;
  cli_command: string;
}

export interface HyperFramesLintCheck {
  id: string;
  name: string;
  description: string;
  status: "passed" | "warning" | "failed";
  fix?: string | null;
  details?: string;
}

export interface HyperFramesLintReport {
  status: "passed" | "warnings" | "failed";
  errors_count: number;
  warnings_count: number;
  checks_count: number;
  checks: HyperFramesLintCheck[];
  summary: string;
}

export interface HyperFramesRegistryBlock {
  id: string;
  name: string;
  category: string;
  description: string;
  author: string;
  tags: string[];
  default_duration: number;
  track_kind: string;
  track_index: number;
  html: string;
  css: string;
  gsap_tween: string;
}

export interface ClipFitAnalysis {
  clip_id: string;
  filename: string;
  duration: number;
  shot_type?: string;
  tags?: string[];
  energy_level?: number;
  motion_score?: number;
  edge_density?: number;
  visual_summary?: string;
  best_fit_beat?: any;
  ranked_recommendations?: any[];
}

export interface VersionDiffItem {
  beat_index: number;
  beat_role: string;
  v1_source: string;
  v1_clip_id?: string;
  v1_in: number;
  v1_out: number;
  v2_source: string;
  v2_clip_id?: string;
  v2_in: number;
  v2_out: number;
  diff_status: "MODIFIED" | "UNCHANGED";
  v2_reason?: string;
}
