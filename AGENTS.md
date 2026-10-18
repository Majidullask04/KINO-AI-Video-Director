# AGENTS.md — KINO AI Video Director Developer & Agent Guide

> **System Overview**: KINO AI Video Director is a graph-grounded autonomous Non-Linear Editing (NLE) copilot built on **FalkorDB** and **Google Gemini 2.5 Flash/Pro**.
> This document specifies the complete codebase architecture, multi-agent coordination protocol, graph schema, runtime instructions, and development playbooks for Google Jules and automated coding agents.

---

## 1. System Architecture & Component Mapping

```
director.ai/
├── backend/
│   ├── agents/
│   │   ├── director_agent.py   # Multi-hop graph matching + shot compatibility scoring + Gemini rationale
│   │   ├── ingestor_agent.py   # Footage segmentation, CV heuristics, and graph node creation
│   │   └── revision_agent.py   # Conversational revision parsing via Gemini + Lineage DAG mutations
│   ├── graph/
│   │   ├── client.py           # FalkorDB / Redis connection pooling and retry logic
│   │   ├── queries.py          # Clean, parameterized Cypher query library (Queries 1-5 + Taste Learning)
│   │   └── schema.py           # Node labels, edge types, and indices definition
│   ├── video/
│   │   ├── analyzer.py         # OpenCV frame differencing, edge density, and Gemini multimodal vision
│   │   └── renderer.py         # MoviePy / FFmpeg video trimmer and audio stitcher
│   ├── beats.py                # Canonical beat templates & ROLE_SHOT_MATRIX shot-type compatibility
│   ├── llm.py                  # Google Gemini 2.5 Flash SDK client (`google-genai`) with structured JSON
│   ├── main.py                 # FastAPI application, REST endpoints, static media serving, CORS
│   └── requirements.txt        # Python dependencies (google-genai, falkordb, fastapi, opencv, moviepy)
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Lean orchestrator shell (48px header + sidebar + view routing)
│   │   │   └── layout.tsx      # Next.js app shell & font configuration
│   │   ├── components/
│   │   │   ├── views/          # Modularized studio screens
│   │   │   │   ├── LandingView.tsx      # System overview & 1-click demo seed
│   │   │   │   ├── DashboardView.tsx    # Project library & search
│   │   │   │   ├── WizardView.tsx       # New project production brief modal
│   │   │   │   ├── ReferenceView.tsx    # Reference video monitor & beat timeline
│   │   │   │   ├── FootageView.tsx      # Media bin, upload dropzone, BeatFit modal
│   │   │   │   ├── StudioView.tsx       # Program monitor, timeline, chat, Graph Inspector
│   │   │   │   ├── ExportView.tsx       # Codec presets & master download
│   │   │   │   ├── PublishingView.tsx   # Producer sign-off gate & channel stage
│   │   │   │   └── SettingsView.tsx     # FalkorDB RAM telemetry & Track 02 creator taste rules
│   │   │   ├── DirectorChat.tsx         # Natural-language editorial copilot chat
│   │   │   ├── GraphInspector.tsx       # FalkorDB property graph visualizer & Cypher explorer
│   │   │   ├── StudioTimeline.tsx       # Multitrack timeline (V1 Primary, V2 B-Roll, A1 Audio)
│   │   │   ├── VersionDiffView.tsx      # Graph diff comparison table (Query 4)
│   │   │   └── SidebarNav.tsx           # Left studio navigation rail
│   │   ├── utils/
│   │   │   └── media.ts        # Dynamic API_BASE and backendMediaUrl resolver
│   │   └── types.ts            # Shared TypeScript contracts
│   └── package.json            # Next.js 16 + React 19 + Tailwind CSS 4
│
├── AGENTS.md                   # This instruction guide
├── Dockerfile                  # Production container definition
├── docker-compose.yml          # Local multi-service orchestration (FalkorDB + Backend + Frontend)
└── render.yaml                 # Cloud deployment manifest for Render
```

---

## 2. The Multi-Agent Pipeline

