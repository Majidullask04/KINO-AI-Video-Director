"""
Core FalkorDB Cypher queries for AI Video Director.
Includes all 5 required submission queries as documented in Rule 10 of Graph Hacks.
"""

import uuid
import time
import logging
from typing import Any, Dict, List, Optional
from backend.graph.client import db

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# 1. QUERY 1: Multi-Hop Beat-to-Clip Candidate Matching (Director Agent)
# ----------------------------------------------------------------------
CYPHER_MATCH_BEATS_TO_CLIPS = """
MATCH (p:Project {id: $project_id})-[:USES_REFERENCE]->(r:ReferenceVideo)-[:HAS_BEAT]->(b:StoryBeat)
MATCH (b)-[:REQUIRES_TAG]->(t:VisualTag)<-[ht:HAS_TAG]-(c:VideoClip)<-[:CONTAINS_CLIP]-(sa:SourceAsset)<-[:HAS_ASSET]-(p)
WHERE c.duration >= b.target_duration
  AND NOT (c)-[:REJECTED_FOR]->(b)
OPTIONAL MATCH (c)-[:HAS_MOOD]->(m:AudioMood {name: p.mood})
WITH b, c, sa,
     collect(t.name) AS matched_tags,
     sum(ht.confidence) AS tag_score,
     abs(c.energy_level - b.energy_level) AS energy_diff,
     CASE WHEN m IS NOT NULL THEN 1.5 ELSE 0.0 END AS mood_bonus,
     coalesce(c.keep_count, 0) AS keeps,
     coalesce(c.replace_count, 0) AS replaces,
     coalesce(c.reject_count, 0) AS rejects
WITH b, c, sa, matched_tags, keeps, replaces, rejects,
     (tag_score * 2.0 + mood_bonus - (energy_diff * 0.5) + (keeps * 1.5) - (replaces * 1.0) - (rejects * 2.5)) AS total_match_score
ORDER BY b.beat_index ASC, total_match_score DESC
RETURN b.id AS beat_id,
       b.beat_index AS beat_index,
       b.role AS beat_role,
       b.target_duration AS target_duration,
       c.id AS clip_id,
       sa.filename AS source_file,
       c.in_sec AS clip_in_sec,
       c.out_sec AS clip_out_sec,
       c.shot_type AS shot_type,
       c.energy_level AS clip_energy_level,
       coalesce(c.motion_score, 0.5) AS motion_score,
       coalesce(c.edge_density, 1.8) AS edge_density,
       coalesce(c.visual_summary, '') AS visual_summary,
       keeps AS keep_count,
       replaces AS replace_count,
       rejects AS reject_count,
       matched_tags,
       total_match_score
"""

# Fallback matching query if visual tag matches are sparse
CYPHER_RELAXED_BEAT_MATCHING = """
MATCH (p:Project {id: $project_id})-[:USES_REFERENCE]->(r:ReferenceVideo)-[:HAS_BEAT]->(b:StoryBeat)
MATCH (p)-[:HAS_ASSET]->(sa:SourceAsset)-[:CONTAINS_CLIP]->(c:VideoClip)
WHERE c.duration >= b.target_duration
  AND NOT (c)-[:REJECTED_FOR]->(b)
OPTIONAL MATCH (b)-[:REQUIRES_TAG]->(t:VisualTag)<-[ht:HAS_TAG]-(c)
OPTIONAL MATCH (c)-[:HAS_MOOD]->(m:AudioMood {name: p.mood})
WITH b, c, sa,
     collect(DISTINCT t.name) AS matched_tags,
     coalesce(sum(ht.confidence), 0.5) AS tag_score,
     abs(c.energy_level - b.energy_level) AS energy_diff,
     CASE WHEN m IS NOT NULL THEN 1.5 ELSE 0.0 END AS mood_bonus,
     coalesce(c.keep_count, 0) AS keeps,
     coalesce(c.replace_count, 0) AS replaces,
     coalesce(c.reject_count, 0) AS rejects
WITH b, c, sa, matched_tags, keeps, replaces, rejects,
     (tag_score * 2.0 + mood_bonus - (energy_diff * 0.5) + (keeps * 1.5) - (replaces * 1.0) - (rejects * 2.5)) AS total_match_score
ORDER BY b.beat_index ASC, total_match_score DESC
RETURN b.id AS beat_id,
       b.beat_index AS beat_index,
       b.role AS beat_role,
       b.target_duration AS target_duration,
       c.id AS clip_id,
       sa.filename AS source_file,
       c.in_sec AS clip_in_sec,
       c.out_sec AS clip_out_sec,
       c.shot_type AS shot_type,
       c.energy_level AS clip_energy_level,
       coalesce(c.motion_score, 0.5) AS motion_score,
       coalesce(c.edge_density, 1.8) AS edge_density,
       coalesce(c.visual_summary, '') AS visual_summary,
       keeps AS keep_count,
       replaces AS replace_count,
       rejects AS reject_count,
       matched_tags,
       total_match_score
"""

