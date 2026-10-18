import logging
from typing import Dict, Any, List, Optional
from backend.graph.client import db
from backend.graph.queries import get_reference_beats, run_creator_preferences_query as get_creator_preferences

logger = logging.getLogger(__name__)

STANDARD_STORY_BEATS = [
    {
        "id": "beat_std_01",
        "beat_index": 1,
        "role": "hook",
        "role_label": "Opening Hook",
        "target_duration": 2.5,
        "energy_level": 5,
        "required_shot_type": "talking_head",
        "required_tags": ["face", "talking_head", "kinetic", "hook"]
    },
    {
        "id": "beat_std_02",
        "beat_index": 2,
        "role": "problem",
        "role_label": "Problem / Conflict",
        "target_duration": 3.5,
        "energy_level": 3,
        "required_shot_type": "talking_head",
        "required_tags": ["explainer", "problem", "dialog"]
    },
    {
        "id": "beat_std_03",
        "beat_index": 3,
        "role": "demonstration",
        "role_label": "Core Demonstration",
        "target_duration": 4.0,
        "energy_level": 4,
        "required_shot_type": "product_shot",
        "required_tags": ["screen", "code", "demo", "software"]
    },
    {
        "id": "beat_std_04",
        "beat_index": 4,
        "role": "call_to_action",
        "role_label": "Resolution & CTA",
        "target_duration": 3.0,
        "energy_level": 4,
        "required_shot_type": "broll",
        "required_tags": ["lifestyle", "action", "cta", "resolution"]
    }
]

# Compatibility matrix: beat role -> shot_type -> base compatibility (out of 40)
ROLE_SHOT_MATRIX = {
    "hook": {
        "talking_head": 40.0,
        "action": 38.0,
        "energetic": 38.0,
        "closeup": 32.0,
        "broll": 24.0,
        "product_shot": 20.0,
        "code_screen": 16.0,
        "generic": 22.0
    },
    "problem": {
        "talking_head": 38.0,
        "broll": 35.0,
        "closeup": 34.0,
        "product_shot": 22.0,
        "code_screen": 20.0,
        "action": 20.0,
        "generic": 24.0
    },
    "demonstration": {
        "code_screen": 40.0,
        "product_shot": 40.0,
        "screen": 38.0,
        "closeup": 32.0,
        "talking_head": 22.0,
        "broll": 18.0,
        "action": 15.0,
        "generic": 20.0
    },
    "call_to_action": {
        "talking_head": 38.0,
        "broll": 36.0,
        "lifestyle": 36.0,
        "product_shot": 32.0,
        "action": 30.0,
        "code_screen": 16.0,
        "generic": 22.0
    },
    "cta": {
        "talking_head": 38.0,
        "broll": 36.0,
        "lifestyle": 36.0,
        "product_shot": 32.0,
        "action": 30.0,
        "code_screen": 16.0,
        "generic": 22.0
    },
    "broll": {
        "broll": 40.0,
        "lifestyle": 38.0,
        "product_shot": 34.0,
        "action": 34.0,
        "closeup": 28.0,
        "talking_head": 18.0,
        "code_screen": 16.0,
        "generic": 25.0
    }
}


def analyze_clip_beat_fit(
    project_id: str,
    clip_data: Dict[str, Any],
    creator_id: str = "creator_default"
) -> Dict[str, Any]:
    """
    Evaluates where a video clip fits best across a project's StoryBeats.
    Uses computer vision attributes (shot_type, energy_level, motion, edge_density, warmth, tags),
    creator preferences, and pacing styles to rank beats from best fit down.
    """
    # 1. Fetch project reference beats (or fallback to standard narrative beats)
    beats = []
    try:
        beats = get_reference_beats(project_id)
    except Exception as e:
        logger.warning(f"Could not load reference beats from graph for project {project_id}: {e}")

    if not beats:
        beats = STANDARD_STORY_BEATS

    # 2. Fetch creator preferences
    preferences = []
    try:
        preferences = get_creator_preferences(creator_id)
    except Exception as e:
        logger.warning(f"Could not load creator preferences for {creator_id}: {e}")

    # 3. Extract clip attributes
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
        role_matrix = ROLE_SHOT_MATRIX.get(role, ROLE_SHOT_MATRIX.get("broll"))
        shot_compat = role_matrix.get(shot_type, 20.0)

        # Bonus if matches exact required_shot_type
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

        # Edge density bonus for technical demo
        if role in ("demonstration", "tutorial", "setup") and edge_density > 0.08:
            tag_score = min(10.0, tag_score + 3.0)
        # Motion bonus for hook/kinetic
        if role in ("hook", "intro") and motion_score > 0.6:
            tag_score = min(10.0, tag_score + 3.0)

        # E. Customer Style & Taste Alignment (Max 15 pts, or negative penalty)
        pref_score = 0.0
        pref_reasons = []

        for p in preferences:
            rule_text = p.get("rule_text", "").lower()
            weight = float(p.get("weight", 1.0))
            sessions = int(p.get("reinforced_sessions", 1))
            eff_weight = min(2.0, weight * (1.0 + (sessions - 1) * 0.15))

            # Avoidance rules check
            if "avoid" in rule_text:
                if shot_type in rule_text and role in rule_text:
                    penalty = round(20.0 * eff_weight, 1)
                    pref_score -= penalty
                    pref_reasons.append(f"Penalized by avoidance rule: '{p.get('rule_text')}' (-{penalty})")
                continue

            # Hook style preference
            if role in ("hook", "intro") and ("hook" in rule_text or "lead" in rule_text):
                if shot_type in ("talking_head", "closeup") and ("talking head" in rule_text or "close-up" in rule_text):
                    bonus = round(6.0 * eff_weight, 1)
                    pref_score += bonus
                    pref_reasons.append(f"Satisfies creator style: '{p.get('rule_text')}' (+{bonus})")

            # Demonstration style preference
            if role in ("demonstration", "setup") and ("demo" in rule_text or "code" in rule_text or "screen" in rule_text):
                if shot_type in ("code_screen", "product_shot", "screen"):
                    bonus = round(6.0 * eff_weight, 1)
                    pref_score += bonus
                    pref_reasons.append(f"Satisfies creator style: '{p.get('rule_text')}' (+{bonus})")

            # Pacing / Energy preference
            if "high energy" in rule_text or "fast" in rule_text or "rapid" in rule_text:
                if energy_level >= 4:
                    bonus = round(3.5 * eff_weight, 1)
                    pref_score += bonus
                    pref_reasons.append(f"Satisfies high-energy pacing taste (+{bonus})")
                elif energy_level <= 2:
                    penalty = round(4.0 * eff_weight, 1)
                    pref_score -= penalty
                    pref_reasons.append(f"Discounts low energy against pacing preference (-{penalty})")

        # Sum total raw score
        total_raw = shot_compat + energy_score + dur_score + tag_score + pref_score
        # Normalize to 0-100%
        fit_percentage = max(10.0, min(99.0, round(total_raw, 1)))

        # Assign Tier
        if fit_percentage >= 88.0:
            tier = "HIGHLY RECOMMENDED"
        elif fit_percentage >= 72.0:
            tier = "STRONG FIT"
        elif fit_percentage >= 50.0:
            tier = "ALTERNATIVE FIT"
        else:
            tier = "NOT RECOMMENDED"

        # Construct Explainable Rationale
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
            "rank": 0,  # Will assign after sort
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

    # Sort descending by fit percentage
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
