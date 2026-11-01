"""
HyperFrames HTML Composition Parser and Synchronizer.
Reads data-start, data-duration, data-track-index, and data-beat-role
from the project's index.html and maps them to timeline CutDecision objects.
Also provides bidirectional writing back to HTML on disk.
"""

import os
import re
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("hyperframes.parser")

PROJECTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "projects"))

CLIP_TAG_REGEX = re.compile(
    r'<(?P<tag>[a-zA-Z0-9]+)\s+[^>]*class=["\'][^"\']*\bclip\b[^"\']*["\'][^>]*>',
    re.IGNORECASE | re.DOTALL
)

ATTR_REGEX = {
    "id": re.compile(r'id=["\']([^"\']+)["\']'),
    "data-start": re.compile(r'data-start=["\']([^"\']+)["\']'),
    "data-duration": re.compile(r'data-duration=["\']([^"\']+)["\']'),
    "data-track-index": re.compile(r'data-track-index=["\']([^"\']+)["\']'),
    "data-track-kind": re.compile(r'data-track-kind=["\']([^"\']+)["\']'),
    "data-beat-role": re.compile(r'data-beat-role=["\']([^"\']+)["\']'),
    "data-composition-src": re.compile(r'data-composition-src=["\']([^"\']+)["\']'),
}

def parse_composition_html(html_content: str) -> List[Dict[str, Any]]:
    """
    Parses all elements containing the class 'clip' along with timing attributes.
    Returns a structured list of timeline decisions.
    """
    decisions = []
    
    # Also find audio tags or clips without explicit class="clip" if they have data-start and data-duration
    element_pattern = re.compile(
        r'<(?P<tag>[a-zA-Z0-9]+)\s+(?P<attrs>[^>]*(?:data-start|class=["\'][^"\']*\bclip\b)[^>]*)>',
        re.IGNORECASE
    )

    matches = element_pattern.finditer(html_content)
    index = 1

    for m in matches:
        attrs_str = m.group("attrs")
        tag_name = m.group("tag").lower()

        # Skip root container
        if 'id="root"' in attrs_str or "id='root'" in attrs_str:
            continue

        clip_id_m = ATTR_REGEX["id"].search(attrs_str)
        clip_id = clip_id_m.group(1) if clip_id_m else f"clip-{index}"

        start_m = ATTR_REGEX["data-start"].search(attrs_str)
        if not start_m:
            continue
        try:
            start_sec = float(start_m.group(1))
        except ValueError:
            start_sec = 0.0

        dur_m = ATTR_REGEX["data-duration"].search(attrs_str)
        if not dur_m:
            continue
        try:
            dur_sec = float(dur_m.group(1))
        except ValueError:
            dur_sec = 3.0

        track_m = ATTR_REGEX["data-track-index"].search(attrs_str)
        track_index = int(track_m.group(1)) if track_m else (3 if tag_name == "audio" else 1)

        kind_m = ATTR_REGEX["data-track-kind"].search(attrs_str)
        track_kind = kind_m.group(1) if kind_m else ("audio" if tag_name == "audio" else "video")

        role_m = ATTR_REGEX["data-beat-role"].search(attrs_str)
        role = role_m.group(1) if role_m else f"BEAT_{index}"

        sub_src_m = ATTR_REGEX["data-composition-src"].search(attrs_str)
        composition_src = sub_src_m.group(1) if sub_src_m else None

        # Find any inner video or audio src if present near this tag
        # Lookahead up to 400 chars
        lookahead = html_content[m.end():m.end() + 400]
        src_m = re.search(r'src=["\']([^"\']+)["\']', lookahead)
        source_asset = composition_src or (src_m.group(1) if src_m else f"asset_{index}.mp4")
        if source_asset.startswith("assets/"):
            source_asset = source_asset.replace("assets/", "")

        decisions.append({
            "decision_id": clip_id,
            "order": index,
            "track": f"V{track_index}" if track_kind != "audio" else f"A{track_index}",
            "track_index": track_index,
            "track_kind": track_kind,
            "narrative_beat": role,
            "source_asset": source_asset,
            "clip_id": clip_id,
            "source_in_sec": round(start_sec, 2),
            "source_out_sec": round(start_sec + dur_sec, 2),
            "duration": round(dur_sec, 2),
            "shot_type": "dynamic_clip",
            "explanation": f"Synced from index.html element #{clip_id} at {start_sec:.2f}s"
        })
        index += 1

    # Sort decisions by start time then track
    decisions.sort(key=lambda d: (d["source_in_sec"], d["track_index"]))
    return decisions