# ----------------------------------------------------------------------
# 2. QUERY 2: Building a New Conversational Revision Version in Lineage DAG (Revision Agent)
# ----------------------------------------------------------------------
CYPHER_CREATE_REVISION_VERSION = """
MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(prev:EditVersion {id: $prev_version_id})
MATCH (prev)-[:HAS_DECISION]->(old_dec:CutDecision {timeline_order: $target_order})-[:FULFILLS_BEAT]->(b:StoryBeat)
MATCH (old_dec)-[:SELECTS_CLIP]->(old_clip:VideoClip)
MERGE (old_clip)-[:REJECTED_FOR {reason: $user_prompt, rejected_in_version: prev.version_num}]->(b)
CREATE (next_v:EditVersion {
  id: $new_version_id,
  version_num: prev.version_num + 1,
  prompt_summary: $user_prompt,
  render_status: 'queued',
  preview_url: '',
  created_at: $timestamp
})
CREATE (p)-[:HAS_VERSION {is_active: true}]->(next_v)
CREATE (next_v)-[:DERIVED_FROM {revision_prompt: $user_prompt, changed_beat_index: $target_order}]->(prev)
RETURN next_v.id AS new_version_id, b.id AS target_beat_id
"""

# ----------------------------------------------------------------------
# 3. QUERY 3: Full Edit Traceability & Explainability Query (Powers Studio UI)
# ----------------------------------------------------------------------
CYPHER_EDIT_TRACEABILITY = """
MATCH (v:EditVersion {id: $version_id})-[:HAS_DECISION]->(d:CutDecision)
MATCH (d)-[:FULFILLS_BEAT]->(b:StoryBeat)<-[:HAS_BEAT]-(r:ReferenceVideo)
MATCH (d)-[:SELECTS_CLIP]->(c:VideoClip)<-[:CONTAINS_CLIP]-(sa:SourceAsset)
OPTIONAL MATCH (b)-[:NEXT_BEAT]->(next_b:StoryBeat)
RETURN d.id AS decision_id,
       d.timeline_order AS order,
       d.track AS track,
       b.id AS beat_id,
       b.role AS narrative_beat,
       b.target_duration AS beat_target_sec,
       sa.id AS source_asset_id,
       sa.filename AS source_asset,
       c.id AS clip_id,
       d.trim_in_sec AS source_in_sec,
       d.trim_out_sec AS source_out_sec,
       d.ai_rationale AS explanation,
       d.confidence AS match_confidence,
       c.shot_type AS shot_type,
       c.energy_level AS energy_level
ORDER BY d.timeline_order ASC
"""

# ----------------------------------------------------------------------
# 4. QUERY 4: Version-to-Version Graph Diff Query (Revision History & Comparison)
# ----------------------------------------------------------------------
CYPHER_VERSION_DIFF = """
MATCH (v1:EditVersion {id: $version_a_id})-[:HAS_DECISION]->(d1:CutDecision)-[:FULFILLS_BEAT]->(b:StoryBeat)
MATCH (d1)-[:SELECTS_CLIP]->(c1:VideoClip)<-[:CONTAINS_CLIP]-(sa1:SourceAsset)
MATCH (v2:EditVersion {id: $version_b_id})-[:HAS_DECISION]->(d2:CutDecision)-[:FULFILLS_BEAT]->(b)
MATCH (d2)-[:SELECTS_CLIP]->(c2:VideoClip)<-[:CONTAINS_CLIP]-(sa2:SourceAsset)
RETURN b.beat_index AS beat_index,
       b.role AS beat_role,
       sa1.filename AS v1_source,
       c1.id AS v1_clip_id,
       d1.trim_in_sec AS v1_in,
       d1.trim_out_sec AS v1_out,
       sa2.filename AS v2_source,
       c2.id AS v2_clip_id,
       d2.trim_in_sec AS v2_in,
       d2.trim_out_sec AS v2_out,
       CASE WHEN c1.id <> c2.id OR d1.trim_in_sec <> d2.trim_in_sec OR d1.trim_out_sec <> d2.trim_out_sec
            THEN 'MODIFIED' ELSE 'UNCHANGED' END AS diff_status,
       d2.ai_rationale AS v2_reason
ORDER BY b.beat_index ASC
"""

