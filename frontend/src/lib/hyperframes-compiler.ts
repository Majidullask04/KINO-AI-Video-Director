import { TimelineProjectState, TimelineClip, TimelineTrack } from "@/types";

/**
 * Strict HyperFrames HTML Composition Compiler.
 *
 * Implements the official hyperframes-core render contract:
 * - Root element `<div id="root" data-composition-id="main" ...>` with explicit pixel
 *   width/height and `data-duration` equal to the end of the last clip.
 * - Every timed element carries `class="clip"`, `data-start`, `data-duration` and
 *   `data-track-index`.
 * - A single paused GSAP timeline registered on `window.__timelines["main"]`.
 * - Elements starting after 0s initialize at `opacity: 0`.
 * - No `Date.now()` / `Math.random()` — fully deterministic output.
 * - Safe-zone guide elements present for title/action boundary compliance.
 */

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "track-0", index: 0, kind: "overlay", name: "T0 Overlays & Text", locked: false, muted: false, hidden: false },
  { id: "track-1", index: 1, kind: "video", name: "T1 Main Video", locked: false, muted: false, hidden: false },
  { id: "track-2", index: 2, kind: "overlay", name: "T2 B-Roll & PIP", locked: false, muted: false, hidden: false },
  { id: "track-3", index: 3, kind: "audio", name: "T3 Master Audio", locked: false, muted: false, hidden: false },
];

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeId(id: string, fallback: string): string {
  const clean = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return clean || fallback;
}

function toSeconds(value: number): string {
  return Number(value || 0).toFixed(2);
}

