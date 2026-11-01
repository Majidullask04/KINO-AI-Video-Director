"""
Local Filesystem Workspace Manager for HyperFrames Projects.
Directly creates, reads, and mutates project folders and control documents:
- meta.json
- STORYBOARD.md
- frame.md
- SCRIPT.md
- HANDOFF.md
- index.html
- assets/ & manifest.json
- Local Git repository (.git/) for checkpoint history & rollback
- Agent skill rules (HYPERFRAMES_RULES.md, CLAUDE.md, GEMINI.md)
"""

import os
import re
import json
import time
import subprocess
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("kino.workspace")

PROJECTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "projects"))
BIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "bin"))
BIN_FFPROBE = os.path.join(BIN_DIR, "ffprobe")
BIN_FFMPEG = os.path.join(BIN_DIR, "ffmpeg")

def ensure_projects_root() -> str:
    """Ensures the root projects/ directory exists."""
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    return PROJECTS_DIR

def get_project_dir(project_id: str) -> str:
    """Returns absolute path to a specific project directory."""
    ensure_projects_root()
    return os.path.join(PROJECTS_DIR, project_id)

def probe_media_file(filepath: str) -> Dict[str, Any]:
    """
    Extracts exact media telemetry using bin/ffprobe:
    duration, resolution, fps, audio channels, bit rate, and codecs.
    """
    if not os.path.exists(filepath):
        return {}

    filename = os.path.basename(filepath)
    filesize = os.path.getsize(filepath)

    if not os.path.exists(BIN_FFPROBE):
        return {
            "filename": filename,
            "duration": 4.0,
            "width": 1920,
            "height": 1080,
            "fps": 30.0,
            "filesize_bytes": filesize,
            "has_audio": False,
            "has_video": True,
            "codec": "unknown"
        }

    try:
        res = subprocess.run([
            BIN_FFPROBE, "-v", "error",
            "-show_format", "-show_streams",
            "-print_format", "json",
            filepath
        ], capture_output=True, text=True, timeout=10)

        if res.returncode != 0:
            logger.warning(f"ffprobe failed for {filename}: {res.stderr}")
            return {"filename": filename, "filesize_bytes": filesize}

        data = json.loads(res.stdout)
        fmt = data.get("format", {})
        streams = data.get("streams", [])

        duration = float(fmt.get("duration") or 0.0)
        bit_rate = int(fmt.get("bit_rate") or 0)

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        width = int(video_stream.get("width") or 0) if video_stream else 0
        height = int(video_stream.get("height") or 0) if video_stream else 0

        # Calculate FPS
        fps = 30.0
        if video_stream:
            r_fps = video_stream.get("r_frame_rate", "30/1")
            try:
                num, den = map(float, r_fps.split("/"))
                fps = round(num / den, 2) if den > 0 else 30.0
            except Exception:
                fps = 30.0

        aspect_ratio = "16:9"
        if width > 0 and height > 0:
            if width == height:
                aspect_ratio = "1:1"
            elif height > width:
                aspect_ratio = "9:16"
            else:
                aspect_ratio = "16:9"

        return {
            "filename": filename,
            "filepath": os.path.abspath(filepath),
            "filesize_bytes": filesize,
            "duration": round(duration, 2),
            "width": width,
            "height": height,
            "fps": fps,
            "aspect_ratio": aspect_ratio,
            "has_video": video_stream is not None,
            "has_audio": audio_stream is not None,
            "video_codec": video_stream.get("codec_name") if video_stream else None,
            "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
            "audio_channels": int(audio_stream.get("channels") or 0) if audio_stream else 0,
            "sample_rate": int(audio_stream.get("sample_rate") or 0) if audio_stream else 0,
            "bit_rate": bit_rate
        }
    except Exception as e:
        logger.error(f"Error probing {filepath} with ffprobe: {e}")
        return {"filename": filename, "filesize_bytes": filesize}

