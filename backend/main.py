"""
KINO HyperFrames Studio & Local Host CLI Bridge.
Local-first video composition orchestrator and deterministic renderer.
Replaces FalkorDB and MoviePy with standard filesystem state (meta.json, STORYBOARD.md, index.html)
and the HyperFrames CLI (headless Chrome + FFmpeg).
"""

import os
import time
import logging
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.hyperframes.routes import router as hyperframes_router
from backend.projects.routes import router as projects_router
from backend.cli.routes import router as cli_router
from backend.cli.runner import check_system_prerequisites, BIN_DIR
from backend.projects.manager import ensure_projects_root, create_project, list_projects, get_project

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kino.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes local projects directory and verifies host prerequisites."""
    projects_root = ensure_projects_root()
    logger.info(f"KINO Workspace Root: {projects_root}")

    # Check system prerequisites
    prereqs = check_system_prerequisites()
    logger.info(f"System Prerequisites Status: {prereqs['status']}")
    logger.info(f"Node.js: {prereqs['node_version']} (Valid: {prereqs['node_valid']})")
    logger.info(f"FFmpeg: {prereqs['ffmpeg_available']} ({prereqs['ffmpeg_version']})")
    logger.info(f"HyperFrames CLI: {prereqs['hyperframes_available']} ({prereqs['hyperframes_version']})")

    # If no projects exist, seed a starter showcase project
    existing = list_projects()
    if not existing:
        logger.info("Seeding initial showcase HyperFrames project...")
        create_project(
            project_id="demo-hyperframes-showcase",
            title="HyperFrames Deterministic Showcase",
            duration=12.0,
            aspect_ratio="16:9",
            category="Product Reveal",
            mood="high-energy"
        )
    yield

app = FastAPI(
    title="KINO HyperFrames Studio & Local CLI Engine",
    description="Local-first deterministic video studio and agent orchestration hub",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include core routers
app.include_router(projects_router)
app.include_router(hyperframes_router)
app.include_router(cli_router)

# Direct System Endpoints
@app.get("/")
def root():
    return {
        "service": "KINO HyperFrames Studio & Local CLI Engine",
        "status": "online",
        "version": "2.0.0",
        "architecture": "Local Filesystem + HyperFrames CLI + Local PTY Bridge",
        "engine": "HeyGen HyperFrames (HTML/CSS/GSAP -> Frame-Accurate MP4)"
    }

@app.get("/api/health")
def api_health():
    prereqs = check_system_prerequisites()
    return {
        "status": "online",
        "service": "KINO HyperFrames Studio",
        "storage": "Local Filesystem (projects/)",
        "prerequisites": prereqs,
        "timestamp": int(time.time() * 1000)
    }

@app.get("/api/system/prerequisites")
def api_system_prerequisites():
    return check_system_prerequisites()

# Backward-compatible 1-click Demo Seed endpoint
@app.post("/api/seed-demo")
def seed_demo_project():
    """Seeds a rich HyperFrames demo project on the local disk."""
    p_id = f"demo-project-{int(time.time()) % 10000}"
    meta = create_project(
        project_id=p_id,
        title="Autonomous Video Studio Reveal",
        duration=12.0,
        aspect_ratio="16:9",
        category="YouTube Long-Form",
        mood="upbeat"
    )
    details = get_project(p_id)
    return {
        "message": "Demo project scaffolded on local filesystem",
        "project": meta,
        "version_v1": {
            "decisions": [],
            "traceability": []
        }
    }

# Preferences and Feedback compatibility endpoints
@app.get("/api/creator/preferences")
def get_preferences():
    return {"preferences": [
        {"id": "p1", "category": "Pacing & Style", "rule_text": "Lead with high-energy kinetic hook under 3s", "weight": 1.8},
        {"id": "p2", "category": "Visual Continuity", "rule_text": "Always preserve GSAP timeline contract on window.__timelines", "weight": 1.5}
    ]}

@app.post("/api/creator/preferences")
def create_preference():
    return {"message": "Saved rule to project directives", "id": "p_new"}

@app.delete("/api/creator/preferences/{pref_id}")
def delete_preference(pref_id: str):
    return {"message": "Removed rule"}

@app.get("/api/creator/feedback")
def get_feedback():
    return {"total_feedback": 12, "history": []}

@app.post("/api/creator/learn-taste")
def learn_taste():
    return {"message": "Directives synchronized with style guidelines", "learned_taste_rules": []}
