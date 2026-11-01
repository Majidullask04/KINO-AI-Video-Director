"""
HyperFrames Composition Engine.
Generates and parses deterministic HyperFrames HTML5 compositions
directly on the local filesystem according to the HyperFrames render contract.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from backend.hyperframes.registry import get_registry_blocks, get_block_by_id

logger = logging.getLogger("hyperframes.composition")

PROJECTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "projects"))

def render_block_template(template_str: str, **kwargs) -> str:
    """Safe template renderer that replaces {key} without breaking JS object syntax."""
    res = template_str
    for k, v in kwargs.items():
        res = res.replace("{" + k + "}", str(v))
    return res

def build_hyperframes_html(
    project_id: str,
    project_title: str,
    total_duration: float,
    decisions: List[Dict[str, Any]],
    blocks_applied: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Constructs a standards-compliant HyperFrames HTML document.
    """
    blocks_applied = blocks_applied or []
    clips_html = []
    gsap_tweens = []
    accumulated_time = 0.0

    # 1. Primary Video Clips (Track 1)
    for i, dec in enumerate(decisions):
        order = dec.get("order", i + 1)
        role = dec.get("narrative_beat", f"BEAT_{order}")
        source_asset = dec.get("source_asset", "footage.mp4")
        trim_in = float(dec.get("source_in_sec", 0.0))
        trim_out = float(dec.get("source_out_sec", 3.0))
        clip_duration = max(0.5, round(trim_out - trim_in, 2))
        clip_id = f"clip-video-{order}"
        video_src = f"assets/{source_asset}"

        initial_opacity = "1" if accumulated_time == 0 else "0"
        clip_markup = f"""      <!-- Track 1: Video Beat #{order} ({role}) -->
      <video
        id="{clip_id}"
        class="clip video-clip"
        src="{video_src}"
        data-start="{accumulated_time:.2f}"
        data-duration="{clip_duration:.2f}"
        data-track-index="1"
        data-track-kind="video"
        data-beat-role="{role}"
        data-has-audio="false"
        preload="auto"
        muted
        playsinline
        style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: {initial_opacity};"
      ></video>"""
        clips_html.append(clip_markup)

        # GSAP tween for the video clip (cut with smooth fade)
        gsap_tweens.append(f"""
      // Beat #{order} Video Transition
      tl.fromTo("#{clip_id}", 
        {{ opacity: 0, scale: 1.02 }}, 
        {{ opacity: 1, scale: 1.0, duration: 0.12, ease: "power2.out" }}, 
        {accumulated_time:.2f}
      );
      tl.to("#{clip_id}", 
        {{ opacity: 0, duration: 0.08, ease: "power1.in" }}, 
        {accumulated_time + clip_duration:.2f} - 0.08
      );""")

        # Add corresponding default kinetic overlay for beat 1 and CTA beat
        if i == 0:
            block = get_block_by_id("kinetic-title")
            b_id = f"block-kt-{order}"
            b_dur = min(2.8, clip_duration)
            rendered_html = render_block_template(
                block["html"],
                start=f"{accumulated_time:.2f}",
                duration=f"{b_dur:.2f}",
                element_id=b_id,
                badge_text="HYPERFRAMES STUDIO",
                title_text=project_title.upper(),
                sub_text="Deterministic HTML Video Engine"
            )
            clips_html.append(f"      <!-- Track 0: Graphics / Hero Title -->\n      {rendered_html}")
            rendered_gsap = render_block_template(
                block["gsap_tween"],
                element_id=b_id,
                start=f"{accumulated_time:.2f}",
                duration=f"{b_dur:.2f}"
            )
            gsap_tweens.append(f"      {rendered_gsap}")
        elif i == len(decisions) - 1:
            block = get_block_by_id("beat-freeze-cut")
            b_id = f"block-bfc-{order}"
            b_dur = min(2.5, clip_duration)
            rendered_html = render_block_template(
                block["html"],
                start=f"{accumulated_time:.2f}",
                duration=f"{b_dur:.2f}",
                element_id=b_id,
                badge_text="COMPOSITION COMPLETE",
                title_text="RENDERED WITH HYPERFRAMES",
                sub_text="Built for Agents · Deterministic 30 FPS"
            )
            clips_html.append(f"      <!-- Track 0: Graphics / Outro Beat -->\n      {rendered_html}")
            rendered_gsap = render_block_template(
                block["gsap_tween"],
                element_id=b_id,
                start=f"{accumulated_time:.2f}",
                duration=f"{b_dur:.2f}"
            )
            gsap_tweens.append(f"      {rendered_gsap}")

        accumulated_time += clip_duration

    # Audio Track (Track 3)
    if os.path.exists(os.path.join(PROJECTS_DIR, project_id, "assets", "audio_bed.mp3")):
        clips_html.append(f"""      <!-- Track 3: Master Audio Track -->
      <audio
        id="master-audio-bed"
        src="assets/audio_bed.mp3"
        data-start="0.00"
        data-duration="{total_duration:.2f}"
        data-track-index="3"
        data-track-kind="audio"
        data-volume="0.85"
      ></audio>""")

    # If no video clips are present yet, provide a welcoming stage title
    if not decisions:
        block = get_block_by_id("kinetic-title")
        b_id = "block-kt-starter"
        rendered_html = render_block_template(
            block["html"],
            start="0.00",
            duration=f"{total_duration:.2f}",
            element_id=b_id,
            badge_text="KINO STUDIO",
            title_text=project_title.upper(),
            sub_text="Upload Video Clips to Build Timeline"
        )
        clips_html.append(f"      <!-- Track 0: Graphics / Welcome Title -->\n      {rendered_html}")
        rendered_gsap = render_block_template(
            block["gsap_tween"],
            element_id=b_id,
            start="0.00",
            duration=f"{total_duration:.2f}"
        )
        gsap_tweens.append(f"      {rendered_gsap}")

    # Combined HTML Document
    html_content = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>{project_title} — HyperFrames Composition</title>
    <!-- Fonts matching HyperFrames Design System -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <!-- GSAP Runtime for deterministic seeking -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root {{
        --bg: #0a0a0a;
        --surface: #141414;
        --surface2: #1a1a1a;
        --border: #2a2a2a;
        --text: #e5e5e5;
        --accent-green: #22c55e;
        --accent-blue: #3b82f6;
        --accent-purple: #a78bfa;
      }}
      * {{
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }}
      html, body {{
        width: 1920px;
        height: 1080px;
        margin: 0;
        overflow: hidden;
        background: var(--bg);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--text);
      }}
      #root {{
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #000000;
      }}
      .clip {{
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }}
      .video-clip-wrapper {{
        background: #000;
        overflow: hidden;
      }}
      .video-overlay-meta {{
        position: absolute;
        top: 24px;
        left: 24px;
        display: flex;
        gap: 8px;
        z-index: 10;
        opacity: 0.7;
      }}
      .role-badge {{
        padding: 4px 10px;
        background: rgba(10, 10, 10, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        color: #f5f5f5;
        letter-spacing: 0.05em;
      }}
      .duration-badge {{
        padding: 4px 8px;
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.4);
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        color: #22c55e;
      }}
      /* Safe-Zone Guide Markers */
      .safe-zone-overlay {{
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 100;
        display: none;
      }}
      .safe-zone-action {{
        position: absolute;
        top: 5%; left: 5%; right: 5%; bottom: 5%;
        border: 1px dashed rgba(59, 130, 246, 0.4);
      }}
      .safe-zone-title {{
        position: absolute;
        top: 10%; left: 10%; right: 10%; bottom: 10%;
        border: 1px dashed rgba(245, 158, 11, 0.4);
      }}
      /* Block Specific Styles */
{chr(10).join([b["css"] for b in get_registry_blocks()])}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="{total_duration:.2f}"
      data-width="1920"
      data-height="1080"
    >
{chr(10).join(clips_html)}
      <div id="safe-zones" class="safe-zone-overlay">
        <div class="safe-zone-action"></div>
        <div class="safe-zone-title"></div>
      </div>
    </div>

    <script>
      // HyperFrames Paused Root GSAP Timeline Registration
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});