# ----------------------------------------------------------------------
# 5. QUERY 5: Cross-Session Creator Preference Retrieval (Track 02 Agent Memory)
# ----------------------------------------------------------------------
CYPHER_CREATOR_PREFERENCES = """
MATCH (u:Creator {id: $creator_id})-[r:REMEMBERS_PREF]->(pref:CreatorPreference)
RETURN pref.id AS id,
       pref.category AS category,
       pref.rule_text AS rule_text,
       pref.weight AS weight,
       r.session_count AS reinforced_sessions,
       pref.updated_at AS updated_at
ORDER BY pref.weight DESC
"""

# ----------------------------------------------------------------------
# Helper Graph Query Execution Functions
# ----------------------------------------------------------------------

def run_beat_matching_query(project_id: str) -> List[Dict[str, Any]]:
    """Runs Query 1 (or relaxed query) to find best candidate clips for reference beats."""
    matches = db.query_as_dicts(CYPHER_MATCH_BEATS_TO_CLIPS, {"project_id": project_id})
    if not matches:
        matches = db.query_as_dicts(CYPHER_RELAXED_BEAT_MATCHING, {"project_id": project_id})
    return matches

def run_traceability_query(version_id: str) -> List[Dict[str, Any]]:
    """Runs Query 3 to fetch the full decision & cut lineage for an EditVersion."""
    return db.query_as_dicts(CYPHER_EDIT_TRACEABILITY, {"version_id": version_id})

def run_version_diff_query(version_a_id: str, version_b_id: str) -> List[Dict[str, Any]]:
    """Runs Query 4 to diff two EditVersions across beats."""
    return db.query_as_dicts(CYPHER_VERSION_DIFF, {
        "version_a_id": version_a_id,
        "version_b_id": version_b_id
    })

def run_creator_preferences_query(creator_id: str = "creator_default") -> List[Dict[str, Any]]:
    """Runs Query 5 to fetch durable creator style preferences."""
    return db.query_as_dicts(CYPHER_CREATOR_PREFERENCES, {"creator_id": creator_id})

def ensure_default_creator(creator_id: str = "creator_default", name: str = "Alex Chen"):
    """Ensures default creator node and baseline preferences exist."""
    cypher = """
    MERGE (c:Creator {id: $creator_id})
    ON CREATE SET c.name = $name, c.default_aspect_ratio = '16:9'
    RETURN c.id AS id
    """
    db.query(cypher, {"creator_id": creator_id, "name": name})

def add_creator_preference(creator_id: str, pref_id: str, category: str, rule_text: str, weight: float = 1.0):
    cypher = """
    MATCH (c:Creator {id: $creator_id})
    MERGE (p:CreatorPreference {id: $pref_id})
    SET p.category = $category, p.rule_text = $rule_text, p.weight = $weight, p.updated_at = timestamp()
    MERGE (c)-[r:REMEMBERS_PREF]->(p)
    ON CREATE SET r.session_count = 1, r.confidence = 0.95
    ON MATCH SET r.session_count = r.session_count + 1
    RETURN p.id AS id
    """
    db.query(cypher, {
        "creator_id": creator_id,
        "pref_id": pref_id,
        "category": category,
        "rule_text": rule_text,
        "weight": weight
    })

def delete_creator_preference(pref_id: str):
    cypher = """
    MATCH (p:CreatorPreference {id: $pref_id})
    DETACH DELETE p
    """
    db.query(cypher, {"pref_id": pref_id})

