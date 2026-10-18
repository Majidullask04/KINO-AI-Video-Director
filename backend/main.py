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
    delete_creator_preference,
    record_clip_feedback,
    get_creator_feedback_history,
    learn_creator_taste
)
from backend.video.renderer import (
    STATIC_DIR,
    SAMPLES_DIR,
    RENDERS_DIR,
    UPLOADS_DIR,
    generate_sample_media,
    render_edit_version
)
from backend.video.fit_analyzer import analyze_clip_beat_fit
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

class FeedbackRequest(BaseModel):
    action: str = Field(..., example="keep", description="'keep', 'replace', or 'reject'")
    clip_id: str = Field(..., example="clip_abc123")
    beat_id: str = Field(..., example="beat_hook_0")
    decision_id: Optional[str] = Field(default=None)
    version_id: Optional[str] = Field(default=None)
    reason: Optional[str] = Field(default="")
    rating: Optional[float] = Field(default=None)
    creator_id: str = Field(default="creator_default")

class AssignClipRequest(BaseModel):
    clip_id: str = Field(..., example="clip_abc123")
    beat_id: Optional[str] = Field(default=None)
    beat_index: int = Field(default=1, example=1)
    trim_in: Optional[float] = Field(default=None)
    trim_out: Optional[float] = Field(default=None)
    version_id: Optional[str] = Field(default=None)

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
    """
    Uploads raw video footage, executes computer vision frame sampling (motion, energy, edge density, shot types),
    indexes VideoClips into FalkorDB, and analyzes which StoryBeats each clip fits best.
    """
    indexed_assets = []
    all_recommendations = []

    if files:
        for f in files:
            # Save into uploads directory and static root
            upload_path = os.path.join(UPLOADS_DIR, f.filename)
            static_path = os.path.join(STATIC_DIR, f.filename)
            content = await f.read()
            with open(upload_path, "wb") as out_f:
                out_f.write(content)
            with open(static_path, "wb") as out_f:
                out_f.write(content)

            idx_res = ingestor.index_source_asset(project_id, f.filename, upload_path)
            
            # Analyze each created clip for best beat fit
            for clip in idx_res.get("clips", []):
                clip_data = {
                    "clip_id": clip["clip_id"],
                    "filename": f.filename,
                    "shot_type": clip["shot_type"],
                    "energy_level": clip["energy_level"],
                    "duration": clip["duration"],
                    "motion_score": clip["motion_score"],
                    "tags": clip.get("tags", []),
                    "visual_summary": clip.get("visual_summary", "")
                }
                fit_res = analyze_clip_beat_fit(project_id, clip_data)
                clip["fit_analysis"] = fit_res
                clip["video_url"] = f"/static/uploads/{f.filename}"
                all_recommendations.append(fit_res)

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
            for clip in idx_res.get("clips", []):
                clip_data = {
                    "clip_id": clip["clip_id"],
                    "filename": sc,
                    "shot_type": clip["shot_type"],
                    "energy_level": clip["energy_level"],
                    "duration": clip["duration"],
                    "motion_score": clip["motion_score"],
                    "tags": clip.get("tags", []),
                    "visual_summary": clip.get("visual_summary", "")
                }
                fit_res = analyze_clip_beat_fit(project_id, clip_data)
                clip["fit_analysis"] = fit_res
                clip["video_url"] = f"/static/samples/{sc}"
                all_recommendations.append(fit_res)
            indexed_assets.append(idx_res)

    # Ensure project has StoryBeats in FalkorDB
    try:
        ingestor.ensure_project_beats(project_id)
    except Exception as e:
        logger.warning(f"Could not ensure project beats: {e}")

    # Auto-synthesize optimal timeline edit using AI Director Agent
    synthesized_plan = None
    try:
        synthesized_plan = director.generate_initial_edit(project_id)
    except Exception as e:
        logger.warning(f"Could not auto-generate initial edit plan during footage upload: {e}")

    cut_count = len(synthesized_plan.get("decisions", [])) if synthesized_plan else len(all_recommendations)
    version_num = synthesized_plan.get("version_num", 1) if synthesized_plan else 1

    # Formulate rich breakdown of the synthesized cut
    beat_summaries = []
    if synthesized_plan and synthesized_plan.get("traceability"):
        for t in synthesized_plan["traceability"]:
            beat_summaries.append(f"• Beat {t['order']} ({t['narrative_beat'].upper()}): '{t['source_asset']}' ({t['shot_type'].replace('_', ' ')})")
    
    beat_text = "\n".join(beat_summaries) if beat_summaries else f"Created {cut_count} narrative cuts."

    assistant_briefing = (
        f"Initial Cut v{version_num} synthesized from your uploaded footage!\n\n"
        f"I analyzed your video frames with OpenCV and matched candidate clips to your StoryBeats using your customer style preferences:\n"
        f"{beat_text}\n\n"
        f"Your video is live in the Program Monitor and Multitrack Timeline. What would you like to refine? Select a Quick Directive or tell me how to make it the best video possible."
    )

    return {
        "message": f"Successfully indexed footage and synthesized timeline edit in FalkorDB",
        "assets": indexed_assets,
        "recommendations": all_recommendations,
        "plan": synthesized_plan,
        "assistant_briefing": assistant_briefing
    }

