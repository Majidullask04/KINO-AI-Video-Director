import re
import uuid
import logging
from typing import Dict, Any, List, Optional

from backend.graph.client import db
from backend.graph.queries import (
    CYPHER_CREATE_REVISION_VERSION,
    run_beat_matching_query,
    add_creator_preference,
    run_version_diff_query,
    run_traceability_query
)
from backend.video.renderer import render_edit_version

logger = logging.getLogger(__name__)

class RevisionAgent:
    """
    Translates natural-language revision prompts into Cypher DAG mutations,
    maintains negative clip memory ([:REJECTED_FOR]), and updates durable CreatorPreference nodes.
    """

    def apply_revision(
        self,
        project_id: str,
        user_prompt: str,
        creator_id: str = "creator_default"
    ) -> Dict[str, Any]:
        """
        Executes conversational revision:
        1. Checks for standing preference to store in durable memory.
        2. Identifies target beat/cut to modify.
        3. Branches a new EditVersion in the FalkorDB lineage DAG.
        4. Writes a [:REJECTED_FOR] edge preventing the old clip from being picked again.
        5. Matches a fresh candidate clip and links new CutDecision nodes.
        6. Renders the new video preview.
        """
        logger.info(f"RevisionAgent processing: '{user_prompt}' for project {project_id}")

        # 1. Parse and extract standing CreatorPreferences (Track 02 Durable Memory)
        learned_preference = self._extract_creator_preference(user_prompt)
        if learned_preference:
            pref_id = f"pref_{uuid.uuid4().hex[:8]}"
            add_creator_preference(
                creator_id=creator_id,
                pref_id=pref_id,
                category=learned_preference["category"],
                rule_text=learned_preference["rule_text"],
                weight=1.5
            )
            logger.info(f"Learned and stored new creator preference in FalkorDB: {learned_preference['rule_text']}")

        # 2. Get the latest active EditVersion
        latest_version_cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(v:EditVersion)
        RETURN v.id AS id, v.version_num AS version_num
        ORDER BY v.version_num DESC
        LIMIT 1
        """
        versions = db.query_as_dicts(latest_version_cypher, {"project_id": project_id})
        if not versions:
            raise ValueError(f"No active EditVersion found to revise in project {project_id}")
        
        prev_version = versions[0]
        prev_version_id = prev_version["id"]
        prev_version_num = int(prev_version["version_num"])

        # 3. Determine which beat is targeted
        target_order = self._identify_target_beat(user_prompt)

        # 4. Fetch the previous decisions
        prev_decisions_cypher = """
        MATCH (v:EditVersion {id: $version_id})-[:HAS_DECISION]->(d:CutDecision)
        MATCH (d)-[:FULFILLS_BEAT]->(b:StoryBeat)
        MATCH (d)-[:SELECTS_CLIP]->(c:VideoClip)<-[:CONTAINS_CLIP]-(sa:SourceAsset)
        RETURN d.timeline_order AS order,
               d.trim_in_sec AS in_sec,
               d.trim_out_sec AS out_sec,
               d.track AS track,
               b.id AS beat_id,
               b.role AS beat_role,
               b.target_duration AS target_duration,
               c.id AS clip_id,
               sa.filename AS filename
        ORDER BY d.timeline_order ASC
        """
        prev_decisions = db.query_as_dicts(prev_decisions_cypher, {"version_id": prev_version_id})

        # 5. Execute Cypher Query 2: Mark old clip REJECTED_FOR and create new EditVersion
        new_version_id = f"v{prev_version_num + 1}_{uuid.uuid4().hex[:8]}"
        new_version_num = prev_version_num + 1

        create_v_cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(prev:EditVersion {id: $prev_version_id})
        MATCH (prev)-[:HAS_DECISION]->(old_dec:CutDecision {timeline_order: $target_order})-[:FULFILLS_BEAT]->(b:StoryBeat)
        MATCH (old_dec)-[:SELECTS_CLIP]->(old_clip:VideoClip)
        MERGE (old_clip)-[:REJECTED_FOR {reason: $user_prompt, rejected_in_version: prev.version_num}]->(b)
        CREATE (next_v:EditVersion {
            id: $new_version_id,
            version_num: $new_version_num,
            prompt_summary: $user_prompt,
            render_status: 'rendering',
            preview_url: '',
            created_at: timestamp()
        })
        CREATE (p)-[:HAS_VERSION {is_active: true}]->(next_v)
        CREATE (next_v)-[:DERIVED_FROM {revision_prompt: $user_prompt, changed_beat_index: $target_order}]->(prev)
        RETURN next_v.id AS new_version_id, b.id AS target_beat_id
        """
        res = db.query_as_dicts(create_v_cypher, {
            "project_id": project_id,
            "prev_version_id": prev_version_id,
            "target_order": target_order,
            "user_prompt": user_prompt,
            "new_version_id": new_version_id,
            "new_version_num": new_version_num
        })

        target_beat_id = res[0]["target_beat_id"] if res else None

        # 6. Find a new replacement clip for target_order that is NOT rejected
        replacement_clip = self._find_replacement_clip(project_id, target_beat_id, target_order, user_prompt)

        # 7. Re-populate CutDecisions for the new EditVersion
        for dec in prev_decisions:
            order = int(dec["order"])
            dec_id = f"dec_{uuid.uuid4().hex[:8]}"

            if order == target_order and replacement_clip:
                # Use new replacement clip
                trim_in = float(replacement_clip.get("clip_in_sec", 0.0))
                # Check if prompt specifies trimming (e.g., "trim to 2 seconds")
                trimmed_dur = self._extract_duration(user_prompt) or float(dec["target_duration"])
                trim_out = round(trim_in + trimmed_dur, 2)
                chosen_clip_id = replacement_clip["clip_id"]
                rationale = (
                    f"Revised based on user prompt: '{user_prompt}'. "
                    f"Replaced previous clip with high-affinity candidate {chosen_clip_id}. "
                    f"Old clip marked [:REJECTED_FOR] in FalkorDB lineage."
                )
            else:
                # Retain original clip from previous version
                trim_in = float(dec["in_sec"])
                trim_out = float(dec["out_sec"])
                chosen_clip_id = dec["clip_id"]
                rationale = f"Retained from v{prev_version_num} (unchanged in revision)."

            insert_dec_cypher = """
            MATCH (v:EditVersion {id: $version_id})
            MATCH (b:StoryBeat {id: $beat_id})
            MATCH (c:VideoClip {id: $clip_id})
            CREATE (d:CutDecision {
                id: $decision_id,
                timeline_order: $order,
                trim_in_sec: $trim_in,
                trim_out_sec: $trim_out,
                track: 'V1',
                ai_rationale: $rationale,
                confidence: 0.95
            })
            CREATE (v)-[:HAS_DECISION {timeline_order: $order}]->(d)
            CREATE (d)-[:FULFILLS_BEAT]->(b)
            CREATE (d)-[:SELECTS_CLIP {trim_in: $trim_in, trim_out: $trim_out}]->(c)
            RETURN d.id
            """
            db.query(insert_dec_cypher, {
                "version_id": new_version_id,
                "beat_id": dec["beat_id"],
                "clip_id": chosen_clip_id,
                "decision_id": dec_id,
                "order": order,
                "trim_in": trim_in,
                "trim_out": trim_out,
                "rationale": rationale
            })

        # 8. Render the new MP4 preview
        preview_url = render_edit_version(new_version_id)

        # 9. Get diff between old version and new version (Query 4)
        diff_results = run_version_diff_query(prev_version_id, new_version_id)
        traceability = run_traceability_query(new_version_id)

        return {
            "version_id": new_version_id,
            "version_num": new_version_num,
            "parent_version_id": prev_version_id,
            "preview_url": preview_url,
            "target_beat_order": target_order,
            "diff_summary": diff_results,
            "traceability": traceability,
            "learned_preference": learned_preference
        }

    def _identify_target_beat(self, prompt: str) -> int:
        """Parses target beat index from prompt (defaults to beat 2 if not explicitly specified)."""
        prompt_lower = prompt.lower()
        if "hook" in prompt_lower or "first" in prompt_lower or "clip 1" in prompt_lower or "beat 1" in prompt_lower or "#1" in prompt_lower:
            return 1
        elif "second" in prompt_lower or "clip 2" in prompt_lower or "beat 2" in prompt_lower or "#2" in prompt_lower or "setup" in prompt_lower:
            return 2
        elif "third" in prompt_lower or "clip 3" in prompt_lower or "beat 3" in prompt_lower or "#3" in prompt_lower or "demo" in prompt_lower:
            return 3
        elif "fourth" in prompt_lower or "clip 4" in prompt_lower or "beat 4" in prompt_lower or "#4" in prompt_lower or "cta" in prompt_lower or "outro" in prompt_lower:
            return 4
        
        # Regex search for numbers
        match = re.search(r'\b(?:beat|clip)\s*#?([1-4])\b', prompt_lower)
        if match:
            return int(match.group(1))
            
        return 2  # Default to beat 2 for generic revision requests

    def _extract_duration(self, prompt: str) -> Optional[float]:
        """Extracts seconds duration from phrases like 'trim to 2 seconds' or '2.5s'."""
        match = re.search(r'(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)', prompt.lower())
        if match:
            return float(match.group(1))
        return None

    def _extract_creator_preference(self, prompt: str) -> Optional[Dict[str, str]]:
        """Identifies persistent habits user wants remembered across projects."""
        p_lower = prompt.lower()
        if any(keyword in p_lower for keyword in ["remember", "always", "prefer", "standing rule", "future projects"]):
            return {
                "category": "Pacing & Style",
                "rule_text": prompt.strip(),
            }
        return None

    def _find_replacement_clip(
        self,
        project_id: str,
        beat_id: Optional[str],
        beat_order: int,
        prompt: str
    ) -> Optional[Dict[str, Any]]:
        """
        Traverses FalkorDB for a clip that fulfills the beat and has NOT been rejected.
        """
        cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_ASSET]->(sa:SourceAsset)-[:CONTAINS_CLIP]->(c:VideoClip)
        OPTIONAL MATCH (b:StoryBeat {beat_index: $beat_order})
        WHERE NOT (c)-[:REJECTED_FOR]->(b)
        RETURN c.id AS clip_id,
               c.in_sec AS clip_in_sec,
               c.out_sec AS clip_out_sec,
               c.duration AS duration,
               sa.filename AS source_file,
               c.energy_level AS energy_level
        ORDER BY c.energy_level DESC
        LIMIT 1
        """
        results = db.query_as_dicts(cypher, {
            "project_id": project_id,
            "beat_order": beat_order
        })
        if results:
            return results[0]

        # Relaxed fallback
        fallback_cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_ASSET]->(sa:SourceAsset)-[:CONTAINS_CLIP]->(c:VideoClip)
        RETURN c.id AS clip_id,
               c.in_sec AS clip_in_sec,
               c.out_sec AS clip_out_sec,
               sa.filename AS source_file
        LIMIT 1
        """
        fb = db.query_as_dicts(fallback_cypher, {"project_id": project_id})
        return fb[0] if fb else None

revision = RevisionAgent()