def create_project(project_data: Dict[str, Any], creator_id: str = "creator_default") -> str:
    cypher = """
    MATCH (c:Creator {id: $creator_id})
    CREATE (p:Project {
        id: $id,
        title: $title,
        category: $category,
        target_duration: $target_duration,
        mood: $mood,
        aspect_ratio: $aspect_ratio,
        status: $status,
        created_at: $created_at
    })
    CREATE (c)-[:OWNS_PROJECT {created_at: $created_at}]->(p)
    RETURN p.id AS id
    """
    db.query(cypher, {
        "creator_id": creator_id,
        **project_data
    })
    return project_data["id"]

def list_projects() -> List[Dict[str, Any]]:
    cypher = """
    MATCH (p:Project)
    OPTIONAL MATCH (p)-[:HAS_VERSION]->(v:EditVersion)
    OPTIONAL MATCH (p)-[:USES_REFERENCE]->(r:ReferenceVideo)
    OPTIONAL MATCH (p)-[:HAS_ASSET]->(sa:SourceAsset)
    WITH p, count(DISTINCT v) AS version_count,
         count(DISTINCT sa) AS asset_count,
         head(collect(r.avg_cut_duration)) AS avg_cut_duration
    RETURN p.id AS id,
           p.title AS title,
           p.category AS category,
           p.target_duration AS target_duration,
           p.mood AS mood,
           p.aspect_ratio AS aspect_ratio,
           p.status AS status,
           p.created_at AS created_at,
           version_count,
           asset_count,
           coalesce(avg_cut_duration, 2.5) AS avg_cut_duration
    ORDER BY p.created_at DESC
    """
    return db.query_as_dicts(cypher)

def get_project_details(project_id: str) -> Optional[Dict[str, Any]]:
    cypher = """
    MATCH (p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:USES_REFERENCE]->(r:ReferenceVideo)
    RETURN p.id AS id,
           p.title AS title,
           p.category AS category,
           p.target_duration AS target_duration,
           p.mood AS mood,
           p.aspect_ratio AS aspect_ratio,
           p.status AS status,
           p.created_at AS created_at,
           r.id AS ref_id,
           r.avg_cut_duration AS ref_avg_cut,
           r.pacing_style AS ref_pacing,
           r.total_duration AS ref_duration
    """
    items = db.query_as_dicts(cypher, {"project_id": project_id})
    return items[0] if items else None

def get_project_versions(project_id: str) -> List[Dict[str, Any]]:
    cypher = """
    MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(v:EditVersion)
    OPTIONAL MATCH (v)-[d:DERIVED_FROM]->(prev:EditVersion)
    RETURN v.id AS id,
           v.version_num AS version_num,
           v.prompt_summary AS prompt_summary,
           v.render_status AS render_status,
           v.preview_url AS preview_url,
           v.created_at AS created_at,
           prev.id AS parent_version_id,
           d.revision_prompt AS revision_prompt,
           d.changed_beat_index AS changed_beat_index
    ORDER BY v.version_num ASC
    """
    return db.query_as_dicts(cypher, {"project_id": project_id})

def get_reference_beats(project_id: str) -> List[Dict[str, Any]]:
    cypher = """
    MATCH (p:Project {id: $project_id})-[:USES_REFERENCE]->(r:ReferenceVideo)-[:HAS_BEAT]->(b:StoryBeat)
    OPTIONAL MATCH (b)-[rt:REQUIRES_TAG]->(t:VisualTag)
    OPTIONAL MATCH (b)-[nb:NEXT_BEAT]->(next_b:StoryBeat)
    WITH b, collect(t.name) AS required_tags, next_b.id AS next_beat_id
    RETURN b.id AS id,
           b.beat_index AS beat_index,
           b.role AS role,
           b.target_duration AS target_duration,
           b.energy_level AS energy_level,
           b.required_shot_type AS required_shot_type,
           b.transition AS transition,
           required_tags,
           next_beat_id
    ORDER BY b.beat_index ASC
    """
    return db.query_as_dicts(cypher, {"project_id": project_id})

