import uuid
import logging
from typing import Dict, Any, List, Optional

from backend.graph.client import db
from backend.graph.queries import (
    run_beat_matching_query,
    run_creator_preferences_query,
    run_traceability_query,
    get_reference_beats
)
from backend.beats import DEFAULT_BEAT_TEMPLATES, ROLE_SHOT_MATRIX, get_shot_compatibility
from backend.llm import gemini
from backend.video.renderer import render_edit_version

logger = logging.getLogger(__name__)

class DirectorAgent:
    """
    Synthesizes an edit plan using multi-hop Cypher traversals in FalkorDB and Gemini 2.5 Flash reasoning.
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
            for cand in candidates:
                base_score = float(cand.get("total_match_score", 3.0))
                pref_score = 0.0
                pref_reasons = []

                # Shot type affinity from canonical matrix
                compat = get_shot_compatibility(cand.get("beat_role", ""), cand.get("shot_type", ""))
                shot_bonus = round((compat - 20.0) / 10.0, 2)
                base_score += shot_bonus

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
                        if cand["shot_type"] in ("screen", "product_shot", "code_screen", "closeup"):
                            bonus = round(2.5 * eff_weight, 2)
                            pref_score += bonus
                            pref_reasons.append(f"Prefers screen/code for demonstration (+{bonus})")
                    elif cand["beat_role"] in ("call_to_action", "cta", "outro") and ("cta" in rule_lower or "b-roll" in rule_lower or "outro" in rule_lower or "action" in rule_lower):
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

                # Historical feedback score
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
            score = round(float(chosen.get("composite_score", chosen.get("total_match_score", 3.5))), 2)

            # Formulate Gemini or heuristic directorial rationale
            ai_rationale = gemini.generate_editorial_rationale(
                beat_role=chosen["beat_role"],
                target_duration=target_dur,
                clip_data={
                    "filename": chosen.get("source_file"),
                    "shot_type": chosen.get("shot_type"),
                    "energy_level": chosen.get("clip_energy_level", 3),
                    "visual_summary": chosen.get("visual_summary", "")
                },
                creator_preferences=preferences
            )

            style_reasons = chosen.get("pref_reasons", [])
            style_explanation = "; ".join(style_reasons) if style_reasons else f"Honoring creator style memory: '{pref_summary[:50]}...'"
            
            full_rationale = (
                f"Ranked #1 for Beat #{chosen['beat_index']} ({chosen['beat_role']}) with composite score {score}/10.0. "
                f"{ai_rationale} "
                f"Style alignment: {style_explanation}."
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
                "rationale": full_rationale,
                "score": score
            })

            decisions_created.append({
                "decision_id": decision_id,
                "order": order,
                "beat_role": chosen["beat_role"],
                "source_file": chosen["source_file"],
                "trim_in": clip_in,
                "trim_out": clip_out,
                "rationale": full_rationale
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

    def analyze_clip_beat_fit(
        self,
        project_id: str,
        clip_data: Dict[str, Any],
        creator_id: str = "creator_default"
    ) -> Dict[str, Any]:
        """
        Evaluates where a video clip fits best across a project's StoryBeats.
        Uses computer vision attributes, canonical beat compatibility matrix,
        and creator taste memory to rank beats from best fit down.
        """
        beats = []
        try:
            beats = get_reference_beats(project_id)
        except Exception as e:
            logger.warning(f"Could not load reference beats from graph for project {project_id}: {e}")

        if not beats:
            beats = DEFAULT_BEAT_TEMPLATES

        preferences = []
        try:
            preferences = run_creator_preferences_query(creator_id)
        except Exception as e:
            logger.warning(f"Could not load creator preferences for {creator_id}: {e}")

        clip_id = clip_data.get("clip_id") or clip_data.get("id") or "clip_temp"
        filename = clip_data.get("filename") or "uploaded_clip.mp4"
        shot_type = (clip_data.get("shot_type") or "broll").lower().replace(" ", "_")
        energy_level = int(clip_data.get("energy_level", 3))
        duration = float(clip_data.get("clip_duration") or clip_data.get("duration") or 3.0)
        motion_score = float(clip_data.get("motion_score", 0.5))
        edge_density = float(clip_data.get("edge_density", 0.05))
        tags = [t.lower() for t in clip_data.get("tags", [])]
        visual_summary = clip_data.get("visual_summary") or f"Analysis of {shot_type} cut ({duration:.1f}s, energy {energy_level})"

        ranked_recommendations = []

        for beat in beats:
            beat_id = beat.get("id") or f"beat_{beat.get('beat_index', 1)}"
            beat_index = int(beat.get("beat_index", 1))
            role = (beat.get("role") or "generic").lower()
            role_label = beat.get("role_label") or role.replace("_", " ").title()
            target_dur = float(beat.get("target_duration", 3.0))
            target_energy = int(beat.get("energy_level", 3))
            req_shot = (beat.get("required_shot_type") or "").lower()
            req_tags = [t.lower() for t in beat.get("required_tags", [])]

            # A. Shot Type Compatibility (Max 40 pts)
            shot_compat = get_shot_compatibility(role, shot_type)
            if req_shot and (req_shot == shot_type or req_shot in shot_type or shot_type in req_shot):
                shot_compat = min(40.0, shot_compat + 6.0)

            # B. Pacing & Energy Alignment (Max 25 pts)
            energy_diff = abs(energy_level - target_energy)
            if energy_diff == 0:
                energy_score = 25.0
            elif energy_diff == 1:
                energy_score = 18.0
            elif energy_diff == 2:
                energy_score = 10.0
            else:
                energy_score = 4.0

            # C. Duration Fit (Max 15 pts)
            if duration >= target_dur:
                dur_score = 15.0
            else:
                dur_score = round(15.0 * (duration / max(0.5, target_dur)), 1)

            # D. Visual Details & Tags Affinity (Max 10 pts)
            tag_overlap = set(tags).intersection(set(req_tags))
            tag_score = min(10.0, len(tag_overlap) * 3.5)
            if role in ("demonstration", "tutorial", "setup") and edge_density > 0.08:
                tag_score = min(10.0, tag_score + 3.0)
            if role in ("hook", "intro") and motion_score > 0.6:
                tag_score = min(10.0, tag_score + 3.0)

            # E. Creator Style & Taste Alignment (Max 15 pts)
            pref_score = 0.0
            pref_reasons = []

            for p in preferences:
                rule_text = p.get("rule_text", "").lower()
                weight = float(p.get("weight", 1.0))
                sessions = int(p.get("reinforced_sessions", 1))
                eff_weight = min(2.0, weight * (1.0 + (sessions - 1) * 0.15))

                if "avoid" in rule_text:
                    if shot_type in rule_text and role in rule_text:
                        penalty = round(20.0 * eff_weight, 1)
                        pref_score -= penalty
                        pref_reasons.append(f"Penalized by avoidance rule: '{p.get('rule_text')}' (-{penalty})")
                    continue

                if role in ("hook", "intro") and ("hook" in rule_text or "lead" in rule_text):
                    if shot_type in ("talking_head", "closeup") and ("talking head" in rule_text or "close-up" in rule_text):
                        bonus = round(6.0 * eff_weight, 1)
                        pref_score += bonus
                        pref_reasons.append(f"Satisfies creator style: '{p.get('rule_text')}' (+{bonus})")

                if role in ("demonstration", "setup") and ("demo" in rule_text or "code" in rule_text or "screen" in rule_text):
                    if shot_type in ("code_screen", "product_shot", "screen"):
                        bonus = round(6.0 * eff_weight, 1)
                        pref_score += bonus
                        pref_reasons.append(f"Satisfies creator style: '{p.get('rule_text')}' (+{bonus})")

                if "high energy" in rule_text or "fast" in rule_text or "rapid" in rule_text:
                    if energy_level >= 4:
                        bonus = round(3.5 * eff_weight, 1)
                        pref_score += bonus
                        pref_reasons.append(f"Satisfies high-energy pacing taste (+{bonus})")
                    elif energy_level <= 2:
                        penalty = round(4.0 * eff_weight, 1)
                        pref_score -= penalty
                        pref_reasons.append(f"Discounts low energy against pacing preference (-{penalty})")

            total_raw = shot_compat + energy_score + dur_score + tag_score + pref_score
            fit_percentage = max(10.0, min(99.0, round(total_raw, 1)))

            if fit_percentage >= 88.0:
                tier = "HIGHLY RECOMMENDED"
            elif fit_percentage >= 72.0:
                tier = "STRONG FIT"
            elif fit_percentage >= 50.0:
                tier = "ALTERNATIVE FIT"
            else:
                tier = "NOT RECOMMENDED"

            # Directorial rationale
            rationale_parts = []
            if shot_compat >= 35.0:
                rationale_parts.append(f"Detected as '{shot_type}', which is an ideal match for {role_label}.")
            elif shot_compat >= 25.0:
                rationale_parts.append(f"Shot type '{shot_type}' works moderately well for {role_label}.")
            else:
                rationale_parts.append(f"Shot type '{shot_type}' differs from standard {role_label} framing.")

            if energy_diff == 0:
                rationale_parts.append(f"Visual energy ({energy_level}/5) perfectly matches target beat energy.")
            elif energy_diff == 1:
                rationale_parts.append(f"Pacing ({energy_level}/5) is close to desired beat energy ({target_energy}/5).")
            else:
                rationale_parts.append(f"Energy disparity: clip has energy {energy_level}/5 vs beat target {target_energy}/5.")

            if pref_reasons:
                rationale_parts.append(f"Creator Taste: {'; '.join(pref_reasons)}.")

            rationale = " ".join(rationale_parts)

            ranked_recommendations.append({
                "rank": 0,
                "beat_id": beat_id,
                "beat_index": beat_index,
                "role": role,
                "role_label": role_label,
                "target_duration": target_dur,
                "required_shot_type": req_shot or "any",
                "fit_percentage": fit_percentage,
                "recommendation_tier": tier,
                "breakdown": {
                    "shot_type_score": round(shot_compat, 1),
                    "energy_score": round(energy_score, 1),
                    "duration_score": round(dur_score, 1),
                    "visual_tag_score": round(tag_score, 1),
                    "preference_bonus": round(pref_score, 1)
                },
                "rationale": rationale
            })

        ranked_recommendations.sort(key=lambda r: r["fit_percentage"], reverse=True)
        for idx, rec in enumerate(ranked_recommendations, start=1):
            rec["rank"] = idx

        best_fit = ranked_recommendations[0] if ranked_recommendations else None

        return {
            "clip_id": clip_id,
            "filename": filename,
            "shot_type": shot_type,
            "energy_level": energy_level,
            "duration": duration,
            "motion_score": motion_score,
            "edge_density": edge_density,
            "visual_summary": visual_summary,
            "tags": tags,
            "best_fit_beat": best_fit,
            "ranked_recommendations": ranked_recommendations
        }

# Global singleton
director = DirectorAgent()

def analyze_clip_beat_fit(project_id: str, clip_data: Dict[str, Any], creator_id: str = "creator_default") -> Dict[str, Any]:
    """Module-level helper matching previous fit_analyzer interface."""
    return director.analyze_clip_beat_fit(project_id, clip_data, creator_id)