### 🤖 1. Ingestor Agent (`backend/agents/ingestor_agent.py`)
- **Role**: Ingests raw video assets or reference videos.
- **Workflow**:
  1. Decomposes reference video into narrative `:StoryBeat` sequences using PySceneDetect / canonical story templates in `backend/beats.py`.
  2. Samples keyframes from user-uploaded footage at 1.5-second intervals.
  3. Executes OpenCV frame differencing (`analyzer.py`) to calculate motion energy and edge density.
  4. Calls `GeminiDirectorClient.analyze_clip_frames` (`backend/llm.py`) with frame image bytes to infer shot classification (`TALKING_HEAD`, `B_ROLL`, `CODE_SCREEN`, `PRODUCT_DEMO`), subject action, energy score (1–5), and lighting condition.
  5. Injects `:SourceAsset`, `:VideoClip`, `:VisualTag`, and `:AudioMood` nodes and edges into FalkorDB.

### 🎬 2. Director Agent (`backend/agents/director_agent.py`)
- **Role**: Synthesizes the initial timeline cut (`EditVersion v1`) and recommends optimal beat placement.
- **Workflow**:
  1. Executes **Cypher Query 1** to find candidate `:VideoClip` nodes matching each `:StoryBeat` role and visual tag requirements, excluding any clips previously linked with `[:REJECTED_FOR]`.
  2. Scores candidates using `analyze_clip_beat_fit(...)`:
     - Role-to-shot-type compatibility (50% weight via `ROLE_SHOT_MATRIX`).
     - Visual tag overlap (20% weight).
     - Energy match (15% weight).
     - Duration compliance (15% weight).
     - Preference boost: Applies weight bonuses from active `(:CreatorPreference)` nodes.
  3. Calls `GeminiDirectorClient.generate_editorial_rationale(...)` to produce human-readable editorial justification for each cut decision.
  4. Writes `:EditVersion` and `:CutDecision` nodes to FalkorDB.
  5. Invokes `video/renderer.py` to trim and concatenate the video preview MP4.

### 🔄 3. Revision Agent (`backend/agents/revision_agent.py`)
- **Role**: Handles natural-language conversational revision requests and branches the timeline DAG.
- **Workflow**:
  1. Calls `GeminiDirectorClient.parse_revision_prompt(...)` to extract:
     - `intent`: `"swap_clip"`, `"trim_duration"`, `"change_pacing"`, `"learn_preference"`.
     - `target_beat_index`: The specific 1-indexed beat number targeted.
     - `desired_shot_type`, `desired_energy`, `explanation`.
     - `preference_rule`: Permanent rule to store if the user indicates a standing preference.
  2. If a permanent rule is detected, creates a new `(:CreatorPreference)` node in FalkorDB.
  3. Executes **Cypher Query 2**:
     - Marks the previous clip with `[:REJECTED_FOR {reason: prompt, rejected_in_version: prev_v}]` directed at the target `:StoryBeat`.
     - Creates a new `:EditVersion` node linked via `[:DERIVED_FROM]` to form an immutable revision DAG.
  4. Selects a fresh candidate clip that respects all prior `[:REJECTED_FOR]` negative memories.
  5. Computes a graph diff summary (**Cypher Query 4**) comparing the two versions.

---

## 3. FalkorDB Property Graph Schema

### Node Labels
- `:Creator` (`id`, `name`, `default_aspect_ratio`)
- `:CreatorPreference` (`id`, `category`, `rule_text`, `weight`, `updated_at`)
- `:Project` (`id`, `title`, `category`, `target_duration`, `mood`, `aspect_ratio`, `status`)
- `:ReferenceVideo` (`id`, `source_type`, `url_or_path`, `avg_cut_duration`, `pacing_style`, `total_duration`)
- `:StoryBeat` (`id`, `beat_index`, `role`, `target_duration`, `energy_level`, `required_shot_type`, `transition`)
- `:SourceAsset` (`id`, `filename`, `media_type`, `duration`, `resolution`, `fps`)
- `:VideoClip` (`id`, `in_sec`, `out_sec`, `duration`, `shot_type`, `energy_level`, `motion_score`, `transcript`)
- `:VisualTag` (`name`: `closeup`, `broll`, `talking_head`, `product_shot`, `screen`, `lifestyle`)
- `:AudioMood` (`name`: `upbeat`, `calm`, `dramatic`, `conversational`)
- `:EditVersion` (`id`, `version_num`, `prompt_summary`, `render_status`, `preview_url`, `created_at`)
- `:CutDecision` (`id`, `timeline_order`, `trim_in_sec`, `trim_out_sec`, `track`, `ai_rationale`, `confidence`)