def get_source_assets_and_clips(project_id: str) -> List[Dict[str, Any]]:
    cypher = """
    MATCH (p:Project {id: $project_id})-[:HAS_ASSET]->(sa:SourceAsset)
    OPTIONAL MATCH (sa)-[:CONTAINS_CLIP]->(c:VideoClip)
    OPTIONAL MATCH (c)-[:HAS_TAG]->(t:VisualTag)
    OPTIONAL MATCH (c)-[:HAS_MOOD]->(m:AudioMood)
    WITH sa, c, collect(DISTINCT t.name) AS tags, head(collect(DISTINCT m.name)) AS mood
    RETURN sa.id AS asset_id,
           sa.filename AS filename,
           sa.duration AS asset_duration,
           sa.resolution AS resolution,
           c.id AS clip_id,
           c.in_sec AS in_sec,
           c.out_sec AS out_sec,
           c.duration AS clip_duration,
           c.shot_type AS shot_type,
           c.energy_level AS energy_level,
           c.motion_score AS motion_score,
           c.edge_density AS edge_density,
           c.brightness AS brightness,
           c.contrast AS contrast,
           c.visual_summary AS visual_summary,
           c.transcript AS transcript,
           coalesce(c.keep_count, 0) AS keep_count,
           coalesce(c.replace_count, 0) AS replace_count,
           coalesce(c.reject_count, 0) AS reject_count,
           tags,
           mood
    ORDER BY sa.filename ASC, c.in_sec ASC
    """
    return db.query_as_dicts(cypher, {"project_id": project_id})

def get_full_project_graph_state(project_id: str) -> Dict[str, Any]:
    """
    Extracts all nodes and edges for this project to feed the frontend Graph Traceability Inspector.
    """
    nodes_cypher = """
    MATCH (p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:USES_REFERENCE]->(r:ReferenceVideo)-[:HAS_BEAT]->(b:StoryBeat)
    OPTIONAL MATCH (p)-[:HAS_ASSET]->(sa:SourceAsset)-[:CONTAINS_CLIP]->(c:VideoClip)
    OPTIONAL MATCH (p)-[:HAS_VERSION]->(v:EditVersion)
    OPTIONAL MATCH (v)-[:HAS_DECISION]->(d:CutDecision)
    RETURN p.id AS p_id, p.title AS p_title,
           collect(DISTINCT {id: b.id, label: 'StoryBeat', name: b.role, index: b.beat_index, duration: b.target_duration, energy: b.energy_level}) AS beats,
           collect(DISTINCT {id: c.id, label: 'VideoClip', name: c.shot_type, duration: c.duration, energy: c.energy_level, asset: sa.filename}) AS clips,
           collect(DISTINCT {id: v.id, label: 'EditVersion', name: 'v' + toString(v.version_num), status: v.render_status}) AS versions,
           collect(DISTINCT {id: d.id, label: 'CutDecision', name: 'Cut #' + toString(d.timeline_order), order: d.timeline_order}) AS decisions
    """
    
    # Query edges
    edges_cypher = """
    MATCH (p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:USES_REFERENCE]->(r)-[:HAS_BEAT]->(b1:StoryBeat)-[nb:NEXT_BEAT]->(b2:StoryBeat)
    OPTIONAL MATCH (p)-[:HAS_VERSION]->(v:EditVersion)-[:HAS_DECISION]->(d:CutDecision)
    OPTIONAL MATCH (d)-[:FULFILLS_BEAT]->(b:StoryBeat)
    OPTIONAL MATCH (d)-[:SELECTS_CLIP]->(c:VideoClip)
    OPTIONAL MATCH (c)-[rej:REJECTED_FOR]->(rb:StoryBeat)
    OPTIONAL MATCH (v2:EditVersion)-[der:DERIVED_FROM]->(v1:EditVersion)
    RETURN collect(DISTINCT {source: b1.id, target: b2.id, type: 'NEXT_BEAT'}) AS beat_edges,
           collect(DISTINCT {source: v.id, target: d.id, type: 'HAS_DECISION'}) AS decision_edges,
           collect(DISTINCT {source: d.id, target: b.id, type: 'FULFILLS_BEAT'}) AS fulfills_edges,
           collect(DISTINCT {source: d.id, target: c.id, type: 'SELECTS_CLIP'}) AS selects_edges,
           collect(DISTINCT {source: c.id, target: rb.id, type: 'REJECTED_FOR', reason: rej.reason}) AS rejected_edges,
           collect(DISTINCT {source: v2.id, target: v1.id, type: 'DERIVED_FROM'}) AS derived_edges
    """

    node_res = db.query_as_dicts(nodes_cypher, {"project_id": project_id})
    edge_res = db.query_as_dicts(edges_cypher, {"project_id": project_id})
    
    nodes = []
    edges = []
    
    if node_res:
        row = node_res[0]
        nodes.append({"id": project_id, "label": "Project", "name": row.get("p_title", "Project")})
        for b in row.get("beats", []):
            if b and b.get("id"):
                nodes.append(b)
        for c in row.get("clips", []):
            if c and c.get("id"):
                nodes.append(c)
        for v in row.get("versions", []):
            if v and v.get("id"):
                nodes.append(v)
        for d in row.get("decisions", []):
            if d and d.get("id"):
                nodes.append(d)

    if edge_res:
        erow = edge_res[0]
        for key in ["beat_edges", "decision_edges", "fulfills_edges", "selects_edges", "rejected_edges", "derived_edges"]:
            for edge in erow.get(key, []):
                if edge and edge.get("source") and edge.get("target"):
                    edges.append(edge)

    return {
        "nodes": nodes,
        "edges": edges,
        "query_logs": db.get_query_logs(10)
    }