{chr(10).join(gsap_tweens)}

      // Register root timeline per HyperFrames render contract
      window.__timelines["main"] = tl;
      tl.seek(0);

      // Studio Live Seeking Event Bridge
      window.addEventListener("message", (event) => {{
        if (!event.data) return;
        if (event.data.type === "SEEK") {{
          const targetTime = Number(event.data.time) || 0;
          tl.seek(targetTime);
          // Sync HTML5 video clips
          const videos = document.querySelectorAll("video");
          videos.forEach(v => {{
            const clip = v.classList.contains("clip") ? v : v.closest(".clip");
            if (clip) {{
              const start = parseFloat(clip.dataset.start) || 0;
              const dur = parseFloat(clip.dataset.duration) || 0;
              if (targetTime >= start && targetTime <= start + dur) {{
                v.currentTime = targetTime - start;
              }}
            }}
          }});
        }} else if (event.data.type === "TOGGLE_SAFE_ZONES") {{
          const sz = document.getElementById("safe-zones");
          if (sz) sz.style.display = event.data.visible ? "block" : "none";
        }}
      }});
    </script>
  </body>
</html>"""
    return html_content

def get_project_composition(project_id: str) -> Dict[str, Any]:
    """
    Reads the composition from the project's local disk directory:
    projects/<project_id>/index.html and meta.json.
    If the project files exist on disk, returns their exact contents.
    Otherwise, builds a standard starting composition and saves it to disk.
    """
    proj_dir = os.path.join(PROJECTS_DIR, project_id)
    index_html_path = os.path.join(proj_dir, "index.html")
    meta_json_path = os.path.join(proj_dir, "meta.json")

    project_title = project_id.replace("_", " ").title()
    total_dur = 12.0

    meta = {}
    if os.path.exists(meta_json_path):
        try:
            with open(meta_json_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                project_title = meta.get("title", project_title)
                total_dur = float(meta.get("duration", total_dur))
        except Exception as e:
            logger.warning(f"Error reading meta.json for {project_id}: {e}")

    if os.path.exists(index_html_path):
        try:
            with open(index_html_path, "r", encoding="utf-8") as f:
                html_content = f.read()
            return {
                "project_id": project_id,
                "project_title": project_title,
                "format": "1080p",
                "resolution": {
                    "width": meta.get("width", 1920),
                    "height": meta.get("height", 1080)
                },
                "aspect_ratio": meta.get("aspect_ratio", "16:9"),
                "fps": meta.get("fps", 30),
                "duration": round(total_dur, 2),
                "html": html_content,
                "cli_command": f"npx hyperframes render -o {project_id}.mp4"
            }
        except Exception as e:
            logger.warning(f"Error reading index.html for {project_id}: {e}")

    # Default starter storyboard cuts for new projects
    decisions = [
        {"order": 1, "narrative_beat": "HOOK", "source_asset": "hook.mp4", "source_in_sec": 0.0, "source_out_sec": 3.0},
        {"order": 2, "narrative_beat": "PROBLEM", "source_asset": "problem.mp4", "source_in_sec": 0.0, "source_out_sec": 3.0},
        {"order": 3, "narrative_beat": "SOLUTION", "source_asset": "solution.mp4", "source_in_sec": 0.0, "source_out_sec": 3.5},
        {"order": 4, "narrative_beat": "CALL_TO_ACTION", "source_asset": "cta.mp4", "source_in_sec": 0.0, "source_out_sec": 2.5},
    ]

    total_dur = sum(d["source_out_sec"] - d["source_in_sec"] for d in decisions)
    html_code = build_hyperframes_html(
        project_id=project_id,
        project_title=project_title,
        total_duration=total_dur,
        decisions=decisions
    )

    # Persist to disk
    try:
        os.makedirs(os.path.join(proj_dir, "assets"), exist_ok=True)
        with open(index_html_path, "w", encoding="utf-8") as f:
            f.write(html_code)
        with open(meta_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "id": project_id,
                "title": project_title,
                "duration": total_dur,
                "fps": 30,
                "aspect_ratio": "16:9",
                "width": 1920,
                "height": 1080
            }, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not write default project files to disk: {e}")

    return {
        "project_id": project_id,
        "project_title": project_title,
        "format": "1080p",
        "resolution": {"width": 1920, "height": 1080},
        "fps": 30,
        "duration": round(total_dur, 2),
        "html": html_code,
        "cli_command": f"npx hyperframes render -o {project_id}.mp4"
    }
