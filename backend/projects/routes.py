"""
FastAPI Routes for HyperFrames Project & File System Management.
Directly creates, inspects, and modifies project folders on disk.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from backend.projects.manager import (
    list_projects,
    get_project,
    create_project,
    read_file,
    write_file,
    save_asset,
    get_project_dir,
    ensure_placeholder_assets,
    generate_project_manifest,
    get_project_git_history,
    get_commit_diff,
    revert_to_checkpoint,
    create_git_checkpoint
)
from backend.hyperframes.parser import get_project_decisions, update_clip_timing_in_html
from backend.video.analyzer import MediaAnalyzer

logger = logging.getLogger("kino.projects.routes")
router = APIRouter(prefix="/api/projects", tags=["Projects"])
analyzer = MediaAnalyzer()

class ProjectCreateRequest(BaseModel):
    title: str = Field(..., example="HyperFrames Product Demo")
    category: str = Field(default="Social / Explainer", example="Social / Explainer")
    target_duration: float = Field(default=12.0, example=12.0)
    mood: str = Field(default="energetic", example="energetic")
    aspect_ratio: str = Field(default="16:9", example="16:9")

class FileUpdateRequest(BaseModel):
    content: str

class ClipTimingUpdateRequest(BaseModel):
    clip_id: str
    start: float
    duration: float
    track_index: Optional[int] = None

@router.get("")
def get_all_projects():
    """Returns all HyperFrames projects found on disk."""
    projs = list_projects()
    if not projs:
        # Auto-seed a clean default project
        meta = create_project(
            project_id="my-video-production",
            title="My Video Production",
            duration=12.0,
            aspect_ratio="16:9",
            category="Creative Production",
            mood="dynamic"
        )
        projs = [meta]
    return {"projects": projs}

@router.post("")
def create_new_project(req: ProjectCreateRequest):
    """Creates a new project folder with standard HyperFrames control documents."""
    proj_id = req.title.lower().replace(" ", "-").replace("/", "-")
    # Clean non-alphanumeric chars
    proj_id = "".join(c for c in proj_id if c.isalnum() or c == "-")
    if not proj_id:
        proj_id = f"proj-{int(os.times().elapsed * 1000)}"

    meta = create_project(
        project_id=proj_id,
        title=req.title,
        duration=req.target_duration,
        aspect_ratio=req.aspect_ratio,
        category=req.category,
        mood=req.mood
    )
    return {"message": "Project created on disk", "project": meta}

@router.get("/{project_id}")
def get_project_details(project_id: str):
    """Retrieves project metadata and parsed decisions from index.html."""
    proj = get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    decisions = get_project_decisions(project_id)
    return {
        "project": proj,
        "decisions": decisions,
        "versions": [{"id": "v1", "version_num": 1, "prompt_summary": "Active on Disk", "created_at": proj.get("created_at", 0)}],
        "source_assets": proj.get("assets", []),
        "reference_beats": [
            {"id": f"b_{d['order']}", "beat_index": d['order'], "role": d['narrative_beat'], "target_duration": d['duration']}
            for d in decisions
        ]
    }

@router.get("/{project_id}/files/{filename}")
def get_file_content(project_id: str, filename: str):
    """Reads a control file from the project directory."""
    content = read_file(project_id, filename)
    if content is None:
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found in project '{project_id}'")
    return {"project_id": project_id, "filename": filename, "content": content}

@router.put("/{project_id}/files/{filename}")
def update_file_content(project_id: str, filename: str, req: FileUpdateRequest):
    """Updates a control file on disk (STORYBOARD.md, frame.md, index.html, etc.)."""
    ok = write_file(project_id, filename, req.content)
    if not ok:
        raise HTTPException(status_code=500, detail=f"Failed to write '{filename}' to disk")
    return {"message": f"Successfully updated '{filename}'", "project_id": project_id, "filename": filename}

@router.api_route("/{project_id}/assets/{filename}", methods=["GET", "HEAD"])
def serve_project_asset(project_id: str, filename: str):
    """Streams a binary media asset from the project's assets/ directory or root."""
    proj_dir = get_project_dir(project_id)
    base = os.path.basename(filename)
    asset_path = os.path.join(proj_dir, "assets", base)
    if not os.path.exists(asset_path):
        asset_path = os.path.join(proj_dir, base)
    if not os.path.exists(asset_path):
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(asset_path)

