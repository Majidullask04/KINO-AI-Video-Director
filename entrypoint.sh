#!/usr/bin/env bash
set -e

# Ensure bin directory has symlinks for ffmpeg and ffprobe
mkdir -p /app/bin
if command -v ffmpeg >/dev/null 2>&1; then
    ln -sf "$(command -v ffmpeg)" /app/bin/ffmpeg
fi
if command -v ffprobe >/dev/null 2>&1; then
    ln -sf "$(command -v ffprobe)" /app/bin/ffprobe
fi

mkdir -p /app/projects

PORT="${PORT:-8000}"

if [ "$#" -gt 0 ]; then
    exec "$@"
else
    echo "🎬 Starting KINO HyperFrames Studio & Local CLI Engine on port ${PORT}..."
    exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT}"
fi