### Edge Types
- `(:Creator)-[:REMEMBERS_PREF {session_count, confidence}]->(:CreatorPreference)`
- `(:Creator)-[:OWNS_PROJECT]->(:Project)`
- `(:Project)-[:USES_REFERENCE]->(:ReferenceVideo)`
- `(:ReferenceVideo)-[:HAS_BEAT {beat_index}]->(:StoryBeat)`
- `(:StoryBeat)-[:NEXT_BEAT]->(:StoryBeat)`
- `(:StoryBeat)-[:REQUIRES_TAG {weight}]->(:VisualTag)`
- `(:Project)-[:HAS_ASSET]->(:SourceAsset)`
- `(:SourceAsset)-[:CONTAINS_CLIP {clip_index}]->(:VideoClip)`
- `(:VideoClip)-[:NEXT_CLIP_IN_SOURCE {gap_sec}]->(:VideoClip)`
- `(:VideoClip)-[:HAS_TAG {confidence}]->(:VisualTag)`
- `(:VideoClip)-[:HAS_MOOD {confidence}]->(:AudioMood)`
- `(:Project)-[:HAS_VERSION {is_active}]->(:EditVersion)`
- `(:EditVersion)-[:DERIVED_FROM {revision_prompt, changed_beat_index}]->(:EditVersion)`
- `(:EditVersion)-[:HAS_DECISION {timeline_order}]->(:CutDecision)`
- `(:CutDecision)-[:FULFILLS_BEAT {pacing_fit_score}]->(:StoryBeat)`
- `(:CutDecision)-[:SELECTS_CLIP {trim_in, trim_out}]->(:VideoClip)`
- `(:VideoClip)-[:REJECTED_FOR {reason, rejected_in_version}]->(:StoryBeat)` *(Negative Memory)*

---

## 4. Key Developer & Agent Commands

### Backend Validation & Compilation
```bash
# Verify Python syntax across all modules
backend/venv/bin/python -m py_compile backend/main.py backend/llm.py backend/beats.py backend/video/analyzer.py backend/agents/*.py backend/graph/*.py

# Verify FastAPI import and dependency tree
backend/venv/bin/python -c "import backend.main; print('backend.main imported successfully!')"

# Run backend locally with auto-reload
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Validation & Build
```bash
cd frontend

# Run type check and Next.js production build
npm run build

# Start frontend dev server on port 3001
npm run dev -- -p 3001
```

### FalkorDB Docker Instance
```bash
# Start FalkorDB container with persistent port
docker run -p 6379:6379 -p 3000:3000 --name falkordb-director -d falkordb/falkordb:latest
```

---

## 5. Working Rules for Coding Agents

1. **AI Brain Discipline**: All intelligent classification, visual frame inspection, conversational prompt interpretation, and editorial justifications MUST route through `backend/llm.py` (`GeminiDirectorClient`). Never add hardcoded regex-based string replacements or fake marketing transcripts.
2. **Offline Resilience**: When `GEMINI_API_KEY` is not present, `backend/llm.py` MUST gracefully fall back to deterministic CV heuristic approximations without crashing.
3. **Graph Integrity**: Never bypass FalkorDB to store state in local JSON files. Timeline cuts, revision lineages, and creator preferences must be stored and queried via `backend/graph/queries.py`.
4. **Media Path Normalization**: In frontend views, always wrap video media URLs with `backendMediaUrl(...)` from `@/utils/media` to ensure URLs resolve to `API_BASE` (preventing HTTPS mixed-content blocks when deployed on Vercel).
5. **Component Modularity**: Never re-inflate `frontend/src/app/page.tsx` into a monolithic file. Keep views isolated in `frontend/src/components/views/`.
