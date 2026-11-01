# Multi-runtime production container for KINO HyperFrames Studio & Local CLI Engine
# Includes Python 3.11, Node.js 22 (LTS), FFmpeg, Headless Chromium, and HyperFrames CLI

FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium

# Install core system packages: ffmpeg, chromium, curl, git, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    git \
    ffmpeg \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22.x LTS and global HyperFrames CLI
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g hyperframes \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure bin directory with symlinks for ffmpeg and ffprobe
RUN mkdir -p /app/bin && \
    ln -sf /usr/bin/ffmpeg /app/bin/ffmpeg && \
    ln -sf /usr/bin/ffprobe /app/bin/ffprobe

# Install Python backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source code and starter project templates
COPY backend /app/backend
COPY projects /app/projects
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Render sets PORT dynamically (defaults to 8000)
ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
