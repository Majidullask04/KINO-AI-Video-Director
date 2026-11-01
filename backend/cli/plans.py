"""
Autonomous CLI Plan Engine & Self-Healing Sequencer for HyperFrames.
Executes multi-stage video authoring pipelines with automatic
HyperFrames contract check gates, self-healing diagnostic loops,
and local Git checkpoint commits.
"""

import os
import json
import time
import asyncio
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator

from backend.cli.runner import (
    run_command_sync,
    get_augmented_env,
    AGENT_PROFILES,
    PROJECTS_DIR
)
from backend.projects.manager import (
    get_project_dir,
    create_git_checkpoint,
    read_file,
    write_file,
    generate_project_manifest
)

logger = logging.getLogger("kino.plans")

# ----------------------------------------------------------------------
# Predefined Reusable CLI Plan Blueprints
# ----------------------------------------------------------------------
PLAN_BLUEPRINTS = [
    {
        "id": "full_production",
        "name": "Full Video Production Plan",
        "description": "End-to-end autonomous video creation: Storyboard -> Design System -> HTML Composition -> Self-Healing Gate",
        "stages": [
            {
                "id": "script_storyboard",
                "name": "1. Script & Narrative Direction",
                "target_file": "STORYBOARD.md",
                "prompt_template": "Read assets/manifest.json and write an energetic, high-retention 4-beat scene structure into STORYBOARD.md and dialogue into SCRIPT.md for this brief: {brief}"
            },
            {
                "id": "design_tokens",
                "name": "2. Brand Tokens & frame.md",
                "target_file": "frame.md",
                "prompt_template": "Define high-contrast brand color tokens, typography rules (type floor >= 28px), and GSAP easing rules in frame.md for: {brief}"
            },
            {
                "id": "composition",
                "name": "3. HyperFrames HTML/GSAP Scene Authoring",
                "target_file": "index.html",
                "prompt_template": "Read HYPERFRAMES_RULES.md, frame.md, STORYBOARD.md, and assets/manifest.json. Author index.html conforming strictly to the HyperFrames render contract. Ensure paused GSAP timeline on window.__timelines['main'], clip data-start/data-duration attributes, and initial opacity 0 for subsequent cuts."
            },
            {
                "id": "verification_loop",
                "name": "4. Quality Gate & Self-Healing Loop",
                "type": "verify_and_heal",
                "max_retries": 3
            }
        ]
    },
    {
        "id": "kinetic_typography",
        "name": "Kinetic Typography & Captions Plan",
        "description": "Layers synchronized kinetic typography captions and lower thirds around existing footage",
        "stages": [
            {
                "id": "captions_layering",
                "name": "1. Kinetic Overlay Authoring",
                "target_file": "index.html",
                "prompt_template": "Add dynamic kinetic typography headlines and captions into index.html using Track 0. Align every caption to the voiceover timestamps in SCRIPT.md with type floor >= 28px. Brief: {brief}"
            },
            {
                "id": "verification_loop",
                "name": "2. Quality Gate & Self-Healing Loop",
                "type": "verify_and_heal",
                "max_retries": 3
            }
        ]
    },
    {
        "id": "social_vertical",
        "name": "Social 9:16 Vertical Reflow Plan",
        "description": "Adapts an existing composition into vertical 1080x1920 with safe zones for TikTok/Reels/Shorts",
        "stages": [
            {
                "id": "reflow_vertical",
                "name": "1. Vertical Recomposition (9:16)",
                "target_file": "index.html",
                "prompt_template": "Update index.html root stage to 1080x1920 (9:16 aspect ratio). Reflow video elements and titles to respect vertical safe zones (top 15% and bottom 20% clear for social UI). Brief: {brief}"
            },
            {
                "id": "verification_loop",
                "name": "2. Quality Gate & Self-Healing Loop",
                "type": "verify_and_heal",
                "max_retries": 3
            }
        ]
    }
]

def get_plan_blueprints() -> List[Dict[str, Any]]:
    """Returns installable plan templates."""
    return PLAN_BLUEPRINTS