# ----------------------------------------------------------------------
# 6. Feedback & Taste Learning Engine (Requirements 3 & 4)
# ----------------------------------------------------------------------

def record_clip_feedback(
    creator_id: str,
    project_id: str,
    clip_id: str,
    beat_id: str,
    action: str,  # 'keep', 'replace', or 'reject'
    decision_id: Optional[str] = None,
    version_id: Optional[str] = None,
    reason: Optional[str] = "",
    rating: Optional[float] = None
) -> Dict[str, Any]:
    """
    Records customer feedback ('keep', 'replace', 'reject') in FalkorDB.
    Creates (:Feedback) node, links to Creator, VideoClip, StoryBeat,
    updates clip counters, and if replaced/rejected, links [:REJECTED_FOR].
    """
    fb_id = f"fb_{uuid.uuid4().hex[:8]}"
    created_at = int(time.time() * 1000)

    # 1. Fetch clip and beat context
    info_cypher = """
    MATCH (c:VideoClip {id: $clip_id})
    OPTIONAL MATCH (b:StoryBeat {id: $beat_id})
    OPTIONAL MATCH (c)-[:HAS_TAG]->(t:VisualTag)
    RETURN c.shot_type AS shot_type,
           c.energy_level AS energy_level,
           b.role AS beat_role,
           collect(DISTINCT t.name) AS tags
    """
    info = db.query_as_dicts(info_cypher, {"clip_id": clip_id, "beat_id": beat_id})
    shot_type = info[0]["shot_type"] if info and info[0].get("shot_type") else "broll"
    energy_level = info[0]["energy_level"] if info and info[0].get("energy_level") else 3
    beat_role = info[0]["beat_role"] if info and info[0].get("beat_role") else "generic"
    tags = info[0]["tags"] if info and info[0].get("tags") else []

    # Default rating based on action
    if rating is None:
        rating = 5.0 if action == "keep" else (2.5 if action == "replace" else 1.0)

    # 2. Create Feedback Node and link
    create_fb_cypher = """
    MERGE (cr:Creator {id: $creator_id})
    CREATE (fb:Feedback {
        id: $fb_id,
        action: $action,
        decision_id: $decision_id,
        beat_id: $beat_id,
        beat_role: $beat_role,
        clip_id: $clip_id,
        shot_type: $shot_type,
        energy_level: $energy_level,
        reason: $reason,
        rating: $rating,
        created_at: $created_at
    })
    CREATE (cr)-[:RECORDED_FEEDBACK {created_at: $created_at}]->(fb)
    WITH fb
    OPTIONAL MATCH (c:VideoClip {id: $clip_id})
    FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
        CREATE (fb)-[:EVALUATES_CLIP {action: $action}]->(c)
    )
    WITH fb
    OPTIONAL MATCH (b:StoryBeat {id: $beat_id})
    FOREACH (_ IN CASE WHEN b IS NOT NULL THEN [1] ELSE [] END |
        CREATE (fb)-[:FOR_BEAT {role: $beat_role}]->(b)
    )
    RETURN fb.id AS id
    """
    db.query(create_fb_cypher, {
        "creator_id": creator_id,
        "clip_id": clip_id,
        "beat_id": beat_id,
        "fb_id": fb_id,
        "action": action,
        "decision_id": decision_id or "",
        "beat_role": beat_role,
        "shot_type": shot_type,
        "energy_level": energy_level,
        "reason": reason or f"Customer marked suggestion as {action}",
        "rating": rating,
        "created_at": created_at
    })

    # 3. Update VideoClip counters and negative memory if rejected/replaced
    if action == "keep":
        update_clip_cypher = """
        MATCH (c:VideoClip {id: $clip_id})
        SET c.keep_count = coalesce(c.keep_count, 0) + 1
        """
        db.query(update_clip_cypher, {"clip_id": clip_id})
    elif action in ("replace", "reject"):
        update_clip_cypher = """
        MATCH (c:VideoClip {id: $clip_id})
        MATCH (b:StoryBeat {id: $beat_id})
        SET c.replace_count = coalesce(c.replace_count, 0) + (CASE WHEN $action = 'replace' THEN 1 ELSE 0 END),
            c.reject_count = coalesce(c.reject_count, 0) + (CASE WHEN $action = 'reject' THEN 1 ELSE 0 END)
        MERGE (c)-[:REJECTED_FOR {reason: $reason, feedback_id: $fb_id}]->(b)
        """
        db.query(update_clip_cypher, {
            "clip_id": clip_id,
            "beat_id": beat_id,
            "action": action,
            "reason": reason or f"Customer {action}ed suggestion",
            "fb_id": fb_id
        })

    logger.info(f"Recorded feedback '{action}' for clip {clip_id} on beat {beat_id}")
    return {
        "feedback_id": fb_id,
        "action": action,
        "clip_id": clip_id,
        "beat_id": beat_id,
        "beat_role": beat_role,
        "shot_type": shot_type,
        "created_at": created_at
    }