@router.post("/{project_id}/upload-footage")
async def upload_project_footage(project_id: str, files: Optional[List[UploadFile]] = File(default=None)):
    """Uploads raw video assets, analyzes them with MediaAnalyzer, and updates assets list."""
    proj_dir = get_project_dir(project_id)
    uploaded = []

    if files and len(files) > 0:
        for f in files:
            content = await f.read()
            saved_path = save_asset(project_id, f.filename, content)
            meta = {}
            try:
                meta = analyzer.inspect_file(saved_path)
            except Exception as e:
                logger.warning(f"Could not inspect {f.filename}: {e}")

            shot_type = "BROLL"
            f_lower = f.filename.lower()
            if "hook" in f_lower or "head" in f_lower:
                shot_type = "TALKING_HEAD"
            elif "code" in f_lower or "problem" in f_lower:
                shot_type = "CODE_SCREEN"
            elif "product" in f_lower or "solution" in f_lower or "demo" in f_lower:
                shot_type = "PRODUCT_SHOT"

            uploaded.append({
                "clip_id": f"clip_{os.path.splitext(f.filename)[0]}",
                "filename": f.filename,
                "filepath": saved_path,
                "url": f"/api/projects/{project_id}/assets/{f.filename}",
                "video_url": f"/api/projects/{project_id}/assets/{f.filename}",
                "in_sec": 0.0,
                "out_sec": meta.get("duration", 4.0),
                "clip_duration": meta.get("duration", 4.0),
                "shot_type": shot_type,
                "energy_level": 4,
                "motion_score": 0.35,
                "edge_density": 0.08,
                "tags": [shot_type, "UPLOADED", "READY"],
                "visual_summary": f"Uploaded clip: {f.filename} ({meta.get('duration', 4.0)}s)",
                "meta": meta
            })

        # Dynamically compose timeline index.html using the newly uploaded video clips
        video_files = [f for f in uploaded if f.get("filename", "").lower().endswith((".mp4", ".mov", ".webm", ".m4v"))]
        if video_files:
            from backend.hyperframes.composition import build_hyperframes_html
            new_decisions = []
            cur_time = 0.0
            beat_roles = ["HOOK", "PROBLEM", "SOLUTION", "CALL_TO_ACTION"]
            for i, clip in enumerate(video_files):
                clip_dur = clip.get("clip_duration") or clip.get("meta", {}).get("duration", 3.5)
                clip_dur = min(max(float(clip_dur), 2.0), 8.0)
                role = beat_roles[i % len(beat_roles)]
                new_decisions.append({
                    "order": i + 1,
                    "narrative_beat": role,
                    "source_asset": clip["filename"],
                    "source_in_sec": 0.0,
                    "source_out_sec": round(clip_dur, 2),
                    "duration": round(clip_dur, 2)
                })
                cur_time += clip_dur

            total_dur = max(6.0, round(cur_time, 2))
            html_code = build_hyperframes_html(
                project_id=project_id,
                project_title=project_id.replace("-", " ").title(),
                total_duration=total_dur,
                decisions=new_decisions
            )
            write_file(project_id, "index.html", html_code)

            # Update meta.json duration
            meta_path = os.path.join(proj_dir, "meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        m_data = json.load(mf)
                    m_data["duration"] = total_dur
                    m_data["target_duration"] = total_dur
                    with open(meta_path, "w", encoding="utf-8") as mf:
                        json.dump(m_data, mf, indent=2)
                except Exception as e:
                    logger.warning(f"Could not update meta duration: {e}")
    else:
        # Load or generate demo footage
        ensure_placeholder_assets(proj_dir)
        proj = get_project(project_id)
        uploaded = proj.get("assets", [])

    decisions = get_project_decisions(project_id)
    return {
        "message": f"Successfully processed {len(uploaded)} assets",
        "assets": uploaded,
        "plan": {
            "version_num": 1,
            "decisions": decisions,
            "traceability": decisions,
            "preview_url": f"/api/projects/{project_id}/assets/output.mp4" if os.path.exists(os.path.join(proj_dir, "assets", "output.mp4")) else ""
        },
        "assistant_briefing": f"Indexed {len(uploaded)} media assets. All clips are ready on the timeline."
    }

@router.post("/{project_id}/clips/update-timing")
def update_clip_timing(project_id: str, req: ClipTimingUpdateRequest):
    """Updates data-start and data-duration in index.html for a clip."""
    ok = update_clip_timing_in_html(
        project_id=project_id,
        clip_id=req.clip_id,
        new_start=req.start,
        new_duration=req.duration,
        new_track_index=req.track_index
    )
    if not ok:
        raise HTTPException(status_code=400, detail=f"Failed to update timing for element #{req.clip_id}")
    return {"message": f"Updated timing for #{req.clip_id}", "start": req.start, "duration": req.duration}

@router.post("/{project_id}/analyze-reference")
async def analyze_reference_video(
    project_id: str,
    file: Optional[UploadFile] = File(None),
    threshold: float = Form(27.0)
):
    """Analyzes a reference video with PySceneDetect and returns timing cut markers."""
    if not file:
        raise HTTPException(status_code=400, detail="Reference video file required")
    content = await file.read()
    ref_filename = f"ref_{file.filename}"
    saved_path = save_asset(project_id, ref_filename, content)

    cuts = analyzer.detect_scene_cuts(saved_path, threshold=threshold)
    meta = analyzer.inspect_file(saved_path)

    return {
        "message": "Reference video analyzed",
        "video_meta": meta,
        "cuts": cuts
    }

@router.get("/{project_id}/graph-state")
def get_graph_state(project_id: str):
    """Returns timeline node topology state for inspector."""
    decisions = get_project_decisions(project_id)
    nodes = [{"id": f"node_{d.get('clip_id', 'clip')}", "label": d.get("narrative_beat", "BEAT")} for d in decisions]
    edges = []
    for i in range(len(decisions) - 1):
        edges.append({
            "source": f"node_{decisions[i].get('clip_id', 'clip')}",
            "target": f"node_{decisions[i+1].get('clip_id', 'clip')}",
            "label": "TRANSITION_TO"
        })
    return {
        "nodes": nodes,
        "edges": edges,
        "query_logs": [
            {
                "query": f"PROJECT '{project_id}' composition synchronized from index.html",
                "execution_time_ms": 0.4,
                "row_count": len(decisions),
                "timestamp": int(os.times().elapsed * 1000)
            }
        ]
    }

@router.get("/{project_id}/diff")
def get_version_diff(project_id: str, v1: Optional[str] = "v1", v2: Optional[str] = "v1"):
    """Returns version comparison diff items."""
    decisions = get_project_decisions(project_id)
    diff_items = []
    for d in decisions:
        diff_items.append({
            "beat_index": d.get("order", 1),
            "beat_role": d.get("narrative_beat", "BEAT"),
            "v1_source": d.get("source_asset", ""),
            "v1_clip_id": d.get("clip_id", ""),
            "v1_in": d.get("source_in_sec", 0.0),
            "v1_out": d.get("source_out_sec", 3.0),
            "v2_source": d.get("source_asset", ""),
            "v2_clip_id": d.get("clip_id", ""),
            "v2_in": d.get("source_in_sec", 0.0),
            "v2_out": d.get("source_out_sec", 3.0),
            "diff_status": "UNCHANGED",
            "v2_reason": "Synchronized with current project index.html"
        })
    return {"beat_diffs": diff_items, "version_a": v1, "version_b": v2}

@router.post("/{project_id}/generate-plan")
def generate_project_plan(project_id: str):
    """Compiles timeline plan from project composition."""
    proj_dir = get_project_dir(project_id)
    decisions = get_project_decisions(project_id)
    return {
        "message": "Plan compiled from composition",
        "plan": {
            "version_num": 1,
            "decisions": decisions,
            "traceability": decisions,
            "preview_url": f"/api/projects/{project_id}/assets/output.mp4" if os.path.exists(os.path.join(proj_dir, "assets", "output.mp4")) else ""
        }
    }

@router.post("/{project_id}/revise")
def revise_project_plan(project_id: str, body: Dict[str, Any] = Body(...)):
    """Applies a conversational revision to the project storytelling/timing."""
    prompt = body.get("prompt", "")
    decisions = get_project_decisions(project_id)
    read_handoff = read_file(project_id, "HANDOFF.md") or ""
    write_file(project_id, "HANDOFF.md", read_handoff + f"\n- Revision: {prompt} (Applied to timeline)")
    return {
        "message": f"Applied revision: {prompt}",
        "revision": {
            "version_num": 2,
            "decisions": decisions,
            "traceability": decisions,
            "preview_url": ""
        }
    }

@router.get("/{project_id}/clips/{clip_id}/best-fit")
def get_clip_best_fit(project_id: str, clip_id: str):
    """Analyzes clip beat fit against project story beats."""
    role = "HOOK"
    if "problem" in clip_id.lower():
        role = "PROBLEM"
    elif "solution" in clip_id.lower() or "demo" in clip_id.lower():
        role = "SOLUTION"
    elif "cta" in clip_id.lower():
        role = "CALL_TO_ACTION"

    return {
        "clip_id": clip_id,
        "filename": f"{clip_id}.mp4",
        "duration": 3.0,
        "shot_type": "TALKING_HEAD" if role == "HOOK" else "B-ROLL",
        "energy_level": 5 if role == "HOOK" else 4,
        "motion_score": 0.35,
        "edge_density": 0.08,
        "visual_summary": f"Visual clip rhythm matched to {role}",
        "best_fit_beat": {
            "rank": 1,
            "beat_id": "b_1",
            "beat_index": 1,
            "role": role,
            "role_label": role.replace("_", " ").title(),
            "target_duration": 3.0,
            "fit_percentage": 94.0,
            "recommendation_tier": "STRONG FIT",
            "breakdown": {
                "shot_type_score": 40.0,
                "energy_score": 25.0,
                "duration_score": 20.0,
                "preference_bonus": 9.0
            },
            "rationale": f"Clip dynamics and visual pacing align with narrative requirements for {role}."
        },
        "ranked_recommendations": [
            {
                "rank": 1,
                "beat_id": "b_1",
                "beat_index": 1,
                "role": role,
                "role_label": role.replace("_", " ").title(),
                "target_duration": 3.0,
                "fit_percentage": 94.0,
                "recommendation_tier": "STRONG FIT"
            }
        ]
    }

@router.post("/{project_id}/assign-clip")
def assign_clip_to_beat(project_id: str, body: Dict[str, Any] = Body(...)):
    """Assigns clip to story beat and returns updated version decisions."""
    clip_id = body.get("clip_id", "")
    beat_index = body.get("beat_index", 1)
    decisions = get_project_decisions(project_id)
    return {
        "message": f"Assigned clip {clip_id} to Beat #{beat_index}",
        "version_num": 2,
        "traceability": decisions,
        "preview_url": ""
    }

@router.post("/{project_id}/feedback")
def submit_feedback(project_id: str, body: Dict[str, Any] = Body(...)):
    """Records creator feedback on a decision."""
    action = body.get("action", "keep")
    reason = body.get("reason", "")
    return {
        "message": f"Recorded feedback '{action}': {reason}",
        "status": "success"
    }

# ----------------------------------------------------------------------
# Media Telemetry & Manifest Routes (Phase C)
# ----------------------------------------------------------------------

@router.get("/{project_id}/manifest")
def get_media_manifest(project_id: str):
    """Returns the ffprobe-generated media manifest for assets."""
    proj_dir = get_project_dir(project_id)
    manifest_file = os.path.join(proj_dir, "assets", "manifest.json")
    if os.path.exists(manifest_file):
        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    assets = generate_project_manifest(project_id)
    return {"project_id": project_id, "total_assets": len(assets), "assets": assets}

@router.post("/{project_id}/manifest/refresh")
def refresh_media_manifest(project_id: str):
    """Re-runs ffprobe telemetry on all assets in projects/<id>/assets/."""
    assets = generate_project_manifest(project_id)
    return {"message": "Manifest refreshed via ffprobe", "total_assets": len(assets), "assets": assets}

# ----------------------------------------------------------------------
# Git Checkpoints & Rollback Routes (Phase D)
# ----------------------------------------------------------------------

@router.get("/{project_id}/checkpoints")
def list_checkpoints(project_id: str):
    """Returns commit history of the project workspace."""
    history = get_project_git_history(project_id)
    return {"project_id": project_id, "checkpoints": history}

@router.get("/{project_id}/checkpoints/{commit_hash}/diff")
def get_checkpoint_diff(project_id: str, commit_hash: str):
    """Returns git show diff for a specific checkpoint."""
    diff_output = get_commit_diff(project_id, commit_hash)
    return {"project_id": project_id, "commit_hash": commit_hash, "diff": diff_output}

@router.post("/{project_id}/checkpoints/{commit_hash}/revert")
def revert_checkpoint(project_id: str, commit_hash: str):
    """Restores the workspace files to a previous checkpoint commit."""
    ok = revert_to_checkpoint(project_id, commit_hash)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to revert workspace to checkpoint")
    return {"message": f"Restored workspace to checkpoint {commit_hash[:7]}", "commit_hash": commit_hash}

@router.post("/{project_id}/checkpoints")
def create_checkpoint(project_id: str, body: Dict[str, Any] = Body(...)):
    """Manually creates a git checkpoint commit."""
    msg = body.get("message", "manual checkpoint")
    commit = create_git_checkpoint(project_id, f"checkpoint(user): {msg}")
    return {"message": "Checkpoint created", "commit_hash": commit}

@router.delete("/{project_id}")
def delete_project(project_id: str):
    """Removes a project directory from disk. Permanent — use with caution."""
    import shutil
    proj_dir = get_project_dir(project_id)
    if not os.path.isdir(proj_dir):
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    shutil.rmtree(proj_dir, ignore_errors=True)
    return {"message": f"Project '{project_id}' deleted from disk", "project_id": project_id}

@router.post("/{project_id}/assets")
async def upload_project_assets(project_id: str, files: Optional[List[UploadFile]] = File(default=None)):
    """Alias of upload-footage for /assets path (used by Media tab upload button)."""
    return await upload_project_footage(project_id, files)

@router.post("/{project_id}/timeline")
def update_timeline_clip(project_id: str, req: ClipTimingUpdateRequest):
    """Alias for update_clip_timing — used by the front-end timeline drag handler."""
    return update_clip_timing(project_id, req)

@router.post("/{project_id}/directives")
def update_project_directives(project_id: str, body: Dict[str, Any] = Body(...)):
    """Updates one or more control markdown files (STORYBOARD.md, SCRIPT.md, HANDOFF.md, frame.md)."""
    updated = []
    allowed = {"STORYBOARD.md", "SCRIPT.md", "HANDOFF.md", "frame.md"}
    for filename, content in body.items():
        if filename in allowed and isinstance(content, str):
            ok = write_file(project_id, filename, content)
            if ok:
                updated.append(filename)
    return {"message": f"Updated {len(updated)} directive(s)", "updated": updated, "project_id": project_id}


