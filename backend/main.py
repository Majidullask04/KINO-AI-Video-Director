import os
import time
import uuid
import logging
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.graph.client import db
from backend.graph.schema import init_schema
from backend.graph.queries import (
    create_project,
    list_projects,
    get_project_details,
    get_project_versions,
    get_reference_beats,
    get_source_assets_and_clips,
    get_full_project_graph_state,
    run_traceability_query,
    run_version_diff_query,
    run_creator_preferences_query,
    ensure_default_creator,
    add_creator_preference,
    delete_creator_preference
)
from backend.video.renderer import (
    STATIC_DIR,
    SAMPLES_DIR,
    RENDERS_DIR,
    generate_sample_media
)
from backend.agents.ingestor_agent import ingestor
from backend.agents.director_agent import director
from backend.agents.revision_agent import revision

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_video_director")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize graph schema & indices in FalkorDB
    try:
        init_schema()
        ensure_default_creator()
        # Seed baseline creator preferences for Track 02 demo
        add_creator_preference(
            creator_id="creator_default",
            pref_id="pref_opening_hook",
            category="Pacing & Style",
            rule_text="Always lead with high-energy talking head or close-up hook under 3.0 seconds",
            weight=1.8
        )
        add_creator_preference(
            creator_id="creator_default",
            pref_id="pref_broll_density",
            category="Visual Continuity",
            rule_text="Prefer dynamic screen recordings or product B-roll during technical demonstrations",
            weight=1.5
        )
        # Pre-generate sample MP4 media
        generate_sample_media()
        logger.info("Application startup completed successfully.")
    except Exception as e:
        logger.error(f"Error during application startup: {e}")
    yield

app = FastAPI(
    title="AI Video Director API",
    description="FalkorDB-powered Multi-Agent Video Directing & Revision Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for media preview and downloads
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ----------------------------------------------------------------------
# Request/Response Schemas
# ----------------------------------------------------------------------
class ProjectCreateRequest(BaseModel):
    title: str = Field(..., example="FalkorDB Architecture Breakdown")
    category: str = Field(default="YouTube Long-Form", example="YouTube Long-Form")
    target_duration: float = Field(default=12.0, example=12.0)
    mood: str = Field(default="upbeat", example="upbeat")
    aspect_ratio: str = Field(default="16:9", example="16:9")

class ReferenceAnalysisRequest(BaseModel):
    video_url_or_path: Optional[str] = None
    source_type: str = "file"

class RevisionRequest(BaseModel):
    prompt: str = Field(..., example="Replace clip 2 with higher energy B-roll showing code and trim hook to 2s")

class PreferenceCreateRequest(BaseModel):
    category: str = Field(default="Pacing & Style")
    rule_text: str = Field(..., example="Always include an energetic B-roll transition before the CTA")
    weight: float = Field(default=1.0)

# ----------------------------------------------------------------------
# Core API Endpoints
# ----------------------------------------------------------------------

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "AI Video Director Backend",
        "database": "FalkorDB",
        "falkordb_graph": db.graph_name,
        "tracks": [
            "Track 01 — Agents That Act on Connected Data",
            "Track 02 — Agent Memory and Coordination"
        ]
    }

@app.post("/api/seed-demo")
def seed_demo_project():
    """
    1-Click Demo Seed Endpoint for Hackathon Judges:
    Creates a full production project in FalkorDB with reference beats, 5 indexed raw clips,
    synthesizes EditVersion v1 via DirectorAgent, and renders the preview MP4.
    """
    logger.info("Seeding 1-Click Demo Project in FalkorDB...")
    generate_sample_media()

    project_id = f"proj_demo_{uuid.uuid4().hex[:6]}"
    project_data = {
        "id": project_id,
        "title": "Autonomous Agent Video Studio — Product Reveal",
        "category": "YouTube Long-Form (16:9)",
        "target_duration": 12.0,
        "mood": "upbeat",
        "aspect_ratio": "16:9",
        "status": "ready_for_review",
        "created_at": int(time.time() * 1000)
    }
    create_project(project_data)

    # 1. Analyze reference video into StoryBeat chain
    ref_file = os.path.join(SAMPLES_DIR, "ref_high_energy_demo.mp4")
    ingestor.analyze_and_index_reference_video(project_id, ref_file, source_type="demo_template")

    # 2. Ingest 5 raw footage source assets
    source_clips = [
        "raw_hook_talking_head.mp4",
        "raw_closeup_code.mp4",
        "raw_product_demo.mp4",
        "raw_broll_lifestyle.mp4",
        "raw_energetic_broll.mp4"
    ]
    for sc in source_clips:
        sc_path = os.path.join(SAMPLES_DIR, sc)
        ingestor.index_source_asset(project_id, filename=sc, filepath=sc_path)

    # 3. Synthesize EditVersion v1 using DirectorAgent
    plan_result = director.generate_initial_edit(project_id)

    return {
        "message": "Demo project seeded successfully!",
        "project_id": project_id,
        "project": project_data,
        "version_v1": plan_result
    }

@app.get("/api/projects")
def get_projects():
    """Lists all projects stored in FalkorDB."""
    return {"projects": list_projects()}

@app.post("/api/projects")
def create_new_project(req: ProjectCreateRequest):
    """Creates a new Project node in FalkorDB."""
    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    project_data = {
        "id": project_id,
        "title": req.title,
        "category": req.category,
        "target_duration": req.target_duration,
        "mood": req.mood,
        "aspect_ratio": req.aspect_ratio,
        "status": "created",
        "created_at": int(time.time() * 1000)
    }
    create_project(project_data)
    return {"message": "Project created successfully", "project": project_data}