def generate_project_manifest(project_id: str) -> List[Dict[str, Any]]:
    """
    Inspects all media files in projects/<id>/assets/,
    generates assets/manifest.json, and updates STORYBOARD.md.
    """
    proj_dir = get_project_dir(project_id)
    assets_dir = os.path.join(proj_dir, "assets")
    if not os.path.isdir(assets_dir):
        return []

    manifest = []
    for f in sorted(os.listdir(assets_dir)):
        if f.startswith(".") or f == "manifest.json":
            continue
        full_path = os.path.join(assets_dir, f)
        if not os.path.isfile(full_path):
            continue

        telemetry = probe_media_file(full_path)
        f_lower = f.lower()
        shot_type = "BROLL"
        if "hook" in f_lower or "head" in f_lower:
            shot_type = "TALKING_HEAD"
        elif "code" in f_lower or "problem" in f_lower:
            shot_type = "CODE_SCREEN"
        elif "product" in f_lower or "solution" in f_lower or "demo" in f_lower:
            shot_type = "PRODUCT_SHOT"

        dur = telemetry.get("duration", 4.0)
        telemetry["clip_id"] = f"clip_{os.path.splitext(f)[0]}"
        telemetry["url"] = f"/api/projects/{project_id}/assets/{f}"
        telemetry["video_url"] = f"/api/projects/{project_id}/assets/{f}"
        telemetry["clip_duration"] = dur
        telemetry["in_sec"] = 0.0
        telemetry["out_sec"] = dur
        telemetry["shot_type"] = shot_type
        telemetry["energy_level"] = 4
        telemetry["motion_score"] = 0.35
        telemetry["edge_density"] = 0.08
        telemetry["tags"] = [shot_type, "READY"]
        telemetry["visual_summary"] = f"Media clip: {f} ({dur:.1f}s)"
        manifest.append(telemetry)

    # Save manifest.json
    manifest_path = os.path.join(assets_dir, "manifest.json")
    try:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump({
                "project_id": project_id,
                "updated_at": int(time.time() * 1000),
                "total_assets": len(manifest),
                "assets": manifest
            }, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not write manifest.json: {e}")

    # Inject asset table into STORYBOARD.md
    update_storyboard_with_manifest(project_id, manifest)

    return manifest

def update_storyboard_with_manifest(project_id: str, manifest: List[Dict[str, Any]]):
    """Appends or updates the Available Media Assets table in STORYBOARD.md."""
    proj_dir = get_project_dir(project_id)
    storyboard_path = os.path.join(proj_dir, "STORYBOARD.md")
    if not os.path.exists(storyboard_path):
        return

    try:
        with open(storyboard_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Build Markdown table
        table_lines = [
            "## Available Media Assets (from assets/manifest.json)\n",
            "| Filename | Type | Duration | Resolution | FPS | Audio |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |"
        ]
        for a in manifest:
            kind = "Video" if a.get("has_video") else ("Audio" if a.get("has_audio") else "Image/Other")
            dur = f"{a.get('duration', 0):.2f}s"
            res = f"{a.get('width', 0)}x{a.get('height', 0)}" if a.get("width") else "N/A"
            fps = f"{a.get('fps', 0):.0f}" if a.get("has_video") else "N/A"
            audio = "Yes" if a.get("has_audio") else "No"
            table_lines.append(f"| `{a.get('filename')}` | {kind} | {dur} | {res} | {fps} | {audio} |")
        table_str = "\n".join(table_lines) + "\n"

        # Replace existing table or append
        pattern = re.compile(r"## Available Media Assets.*?(?=\n## |\Z)", re.DOTALL)
        if pattern.search(content):
            updated = pattern.sub(table_str.strip(), content)
        else:
            updated = content.rstrip() + "\n\n" + table_str

        with open(storyboard_path, "w", encoding="utf-8") as f:
            f.write(updated)
    except Exception as e:
        logger.warning(f"Could not update STORYBOARD.md with manifest: {e}")

def provision_hyperframes_skills(proj_dir: str):
    """
    Provisions HyperFrames Agent Skill rules, contract specification,
    and automatic instructions (CLAUDE.md & GEMINI.md) into the workspace.
    """
    rules_content = """# HyperFrames Agent Skill & Render Contract Rules
> **Contract Requirement**: You are authoring a deterministic HyperFrames HTML video composition.
> Every change you make to `index.html` must pass `npx hyperframes check` with 0 errors.

## Core Rules for HTML/CSS/GSAP Compositions
1. **Root Stage Container**:
   - The stage must be `<div id="root" style="width: 1920px; height: 1080px; position: relative; overflow: hidden; background: #000;">`.
2. **Deterministic Clip Declaration**:
   - Every timed visual or audio clip MUST have `class="clip"`, `data-start="X.XX"`, and `data-duration="Y.YY"`.
   - Video clips on track 1: `<video class="clip" data-start="0.00" data-duration="3.00" data-track-index="1" data-track-kind="video" data-has-audio="false" muted preload="auto" playsinline style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 1;">`
   - Audio tracks on track 3: `<audio id="master-audio" class="clip" src="assets/..." data-start="0.00" data-duration="..." data-track-index="3" data-track-kind="audio" preload="auto">`
3. **No Audio with Mute Conflict**:
   - If a `<video>` has `muted`, set `data-has-audio="false"`. If `data-has-audio="true"`, omit the `muted` attribute.
4. **GSAP Paused Root Timeline Contract**:
   - The root timeline MUST be created, attached to window, and paused on frame 0:
     ```javascript
     const tl = gsap.timeline({ paused: true });
     window.__timelines = window.__timelines || {};
     window.__timelines["main"] = tl;
     tl.seek(0);
     ```
5. **Initial Opacity for Overlays & Subsequent Cuts**:
   - Any element with `data-start > 0` must start with inline `style="opacity: 0;"` (or `gsap.set(el, { opacity: 0 })`) so it does not flash or cover earlier render frames.
6. **No CSS Transform Conflicts**:
   - Do NOT set `transform: scale(...)` in CSS if GSAP animates scale. Use GSAP `scale: ...` properties directly.
7. **Type Floor & Contrast**:
   - All reading text must have `font-size >= 28px` (2.6% of 1080px short side) or carry `data-layout-ignore="true"`.
   - All text must pass WCAG AA contrast against its background.
8. **Consult Telemetry Before Editing**:
   - Check `assets/manifest.json` and `STORYBOARD.md` to ensure your clip durations and source filenames match real media.
"""
    rules_file = os.path.join(proj_dir, "HYPERFRAMES_RULES.md")
    with open(rules_file, "w", encoding="utf-8") as f:
        f.write(rules_content)

    # Auto-provision CLAUDE.md & GEMINI.md for terminal agents
    agent_guide = f"""# Agent Instructions for this Video Project
Before writing code or editing files, read `HYPERFRAMES_RULES.md`, `STORYBOARD.md`, and `assets/manifest.json`.
When modifying `index.html`, always maintain the paused GSAP timeline on `window.__timelines['main']` and ensure `class="clip"`, `data-start`, and `data-duration` are preserved.
Run `npx hyperframes check` to verify your changes.
"""
    for ag_file in ["CLAUDE.md", "GEMINI.md"]:
        target = os.path.join(proj_dir, ag_file)
        with open(target, "w", encoding="utf-8") as f:
            f.write(agent_guide)

def list_projects() -> List[Dict[str, Any]]:
    """Scans projects/ folder and returns metadata for each project found."""
    ensure_projects_root()
    projects = []
    
    if not os.path.exists(PROJECTS_DIR):
        return []

    for name in sorted(os.listdir(PROJECTS_DIR)):
        proj_path = os.path.join(PROJECTS_DIR, name)
        if not os.path.isdir(proj_path):
            continue

        meta_file = os.path.join(proj_path, "meta.json")
        if os.path.exists(meta_file):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    projects.append(meta)
            except Exception as e:
                logger.warning(f"Error reading meta.json for {name}: {e}")
        else:
            projects.append({
                "id": name,
                "title": name.replace("_", " ").title(),
                "target_duration": 12.0,
                "aspect_ratio": "16:9",
                "created_at": int(os.path.getctime(proj_path) * 1000)
            })

    return projects

def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full details of a project from disk including manifest and files."""
    proj_dir = get_project_dir(project_id)
    if not os.path.isdir(proj_dir):
        return None

    meta_file = os.path.join(proj_dir, "meta.json")
    meta = {}
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            logger.error(f"Error reading {meta_file}: {e}")

    if not meta:
        meta = {
            "id": project_id,
            "title": project_id.replace("_", " ").title(),
            "target_duration": 12.0,
            "aspect_ratio": "16:9",
            "created_at": int(time.time() * 1000)
        }

    # Discover assets & manifest
    assets_dir = os.path.join(proj_dir, "assets")
    manifest_file = os.path.join(assets_dir, "manifest.json")
    if os.path.exists(manifest_file):
        try:
            with open(manifest_file, "r", encoding="utf-8") as mf:
                m_data = json.load(mf)
                meta["assets"] = m_data.get("assets", [])
        except Exception:
            meta["assets"] = []
    else:
        meta["assets"] = generate_project_manifest(project_id)

    meta["has_index_html"] = os.path.exists(os.path.join(proj_dir, "index.html"))
    meta["has_storyboard"] = os.path.exists(os.path.join(proj_dir, "STORYBOARD.md"))
    meta["has_frame_md"] = os.path.exists(os.path.join(proj_dir, "frame.md"))
    meta["has_handoff"] = os.path.exists(os.path.join(proj_dir, "HANDOFF.md"))

    return meta

def ensure_placeholder_assets(proj_dir: str):
    """Generates ultra-lightweight starter MP4/MP3 assets so HyperFrames validation passes."""
    assets_dir = os.path.join(proj_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    
    placeholders = ["hook.mp4", "problem.mp4", "solution.mp4", "cta.mp4"]
    colors = ["#1a1a24", "#161b22", "#1e1e2e", "#0f172a"]
    for i, name in enumerate(placeholders):
        p_path = os.path.join(assets_dir, name)
        if not os.path.exists(p_path) and os.path.exists(BIN_FFMPEG):
            try:
                subprocess.run([
                    BIN_FFMPEG, "-y", "-f", "lavfi",
                    "-i", f"color=c={colors[i]}:s=640x360:d=4",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", "4",
                    p_path
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            except Exception as e:
                logger.warning(f"Could not generate placeholder {name}: {e}")

    # Audio bed
    audio_path = os.path.join(assets_dir, "audio_bed.mp3")
    if not os.path.exists(audio_path) and os.path.exists(BIN_FFMPEG):
        try:
            subprocess.run([
                BIN_FFMPEG, "-y", "-f", "lavfi",
                "-i", "anullsrc=r=44100:cl=stereo",
                "-t", "12", "-c:a", "libmp3lame",
                audio_path
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        except Exception as e:
            logger.warning(f"Could not generate placeholder audio: {e}")

def create_project(
    project_id: str,
    title: str,
    duration: float = 12.0,
    aspect_ratio: str = "16:9",
    category: str = "Standard Video",
    mood: str = "dynamic",
    seed_demo_assets: bool = True
) -> Dict[str, Any]:
    """Scaffolds a complete HyperFrames workspace with git repo, skills, and manifest."""
    proj_dir = get_project_dir(project_id)
    os.makedirs(proj_dir, exist_ok=True)
    os.makedirs(os.path.join(proj_dir, "assets"), exist_ok=True)
    if seed_demo_assets:
        ensure_placeholder_assets(proj_dir)

    width, height = (1920, 1080) if aspect_ratio == "16:9" else (1080, 1920)

    # 1. meta.json
    meta = {
        "id": project_id,
        "title": title,
        "category": category,
        "target_duration": duration,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
        "width": width,
        "height": height,
        "fps": 30,
        "mood": mood,
        "created_at": int(time.time() * 1000),
        "status": "ready"
    }
    with open(os.path.join(proj_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # 2. STORYBOARD.md
    storyboard_content = f"""# Storyboard: {title}
**Target Duration:** {duration:.1f}s | **Aspect Ratio:** {aspect_ratio} ({width}x{height}) | **FPS:** 30

## Scene Beats & Timeline

### Beat 1: Hook (0.00s - 3.00s)
- **Role:** High-energy visual hook and problem framing.
- **Visual:** Dynamic foreground kinetic title with high-contrast badge.
- **Audio/VO:** "What if you could turn standard web code into frame-accurate video?"
- **GSAP Tweens:** Smooth scale-in from 1.05 to 1.0 with subtle glow pulse.

### Beat 2: Core Concept (3.00s - 6.00s)
- **Role:** Demonstration of the deterministic HTML composition model.
- **Visual:** Code breakdown or split-screen illustration.
- **Audio/VO:** "HyperFrames treats every element as an animated DOM node."
- **GSAP Tweens:** Horizontal slide transition with power2.out ease.

### Beat 3: Capabilities (6.00s - 9.50s)
- **Role:** Features, components, and registry block layering.
- **Visual:** Kinetic captions, social badges, and layered motion graphics.
- **Audio/VO:** "Over 450 registry blocks, driven by your local CLI agents."
- **GSAP Tweens:** Staggered fade and slide-up.

### Beat 4: Call to Action (9.50s - {duration:.2f}s)
- **Role:** Final takeaway and next steps.
- **Visual:** Centered CTA badge, animated button border, brand watermark.
- **Audio/VO:** "Start building deterministic video from your terminal today."
- **GSAP Tweens:** Scale-down exit transition.
"""
    with open(os.path.join(proj_dir, "STORYBOARD.md"), "w", encoding="utf-8") as f:
        f.write(storyboard_content)

    # 3. frame.md (Design System Tokens)
    frame_content = f"""# Design System & Motion Tokens: {title}

## Visual Identity
- **Primary Color:** #F59E0B (Amber Gold)
- **Secondary Color:** #10B981 (Emerald Accent)
- **Background:** #0A0A0C (Deep Obsidian)
- **Surface:** #141418 (Subtle Dark Slate)
- **Text Primary:** #F4F4F6 (Crisp Pure White)
- **Text Muted:** #8E8E98 (Muted Zinc)

## Typography
- **Headlines:** 'Inter', -apple-system, sans-serif (Font Weight: 800)
- **Timecode & Data:** 'IBM Plex Mono', 'Courier New', monospace
- **Body & Subtitles:** 'Inter', sans-serif (Font Weight: 500)

## Motion Rules
- **Camera Cuts:** Frame-accurate cuts aligned with data-start and data-duration attributes.
- **GSAP Timing:** Use `power2.out` for entries; `power1.in` for exits.
- **Root Timeline Contract:** Main timeline stored in `window.__timelines["main"]` and paused on frame 0.
"""
    with open(os.path.join(proj_dir, "frame.md"), "w", encoding="utf-8") as f:
        f.write(frame_content)

    # 4. SCRIPT.md
    script_content = f"""# Script & Dialogue: {title}

[00:00:00 - 00:03:00] [VOICE]: What if you could turn standard web code into frame-accurate video?
[00:03:00 - 00:06:00] [VOICE]: HyperFrames treats every element as an animated DOM node.
[00:06:00 - 00:09:15] [VOICE]: Over 450 registry blocks, driven by your local CLI agents.
[00:09:15 - {int(duration):02d}:00:00] [VOICE]: Start building deterministic video from your terminal today.
"""
    with open(os.path.join(proj_dir, "SCRIPT.md"), "w", encoding="utf-8") as f:
        f.write(script_content)

    # 5. HANDOFF.md
    handoff_content = f"""# Agent Handoff Log: {title}
**Status:** Initial Scaffolding Complete
**Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S')}

## Last Actions
1. Initialized HyperFrames project directory.
2. Created `STORYBOARD.md` with 4-beat narrative progression.
3. Created `frame.md` with Amber/Emerald brand design system.
4. Generated deterministic `index.html` root composition conforming to HyperFrames render contract.
5. Generated `assets/manifest.json` with media telemetry.
"""
    with open(os.path.join(proj_dir, "HANDOFF.md"), "w", encoding="utf-8") as f:
        f.write(handoff_content)

    # 6. index.html
    from backend.hyperframes.composition import build_hyperframes_html
    if seed_demo_assets:
        starter_decisions = [
            {"order": 1, "narrative_beat": "HOOK", "source_asset": "hook.mp4", "source_in_sec": 0.0, "source_out_sec": 3.0},
            {"order": 2, "narrative_beat": "PROBLEM", "source_asset": "problem.mp4", "source_in_sec": 0.0, "source_out_sec": 3.0},
            {"order": 3, "narrative_beat": "SOLUTION", "source_asset": "solution.mp4", "source_in_sec": 0.0, "source_out_sec": 3.5},
            {"order": 4, "narrative_beat": "CALL_TO_ACTION", "source_asset": "cta.mp4", "source_in_sec": 0.0, "source_out_sec": round(duration - 9.5, 2)},
        ]
    else:
        starter_decisions = []
    html_code = build_hyperframes_html(
        project_id=project_id,
        project_title=title,
        total_duration=duration,
        decisions=starter_decisions
    )
    with open(os.path.join(proj_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_code)

    # 7. Provision Agent Skills & Rules
    provision_hyperframes_skills(proj_dir)

    # 8. Generate Asset Manifest
    generate_project_manifest(project_id)

    # 9. Initialize Git repo in project folder & commit checkpoint
    try:
        subprocess.run(["git", "init"], cwd=proj_dir, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["git", "add", "."], cwd=proj_dir, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["git", "commit", "-m", "checkpoint(init): initial HyperFrames scaffolding"], cwd=proj_dir, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        logger.warning(f"Could not initialize git in {proj_dir}: {e}")

    return meta

def read_file(project_id: str, filename: str) -> Optional[str]:
    """Reads a text file from a project directory safely."""
    proj_dir = get_project_dir(project_id)
    safe_name = os.path.basename(filename)
    target = os.path.join(proj_dir, safe_name)
    if not os.path.exists(target):
        return None
    try:
        with open(target, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading {target}: {e}")
        return None

def write_file(project_id: str, filename: str, content: str) -> bool:
    """Writes a text file to the project directory."""
    proj_dir = get_project_dir(project_id)
    os.makedirs(proj_dir, exist_ok=True)
    safe_name = os.path.basename(filename)
    target = os.path.join(proj_dir, safe_name)
    try:
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except Exception as e:
        logger.error(f"Error writing to {target}: {e}")
        return False

def save_asset(project_id: str, filename: str, content_bytes: bytes) -> str:
    """Saves a binary media asset, then updates manifest.json automatically."""
    proj_dir = get_project_dir(project_id)
    assets_dir = os.path.join(proj_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    safe_name = os.path.basename(filename)
    target = os.path.join(assets_dir, safe_name)
    with open(target, "wb") as f:
        f.write(content_bytes)

    # Auto-generate manifest whenever new asset is saved
    generate_project_manifest(project_id)
    return target

# ----------------------------------------------------------------------
# Git Checkpoint & Rollback Operations (Phase D)
# ----------------------------------------------------------------------

def create_git_checkpoint(project_id: str, message: str) -> Optional[str]:
    """Creates a local Git commit in projects/<id>/ and returns commit hash."""
    proj_dir = get_project_dir(project_id)
    if not os.path.isdir(os.path.join(proj_dir, ".git")):
        subprocess.run(["git", "init"], cwd=proj_dir, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        subprocess.run(["git", "add", "-A"], cwd=proj_dir, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        res = subprocess.run(["git", "commit", "-m", message], cwd=proj_dir, capture_output=True, text=True)
        if res.returncode == 0:
            h = subprocess.run(["git", "rev-parse", "HEAD"], cwd=proj_dir, capture_output=True, text=True)
            return h.stdout.strip()
    except Exception as e:
        logger.error(f"Error creating git checkpoint in {proj_dir}: {e}")
    return None

def get_project_git_history(project_id: str) -> List[Dict[str, Any]]:
    """Returns the list of git commits for the project workspace."""
    proj_dir = get_project_dir(project_id)
    if not os.path.isdir(os.path.join(proj_dir, ".git")):
        return []

    try:
        res = subprocess.run(
            ["git", "log", "--pretty=format:%H|%s|%an|%ai", "-n", "30"],
            cwd=proj_dir,
            capture_output=True,
            text=True
        )
        if res.returncode != 0:
            return []

        commits = []
        for line in res.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                commits.append({
                    "hash": parts[0],
                    "short_hash": parts[0][:7],
                    "message": parts[1],
                    "author": parts[2],
                    "date": parts[3]
                })
        return commits
    except Exception as e:
        logger.error(f"Error fetching git history: {e}")
        return []

def get_commit_diff(project_id: str, commit_hash: str) -> str:
    """Returns git show diff output for a specific checkpoint."""
    proj_dir = get_project_dir(project_id)
    try:
        res = subprocess.run(
            ["git", "show", commit_hash, "--stat", "--patch"],
            cwd=proj_dir,
            capture_output=True,
            text=True
        )
        return res.stdout if res.returncode == 0 else res.stderr
    except Exception as e:
        return str(e)

def revert_to_checkpoint(project_id: str, commit_hash: str) -> bool:
    """Rolls back the project workspace to the exact state of commit_hash."""
    proj_dir = get_project_dir(project_id)
    try:
        res = subprocess.run(["git", "checkout", commit_hash, "--", "."], cwd=proj_dir, capture_output=True, text=True)
        if res.returncode == 0:
            create_git_checkpoint(project_id, f"checkpoint(rollback): restored to {commit_hash[:7]}")
            return True
        return False
    except Exception as e:
        logger.error(f"Error reverting checkpoint in {proj_dir}: {e}")
        return False
