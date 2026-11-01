# AGENTS.md — HyperFrames & KINO Video Director Agent Guide

> **System Overview**: KINO Video Director is an autonomous Non-Linear Editing (NLE) and video composition studio aligned directly with **HeyGen HyperFrames** (`heygen-com/hyperframes`) — **"Write HTML. Render video. Built for agents."**
> Powered by local filesystem state (`projects/<id>/`), deterministic **HyperFrames HTML5/GSAP** render engine, native FFmpeg 7.0, and an extensible Local Host CLI Bridge.

---

## 1. System Architecture & Component Mapping

```
KINO-AI-Video-Director/
├── bin/                        # Native ARM64 executable toolchain
│   ├── ffmpeg                  # Native FFmpeg 7.0 binary
│   └── ffprobe                 # Native FFprobe 7.0 binary
│
├── projects/                   # The Single Source of Truth on Disk
│   └── <project-id>/           # Local project workspace
│       ├── index.html          # Deterministic HyperFrames HTML5 composition
│       ├── meta.json           # Resolution, duration, FPS, aspect ratio
│       ├── STORYBOARD.md       # Scene beats, visual directions, audio transcript
│       ├── frame.md            # Brand design tokens, typography, motion rules
│       ├── SCRIPT.md           # Scene dialogue and voiceover lines
│       ├── HANDOFF.md          # Agent run notes and execution history
│       ├── assets/             # Footage clips, audio bed, and image assets
│       └── .git/               # Local Git versioning
│
├── backend/
│   ├── hyperframes/            # HyperFrames Composition & Contract Engine
│   │   ├── composition.py      # Translates StoryBeats/CutDecisions to deterministic HTML compositions
│   │   ├── linter.py           # In-process contract verification linter
│   │   ├── parser.py           # Parses data-start & duration from index.html + bidirectional write
│   │   ├── registry.py         # Installable visual blocks catalog
│   │   └── routes.py           # FastAPI endpoints (/api/hyperframes/...)
│   ├── projects/               # Workspace Filesystem Manager
│   │   ├── manager.py          # Project folder CRUD, file reading/writing, placeholder assets
│   │   └── routes.py           # FastAPI endpoints (/api/projects/...)
│   ├── cli/                    # Local Host CLI & Agent Execution Bridge
│   │   ├── runner.py           # Prerequisites check (Node >= 22, FFmpeg), command runner, agent profiles
│   │   └── routes.py           # FastAPI endpoints (/api/cli/...)
│   ├── video/
│   │   └── analyzer.py         # OpenCV & PySceneDetect media inspector
│   ├── main.py                 # FastAPI application & router mounting
│   └── requirements.txt        # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Studio workspace shell + CLI Terminal Drawer
│   │   │   ├── layout.tsx      # Next.js app shell & font configuration
│   │   │   └── globals.css     # Dark violet studio styling & design tokens
│   │   ├── components/
│   │   │   ├── views/          # Studio screens (StudioView, RegistryView, DashboardView, FootageView, ExportView, SettingsView)
│   │   │   ├── CliTerminalDrawer.tsx         # Interactive Host CLI & agent runner drawer
│   │   │   ├── ProjectDirectivesInspector.tsx # Directives editor (STORYBOARD.md, frame.md, HANDOFF.md, index.html)
│   │   │   ├── HyperFramesClipInspector.tsx  # HyperFrames timing bounds & block inspector
│   │   │   ├── HyperFramesLintModal.tsx      # Contract verification modal
│   │   │   ├── StudioTimeline.tsx            # Multitrack DOM-synced timeline
│   │   │   └── SidebarNav.tsx                # Studio navigation rail
│   │   ├── utils/
│   │   │   └── media.ts        # API_BASE resolver
│   │   └── types/
│   │       └── index.ts        # TypeScript data types
│   └── package.json            # Next.js 16 + React 19 + Tailwind CSS 4
```

---

## 2. Operating Instructions for Coding Agents

When any local coding agent (Claude Code, Gemini CLI, OpenCode, Codex, or Antigravity) operates on a KINO project:

1. **Always edit files on disk:**
   - Modify scenes by directly editing `projects/<project-id>/index.html`.
   - Update narrative flow in `projects/<project-id>/STORYBOARD.md`.
   - Update styling, colors, or typography in `projects/<project-id>/frame.md`.
   - Log actions, changes, and suggestions into `projects/<project-id>/HANDOFF.md`.

2. **Verify contract compliance:**
   - Run `npx hyperframes check projects/<project-id>` to verify all rules pass with 0 errors.
   - Root container must be `<div id="root">`.
   - All timed elements must have `class="clip"`, `data-start`, and `data-duration`.
   - Main GSAP timeline must be saved on `window.__timelines["main"]` and paused on frame 0.
   - Elements with `start > 0` must have initial `opacity: 0` in CSS/inline styles.

3. **Render deterministic video:**
   - Run `npx hyperframes render projects/<project-id> -o projects/<project-id>/assets/output.mp4`.
