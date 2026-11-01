"""
FastAPI Routes for Local Host CLI & Agent Execution.
Exposes real subprocess execution, system prerequisites checking,
and interactive WebSocket/SSE streaming for autonomous plans.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from backend.cli.runner import (
    check_system_prerequisites,
    run_command_sync,
    get_available_agents,
    PROJECTS_DIR,
    BIN_DIR
)
from backend.cli.plans import (
    get_plan_blueprints,
    run_autonomous_plan_stream,
    kill_active_plan_process
)
from backend.projects.manager import get_project_dir

logger = logging.getLogger("kino.cli.routes")
router = APIRouter(prefix="/api/cli", tags=["CLI Bridge"])

class RunCommandRequest(BaseModel):
    command: str = Field(..., example="npx hyperframes check")
    project_id: Optional[str] = None
    timeout: int = Field(default=60)

class AddBlockRequest(BaseModel):
    block_id: str = Field(..., example="kinetic-title")
    project_id: str

class RenderRequest(BaseModel):
    project_id: str
    output_filename: Optional[str] = None

class AgentPlanRequest(BaseModel):
    project_id: str
    agent_id: str = Field(default="claude", example="claude")
    prompt: str = Field(..., example="Add kinetic caption overlays to Beat 2 and tune GSAP transitions")

class AutonomousPlanRequest(BaseModel):
    project_id: str
    plan_id: str = Field(default="full_production", example="full_production")
    agent_id: str = Field(default="claude", example="claude")
    brief: str = Field(default="High-energy product reveal video", example="High-energy product reveal video")
    custom_stages: Optional[List[Dict[str, Any]]] = None

@router.get("/prerequisites")
def get_prerequisites():
    """Checks host system for Node >= 22, FFmpeg, FFprobe, and HyperFrames."""
    return check_system_prerequisites()

@router.get("/agents")
def list_agents():
    """Returns supported terminal coding agent configurations."""
    return {"agents": get_available_agents()}

@router.get("/plans")
def list_plan_blueprints():
    """Returns available autonomous CLI plan blueprints."""
    return {"plans": get_plan_blueprints()}

@router.post("/execute")
def execute_command(req: RunCommandRequest):
    """Executes a host command inside a project directory."""
    cwd = get_project_dir(req.project_id) if req.project_id else PROJECTS_DIR
    if not os.path.isdir(cwd):
        cwd = PROJECTS_DIR

    args = req.command.split(" ")
    res = run_command_sync(args, cwd=cwd, timeout=req.timeout)
    return res

@router.post("/kill")
def kill_process(project_id: str = Body(..., embed=True)):
    """Kills any active subprocess or plan running for the specified project."""
    killed = kill_active_plan_process(project_id)
    return {"project_id": project_id, "killed": killed}

@router.post("/hyperframes/check")
def hyperframes_check(project_id: str = Body(..., embed=True)):
    """Runs `npx hyperframes check` in the project folder."""
    cwd = get_project_dir(project_id)
    if not os.path.isdir(cwd):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {project_id}")

    res = run_command_sync(["npx", "hyperframes", "check"], cwd=cwd, timeout=30)
    return res

@router.post("/hyperframes/render")
def hyperframes_render(req: RenderRequest):
    """Runs `npx hyperframes render` to export deterministic MP4 video."""
    cwd = get_project_dir(req.project_id)
    if not os.path.isdir(cwd):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {req.project_id}")

    out_name = req.output_filename or f"{req.project_id}.mp4"
    res = run_command_sync(["npx", "hyperframes", "render", "-o", out_name], cwd=cwd, timeout=120)
    
    mp4_path = os.path.join(cwd, out_name)
    if not os.path.exists(mp4_path):
        alt_path = os.path.join(cwd, "assets", os.path.basename(out_name))
        if os.path.exists(alt_path):
            mp4_path = alt_path

    has_rendered = os.path.exists(mp4_path)

    return {
        **res,
        "rendered_file": out_name,
        "mp4_path": mp4_path if has_rendered else None,
        "video_url": f"/api/projects/{req.project_id}/assets/{os.path.basename(out_name)}" if has_rendered else None,
        "file_exists": has_rendered
    }

@router.post("/hyperframes/add")
def hyperframes_add(req: AddBlockRequest):
    """Runs `npx hyperframes add <block-id>` in the project folder."""
    cwd = get_project_dir(req.project_id)
    if not os.path.isdir(cwd):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {req.project_id}")

    res = run_command_sync(["npx", "hyperframes", "add", req.block_id], cwd=cwd, timeout=45)
    return res

@router.post("/agent/plan")
def run_agent_plan(req: AgentPlanRequest):
    """Executes a single agent directive."""
    cwd = get_project_dir(req.project_id)
    if not os.path.isdir(cwd):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {req.project_id}")

    if req.agent_id == "claude":
        cmd = ["claude", "--print", req.prompt]
    elif req.agent_id == "gemini":
        cmd = ["gemini", req.prompt]
    elif req.agent_id == "opencode":
        cmd = ["opencode", req.prompt]
    elif req.agent_id == "codex":
        cmd = ["codex", req.prompt]
    else:
        cmd = ["sh", "-c", req.prompt]

    res = run_command_sync(cmd, cwd=cwd, timeout=120)
    return res

# ----------------------------------------------------------------------
# Interactive Terminal WebSocket Bridge (Phase A & C)
# ----------------------------------------------------------------------

@router.websocket("/ws/{project_id}")
async def cli_terminal_websocket(websocket: WebSocket, project_id: str):
    """
    Bi-directional interactive terminal WebSocket:
    Streams command output, plan stage transitions, and self-healing events line by line.
    Supports real-time process cancellation.
    """
    await websocket.accept()
    logger.info(f"CLI Terminal WebSocket connected for project: {project_id}")

    try:
        while True:
            raw_msg = await websocket.receive_text()
            data = json.loads(raw_msg)
            action = data.get("action")

            if action == "kill" or action == "cancel":
                killed = kill_active_plan_process(project_id)
                await websocket.send_json({"type": "cancelled", "killed": killed})

            elif action == "run_command":
                cmd = data.get("command", "")
                if cmd:
                    await websocket.send_json({"type": "stdout", "text": f"\n$ {cmd}\n"})
                    cwd = get_project_dir(project_id)
                    res = run_command_sync(cmd.split(" "), cwd=cwd, timeout=60)
                    if res.get("stdout"):
                        await websocket.send_json({"type": "stdout", "text": res["stdout"]})
                    if res.get("stderr"):
                        await websocket.send_json({"type": "stdout", "text": f"[stderr] {res['stderr']}"})
                    await websocket.send_json({"type": "command_complete", "exit_code": res["exit_code"]})

            elif action == "run_plan":
                plan_id = data.get("plan_id", "full_production")
                agent_id = data.get("agent_id", "claude")
                brief = data.get("brief", "High-energy product reveal video")
                custom_stages = data.get("custom_stages")

                async for event in run_autonomous_plan_stream(
                    project_id=project_id,
                    plan_id=plan_id,
                    agent_id=agent_id,
                    brief=brief,
                    custom_stages=custom_stages
                ):
                    await websocket.send_json(event)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for {project_id}")
        kill_active_plan_process(project_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
