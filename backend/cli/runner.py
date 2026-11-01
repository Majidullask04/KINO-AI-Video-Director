"""
Local Host CLI & PTY Execution Bridge for HyperFrames and AI Coding Agents.
Spawns subprocesses on the local machine with real-time stdout/stderr streaming.
Ensures local FFmpeg and Node.js >= 22 are configured on the process PATH.
"""

import os
import sys
import shutil
import subprocess
import asyncio
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator

logger = logging.getLogger("kino.cli")

BIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "bin"))
PROJECTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "projects"))

def get_augmented_env() -> Dict[str, str]:
    """Returns environment with bin/ prepended to PATH for ffmpeg/ffprobe discovery."""
    env = os.environ.copy()
    current_path = env.get("PATH", "")
    paths = [BIN_DIR]
    # Add common homebrew and user local paths
    for p in ["/opt/homebrew/bin", "/usr/local/bin", os.path.expanduser("~/.local/bin")]:
        if os.path.isdir(p) and p not in current_path:
            paths.append(p)
    paths.append(current_path)
    env["PATH"] = ":".join(paths)
    return env

def check_system_prerequisites() -> Dict[str, Any]:
    """
    Checks all host prerequisites required for HyperFrames and local agent execution:
    - Node.js >= 22.0.0
    - FFmpeg executable on PATH
    - FFprobe executable on PATH
    - HyperFrames CLI availability
    """
    env = get_augmented_env()

    # 1. Check Node.js
    node_version = "not_found"
    node_valid = False
    try:
        res = subprocess.run(["node", "--version"], env=env, capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            node_version = res.stdout.strip()
            # Parse major version (e.g. v24.12.0 -> 24)
            major = int(node_version.lstrip("v").split(".")[0])
            node_valid = major >= 22
    except Exception as e:
        logger.warning(f"Node.js check failed: {e}")

    # 2. Check FFmpeg
    ffmpeg_available = False
    ffmpeg_version = "not_found"
    try:
        res = subprocess.run(["ffmpeg", "-version"], env=env, capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            ffmpeg_available = True
            first_line = res.stdout.split("\n")[0]
            ffmpeg_version = first_line.replace("ffmpeg version ", "").split(" ")[0]
    except Exception as e:
        logger.warning(f"FFmpeg check failed: {e}")

    # 3. Check FFprobe
    ffprobe_available = False
    try:
        res = subprocess.run(["ffprobe", "-version"], env=env, capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            ffprobe_available = True
    except Exception as e:
        logger.warning(f"FFprobe check failed: {e}")

    # 4. Check HyperFrames CLI
    hyperframes_available = False
    hyperframes_version = "not_found"
    try:
        res = subprocess.run(["npx", "hyperframes", "--version"], env=env, capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            hyperframes_available = True
            hyperframes_version = res.stdout.strip()
    except Exception as e:
        logger.warning(f"HyperFrames CLI check failed: {e}")

    ready = node_valid and ffmpeg_available and ffprobe_available

    return {
        "status": "ready" if ready else "incomplete",
        "node_version": node_version,
        "node_valid": node_valid,
        "ffmpeg_available": ffmpeg_available,
        "ffmpeg_version": ffmpeg_version,
        "ffprobe_available": ffprobe_available,
        "hyperframes_available": hyperframes_available,
        "hyperframes_version": hyperframes_version,
        "platform": sys.platform,
        "bin_dir": BIN_DIR
    }

def run_command_sync(args: List[str], cwd: Optional[str] = None, timeout: int = 60) -> Dict[str, Any]:
    """Runs a host CLI command synchronously and returns stdout, stderr, and exit code."""
    env = get_augmented_env()
    try:
        proc = subprocess.run(
            args,
            cwd=cwd or PROJECTS_DIR,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return {
            "command": " ".join(args),
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "success": proc.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {
            "command": " ".join(args),
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds",
            "success": False
        }
    except Exception as e:
        return {
            "command": " ".join(args),
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "success": False
        }

async def run_command_stream(args: List[str], cwd: Optional[str] = None) -> AsyncGenerator[str, None]:
    """Runs a host command asynchronously and yields output lines in real time."""
    env = get_augmented_env()
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=cwd or PROJECTS_DIR,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT
    )

    if proc.stdout:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            yield line.decode("utf-8", errors="replace")

    await proc.wait()
    yield f"\n[Process completed with exit code {proc.returncode}]\n"

# ----------------------------------------------------------------------
# CLI Agent Configurations
# ----------------------------------------------------------------------
AGENT_PROFILES = [
    {
        "id": "claude",
        "name": "Claude Code",
        "command": "claude",
        "args": ["--print"],
        "description": "Anthropic Claude Code CLI for terminal-based editing and reasoning",
        "available": shutil.which("claude") is not None
    },
    {
        "id": "gemini",
        "name": "Gemini CLI",
        "command": "gemini",
        "args": [],
        "description": "Google Gemini CLI for terminal assistance",
        "available": shutil.which("gemini") is not None
    },
    {
        "id": "opencode",
        "name": "OpenCode CLI",
        "command": "opencode",
        "args": [],
        "description": "Open-source terminal coding agent",
        "available": shutil.which("opencode") is not None
    },
    {
        "id": "codex",
        "name": "Codex CLI",
        "command": "codex",
        "args": [],
        "description": "Terminal code generation engine",
        "available": shutil.which("codex") is not None
    },
    {
        "id": "custom",
        "name": "Custom Shell Plan",
        "command": "sh",
        "args": ["-c"],
        "description": "User-defined custom terminal commands",
        "available": True
    }
]

def get_available_agents() -> List[Dict[str, Any]]:
    """Returns the list of agent profiles with local installation status."""
    return AGENT_PROFILES

