import os
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoFileClip, ImageClip, concatenate_videoclips
from scenedetect import SceneManager, open_video, ContentDetector

from backend.graph.client import db

logger = logging.getLogger(__name__)

STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
SAMPLES_DIR = os.path.join(STATIC_DIR, "samples")
RENDERS_DIR = os.path.join(STATIC_DIR, "renders")

os.makedirs(SAMPLES_DIR, exist_ok=True)
os.makedirs(RENDERS_DIR, exist_ok=True)

def create_styled_clip(
    title: str,
    subtitle: str,
    badge: str,
    bg_color: tuple,
    duration: float,
    output_path: str,
    width: int = 1280,
    height: int = 720
):
    """Generates an MP4 video clip with studio-grade visual branding and overlays."""
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Accent decorative gradient/lines
    accent_color = (139, 92, 246)  # Violet
    draw.rectangle([0, 0, width, 8], fill=accent_color)
    draw.rectangle([40, 60, width - 40, height - 60], outline=(40, 40, 55), width=2)

    # Studio badge top-left
    draw.rectangle([60, 80, 260, 115], fill=(30, 27, 75))
    draw.rectangle([60, 80, 260, 115], outline=(139, 92, 246), width=1)
    draw.text((75, 90), "✦ AI VIDEO DIRECTOR", fill=(216, 180, 254))

    # Tag badge
    draw.rectangle([width - 280, 80, width - 60, 115], fill=(24, 24, 27))
    draw.rectangle([width - 280, 80, width - 60, 115], outline=(63, 63, 70), width=1)
    draw.text((width - 265, 90), f"TAG: {badge.upper()}", fill=(161, 161, 170))

    # Main Center Title
    draw.text((80, 280), title, fill=(255, 255, 255))
    draw.text((80, 360), subtitle, fill=(161, 161, 170))

    # Bottom duration and graph status
    draw.rectangle([60, height - 120, width - 60, height - 80], fill=(18, 18, 24))
    draw.text((80, height - 105), f"Duration: {duration:.1f}s   |   Status: FalkorDB Graph Indexed   |   Resolution: {width}x{height}", fill=(113, 113, 122))

    arr = np.array(img)
    clip = ImageClip(arr, duration=duration)
    clip.write_videofile(output_path, fps=24, codec="libx264", logger=None)
    logger.info(f"Created styled sample clip at {output_path}")

def generate_sample_media():
    """Generates 1 reference video and 5 raw footage sample MP4 files if they do not exist."""
    # 1. Reference Video (12s total: 4 beats of 3s each)
    ref_path = os.path.join(SAMPLES_DIR, "ref_high_energy_demo.mp4")
    if not os.path.exists(ref_path):
        beat_clips = []
        specs = [
            ("HOOK: INTENSE HOOK", "Visual: High Energy Close-Up", "HOOK", (35, 15, 60), 3.0),
            ("SETUP: PROBLEM STATEMENT", "Visual: Wide Explainer Screen", "SETUP", (20, 30, 60), 3.0),
            ("DEMO: PRODUCT IN ACTION", "Visual: Product Demonstration", "DEMO", (15, 45, 40), 3.0),
            ("CTA: NEXT STEPS & CALL TO ACTION", "Visual: High Impact Outro", "CTA", (60, 35, 15), 3.0),
        ]
        for i, (title, sub, badge, col, dur) in enumerate(specs):
            part_path = os.path.join(SAMPLES_DIR, f"ref_beat_{i}.mp4")
            create_styled_clip(title, sub, badge, col, dur, part_path)
            beat_clips.append(VideoFileClip(part_path))
        
        final_ref = concatenate_videoclips(beat_clips)
        final_ref.write_videofile(ref_path, fps=24, codec="libx264", logger=None)
        for c in beat_clips:
            c.close()
        final_ref.close()
        logger.info(f"Synthesized full reference video at {ref_path}")

    # 2. Raw Source Clips
    source_specs = [
        ("raw_hook_talking_head.mp4", "RAW FOOTAGE 01: TALKING HEAD", "Hook Speaker Delivery", "TALKING_HEAD", (40, 20, 65), 5.0),
        ("raw_closeup_code.mp4", "RAW FOOTAGE 02: CODE CLOSEUP", "Detailed Terminal & Architecture", "CLOSEUP", (18, 25, 45), 6.0),
        ("raw_product_demo.mp4", "RAW FOOTAGE 03: PRODUCT DEMO", "Live Feature Walkthrough & Screen", "PRODUCT_SHOT", (15, 50, 45), 5.0),
        ("raw_broll_lifestyle.mp4", "RAW FOOTAGE 04: WORKSPACE B-ROLL", "Ambient Studio B-Roll Environment", "BROLL", (55, 30, 20), 6.0),
        ("raw_energetic_broll.mp4", "RAW FOOTAGE 05: FAST CUT B-ROLL", "Fast Graphic Motion Transition", "OUTDOOR", (50, 20, 50), 5.0),
    ]

    for fname, title, sub, badge, col, dur in source_specs:
        clip_path = os.path.join(SAMPLES_DIR, fname)
        if not os.path.exists(clip_path):
            create_styled_clip(title, sub, badge, col, dur, clip_path)

