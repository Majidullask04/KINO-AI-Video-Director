"""
Gemini 2.5 Flash LLM integration for KINO AI Video Director.
Provides structured reasoning for:
1. Video frame visual analysis (shot classification, visual summary, energy, mood, tags)
2. Conversational revision prompt parsing (intent, target beat, replacement criteria)
3. Editorial rationale synthesis (why clips match story beats according to creator style)
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("ai_video_director.llm")

# Structured Pydantic Schemas for Gemini Output
class ClipVisualAnalysis(BaseModel):
    shot_type: str = Field(description="One of: talking_head, product_shot, code_screen, action, broll, closeup, lifestyle")
    energy_level: int = Field(ge=1, le=5, description="Visual and kinetic energy on a scale of 1 (calm/static) to 5 (hyper-dynamic/fast)")
    visual_summary: str = Field(description="Clear, 1-2 sentence description of subjects, camera movement, and visual action")
    tags: List[str] = Field(description="3-6 descriptive visual tags, e.g. ['developer', 'workspace', 'closeup']")
    mood: str = Field(description="Detected tone: upbeat, energetic, calm, informative, intense")
    motion_intensity: float = Field(ge=0.0, le=1.0, description="Estimated motion level between 0.0 and 1.0")

class RevisionIntent(BaseModel):
    target_beat_index: int = Field(description="1-based index of the StoryBeat targeted by the user prompt")
    target_role: str = Field(description="StoryBeat role: hook, problem, demonstration, call_to_action, or generic")
    action_type: str = Field(description="Action to perform: REPLACE_CLIP, ADJUST_PACING, SWAP_CLIPS, or ADJUST_ENERGY")
    desired_shot_type: Optional[str] = Field(default=None, description="Preferred replacement shot type if mentioned")
    desired_energy_level: Optional[int] = Field(default=None, description="Preferred energy 1-5 if specified")
    ai_rationale: str = Field(description="Professional directorial rationale explaining the change and why it improves the cut")
    learned_preference_rule: Optional[str] = Field(default=None, description="Permanent style rule inferred from prompt, or null")

class EditorialRationale(BaseModel):
    rationale: str = Field(description="2-3 sentence directorial rationale explaining why this clip fits the beat and creator style")
    key_factors: List[str] = Field(description="Key factors influencing selection, e.g. ['High kinetic hook', 'Creator style match']")


class GeminiDirectorClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.client = None
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"Gemini client initialized with model: {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not initialize google-genai client: {e}. Falling back to heuristic reasoning.")
        else:
            logger.info("No GEMINI_API_KEY detected. Running in autonomous heuristic fallback mode.")

    def is_available(self) -> bool:
        return self.client is not None

    def analyze_clip_visuals(
        self,
        frame_bytes_list: List[bytes],
        duration: float,
        filename: str,
        cv_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Uses Gemini 2.5 Flash to visually inspect sampled video frames and produce
        structured shot classification, visual summary, and tagging.
        """
        if not self.is_available() or not frame_bytes_list:
            return self._fallback_visual_analysis(filename, duration, cv_metrics)

        try:
            from google.genai import types
            
            prompt = f"""
You are an expert director and cinema assistant.
Analyze these {len(frame_bytes_list)} frames extracted from a video clip named '{filename}' (duration: {duration:.1f}s).
Computer vision edge density: {cv_metrics.get('edge_density', 0.05):.3f}, motion score: {cv_metrics.get('motion_score', 0.5):.2f}.

Provide accurate visual analysis:
1. shot_type (must be one of: talking_head, product_shot, code_screen, action, broll, closeup, lifestyle)
2. energy_level (1-5 based on motion and visual pacing)
3. visual_summary (accurate description of what is visible in these frames)
4. tags (3-5 relevant keywords)
5. mood (upbeat, energetic, calm, informative, intense)
6. motion_intensity (0.0 to 1.0)
"""
            contents = [prompt]
            for fb in frame_bytes_list[:3]:
                contents.append(types.Part.from_bytes(data=fb, mime_type="image/jpeg"))

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ClipVisualAnalysis,
                    temperature=0.2
                )
            )

            if response.text:
                parsed = json.loads(response.text)
                return {
                    "shot_type": parsed.get("shot_type", "broll").lower(),
                    "energy_level": int(parsed.get("energy_level", 3)),
                    "visual_summary": parsed.get("visual_summary", f"Visual analysis of {filename}"),
                    "tags": parsed.get("tags", ["broll", "raw_footage"]),
                    "mood": parsed.get("mood", "upbeat"),
                    "motion_score": float(parsed.get("motion_intensity", cv_metrics.get("motion_score", 0.5)))
                }
        except Exception as e:
            logger.warning(f"Gemini visual analysis failed for {filename}: {e}. Using CV fallback.")

        return self._fallback_visual_analysis(filename, duration, cv_metrics)

    def parse_revision_prompt(
        self,
        user_prompt: str,
        current_beats: List[Dict[str, Any]],
        current_decisions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Interprets natural language revision instructions from the creator (e.g.
        'Make the intro feel faster and punchier', 'Replace clip 2 with product B-roll').
        """
        if not self.is_available():
            return self._fallback_revision_parser(user_prompt, current_beats)

        try:
            from google.genai import types

            beats_context = [
                {
                    "beat_index": b.get("beat_index"),
                    "role": b.get("role"),
                    "target_duration": b.get("target_duration")
                }
                for b in current_beats
            ]
            decisions_context = [
                {
                    "order": d.get("timeline_order") or d.get("order"),
                    "shot_type": d.get("shot_type"),
                    "source_file": d.get("source_asset") or d.get("source_file"),
                    "duration": d.get("source_out_sec", 0) - d.get("source_in_sec", 0)
                }
                for d in current_decisions
            ]

            prompt = f"""
You are an autonomous Film Director editing a video timeline.
The creator gave this revision instruction:
"{user_prompt}"

Current StoryBeats:
{json.dumps(beats_context, indent=2)}

Current Cut Decisions:
{json.dumps(decisions_context, indent=2)}

Determine:
1. target_beat_index (which StoryBeat 1..N this revision applies to)
2. target_role (hook, problem, demonstration, call_to_action)
3. action_type (REPLACE_CLIP, ADJUST_PACING, SWAP_CLIPS, or ADJUST_ENERGY)
4. desired_shot_type (e.g. broll, action, code_screen, talking_head, or null if unchanged)
5. desired_energy_level (1-5 if specified, else null)
6. ai_rationale (clear explanation connecting this change to narrative flow and creator style)
7. learned_preference_rule (if the user expressed an ongoing style taste like 'Always prefer fast hooks', write a concise rule statement, else null)
"""

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RevisionIntent,
                    temperature=0.1
                )
            )

            if response.text:
                parsed = json.loads(response.text)
                return {
                    "target_order": int(parsed.get("target_beat_index", 1)),
                    "target_role": parsed.get("target_role", "hook"),
                    "action_type": parsed.get("action_type", "REPLACE_CLIP"),
                    "desired_shot_type": parsed.get("desired_shot_type"),
                    "desired_energy_level": parsed.get("desired_energy_level"),
                    "rationale": parsed.get("ai_rationale", f"Applied revision: {user_prompt}"),
                    "learned_rule": parsed.get("learned_preference_rule")
                }
        except Exception as e:
            logger.warning(f"Gemini revision prompt parsing failed: {e}. Using fallback parser.")

        return self._fallback_revision_parser(user_prompt, current_beats)

    def generate_editorial_rationale(
        self,
        beat_role: str,
        target_duration: float,
        clip_data: Dict[str, Any],
        creator_preferences: List[Dict[str, Any]]
    ) -> str:
        """
        Synthesizes human-sounding directorial rationale connecting beat requirements,
        clip visual attributes, and creator taste rules.
        """
        if not self.is_available():
            return self._fallback_editorial_rationale(beat_role, clip_data, creator_preferences)

        try:
            from google.genai import types

            pref_summary = [p.get("rule_text", "") for p in creator_preferences[:4] if p.get("rule_text")]
            prompt = f"""
Write a 1-2 sentence directorial rationale explaining why this clip was selected for this story beat:
StoryBeat: {beat_role} (target duration: {target_duration:.1f}s)
Selected Clip: {clip_data.get('filename')}, shot_type: {clip_data.get('shot_type')}, energy: {clip_data.get('energy_level')}/5, summary: {clip_data.get('visual_summary')}
Active Creator Preferences: {pref_summary}

Respond in concise professional editorial language.
"""
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3
                )
            )
            if response.text:
                return response.text.strip().replace('"', '')
        except Exception as e:
            logger.debug(f"Gemini editorial rationale generation failed: {e}")

        return self._fallback_editorial_rationale(beat_role, clip_data, creator_preferences)

    # ------------------------------------------------------------------
    # Heuristic Fallbacks (Zero External Dependency / Offline Reliability)
    # ------------------------------------------------------------------
    def _fallback_visual_analysis(self, filename: str, duration: float, cv: Dict[str, Any]) -> Dict[str, Any]:
        """Clean computer vision fallback when no Gemini API key is available."""
        motion = float(cv.get("motion_score", 0.5))
        edge_density = float(cv.get("edge_density", 0.05))
        brightness = float(cv.get("brightness", 50.0))

        # Infer shot type from visual metrics
        if edge_density > 0.12:
            shot_type = "code_screen"
            tags = ["code", "developer", "screen", "technical"]
            mood = "informative"
            summary = f"High edge density ({edge_density:.3f}) screen display showing code and structured interface elements."
        elif cv.get("skin_ratio", 0) > 0.08:
            shot_type = "talking_head"
            tags = ["talking_head", "presenter", "dialog"]
            mood = "informative"
            summary = f"Presenter dialogue framing with visible facial/skin presence ({duration:.1f}s)."
        elif motion > 0.6:
            shot_type = "action"
            tags = ["action", "kinetic", "high_motion"]
            mood = "energetic"
            summary = f"High kinetic motion scene (motion index {motion:.2f}) with rapid frame-to-frame shifts."
        else:
            shot_type = "broll"
            tags = ["broll", "workspace", "lifestyle"]
            mood = "upbeat"
            summary = f"Ambient environmental B-roll sequence captured across {duration:.1f} seconds."

        energy = max(1, min(5, int(round(motion * 4.0 + 1.0))))

        return {
            "shot_type": shot_type,
            "energy_level": energy,
            "visual_summary": summary,
            "tags": tags,
            "mood": mood,
            "motion_score": motion
        }

    def _fallback_revision_parser(self, prompt: str, beats: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Regex/keyword revision intent parser when offline."""
        p_lower = prompt.lower()
        target_order = 1
        target_role = "hook"

        # Check beat indices
        for i in range(1, len(beats) + 1):
            if f"beat {i}" in p_lower or f"clip {i}" in p_lower or f"shot {i}" in p_lower or f"part {i}" in p_lower:
                target_order = i
                break
        else:
            if "hook" in p_lower or "intro" in p_lower or "opening" in p_lower:
                target_order = 1
            elif "problem" in p_lower or "conflict" in p_lower:
                target_order = 2
            elif "demo" in p_lower or "feature" in p_lower or "product" in p_lower or "code" in p_lower:
                target_order = 3
            elif "cta" in p_lower or "outro" in p_lower or "action" in p_lower or "ending" in p_lower:
                target_order = min(4, len(beats))

        desired_shot = None
        if "broll" in p_lower or "b-roll" in p_lower:
            desired_shot = "broll"
        elif "talking head" in p_lower or "face" in p_lower or "presenter" in p_lower:
            desired_shot = "talking_head"
        elif "demo" in p_lower or "screen" in p_lower or "code" in p_lower:
            desired_shot = "product_shot"

        desired_energy = None
        if "fast" in p_lower or "punchy" in p_lower or "energy" in p_lower or "quicker" in p_lower:
            desired_energy = 5
        elif "calm" in p_lower or "slow" in p_lower or "deliberate" in p_lower:
            desired_energy = 2

        rule = None
        if "always" in p_lower or "never" in p_lower or "prefer" in p_lower:
            rule = prompt.strip()

        return {
            "target_order": target_order,
            "target_role": target_role,
            "action_type": "REPLACE_CLIP",
            "desired_shot_type": desired_shot,
            "desired_energy_level": desired_energy,
            "rationale": f"Revising beat {target_order} based on creator direction: '{prompt}'",
            "learned_rule": rule
        }

    def _fallback_editorial_rationale(
        self,
        beat_role: str,
        clip_data: Dict[str, Any],
        preferences: List[Dict[str, Any]]
    ) -> str:
        shot = clip_data.get("shot_type", "broll").replace("_", " ")
        energy = clip_data.get("energy_level", 3)
        return f"Selected {shot} clip matching {beat_role} pacing with visual energy level {energy}/5."


# Global singleton
gemini = GeminiDirectorClient()
