"""
FastAPI Routes for HyperFrames Integration.
Exposes endpoints for composition generation, contract linting,
registry block exploration, and CLI export.
"""

from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import HTMLResponse
from typing import Dict, Any
from backend.hyperframes.composition import get_project_composition
from backend.hyperframes.linter import lint_composition_contract
from backend.hyperframes.registry import get_registry_blocks, get_block_by_id

router = APIRouter(prefix="/api/hyperframes", tags=["HyperFrames"])

@router.get("/projects/{project_id}/composition")
def get_composition(project_id: str):
    """
    Generates and returns the deterministic HyperFrames HTML5 composition.
    """
    try:
        comp = get_project_composition(project_id)
        return comp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate HyperFrames composition: {str(e)}")

@router.api_route("/projects/{project_id}/preview.html", methods=["GET", "HEAD"], response_class=HTMLResponse)
def get_preview_html(project_id: str):
    """
    Renders the live HyperFrames composition with base href injected
    for instant browser preview in iframe.
    """
    try:
        comp = get_project_composition(project_id)
        html = comp["html"]
        base_tag = f'<base href="/api/projects/{project_id}/">'
        if "<head>" in html:
            html = html.replace("<head>", f"<head>\n    {base_tag}")
        elif "<html" in html:
            html = html.replace(">", f">\n<head>{base_tag}</head>", 1)
        return HTMLResponse(content=html, media_type="text/html")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.get("/projects/{project_id}/lint")
def lint_composition(project_id: str):
    """
    Runs the HyperFrames contract linter on the project's active composition.
    """
    try:
        comp = get_project_composition(project_id)
        lint_report = lint_composition_contract(comp["html"], comp["duration"])
        return {
            "project_id": project_id,
            "report": lint_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to lint HyperFrames composition: {str(e)}")

@router.get("/registry/blocks")
def list_registry_blocks():
    """
    Returns the installable HyperFrames blocks and components catalog.
    """
    blocks = get_registry_blocks()
    return {
        "catalog_version": "1.0.0",
        "total_blocks": len(blocks),
        "blocks": blocks
    }

@router.get("/registry/blocks/{block_id}")
def get_block(block_id: str):
    """
    Retrieves details and code for a specific registry block.
    """
    block = get_block_by_id(block_id)
    return block

@router.post("/projects/{project_id}/apply-block")
def apply_block_to_beat(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    """
    Injects a HyperFrames registry block into a specified StoryBeat.
    """
    block_id = payload.get("block_id")
    target_beat_order = payload.get("target_beat_order", 1)

    if not block_id:
        raise HTTPException(status_code=400, detail="block_id is required")

    block = get_block_by_id(block_id)

    return {
        "message": f"Successfully applied '{block['name']}' to Beat #{target_beat_order}",
        "project_id": project_id,
        "block": block,
        "applied_to_beat": target_beat_order,
        "cli_preview_command": f"npx hyperframes preview"
    }
