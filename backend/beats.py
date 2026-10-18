"""
Canonical StoryBeat definitions and shot compatibility matrix for KINO AI Video Director.
Eliminates contradictory beat lists and provides a single source of truth across all agents.
"""

from typing import Dict, Any, List, Optional

# Standard 4-beat narrative progression for autonomous YouTube / commercial directing
DEFAULT_BEAT_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "beat_std_01",
        "beat_index": 1,
        "role": "hook",
        "role_label": "Opening Hook",
        "target_duration": 2.5,
        "energy_level": 5,
        "required_shot_type": "talking_head",
        "required_tags": ["face", "talking_head", "kinetic", "hook"],
        "transition": "cut"
    },
    {
        "id": "beat_std_02",
        "beat_index": 2,
        "role": "problem",
        "role_label": "Problem / Conflict",
        "target_duration": 3.5,
        "energy_level": 3,
        "required_shot_type": "talking_head",
        "required_tags": ["explainer", "problem", "dialog"],
        "transition": "cut"
    },
    {
        "id": "beat_std_03",
        "beat_index": 3,
        "role": "demonstration",
        "role_label": "Core Demonstration",
        "target_duration": 4.0,
        "energy_level": 4,
        "required_shot_type": "product_shot",
        "required_tags": ["screen", "code", "demo", "software"],
        "transition": "cut"
    },
    {
        "id": "beat_std_04",
        "beat_index": 4,
        "role": "call_to_action",
        "role_label": "Resolution & CTA",
        "target_duration": 3.0,
        "energy_level": 4,
        "required_shot_type": "broll",
        "required_tags": ["lifestyle", "action", "cta", "resolution"],
        "transition": "fade_out"
    }
]

# Compatibility matrix: beat role -> shot_type -> base compatibility (out of 40)
ROLE_SHOT_MATRIX: Dict[str, Dict[str, float]] = {
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

def get_beat_template(index: int) -> Dict[str, Any]:
    """Returns canonical beat template by index (1-based)."""
    idx = max(0, min(len(DEFAULT_BEAT_TEMPLATES) - 1, index - 1))
    return DEFAULT_BEAT_TEMPLATES[idx]

def get_shot_compatibility(beat_role: str, shot_type: str) -> float:
    """Returns shot compatibility score (0-40) for a given beat role and shot type."""
    role_key = (beat_role or "broll").lower()
    shot_key = (shot_type or "generic").lower().replace(" ", "_")
    matrix = ROLE_SHOT_MATRIX.get(role_key, ROLE_SHOT_MATRIX["broll"])
    return matrix.get(shot_key, 20.0)