@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    """Retrieves full project metadata, beats, source assets, and versions from FalkorDB."""
    details = get_project_details(project_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    beats = get_reference_beats(project_id)
    assets = get_source_assets_and_clips(project_id)
    versions = get_project_versions(project_id)

    return {
        "project": details,
        "reference_beats": beats,
        "source_assets": assets,
        "versions": versions
    }

@app.post("/api/projects/{project_id}/analyze-reference")
async def analyze_reference(
    project_id: str,
    file: Optional[UploadFile] = File(None),
    video_url: Optional[str] = Form(None)
):
    """Analyzes a reference video (file upload or URL) and saves StoryBeat chain in FalkorDB."""
    details = get_project_details(project_id)
    if not details:
        raise HTTPException(status_code=404, detail="Project not found")

    ref_path = ""
    source_type = "upload"

    if file:
        file_ext = os.path.splitext(file.filename)[1] or ".mp4"
        ref_filename = f"ref_{project_id}{file_ext}"
        ref_path = os.path.join(STATIC_DIR, ref_filename)
        content = await file.read()
        with open(ref_path, "wb") as f:
            f.write(content)
        source_type = "file_upload"
    elif video_url:
        ref_path = video_url
        source_type = "url"
    else:
        # Fallback to demo reference clip
        ref_path = os.path.join(SAMPLES_DIR, "ref_high_energy_demo.mp4")
        source_type = "demo_template"

    result = ingestor.analyze_and_index_reference_video(project_id, ref_path, source_type=source_type)
    return {
        "message": "Reference video analyzed and StoryBeat graph written to FalkorDB",
        "analysis": result
    }

@app.post("/api/projects/{project_id}/upload-footage")
async def upload_footage(
    project_id: str,
    files: List[UploadFile] = File(None)
):
    """Uploads and indexes raw footage assets into VideoClip and VisualTag nodes in FalkorDB."""
    indexed_assets = []

    if files:
        for f in files:
            file_path = os.path.join(STATIC_DIR, f.filename)
            content = await f.read()
            with open(file_path, "wb") as out_f:
                out_f.write(content)
            idx_res = ingestor.index_source_asset(project_id, f.filename, file_path)
            indexed_assets.append(idx_res)
    else:
        # Load sample demo footage if no files uploaded
        source_clips = [
            "raw_hook_talking_head.mp4",
            "raw_closeup_code.mp4",
            "raw_product_demo.mp4",
            "raw_broll_lifestyle.mp4",
            "raw_energetic_broll.mp4"
        ]
        for sc in source_clips:
            sc_path = os.path.join(SAMPLES_DIR, sc)
            idx_res = ingestor.index_source_asset(project_id, filename=sc, filepath=sc_path)
            indexed_assets.append(idx_res)

    return {
        "message": f"Successfully indexed {len(indexed_assets)} source assets in FalkorDB",
        "assets": indexed_assets
    }

@app.post("/api/projects/{project_id}/generate-plan")
def generate_edit_plan(project_id: str):
    """
    Executes Query 1 to synthesize EditVersion v1 from StoryBeats and VideoClips,
    rendering the MP4 preview.
    """
    try:
        plan = director.generate_initial_edit(project_id)
        return {
            "message": "Graph Director Agent successfully synthesized EditVersion v1",
            "plan": plan
        }
    except Exception as e:
        logger.error(f"Error generating edit plan: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/projects/{project_id}/revise")
def revise_edit(project_id: str, req: RevisionRequest):
    """
    Translates natural-language revision prompt into Cypher mutations (Query 2),
    adds [:REJECTED_FOR] negative memory edge, branches new EditVersion, and renders new preview.
    """
    try:
        revision_res = revision.apply_revision(project_id, req.prompt)
        return {
            "message": "Revision Agent mutated timeline and branched new EditVersion in lineage DAG",
            "revision": revision_res
        }
    except Exception as e:
        logger.error(f"Error revising edit: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/projects/{project_id}/graph-state")
def get_graph_state(project_id: str):
    """
    Returns the real-time FalkorDB property graph nodes, edges, active version decisions,
    and recent Cypher query audit logs for the frontend Graph Traceability Inspector.
    """
    return get_full_project_graph_state(project_id)

@app.get("/api/projects/{project_id}/compare")
def compare_versions(
    project_id: str,
    v1: str = Query(..., description="First EditVersion ID"),
    v2: str = Query(..., description="Second EditVersion ID")
):
    """Runs Query 4 to diff two EditVersions across beats."""
    diff_data = run_version_diff_query(v1, v2)
    return {
        "version_a": v1,
        "version_b": v2,
        "beat_diffs": diff_data
    }

@app.get("/api/creator/preferences")
def get_preferences(creator_id: str = "creator_default"):
    """Fetches persistent CreatorPreference nodes from FalkorDB (Track 02)."""
    prefs = run_creator_preferences_query(creator_id)
    return {"preferences": prefs}

@app.post("/api/creator/preferences")
def create_preference(req: PreferenceCreateRequest, creator_id: str = "creator_default"):
    """Adds a persistent CreatorPreference node to FalkorDB."""
    pref_id = f"pref_{uuid.uuid4().hex[:8]}"
    add_creator_preference(creator_id, pref_id, req.category, req.rule_text, req.weight)
    return {"message": "Preference saved to FalkorDB memory", "id": pref_id}

@app.delete("/api/creator/preferences/{pref_id}")
def remove_preference(pref_id: str):
    """Deletes a CreatorPreference node from FalkorDB."""
    delete_creator_preference(pref_id)
    return {"message": "Preference deleted from FalkorDB"}