def get_project_decisions(project_id: str) -> List[Dict[str, Any]]:
    """Reads index.html for project_id and parses all clips."""
    index_path = os.path.join(PROJECTS_DIR, project_id, "index.html")
    if not os.path.exists(index_path):
        return []
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        return parse_composition_html(content)
    except Exception as e:
        logger.error(f"Error parsing index.html for {project_id}: {e}")
        return []

def update_clip_timing_in_html(
    project_id: str,
    clip_id: str,
    new_start: float,
    new_duration: float,
    new_track_index: Optional[int] = None
) -> bool:
    """
    Directly updates data-start and data-duration attributes for a target element
    in the project's index.html without re-writing or corrupting other parts of the DOM.
    """
    index_path = os.path.join(PROJECTS_DIR, project_id, "index.html")
    if not os.path.exists(index_path):
        return False

    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Pattern to match opening tag of the element with id=clip_id
    pattern = re.compile(
        rf'(<[a-zA-Z0-9]+\s+[^>]*id=["\']{re.escape(clip_id)}["\'][^>]*>)',
        re.IGNORECASE
    )

    match = pattern.search(html)
    if not match:
        # Fallback: if id not directly matched, find target clip by class="clip"
        clip_matches = list(re.finditer(r'(<[a-zA-Z0-9]+\s+[^>]*class=["\'][^"\']*\bclip\b[^"\']*["\'][^>]*>)', html, re.IGNORECASE))
        if clip_matches:
            try:
                idx = int(clip_id.split("-")[-1]) if "-" in clip_id else 0
                if 0 <= idx < len(clip_matches):
                    match = clip_matches[idx]
                else:
                    match = clip_matches[0]
            except Exception:
                match = clip_matches[0]

    if not match:
        return False

    tag_str = match.group(1)
    new_tag = tag_str

    # Replace data-start
    if 'data-start="' in new_tag:
        new_tag = re.sub(r'data-start=["\'][^"\']+["\']', f'data-start="{new_start:.2f}"', new_tag)
    else:
        new_tag = new_tag[:-1] + f' data-start="{new_start:.2f}">'

    # Replace data-duration
    if 'data-duration="' in new_tag:
        new_tag = re.sub(r'data-duration=["\'][^"\']+["\']', f'data-duration="{new_duration:.2f}"', new_tag)
    else:
        new_tag = new_tag[:-1] + f' data-duration="{new_duration:.2f}">'

    # Replace track index if supplied
    if new_track_index is not None:
        if 'data-track-index="' in new_tag:
            new_tag = re.sub(r'data-track-index=["\'][^"\']+["\']', f'data-track-index="{new_track_index}"', new_tag)
        else:
            new_tag = new_tag[:-1] + f' data-track-index="{new_track_index}">'

    updated_html = html[:match.start()] + new_tag + html[match.end():]

    with open(index_path, "w", encoding="utf-8") as f:
        f.write(updated_html)

    # Also update meta.json duration if this clip extends past current duration
    meta_path = os.path.join(PROJECTS_DIR, project_id, "meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as mf:
                meta = json.load(mf)
            clip_end = new_start + new_duration
            if clip_end > meta.get("duration", 0):
                meta["duration"] = round(clip_end, 2)
                with open(meta_path, "w", encoding="utf-8") as mf:
                    json.dump(meta, mf, indent=2)
        except Exception as e:
            logger.warning(f"Failed to update meta.json duration: {e}")

    return True

