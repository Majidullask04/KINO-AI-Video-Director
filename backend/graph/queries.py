"""
Core FalkorDB Cypher queries for AI Video Director.
Includes all 5 required submission queries as documented in Rule 10 of Graph Hacks.
"""

from typing import Any, Dict, List, Optional
from backend.graph.client import db

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
     CASE WHEN m IS NOT NULL THEN 1.5 ELSE 0.0 END AS mood_bonus
WITH b, c, sa, matched_tags,
     (tag_score * 2.0 + mood_bonus - (energy_diff * 0.5)) AS total_match_score
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
     CASE WHEN m IS NOT NULL THEN 1.5 ELSE 0.0 END AS mood_bonus
WITH b, c, sa, matched_tags,
     (tag_score * 2.0 + mood_bonus - (energy_diff * 0.5)) AS total_match_score
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
           c.transcript AS transcript,
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
