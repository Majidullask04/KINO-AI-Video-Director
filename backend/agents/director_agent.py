import uuid
import logging
from typing import Dict, Any, List

from backend.graph.client import db
from backend.graph.queries import (
    run_beat_matching_query,
    run_creator_preferences_query,
    run_traceability_query
)
from backend.video.renderer import render_edit_version

logger = logging.getLogger(__name__)

class DirectorAgent:
    """
    Synthesizes an edit plan using multi-hop Cypher traversals in FalkorDB.
    Enforces Track 01 (Acting on Connected Data) and Track 02 (Cross-Session Memory).
    """

    def generate_initial_edit(self, project_id: str, creator_id: str = "creator_default") -> Dict[str, Any]:
        """
        Runs Query 1 to match StoryBeats to candidate VideoClips, creates EditVersion v1 and CutDecisions.
        """
        logger.info(f"DirectorAgent generating edit plan for project: {project_id}")

        # 1. Fetch persistent CreatorPreferences (Track 02 memory)
        preferences = run_creator_preferences_query(creator_id)
        pref_notes = [p["rule_text"] for p in preferences] if preferences else []
        pref_summary = " | ".join(pref_notes) if pref_notes else "Default balanced rhythm"

        # 2. Run Multi-Hop Beat-to-Clip Graph Matching Cypher Query (Track 01)
        matches = run_beat_matching_query(project_id)
        if not matches:
            raise ValueError(f"No candidate video clips found for project {project_id}. Please upload footage first.")

        # Organize candidate matches by beat_id
        beats_map: Dict[str, List[Dict[str, Any]]] = {}
        for m in matches:
            b_id = m["beat_id"]
            if b_id not in beats_map:
                beats_map[b_id] = []
            beats_map[b_id].append(m)

        # 3. Create incremental EditVersion node in FalkorDB
        ver_check_cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(v:EditVersion)
        RETURN coalesce(max(v.version_num), 0) AS max_v
        """
        v_res = db.query_as_dicts(ver_check_cypher, {"project_id": project_id})
        max_v = v_res[0]["max_v"] if v_res and v_res[0].get("max_v") is not None else 0
        new_version_num = int(max_v) + 1
        version_id = f"v{new_version_num}_{uuid.uuid4().hex[:8]}"

        # Deactivate older active versions
        db.query("""
        MATCH (p:Project {id: $project_id})-[r:HAS_VERSION]->(v:EditVersion)
        SET r.is_active = false
        """, {"project_id": project_id})

        create_version_cypher = """
        MATCH (p:Project {id: $project_id})
        CREATE (v:EditVersion {
            id: $version_id,
            version_num: $version_num,
            prompt_summary: $prompt_summary,
            render_status: 'rendering',
            preview_url: '',
            created_at: timestamp()
        })
        CREATE (p)-[:HAS_VERSION {is_active: true}]->(v)
        RETURN v.id AS id
        """
        db.query(create_version_cypher, {
            "project_id": project_id,
            "version_id": version_id,
            "version_num": new_version_num,
            "prompt_summary": f"Graph-Synthesized Edit v{new_version_num}"
        })

        # 4. Rank candidate clips per beat using customer's style, preferences, and feedback
        used_clips = set()
        decisions_created = []

        # Sort beats by beat_index
        sorted_beats = sorted(
            list(beats_map.items()),
            key=lambda item: item[1][0]["beat_index"] if item[1] else 0
        )

        for order, (b_id, candidates) in enumerate(sorted_beats, start=1):
            # Evaluate every candidate clip against customer's style preferences & historical feedback
            for cand in candidates:
                base_score = float(cand.get("total_match_score", 3.0))
                pref_score = 0.0
                pref_reasons = []

                # Evaluate against each CreatorPreference node
                for p in preferences:
                    rule_lower = p.get("rule_text", "").lower()
                    weight = float(p.get("weight", 1.0))
                    sessions = int(p.get("reinforced_sessions", 1))
                    session_factor = min(2.5, 1.0 + (sessions - 1) * 0.25)
                    eff_weight = weight * session_factor

                    # Role-to-shot style matching
                    if cand["beat_role"] == "hook" and ("hook" in rule_lower or "opening" in rule_lower):
                        if cand["shot_type"] in ("talking_head", "closeup") and ("talking head" in rule_lower or "close-up" in rule_lower or "closeup" in rule_lower):
                            bonus = round(2.5 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Favors {cand['shot_type']} on hook (+{bonus})")
                    elif cand["beat_role"] in ("demonstration", "setup") and ("demo" in rule_lower or "screen" in rule_lower or "code" in rule_lower or "technical" in rule_lower):
                        if cand["shot_type"] in ("screen", "product_shot", "closeup"):
                            bonus = round(2.5 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Prefers screen/code for demonstration (+{bonus})")
                    elif cand["beat_role"] in ("cta", "outro") and ("cta" in rule_lower or "b-roll" in rule_lower or "outro" in rule_lower or "action" in rule_lower):
                        if cand["shot_type"] in ("broll", "outdoor", "lifestyle"):
                            bonus = round(2.5 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Prefers b-roll/lifestyle for CTA (+{bonus})")

                    # Energy & pacing preference matching
                    if "high energy" in rule_lower or "high-energy" in rule_lower or "fast" in rule_lower or "rapid" in rule_lower:
                        if int(cand.get("clip_energy_level", 3)) >= 4:
                            bonus = round(1.8 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Aligns with high-energy pacing (+{bonus})")
                        elif int(cand.get("clip_energy_level", 3)) <= 2:
                            penalty = round(1.5 * eff_weight, 2)
                            pref_score -= penalty
                            pref_reasons.append(f"Penalized for low energy against preference (-{penalty})")
                    elif "calm" in rule_lower or "deliberate" in rule_lower:
                        if int(cand.get("clip_energy_level", 3)) <= 3:
                            bonus = round(1.6 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Aligns with calm pacing preference (+{bonus})")

                    # Avoidance rules from learned negative feedback
                    if "avoid" in rule_lower:
                        if cand["shot_type"] in rule_lower and cand["beat_role"] in rule_lower:
                            penalty = round(3.5 * eff_weight, 2)
                            pref_score -= penalty
                            pref_reasons.append(f"Demoted by avoidance preference (-{penalty})")

                    # Visual tag keyword matching
                    for tag in cand.get("matched_tags", []):
                        if tag in rule_lower:
                            bonus = round(0.8 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Tag '{tag}' aligns with customer style (+{bonus})")

                # Historical feedback score (Requirement 3 & 4)
                keeps = int(cand.get("keep_count", 0))
                replaces = int(cand.get("replace_count", 0))
                rejects = int(cand.get("reject_count", 0))
                fb_score = (keeps * 2.0) - (replaces * 1.0) - (rejects * 3.0)
                if keeps > 0:
                    pref_reasons.append(f"Reinforced by {keeps} previous Keep choices (+{keeps * 2.0:.1f})")
                if rejects > 0:
                    pref_reasons.append(f"Demoted by {rejects} previous Rejection choices (-{rejects * 3.0:.1f})")

                composite_score = round(base_score + pref_score + fb_score, 2)
                cand["composite_score"] = composite_score
                cand["pref_score"] = round(pref_score, 2)
                cand["fb_score"] = round(fb_score, 2)
                cand["pref_reasons"] = pref_reasons

            # Rank candidate clips descending by customer-aligned composite score
            candidates.sort(key=lambda c: c.get("composite_score", 0.0), reverse=True)

            chosen = None
            for cand in candidates:
                if cand["clip_id"] not in used_clips:
                    chosen = cand
                    used_clips.add(cand["clip_id"])
                    break
            
            # Fallback to top-ranked candidate if all clips used
            if not chosen and candidates:
                chosen = candidates[0]

            if not chosen:
                continue

            decision_id = f"dec_{uuid.uuid4().hex[:8]}"
            target_dur = float(chosen["target_duration"])
            clip_in = float(chosen["clip_in_sec"])
            clip_out = round(clip_in + target_dur, 2)
            
            # Formulate explainable AI rationale directly citing creator preferences and feedback
            matched_tags = chosen.get("matched_tags", [])
            tag_str = ", ".join(matched_tags) if matched_tags else "contextual fit"
            score = round(float(chosen.get("composite_score", chosen.get("total_match_score", 3.5))), 2)
            
            style_reasons = chosen.get("pref_reasons", [])
            style_explanation = "; ".join(style_reasons) if style_reasons else f"Honoring creator style memory: '{pref_summary[:50]}...'"
            
            rationale = (
                f"Ranked #1 for Beat #{chosen['beat_index']} ({chosen['beat_role']}) with composite score {score}/10.0 "
                f"(Base fit: {chosen['total_match_score']}, Style bonus: +{chosen['pref_score']}, Feedback: {chosen['fb_score']:+}). "
                f"Style rationale: {style_explanation}."
            )

            # Persist CutDecision node linked to EditVersion, StoryBeat, and VideoClip
            create_decision_cypher = """
            MATCH (v:EditVersion {id: $version_id})
            MATCH (b:StoryBeat {id: $beat_id})
            MATCH (c:VideoClip {id: $clip_id})
            CREATE (d:CutDecision {
                id: $decision_id,
                timeline_order: $order,
                trim_in_sec: $trim_in_sec,
                trim_out_sec: $trim_out_sec,
                track: 'V1',
                ai_rationale: $rationale,
                confidence: 0.94
            })
            CREATE (v)-[:HAS_DECISION {timeline_order: $order}]->(d)
            CREATE (d)-[:FULFILLS_BEAT {pacing_fit_score: $score}]->(b)
            CREATE (d)-[:SELECTS_CLIP {trim_in: $trim_in_sec, trim_out: $trim_out_sec}]->(c)
            RETURN d.id AS id
            """
            db.query(create_decision_cypher, {
                "version_id": version_id,
                "beat_id": b_id,
                "clip_id": chosen["clip_id"],
                "decision_id": decision_id,
                "order": order,
                "trim_in_sec": clip_in,
                "trim_out_sec": clip_out,
                "rationale": rationale,
                "score": score
            })

            decisions_created.append({
                "decision_id": decision_id,
                "order": order,
                "beat_role": chosen["beat_role"],
                "source_file": chosen["source_file"],
                "trim_in": clip_in,
                "trim_out": clip_out,
                "rationale": rationale
            })

        # 5. Render playable MP4 preview from FalkorDB cut graph
        preview_url = render_edit_version(version_id)

        # 6. Fetch full traceability
        traceability = run_traceability_query(version_id)

        return {
            "version_id": version_id,
            "version_num": new_version_num,
            "preview_url": preview_url,
            "decisions": decisions_created,
            "traceability": traceability,
            "creator_preferences_honored": pref_notes
        }

director = DirectorAgent()