def get_blueprint_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    """Finds blueprint by ID."""
    return next((p for p in PLAN_BLUEPRINTS if p["id"] == plan_id), None)

# Active execution process registry for process cancellation
ACTIVE_PLAN_PROCESSES: Dict[str, asyncio.subprocess.Process] = {}

def kill_active_plan_process(project_id: str) -> bool:
    """Kills any running subprocess for the project."""
    proc = ACTIVE_PLAN_PROCESSES.get(project_id)
    if proc:
        try:
            proc.kill()
            ACTIVE_PLAN_PROCESSES.pop(project_id, None)
            return True
        except Exception as e:
            logger.warning(f"Error killing process: {e}")
    return False

async def run_autonomous_plan_stream(
    project_id: str,
    plan_id: str,
    agent_id: str = "claude",
    brief: str = "Create a high-energy product launch video",
    custom_stages: Optional[List[Dict[str, Any]]] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Executes a multi-stage CLI plan with live streaming events,
    automatic npx hyperframes check verification, self-healing diagnostic feedback loop,
    and Git checkpoint commits.
    """
    proj_dir = get_project_dir(project_id)
    if not os.path.isdir(proj_dir):
        yield {"type": "error", "message": f"Project directory not found: {project_id}"}
        return

    blueprint = get_blueprint_by_id(plan_id)
    stages = custom_stages or (blueprint["stages"] if blueprint else PLAN_BLUEPRINTS[0]["stages"])

    # Ensure manifest is fresh before plan starts
    generate_project_manifest(project_id)

    yield {
        "type": "plan_start",
        "plan_id": plan_id,
        "agent_id": agent_id,
        "stages_count": len(stages),
        "timestamp": int(time.time() * 1000)
    }

    env = get_augmented_env()

    for stage_idx, stage in enumerate(stages):
        stage_name = stage.get("name", f"Stage {stage_idx + 1}")
        stage_type = stage.get("type", "agent_step")

        yield {
            "type": "stage_start",
            "stage_index": stage_idx,
            "stage_name": stage_name,
            "stage_type": stage_type
        }

        # Handle Verification & Self-Healing Loop
        if stage_type == "verify_and_heal":
            max_retries = int(stage.get("max_retries", 3))
            passed = False
            last_report = ""

            for attempt in range(max_retries + 1):
                yield {
                    "type": "stdout",
                    "text": f"\n🔍 [Quality Gate] Running `npx hyperframes check` (Attempt {attempt + 1}/{max_retries + 1})...\n"
                }

                check_proc = await asyncio.create_subprocess_exec(
                    "npx", "hyperframes", "check",
                    cwd=proj_dir,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                ACTIVE_PLAN_PROCESSES[project_id] = check_proc
                stdout_b, stderr_b = await check_proc.communicate()
                ACTIVE_PLAN_PROCESSES.pop(project_id, None)

                stdout_text = stdout_b.decode("utf-8", errors="replace")
                stderr_text = stderr_b.decode("utf-8", errors="replace")
                combined_report = f"{stdout_text}\n{stderr_text}".strip()

                if check_proc.returncode == 0 and "Check passed" in combined_report and "0 error(s)" in combined_report:
                    passed = True
                    yield {
                        "type": "stdout",
                        "text": f"\n✨ [Quality Gate PASSED] HyperFrames check passed with 0 errors!\n"
                    }
                    # Create Git checkpoint commit
                    commit_hash = create_git_checkpoint(
                        project_id,
                        f"checkpoint({stage.get('id', 'verify')}): HyperFrames check passed (0 errors)"
                    )
                    yield {
                        "type": "checkpoint_created",
                        "commit_hash": commit_hash,
                        "message": "Quality gate passed and workspace checkpointed"
                    }
                    break
                else:
                    # Check failed: extract diagnostics
                    last_report = combined_report
                    yield {
                        "type": "stdout",
                        "text": f"\n⚠️ [Quality Gate Warning] Check reported issues:\n{combined_report[:800]}\n"
                    }

                    if attempt < max_retries:
                        yield {
                            "type": "stdout",
                            "text": f"\n🛠 [Self-Healing Loop] Prompting {agent_id} with diagnostic errors to fix autonomously...\n"
                        }
                        healing_prompt = (
                            f"You edited index.html, but `npx hyperframes check` reported the following contract errors:\n\n"
                            f"{combined_report[:1200]}\n\n"
                            f"Please inspect and fix index.html now. Remember: paused GSAP timeline on window.__timelines['main'], "
                            f"class='clip' with data-start and data-duration on every timed element, type floor >= 28px, "
                            f"and no audio-with-mute conflicts."
                        )
                        # Invoke agent to heal
                        await _execute_agent_command(agent_id, healing_prompt, proj_dir, env, project_id)
                    else:
                        yield {
                            "type": "stdout",
                            "text": f"\n❌ [Quality Gate] Exceeded maximum self-healing retries ({max_retries}). Continuing with warnings.\n"
                        }

            yield {
                "type": "stage_complete",
                "stage_index": stage_idx,
                "passed": passed,
                "report": last_report[:600]
            }

        else:
            # Standard Agent Execution Stage
            prompt_template = stage.get("prompt_template", "{brief}")
            stage_prompt = prompt_template.replace("{brief}", brief)

            yield {
                "type": "stdout",
                "text": f"\n🚀 [{agent_id.upper()}] Executing {stage_name}...\nPrompt: {stage_prompt[:200]}...\n"
            }

            cmd_args = _build_agent_cmd(agent_id, stage_prompt)
            proc = await asyncio.create_subprocess_exec(
                *cmd_args,
                cwd=proj_dir,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            ACTIVE_PLAN_PROCESSES[project_id] = proc

            if proc.stdout:
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    line_str = line.decode("utf-8", errors="replace")
                    yield {"type": "stdout", "text": line_str}

            await proc.wait()
            ACTIVE_PLAN_PROCESSES.pop(project_id, None)

            # Create Git checkpoint after stage
            commit_hash = create_git_checkpoint(
                project_id,
                f"checkpoint({stage.get('id', 'step')}): completed {stage_name}"
            )

            # Update HANDOFF.md
            handoff = read_file(project_id, "HANDOFF.md") or ""
            entry = f"\n\n### Stage Completed: {stage_name} ({time.strftime('%Y-%m-%d %H:%M:%S')})\n"
            entry += f"- **Agent:** {agent_id}\n- **Checkpoint:** `{commit_hash or 'uncommitted'}`\n"
            write_file(project_id, "HANDOFF.md", handoff + entry)

            yield {
                "type": "stage_complete",
                "stage_index": stage_idx,
                "exit_code": proc.returncode,
                "commit_hash": commit_hash
            }

    yield {
        "type": "plan_complete",
        "project_id": project_id,
        "plan_id": plan_id,
        "timestamp": int(time.time() * 1000)
    }

def _build_agent_cmd(agent_id: str, prompt: str) -> List[str]:
    """Constructs command arguments for the specified agent profile."""
    if agent_id == "claude":
        return ["claude", "--print", prompt]
    elif agent_id == "gemini":
        return ["gemini", prompt]
    elif agent_id == "opencode":
        return ["opencode", prompt]
    elif agent_id == "codex":
        return ["codex", prompt]
    else:
        # Fallback to shell script or echo simulation if binary not installed
        import shutil
        if shutil.which(agent_id):
            return [agent_id, prompt]
        return ["sh", "-c", f"echo '[KINO Agent Bridge: Running Plan Directive]' && echo '{prompt}' >> .agent_directives.log"]

async def _execute_agent_command(agent_id: str, prompt: str, proj_dir: str, env: Dict[str, str], project_id: str):
    """Internal helper to execute agent subprocess during self-healing."""
    cmd = _build_agent_cmd(agent_id, prompt)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=proj_dir,
            env=env,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        ACTIVE_PLAN_PROCESSES[project_id] = proc
        await proc.wait()
        ACTIVE_PLAN_PROCESSES.pop(project_id, None)
    except Exception as e:
        logger.warning(f"Agent healing execution error: {e}")