def get_creator_feedback_history(creator_id: str = "creator_default") -> Dict[str, Any]:
    """Retrieves all recorded feedback and aggregate statistics for a creator."""
    cypher = """
    MATCH (c:Creator {id: $creator_id})-[:RECORDED_FEEDBACK]->(fb:Feedback)
    OPTIONAL MATCH (fb)-[:EVALUATES_CLIP]->(clip:VideoClip)<-[:CONTAINS_CLIP]-(sa:SourceAsset)
    OPTIONAL MATCH (fb)-[:FOR_BEAT]->(b:StoryBeat)
    RETURN fb.id AS id,
           fb.action AS action,
           fb.beat_role AS beat_role,
           fb.decision_id AS decision_id,
           fb.clip_id AS clip_id,
           sa.filename AS source_file,
           clip.shot_type AS shot_type,
           clip.energy_level AS energy_level,
           fb.reason AS reason,
           fb.rating AS rating,
           fb.created_at AS created_at
    ORDER BY fb.created_at DESC
    """
    items = db.query_as_dicts(cypher, {"creator_id": creator_id})
    
    total_keeps = sum(1 for x in items if x["action"] == "keep")
    total_replaces = sum(1 for x in items if x["action"] == "replace")
    total_rejects = sum(1 for x in items if x["action"] == "reject")

    return {
        "total_feedback": len(items),
        "keeps": total_keeps,
        "replaces": total_replaces,
        "rejects": total_rejects,
        "approval_rate": round((total_keeps / max(1, len(items))) * 100, 1),
        "items": items
    }


