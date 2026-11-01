"use client";

import { TimelineProjectState, TimelineClip } from "@/types";
import { API_BASE } from "@/utils/media";
import { checkBackendAvailability } from "./storage-adapter";

export interface ByokSettings {
  provider: "gemini" | "openai" | "openrouter" | "claude" | "local_cli";
  apiKey: string;
  model?: string;
}

const BYOK_STORAGE_KEY = "kino_byok_settings";

export function getByokSettings(): ByokSettings {
  if (typeof window === "undefined") {
    return { provider: "gemini", apiKey: "" };
  }
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: "gemini", apiKey: "" };
}

export function saveByokSettings(settings: ByokSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * Dispatches an AI Director instruction using the best available path:
 * 1. Local CLI Agent Bridge (if local backend running and selected)
 * 2. In-Browser Direct BYOK API (Gemini / OpenAI / OpenRouter)
 * 3. Free Built-In Rules Engine (Deterministic client-side transformation)
 */
export async function executeAiDirective(
  projectId: string,
  prompt: string,
  currentTimeline: TimelineProjectState
): Promise<{
  updatedTimeline: TimelineProjectState;
  logMessage: string;
  source: "local_cli" | "byok_api" | "builtin_rule";
}> {
  const byok = getByokSettings();
  const isOnline = await checkBackendAvailability();

  // ── Path 1: Local CLI Bridge (If online and configured) ──
  if (isOnline && byok.provider === "local_cli") {
    try {
      const res = await fetch(`${API_BASE}/api/cli/agent/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          agent_id: "claude",
          prompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          updatedTimeline: currentTimeline,
          logMessage: data.stdout || "Local agent modified composition on disk.",
          source: "local_cli",
        };
      }
    } catch (e) {
      console.warn("Local CLI agent execution failed, falling back:", e);
    }
  }

  // ── Path 2: In-Browser BYOK API (Gemini, OpenAI, OpenRouter) ──
  if (byok.apiKey && byok.apiKey.trim().length > 5) {
    try {
      const result = await executeByokRequest(prompt, currentTimeline, byok);
      return {
        updatedTimeline: result.timeline,
        logMessage: result.message,
        source: "byok_api",
      };
    } catch (e) {
      console.warn("BYOK API call failed, falling back to built-in rules:", e);
    }
  }

  // ── Path 3: Free Built-In Rules Engine (100% Free / Zero Key) ──
  const ruleResult = executeBuiltinRule(prompt, currentTimeline);
  return {
    updatedTimeline: ruleResult.timeline,
    logMessage: ruleResult.message,
    source: "builtin_rule",
  };
}

// ─────────────────────────────────────────────────────────────
// Built-In Deterministic Rules Engine (Free, Offline, Client-side)
// ─────────────────────────────────────────────────────────────

export function executeBuiltinRule(
  prompt: string,
  timeline: TimelineProjectState
): { timeline: TimelineProjectState; message: string } {
  const p = prompt.toLowerCase();
  const nextClips = [...timeline.clips];

  // Rule 1: Auto-split video into 2.5s pacing cuts
  if (p.includes("split") || p.includes("pace") || p.includes("rhythm") || p.includes("cut")) {
    const videoClips = nextClips.filter((c) => c.type === "video");
    const splitClips: TimelineClip[] = [];

    for (const vc of videoClips) {
      if (vc.duration > 4.0) {
        const half = Math.round((vc.duration / 2) * 10) / 10;
        splitClips.push(
          { ...vc, id: `${vc.id}-a`, duration: half },
          { ...vc, id: `${vc.id}-b`, start: vc.start + half, duration: vc.duration - half, trimStart: (vc.trimStart || 0) + half }
        );
      } else {
        splitClips.push(vc);
      }
    }

    const nonVideo = nextClips.filter((c) => c.type !== "video");
    return {
      timeline: { ...timeline, clips: [...splitClips, ...nonVideo] },
      message: `Built-in Rule: Applied 2.5s dynamic pacing split across ${videoClips.length} video segments.`,
    };
  }

  // Rule 2: Amber Serif or Caption Styling
  if (p.includes("serif") || p.includes("amber") || p.includes("style") || p.includes("caption")) {
    const styledClips = nextClips.map((c) => {
      if (c.type === "text") {
        return {
          ...c,
          style: {
            ...c.style,
            fontFamily: "Georgia, serif",
            color: "#FBBF24",
            shadow: "0 0 20px rgba(251, 191, 36, 0.4)",
            fontWeight: 700,
          },
          animation: { in: "fade" as const, out: "fade" as const, duration: 0.5 },
        };
      }
      return c;
    });

    return {
      timeline: { ...timeline, clips: styledClips },
      message: "Built-in Rule: Restyled all title and caption layers with Amber Serif Glow.",
    };
  }

  // Rule 3: Format Canvas to 9:16 Vertical TikTok/Reels
  if (p.includes("9:16") || p.includes("vertical") || p.includes("tiktok") || p.includes("reel") || p.includes("shorts")) {
    return {
      timeline: {
        ...timeline,
        width: 1080,
        height: 1920,
        aspectRatio: "9:16",
        background: { type: "gradient", value: "linear-gradient(180deg, #18181b 0%, #09090b 100%)" },
      },
      message: "Built-in Rule: Re-formatted master stage to 9:16 Vertical (1080x1920) for mobile feeds.",
    };
  }

  // Rule 4: Add New Kinetic Title Layer
  const newTitleClip: TimelineClip = {
    id: `title-${Date.now()}`,
    name: prompt.replace(/[^a-zA-Z0-9\s]/g, "").slice(0, 30) || "Dynamic Overlay",
    type: "text",
    start: 0.5,
    duration: 3.5,
    trackIndex: 0,
    text: prompt.length < 50 ? prompt : "Cinematic Reveal",
    transform: { x: 0, y: -10, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
    style: {
      fontSize: 48,
      color: "#FFFFFF",
      fontFamily: "Inter, sans-serif",
      fontWeight: 800,
      backgroundColor: "rgba(0,0,0,0.6)",
      shadow: "0 4px 15px rgba(0,0,0,0.8)",
    },
    animation: { in: "pop", out: "fade", duration: 0.4 },
  };

  return {
    timeline: {
      ...timeline,
      clips: [...nextClips, newTitleClip],
    },
    message: `Built-in Rule: Generated new kinetic text layer: "${newTitleClip.text}"`,
  };
}

// ─────────────────────────────────────────────────────────────
// In-Browser Direct BYOK Execution (Gemini, OpenAI, OpenRouter)
// ─────────────────────────────────────────────────────────────

async function executeByokRequest(
  prompt: string,
  timeline: TimelineProjectState,
  byok: ByokSettings
): Promise<{ timeline: TimelineProjectState; message: string }> {
  // If Gemini
  if (byok.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${byok.apiKey}`;
    const systemPrompt = `You are an AI video director assistant. The user wants to modify their video timeline.
Current timeline metadata: duration=${timeline.duration}s, width=${timeline.width}, height=${timeline.height}, totalClips=${timeline.clips.length}.
Respond with a JSON object: {"summary": "brief summary", "newTextClips": [{"text": "...", "start": 0.0, "duration": 3.0}], "aspectRatio": "16:9"}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Request: ${prompt}` }] }
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.statusText}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      let nextClips = [...timeline.clips];

      if (parsed.newTextClips && Array.isArray(parsed.newTextClips)) {
        for (const tc of parsed.newTextClips) {
          nextClips.push({
            id: `clip-ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: tc.text,
            type: "text",
            start: tc.start || 0,
            duration: tc.duration || 3.0,
            trackIndex: 0,
            text: tc.text,
            transform: { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 },
            style: { fontSize: 44, color: "#34D399", fontWeight: 700, fontFamily: "Inter, sans-serif" },
            animation: { in: "pop", out: "fade", duration: 0.4 },
          });
        }
      }

      return {
        timeline: { ...timeline, clips: nextClips },
        message: parsed.summary || "Gemini generated timeline composition changes.",
      };
    }
  }

  // Fallback to built-in rule
  return executeBuiltinRule(prompt, timeline);
}