@app.get("/api/projects/{project_id}/clips/{clip_id}/best-fit")
def get_clip_best_fit(project_id: str, clip_id: str):
    """
    Evaluates where an existing VideoClip in the project's media bin fits best
    across all StoryBeats, taking into account creator style preferences.
    """
    cypher = """
    MATCH (c:VideoClip {id: $clip_id})
    OPTIONAL MATCH (sa:SourceAsset)-[:CONTAINS_CLIP]->(c)
    OPTIONAL MATCH (c)-[:HAS_TAG]->(t:VisualTag)
    RETURN c.id AS clip_id,
           sa.filename AS filename,
           c.shot_type AS shot_type,
           c.energy_level AS energy_level,
           c.duration AS duration,
           c.motion_score AS motion_score,
           c.edge_density AS edge_density,
           c.visual_summary AS visual_summary,
           collect(DISTINCT t.name) AS tags
    """
    res = db.query_as_dicts(cypher, {"clip_id": clip_id})
    if not res:
        raise HTTPException(status_code=404, detail=f"Clip {clip_id} not found")
    
    clip_data = res[0]
    return analyze_clip_beat_fit(project_id, clip_data)

@app.post("/api/projects/{project_id}/assign-clip")
def assign_clip_to_beat(project_id: str, req: AssignClipRequest):
    """
    Directly assigns a specific video clip to a story beat in the project timeline.
    Branches a new EditVersion (e.g. v2, v3) in FalkorDB lineage, links the CutDecision,
    and renders the updated timeline preview.
    """
    try:
        # 1. Fetch latest active EditVersion
        v_cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(v:EditVersion)
        RETURN v.id AS id, v.version_num AS version_num
        ORDER BY v.version_num DESC
        LIMIT 1
        """
        v_res = db.query_as_dicts(v_cypher, {"project_id": project_id})

        # 2. Fetch clip info
        clip_cypher = """
        MATCH (c:VideoClip {id: $clip_id})
        OPTIONAL MATCH (sa:SourceAsset)-[:CONTAINS_CLIP]->(c)
        RETURN c.id AS id, c.in_sec AS in_sec, c.out_sec AS out_sec, c.duration AS duration,
               c.shot_type AS shot_type, sa.filename AS filename
        """
        clip_res = db.query_as_dicts(clip_cypher, {"clip_id": req.clip_id})
        if not clip_res:
            raise HTTPException(status_code=404, detail=f"Clip {req.clip_id} not found")
        clip_info = clip_res[0]

        # 3. If no EditVersion exists yet, generate initial edit plan first
        if not v_res:
            director.generate_initial_edit(project_id)
            v_res = db.query_as_dicts(v_cypher, {"project_id": project_id})

        prev_version_id = v_res[0]["id"]
        prev_version_num = int(v_res[0]["version_num"])
        new_version_num = prev_version_num + 1
        new_version_id = f"v{new_version_num}_{uuid.uuid4().hex[:8]}"

        # 4. Fetch previous decisions
        d_cypher = """
        MATCH (v:EditVersion {id: $v_id})-[:HAS_DECISION]->(d:CutDecision)
        OPTIONAL MATCH (d)-[:FULFILLS_BEAT]->(b:StoryBeat)
        OPTIONAL MATCH (d)-[:SELECTS_CLIP]->(c:VideoClip)
        OPTIONAL MATCH (sa:SourceAsset)-[:CONTAINS_CLIP]->(c)
        RETURN d.timeline_order AS order, d.trim_in_sec AS in_sec, d.trim_out_sec AS out_sec,
               b.id AS beat_id, b.role AS beat_role, b.target_duration AS target_duration,
               c.id AS clip_id, sa.filename AS filename
        ORDER BY d.timeline_order ASC
        """
        prev_decisions = db.query_as_dicts(d_cypher, {"v_id": prev_version_id})

        target_order = int(req.beat_index)

        # 5. Create new EditVersion node in FalkorDB
        summary = f"Assigned clip {clip_info.get('filename', req.clip_id)} to Beat {target_order} based on AI Beat Fit"
        create_v_cypher = """
        MATCH (p:Project {id: $project_id})-[:HAS_VERSION]->(prev:EditVersion {id: $prev_version_id})
        CREATE (next_v:EditVersion {
            id: $new_version_id,
            version_num: $new_version_num,
            prompt_summary: $summary,
            render_status: 'rendering',
            preview_url: '',
            created_at: timestamp()
        })
        CREATE (p)-[:HAS_VERSION {is_active: true}]->(next_v)
        CREATE (next_v)-[:DERIVED_FROM {revision_prompt: $summary, changed_beat_index: $target_order}]->(prev)
        RETURN next_v.id AS id
        """
        db.query(create_v_cypher, {
            "project_id": project_id,
            "prev_version_id": prev_version_id,
            "new_version_id": new_version_id,
            "new_version_num": new_version_num,
            "summary": summary,
            "target_order": target_order
        })

        # 6. Re-populate decisions for new version
        for dec in prev_decisions:
            order = int(dec["order"])
            dec_id = f"dec_{uuid.uuid4().hex[:8]}"
            b_id = dec.get("beat_id")

            if order == target_order:
                chosen_clip_id = req.clip_id
                trim_in = req.trim_in if req.trim_in is not None else float(clip_info.get("in_sec", 0.0))
                dur = float(dec.get("target_duration") or 3.0)
                if req.trim_out is not None:
                    trim_out = req.trim_out
                else:
                    trim_out = round(trim_in + min(dur, float(clip_info.get("duration", dur))), 2)
                rationale = f"Assigned clip {chosen_clip_id} to Beat {order} ({dec.get('beat_role', 'cut')}) via AI Fit Recommender."
            else:
                chosen_clip_id = dec["clip_id"]
                trim_in = float(dec["in_sec"])
                trim_out = float(dec["out_sec"])
                rationale = f"Retained from v{prev_version_num}."

            insert_cypher = """
            MATCH (v:EditVersion {id: $version_id})
            MATCH (b:StoryBeat {id: $beat_id})
            MATCH (c:VideoClip {id: $clip_id})
            CREATE (d:CutDecision {
                id: $decision_id,
                timeline_order: $order,
                trim_in_sec: $trim_in,
                trim_out_sec: $trim_out,
                track: 'V1',
                ai_rationale: $rationale,
                confidence: 0.98
            })
            CREATE (v)-[:HAS_DECISION {timeline_order: $order}]->(d)
            CREATE (d)-[:FULFILLS_BEAT]->(b)
            CREATE (d)-[:SELECTS_CLIP {trim_in: $trim_in, trim_out: $trim_out}]->(c)
            RETURN d.id
            """
            db.query(insert_cypher, {
                "version_id": new_version_id,
                "beat_id": b_id,
                "clip_id": chosen_clip_id,
                "decision_id": dec_id,
                "order": order,
                "trim_in": trim_in,
                "trim_out": trim_out,
                "rationale": rationale
            })

        # 7. Render updated preview
        preview_url = render_edit_version(new_version_id)

        return {
            "message": f"Successfully assigned clip to Beat {target_order} and branched EditVersion v{new_version_num}",
            "version_id": new_version_id,
            "version_num": new_version_num,
            "preview_url": preview_url
        }
    except Exception as e:
        logger.error(f"Error assigning clip to beat: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

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

# ----------------------------------------------------------------------
# Feedback & Taste Learning Endpoints (Requirements 3 & 4)
# ----------------------------------------------------------------------

@app.post("/api/projects/{project_id}/feedback")
def submit_clip_feedback(project_id: str, req: FeedbackRequest):
    """
    Requirement 3: Records customer feedback ('keep', 'replace', 'reject') for a suggested clip cut.
    Updates FalkorDB graph nodes, clip counters, and automatically runs taste learning to reinforce preferences.
    """
    try:
        feedback_res = record_clip_feedback(
            creator_id=req.creator_id,
            project_id=project_id,
            clip_id=req.clip_id,
            beat_id=req.beat_id,
            action=req.action,
            decision_id=req.decision_id,
            version_id=req.version_id,
            reason=req.reason,
            rating=req.rating
        )

        # Requirement 4: Learn their taste automatically from collected choices
        learned_rules = learn_creator_taste(req.creator_id)

        return {
            "message": f"Successfully recorded feedback '{req.action}' in FalkorDB",
            "feedback": feedback_res,
            "learned_taste_rules": learned_rules
        }
    except Exception as e:
        logger.error(f"Error recording feedback: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/projects/{project_id}/feedback")
def get_project_feedback(project_id: str, creator_id: str = "creator_default"):
    """Fetches feedback logs and aggregate metrics."""
    return get_creator_feedback_history(creator_id)

@app.get("/api/creator/feedback")
def get_all_creator_feedback(creator_id: str = "creator_default"):
    """Fetches feedback logs across all sessions for a creator."""
    return get_creator_feedback_history(creator_id)

@app.post("/api/creator/learn-taste")
def trigger_taste_learning(creator_id: str = "creator_default"):
    """
    Requirement 4: Explicitly mines customer feedback history to learn taste patterns
    and creates/reinforces durable CreatorPreference nodes in FalkorDB.
    """
    learned_rules = learn_creator_taste(creator_id)
    active_prefs = run_creator_preferences_query(creator_id)
    return {
        "message": f"Learned or updated {len(learned_rules)} style preferences from customer feedback",
        "newly_mined_rules": learned_rules,
        "active_preferences": active_prefs
    }

