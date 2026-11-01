# KINO Studio — Local-First HyperFrames & Agentic Video Engine
**Deterministic HTML5 Video Studio | Powered by HeyGen HyperFrames & Local Host CLI Bridge**

![HyperFrames Compatible](https://img.shields.io/badge/Render_Engine-HyperFrames_v0.8-22C55E?style=for-the-badge)
![Local-First](https://img.shields.io/badge/Architecture-Local_Filesystem_Only-F59E0B?style=for-the-badge)
![FastAPI + Next.js 16](https://img.shields.io/badge/Stack-FastAPI_+_Next.js_16-09090B?style=for-the-badge)
![FFmpeg 7.0](https://img.shields.io/badge/Encoding-Native_FFmpeg_7.0-06B6D4?style=for-the-badge)

---

## 💡 Overview

**KINO Studio** is a local-first, deterministic video composition studio designed from the ground up to follow the **[HeyGen HyperFrames](https://github.com/heygen-com/hyperframes)** specification:
> *"Write HTML. Render video. Built for agents."*

Instead of opaque graph databases and slow MoviePy scripts, KINO treats video as **standard DOM elements, CSS styles, and GSAP animations**, with frame-accurate headless Chrome capture and native FFmpeg video encoding. Any terminal AI coding agent (Claude Code, Gemini CLI, OpenCode, Codex, or custom shell scripts) can scaffold, edit, and render videos directly on your local machine.

---

## 🏛 Architecture & Principles

```
+-----------------------------------------------------------------------+
|                    KINO STUDIO FRONTEND (Next.js 16)                  |
|  +-------------------+  +--------------------+  +------------------+  |
|  | Storyboard Editor |  | Live Preview Stage |  | Integrated CLI   |  |
|  | & frame.md Tokens |  | (HTML5 GSAP Canvas)|  | Terminal Drawer  |  |
|  +---------+---------+  +---------+----------+  +--------+---------+  |
|            |                      |                      |            |
|  +---------v----------------------v----------------------v---------+  |
|  |       DOM-Synced Multitrack Timeline (data-start & duration)    |  |
|  +--------------------------------+--------------------------------+  |
+-----------------------------------|-----------------------------------+
                                    | REST / Local IPC
+-----------------------------------v-----------------------------------+
|                   LOCAL HOST BRIDGE & WORKSPACE MANAGER               |
|  - Workspace Manager (Reads & writes projects/<id>/ files)            |
|  - CLI Bridge (Executes npx hyperframes check/render & agent plans)   |
|  - Native FFmpeg & FFprobe 7.0 binaries in bin/                       |
+-----------------+-----------------------------------+-----------------+
                  |                                   |
                  v                                   v
+-----------------------------------+ +---------------------------------+
|      LOCAL CLI CODING AGENT       | |     HYPERFRAMES CLI ENGINE      |
|  - Claude Code, Gemini, OpenCode  | |  - Headless Chrome Capture      |
|  - Reads/Writes STORYBOARD.md     | |  - Native FFmpeg 7.0 MP4 Mux    |
|  - Authors HTML/CSS/GSAP Scenes   | |  - 450+ Registry Components     |
+-----------------------------------+ +---------------------------------+
```

### 1. The Project Folder is the Single Source of Truth
Every project lives directly on your computer's filesystem in `projects/<project-id>/`:
- `index.html`: The root deterministic HyperFrames composition (`data-start`, `data-duration`, `data-track-index`, `window.__timelines["main"]`).
- `meta.json`: Project resolution, frame rate, aspect ratio, duration, and title.
- `STORYBOARD.md`: Scene-by-scene narrative direction, camera angles, and voiceover scripts.
- `frame.md`: Brand design system, color tokens, typography rules, and GSAP easing rules.
- `SCRIPT.md`: Scene transcript and dialogue.
- `HANDOFF.md`: Execution history and agent handoff notes.
- `assets/`: Raw footage clips (`.mp4`), audio stems (`.mp3`), and image assets.
- `.git/`: Local Git version control tracking every iteration.

### 2. Zero Mock Tolerance & Deterministic Rendering
- No simulated rendering timers, mock databases, or fake terminal outputs.
- Running `npx hyperframes check` enforces the official HyperFrames render contract (WCAG AA color contrast, GSAP timeline pausing, timing attribute checks).
- Running `npx hyperframes render` drives headless Chrome to capture frames deterministically at 30fps and muxes them with native FFmpeg into production MP4s.

### 3. Agent-Agnostic CLI Execution
KINO includes a built-in **Host CLI Drawer** that spawns your terminal agent directly in the target project folder:
- **Claude Code:** `claude --print "<directive>"`
- **Gemini CLI:** `gemini "<directive>"`
- **OpenCode:** `opencode "<directive>"`
- **Codex CLI:** `codex "<directive>"`
- **Custom Shell Plans:** `sh -c "<command>"`

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js:** &ge; 22.0.0 (`node --version`)
- **FFmpeg & FFprobe:** Native 7.0 binaries are bundled in `bin/`
- **HyperFrames CLI:** `npx hyperframes --version` (v0.8.225)

### 2. Start Backend API Server
```bash
cd KINO-AI-Video-Director
source backend/venv/bin/activate
uvicorn backend.main:app --port 8000 --reload
```
The backend will boot at `http://localhost:8000` and automatically verify host prerequisites and scaffold the workspace root.

### 3. Start Frontend Studio
```bash
cd KINO-AI-Video-Director/frontend
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🛠 Key Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/system/prerequisites` | `GET` | Verifies Node.js &ge; 22, FFmpeg 7.0, and HyperFrames CLI |
| `/api/projects` | `GET`, `POST` | Lists and scaffolds local project folders on disk |
| `/api/projects/{id}/files/{file}` | `GET`, `PUT` | Reads and writes `STORYBOARD.md`, `frame.md`, `index.html` |
| `/api/projects/{id}/upload-footage` | `POST` | Uploads raw footage and analyzes frame rate, duration, and shot cuts |
| `/api/hyperframes/projects/{id}/composition` | `GET` | Returns deterministic HTML5 composition code |
| `/api/cli/hyperframes/check` | `POST` | Executes `npx hyperframes check` on the project folder |
| `/api/cli/hyperframes/render` | `POST` | Executes `npx hyperframes render` to export frame-accurate MP4 |
| `/api/cli/agent/plan` | `POST` | Executes user's chosen CLI agent inside the project folder |

---

## 📜 HyperFrames Render Contract
Compositions authored or modified in KINO adhere strictly to the HyperFrames render contract:
- Root container: `<div id="root" style="width: 1920px; height: 1080px; position: relative; overflow: hidden;">`
- Timed clips: marked with `class="clip"`, `data-start="0.00"`, `data-duration="3.00"`, `data-track-index="1"`.
- Animation controller: Root GSAP timeline saved on `window.__timelines["main"]` and paused on frame 0 (`tl.pause()`).
- Video audio declaration: `<video ... data-has-audio="false" muted>` for background visual tracks.
