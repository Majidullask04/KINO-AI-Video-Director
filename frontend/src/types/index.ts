export interface Project {
  id: string;
  title: string;
  category: string;
  target_duration: number;
  mood: string;
  aspect_ratio: string;
  status: string;
  created_at: number;
  version_count?: number;
  asset_count?: number;
  avg_cut_duration?: number;
}

export interface StoryBeat {
  id: string;
  beat_index: number;
  role: string;
  target_duration: number;
  energy_level: number;
  required_shot_type: string;
  transition: string;
  required_tags?: string[];
  next_beat_id?: string;
}

export interface VideoClip {
  clip_id: string;
  in_sec: number;
  out_sec: number;
  clip_duration: number;
  shot_type: string;
  energy_level: number;
  motion_score: number;
  transcript: string;
  tags: string[];
  mood?: string;
  asset_id?: string;
  filename?: string;
}

export interface CutDecision {
  decision_id: string;
  order: number;
  track: string;
  beat_id: string;
  narrative_beat: string;
  beat_target_sec: number;
  source_asset_id: string;
  source_asset: string;
  clip_id: string;
  source_in_sec: number;
  source_out_sec: number;
  explanation: string;
  match_confidence: number;
  shot_type: string;
  energy_level: number;
}

export interface EditVersion {
  id: string;
  version_num: number;
  prompt_summary: string;
  render_status: string;
  preview_url: string;
  created_at: number;
  parent_version_id?: string;
  revision_prompt?: string;
  changed_beat_index?: number;
}

export interface CreatorPreference {
  id: string;
  category: string;
  rule_text: string;
  weight: number;
  reinforced_sessions?: number;
  updated_at?: number;
}

export interface QueryLog {
  query: string;
  params: Record<string, any>;
  execution_time_ms: number;
  row_count: number;
  timestamp: number;
}

export interface GraphNode {
  id: string;
  label: string;
  name: string;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  [key: string]: any;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  query_logs: QueryLog[];
}

export interface VersionDiffItem {
  beat_index: number;
  beat_role: string;
  v1_source: string;
  v1_clip_id: string;
  v1_in: number;
  v1_out: number;
  v2_source: string;
  v2_clip_id: string;
  d2_trim_in_sec?: number;
  v2_in: number;
  v2_out: number;
  diff_status: "MODIFIED" | "UNCHANGED";
  v2_reason: string;
}
