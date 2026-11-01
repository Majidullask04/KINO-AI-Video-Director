import { TimelineProjectState, TimelineClip, TimelineTrack } from "@/types";
import { compileTimelineToHtml, DEFAULT_TRACKS } from "./hyperframes-compiler";

export { compileTimelineToHtml, DEFAULT_TRACKS };

export function serializeTimelineToHtml(
  state: TimelineProjectState,
  title: string = "KINO Production"
): string {
  // Strict deterministic HyperFrames composition compiler.
  return compileTimelineToHtml(state, title);
}

export function parseHtmlToTimeline(
  html: string,
  projectId: string,
  fallbackDuration: number = 12.0
): TimelineProjectState {
  const rootMatch = html.match(/id=["']root["'][^>]*style=["']([^"']*)["']/i);
  let width = 1920;
  let height = 1080;
  if (rootMatch) {
    const wMatch = rootMatch[1].match(/width:\s*(\d+)px/);
    const hMatch = rootMatch[1].match(/height:\s*(\d+)px/);
    if (wMatch) width = parseInt(wMatch[1], 10);
    if (hMatch) height = parseInt(hMatch[1], 10);
  }

  const clips: TimelineClip[] = [];
  const tagRegex = /<([a-zA-Z0-9_-]+)[^>]*data-start=[^>]*>/gi;
  let match: RegExpExecArray | null;
  let maxTime = fallbackDuration;
  let order = 1;

  while ((match = tagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = match[0];

    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const clipId = idMatch ? idMatch[1] : `clip-${order}`;

    const startMatch = attrs.match(/data-start=["']([^"']+)["']/i);
    const durMatch = attrs.match(/data-duration=["']([^"']+)["']/i);
    const trackMatch = attrs.match(/data-track-index=["']([^"']+)["']/i);
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);

    const start = startMatch ? parseFloat(startMatch[1]) : 0;
    const duration = durMatch ? parseFloat(durMatch[1]) : 3.0;
    const trackIndex = trackMatch ? parseInt(trackMatch[1], 10) : tagName === "audio" ? 3 : 1;
    const sourceUrl = srcMatch ? srcMatch[1] : undefined;

    if (start + duration > maxTime) {
      maxTime = start + duration;
    }

    let clipType: TimelineClip["type"] = "video";
    if (tagName === "audio") clipType = "audio";
    else if (tagName === "img") clipType = "image";
    else if (tagName === "div") clipType = "text";

    let text = "";
    if (clipType === "text") {
      const closeTag = "</div>";
      const fullText = html.substring(match.index, html.indexOf(closeTag, match.index) + closeTag.length);
      const spanMatch = fullText.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
      text = spanMatch ? spanMatch[1].trim() : clipId;
    }

    clips.push({
      id: clipId,
      name: text || clipId,
      type: clipType,
      start,
      duration,
      trackIndex,
      sourceUrl,
      text: text || undefined,
      transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
      order: order++,
    });
  }

  const aspectRatio = width >= height ? "16:9" : "9:16";

  return {
    projectId,
    duration: Math.max(3.0, maxTime),
    fps: 30,
    width,
    height,
    aspectRatio,
    background: { type: "color", value: "#000000" },
    tracks: DEFAULT_TRACKS,
    clips,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