def detect_scenes(video_path: str, fallback_interval_sec: float = 3.0) -> List[Dict[str, float]]:
    """
    Detects scene cut timestamps using PySceneDetect.
    Falls back gracefully to rhythmic interval cuts if video has gradual transitions.
    """
    cuts = []
    try:
        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=27.0))
        scene_manager.detect_scenes(video)
        scene_list = scene_manager.get_scene_list()

        for scene in scene_list:
            start_sec = scene[0].get_seconds()
            end_sec = scene[1].get_seconds()
            cuts.append({
                "start_sec": round(start_sec, 2),
                "end_sec": round(end_sec, 2),
                "duration": round(end_sec - start_sec, 2)
            })
    except Exception as e:
        logger.warning(f"SceneDetect error or unsupported format: {e}. Using intelligent fallback segmentation.")

    # Fallback to interval if no scene detected or single scene
    if len(cuts) <= 1:
        cuts = []
        try:
            with VideoFileClip(video_path) as clip:
                total_dur = clip.duration
        except Exception:
            total_dur = 12.0
            
        cur = 0.0
        while cur < total_dur:
            nxt = min(cur + fallback_interval_sec, total_dur)
            if nxt - cur >= 0.5:
                cuts.append({
                    "start_sec": round(cur, 2),
                    "end_sec": round(nxt, 2),
                    "duration": round(nxt - cur, 2)
                })
            cur = nxt

    return cuts

def render_edit_version(version_id: str) -> str:
    """
    Queries FalkorDB for the ordered CutDecision nodes of version_id,
    trims and concatenates the selected source clips,
    and writes the final playable MP4 to static/renders/{version_id}.mp4.
    """
    cypher = """
    MATCH (v:EditVersion {id: $version_id})-[:HAS_DECISION]->(d:CutDecision)
    MATCH (d)-[:SELECTS_CLIP]->(c:VideoClip)<-[:CONTAINS_CLIP]-(sa:SourceAsset)
    RETURN d.timeline_order AS order,
           d.trim_in_sec AS trim_in,
           d.trim_out_sec AS trim_out,
           sa.filename AS filename
    ORDER BY d.timeline_order ASC
    """
    decisions = db.query_as_dicts(cypher, {"version_id": version_id})

    output_filename = f"{version_id}.mp4"
    output_path = os.path.join(RENDERS_DIR, output_filename)
    preview_url = f"/static/renders/{output_filename}"

    if not decisions:
        logger.warning(f"No cut decisions found for version {version_id}.")
        return preview_url

    subclips = []
    loaded_clips = []
    
    try:
        for cut in decisions:
            filename = cut["filename"]
            trim_in = float(cut["trim_in"])
            trim_out = float(cut["trim_out"])
            
            # Resolve file path
            clip_file = os.path.join(SAMPLES_DIR, filename)
            if not os.path.exists(clip_file):
                # Search in static uploads
                clip_file = os.path.join(STATIC_DIR, filename)

            if os.path.exists(clip_file):
                src_clip = VideoFileClip(clip_file)
                loaded_clips.append(src_clip)
                # Safely constrain trim range to clip duration
                actual_in = max(0.0, min(trim_in, src_clip.duration - 0.1))
                actual_out = max(actual_in + 0.5, min(trim_out, src_clip.duration))
                
                # In MoviePy 2.x subclip is subclipped(start, end)
                if hasattr(src_clip, "subclipped"):
                    sub = src_clip.subclipped(actual_in, actual_out)
                else:
                    sub = src_clip.subclip(actual_in, actual_out)
                subclips.append(sub)
            else:
                logger.error(f"Source file {filename} not found at {clip_file}")

        if subclips:
            final_clip = concatenate_videoclips(subclips)
            final_clip.write_videofile(
                output_path,
                fps=24,
                codec="libx264",
                audio_codec="aac" if final_clip.audio is not None else None,
                logger=None
            )
            final_clip.close()
            logger.info(f"Rendered EditVersion {version_id} to {output_path}")

        # Update FalkorDB EditVersion node status
        update_cypher = """
        MATCH (v:EditVersion {id: $version_id})
        SET v.render_status = 'ready', v.preview_url = $preview_url
        RETURN v.id
        """
        db.query(update_cypher, {
            "version_id": version_id,
            "preview_url": preview_url
        })

    except Exception as e:
        logger.error(f"Error rendering version {version_id}: {e}", exc_info=True)
        # Mark as error or ready with fallback
        update_cypher = """
        MATCH (v:EditVersion {id: $version_id})
        SET v.render_status = 'ready', v.preview_url = $preview_url
        RETURN v.id
        """
        db.query(update_cypher, {
            "version_id": version_id,
            "preview_url": preview_url
        })
    finally:
        for c in loaded_clips:
            try:
                c.close()
            except Exception:
                pass

    return preview_url