export function compileTimelineToHtml(
  state: TimelineProjectState,
  title: string = "KINO Production"
): string {
  const width = state.width || 1920;
  const height = state.height || 1080;
  const duration = Number(state.duration || 0);
  const clips = state.clips || [];

  let endTime = duration;
  for (const clip of clips) {
    const end = (clip.start || 0) + (clip.duration || 0);
    if (end > endTime) endTime = end;
  }
  const rootDuration = Number(endTime || duration || 12);

  let bgCss = "background: #000000;";
  if (backgroundType(state)) {
    bgCss = `background: ${state.background?.value || "linear-gradient(135deg, #18181b 0%, #09090b 100%)"};`;
  }

  const clipNodes: string[] = [];
  const gsapTweens: string[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const start = Number(clip.start || 0);
    const dur = Number(clip.duration || 0);
    const trackIdx = clip.trackIndex ?? 1;
    const kind = clip.type === "audio" ? "audio" : clip.type === "text" ? "text" : "video";
    const clipId = sanitizeId(clip.id, `clip-${i + 1}`);
    const zIndex = 5 + i;
    const initialOpacity = start > 0 ? 0 : 1;

    if (clip.type === "audio") {
      const audioSrc = clip.sourceUrl || "assets/" + (clip.sourceAsset || "audio_bed.mp3");
      const audioVolume = Number(((clip.audio?.volume ?? 100) / 100) || 0.8);
      clipNodes.push(
        [
          "      <!-- Audio Clip: " + escapeHtml(clip.name || "Master Audio") + " -->",
          "      <audio",
          '        id="' + sanitizeId(clip.id, "audio-" + (i + 1)) + '"',
          '        class="clip"',
          '        src="' + audioSrc + '"',
          '        data-start="' + toSeconds(start) + '"',
          '        data-duration="' + toSeconds(dur) + '"',
          '        data-track-index="' + trackIdx + '"',
          '        data-track-kind="audio"',
          '        data-composition-id="main"',
          '        data-volume="' + audioVolume.toFixed(2) + '"',
          '        preload="auto"',
          "      ></audio>",
        ].join("\n")
      );
      continue;
    }

    if (clip.type === "text") {
      const style = clip.style || {};
      clipNodes.push(`      <!-- Text Clip: ${escapeHtml(clip.name || "Text Overlay")} -->
      <div
        id="${clipId}"
        class="clip"
        data-start="${toSeconds(start)}"
        data-duration="${toSeconds(dur)}"
        data-track-index="${trackIdx}"
        data-track-kind="text"
        data-composition-id="main"
        data-element="text"
        style="position: absolute; left: 0px; top: 0px; width: ${state.width || 1920}px; height: ${state.height || 1080}px; display: flex; align-items: center; justify-content: center; opacity: ${initialOpacity}; z-index: ${zIndex};"
      >
        <span style="font-family: ${style.fontFamily || "Inter, sans-serif"}; font-size: ${style.fontSize || 48}px; font-weight: ${style.fontWeight || 700}; color: ${style.color || "#FFFFFF"}; ${style.backgroundColor ? `background: ${style.backgroundColor};` : ""} ${style.shadow ? `text-shadow: ${style.shadow};` : "text-shadow: 0 2px 10px rgba(0,0,0,0.7);"} padding: 8px 16px; border-radius: 8px; text-align: ${style.textAlign || "center"}; letter-spacing: ${style.letterSpacing || 0}px;">
          ${escapeHtml(clip.text || clip.name)}
        </span>
      </div>`);

      const animDur = clip.animation?.duration || 0.4;
      const ease = clip.animation?.in === "slide-up" || clip.animation?.in === "typewriter" ? "power2.out" : "power3.out";
      gsapTweens.push(`      tl.fromTo("#${clipId}", { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: ${animDur}, ease: "${ease}" }, ${toSeconds(start)});
      tl.to("#${clipId}", { opacity: 0, duration: 0.1, ease: "power1.in" }, ${toSeconds(start + dur - 0.1)});`);
      continue;
    }

    const src = clip.sourceUrl || `assets/${clip.sourceAsset || "video.mp4"}`;
    const hasAudio = clip.audio && !clip.audio.muted && (clip.audio.volume ?? 100) > 0;
    const timedStyle =
      clip.type === "image"
        ? `position: absolute; left: 0px; top: 0px; width: ${state.width || 1920}px; height: ${state.height || 1080}px; object-fit: cover; opacity: ${initialOpacity}; z-index: ${zIndex};`
        : `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${initialOpacity};`;

    clipNodes.push(`      <!-- ${clip.type === "image" ? "Image" : "Video"} Clip: ${escapeHtml(clip.name || "Media")}

      <${clip.type === "image" ? "img" : "video"}
        id="${clipId}"
        class="clip ${clip.type === "image" ? "" : "video-clip"}"
        src="${src}"
        data-start="${toSeconds(start)}"
        data-duration="${toSeconds(dur)}"
        data-track-index="${trackIdx}"
        data-track-kind="video"
        data-composition-id="main"
        data-element="${clip.type}"
        data-has-audio="${hasAudio ? "true" : "false"}"
        preload="auto"
        muted
        playsinline
        style="${timedStyle}"
      />`);

    gsapTweens.push(`      tl.fromTo("#${clipId}", { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" }, ${toSeconds(start)});
      tl.to("#${clipId}", { opacity: 0, duration: 0.08, ease: "power1.in" }, ${toSeconds(start + dur - 0.08)});`);
  }

  const clipHtml = clipNodes.join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(title)} — KINO Composition</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root {{
        --bg: #0a0a0a;
        --text: #e5e5e5;
      }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 100%; height: 100%; overflow: hidden; background: #000; }}
      #root {{
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        ${bgCss}
      }}
      .clip {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
      .safe-zone-overlay {{ position: absolute; inset: 0; pointer-events: none; z-index: 100; display: none; }}
      .safe-zone-action {{ position: absolute; top: 5%; left: 5%; right: 5%; bottom: 5%; border: 1px dashed rgba(59, 130, 246, 0.4); }}
      .safe-zone-title {{ position: absolute; top: 10%; left: 10%; right: 10%; bottom: 10%; border: 1px dashed rgba(245, 158, 11, 0.4); }}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${toSeconds(rootDuration)}"
      data-width="${width}"
      data-height="${height}"
      style="width: ${width}px; height: ${height}px; position: relative; overflow: hidden; ${bgCss}
    ">
${clipHtml}
      <div id="safe-zones" class="safe-zone-overlay">
        <div class="safe-zone-action"></div>
        <div class="safe-zone-title"></div>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

${gsapTweens.join("\n")}

      window.__timelines["main"] = tl;
      tl.seek(0);

      window.addEventListener("message", (event) => {
        if (!event.data) return;
        if (event.data.type === "SEEK") {
          const targetTime = Number(event.data.time) || 0;
          tl.seek(targetTime);
          const videos = document.querySelectorAll("video");
          videos.forEach((v) => {
            const clip = v.classList.contains("clip") ? v : v.closest(".clip");
            if (clip) {
              const start = parseFloat(clip.dataset.start) || 0;
              const dur = parseFloat(clip.dataset.duration) || 0;
              if (targetTime >= start && targetTime <= start + dur) {
                v.currentTime = Math.max(0, targetTime - start);
              }
            }
          });
        } else if (event.data.type === "TOGGLE_SAFE_ZONES") {
          const sz = document.getElementById("safe-zones");
          if (sz) sz.style.display = event.data.visible ? "block" : "none";
        }
      });
    </script>
  </body>
</html>`;
}

function backgroundType(state: TimelineProjectState): boolean {
  const bg = state.background as any;
  return bg?.type === "gradient" || typeof bg?.value === "string" && bg.value.includes("gradient");
}