def learn_creator_taste(creator_id: str = "creator_default") -> List[Dict[str, Any]]:
    """
    Mines feedback choices across sessions in FalkorDB:
    - Identifies patterns of approved/kept shot types for each beat role
    - Analyzes energy level and pacing preferences
    - Identifies visual tag affinities and avoidances
    - Updates durable CreatorPreference nodes in FalkorDB to guide future rankings
    """
    cypher = """
    MATCH (c:Creator {id: $creator_id})-[:RECORDED_FEEDBACK]->(fb:Feedback)
    OPTIONAL MATCH (fb)-[:EVALUATES_CLIP]->(clip:VideoClip)
    OPTIONAL MATCH (clip)-[:HAS_TAG]->(t:VisualTag)
    RETURN fb.action AS action,
           fb.beat_role AS beat_role,
           coalesce(clip.shot_type, fb.shot_type) AS shot_type,
           coalesce(clip.energy_level, fb.energy_level) AS energy_level,
           collect(DISTINCT t.name) AS tags,
           fb.reason AS reason
    """
    feedbacks = db.query_as_dicts(cypher, {"creator_id": creator_id})
    if not feedbacks:
        return []

    learned_rules = []
    
    # Track statistics
    keeps_by_role: Dict[str, Dict[str, int]] = {}
    rejects_by_role: Dict[str, Dict[str, int]] = {}
    kept_energies = []
    kept_tags: Dict[str, int] = {}

    for fb in feedbacks:
        action = fb.get("action")
        role = fb.get("beat_role") or "general"
        shot = fb.get("shot_type") or "broll"
        energy = fb.get("energy_level") or 3
        tags = fb.get("tags") or []

        if action == "keep":
            if role not in keeps_by_role:
                keeps_by_role[role] = {}
            keeps_by_role[role][shot] = keeps_by_role[role].get(shot, 0) + 1
            kept_energies.append(energy)
            for t in tags:
                kept_tags[t] = kept_tags.get(t, 0) + 1
        elif action in ("replace", "reject"):
            if role not in rejects_by_role:
                rejects_by_role[role] = {}
            rejects_by_role[role][shot] = rejects_by_role[role].get(shot, 0) + 1

    # Rule Generation 1: Role-to-Shot Preferences
    for role, shots in keeps_by_role.items():
        for shot, count in shots.items():
            if count >= 1:
                pref_id = f"pref_learned_{role}_{shot}"
                category = "Visual Continuity"
                rule_text = f"Customer style: Always prioritize {shot.replace('_', ' ')} footage for {role} beats (Reinforced by {count} Keep choices)"
                weight = round(1.6 + count * 0.25, 2)
                add_creator_preference(creator_id, pref_id, category, rule_text, weight)
                learned_rules.append({
                    "id": pref_id,
                    "category": category,
                    "rule_text": rule_text,
                    "weight": weight
                })

    # Rule Generation 2: Pacing & Energy Dynamics
    if kept_energies:
        avg_energy = sum(kept_energies) / len(kept_energies)
        if avg_energy >= 3.6:
            pref_id = "pref_learned_energy_pacing"
            category = "Pacing & Style"
            rule_text = f"Pacing preference: High energy and rapid cutting (target energy 4-5) across sequence cuts (Avg kept energy: {avg_energy:.1f})"
            weight = 1.8
            add_creator_preference(creator_id, pref_id, category, rule_text, weight)
            learned_rules.append({
                "id": pref_id,
                "category": category,
                "rule_text": rule_text,
                "weight": weight
            })
        elif avg_energy <= 2.6:
            pref_id = "pref_learned_calm_pacing"
            category = "Pacing & Style"
            rule_text = f"Pacing preference: Calm and deliberate pacing with steady visual flow (Avg kept energy: {avg_energy:.1f})"
            weight = 1.6
            add_creator_preference(creator_id, pref_id, category, rule_text, weight)
            learned_rules.append({
                "id": pref_id,
                "category": category,
                "rule_text": rule_text,
                "weight": weight
            })

    # Rule Generation 3: Visual Tag Affinities
    if kept_tags:
        top_tags = sorted(kept_tags.items(), key=lambda x: x[1], reverse=True)
        top_names = [t[0] for t in top_tags[:3] if t[1] >= 1]
        if top_names:
            pref_id = "pref_learned_tag_affinity"
            category = "Visual Continuity"
            rule_text = f"Creator visual affinity: Strongly favor clips featuring [{', '.join(top_names)}]"
            weight = 1.7
            add_creator_preference(creator_id, pref_id, category, rule_text, weight)
            learned_rules.append({
                "id": pref_id,
                "category": category,
                "rule_text": rule_text,
                "weight": weight
            })

    # Rule Generation 4: Avoidances from Rejections
    for role, shots in rejects_by_role.items():
        for shot, r_count in shots.items():
            if r_count >= 1 and shot not in keeps_by_role.get(role, {}):
                pref_id = f"pref_avoid_{role}_{shot}"
                category = "Director Avoidance"
                rule_text = f"Director avoidance: Avoid using {shot.replace('_', ' ')} for {role} beats based on customer rejections"
                weight = 1.5
                add_creator_preference(creator_id, pref_id, category, rule_text, weight)
                learned_rules.append({
                    "id": pref_id,
                    "category": category,
                    "rule_text": rule_text,
                    "weight": weight
                })

    logger.info(f"Learned and updated {len(learned_rules)} creator preferences from feedback choices.")
    return learned_rules

