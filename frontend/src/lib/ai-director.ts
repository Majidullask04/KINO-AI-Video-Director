"use client";

import { TimelineProjectState, TimelineClip } from "@/types";
import { API_BASE } from "@/utils/media";
import { checkBackendAvailability } from "./storage-adapter";

export interface ByokSettings {
  provider: "gemini" | "openai" | "anthropic" | "openrouter" | "local_cli";
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
 * Validates an API key against the selected provider
 */
export async function testApiKey(settings: ByokSettings): Promise<{ ok: boolean; message: string }> {
  if (settings.provider === "local_cli") {
    const online = await checkBackendAvailability(true);
    return online
      ? { ok: true, message: "Connected to local FastAPI + CLI agent bridge!" }
      : { ok: false, message: "Local FastAPI backend (http://127.0.0.1:8001) is not running." };
  }

  const key = settings.apiKey.trim();
  if (!key) {
    return { ok: false, message: "Please enter an API key." };
  }

  try {
    if (settings.provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        method: "GET",
      });
      if (res.ok) {
        return { ok: true, message: "Google Gemini API connected successfully!" };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: data.error?.message || `Gemini check returned HTTP ${res.status}` };
    }

    if (settings.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return { ok: true, message: "OpenAI API connected successfully!" };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: data.error?.message || `OpenAI check returned HTTP ${res.status}` };
    }

    if (settings.provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return { ok: true, message: "OpenRouter connected successfully!" };
      }
      return { ok: false, message: `OpenRouter returned HTTP ${res.status}` };
    }

    // Default basic check
    return { ok: true, message: "Key format saved." };
  } catch (err: any) {
    return { ok: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Dispatches an AI Director instruction using the best available path:
 * 1. In-Browser Direct BYOK API (Gemini / OpenAI / OpenRouter)
 * 2. Local CLI Agent Bridge (if local backend running and selected)
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

  // ── Path 1: In-Browser BYOK API (Gemini, OpenAI, OpenRouter) ──
  if (byok.apiKey && byok.apiKey.trim().length > 5 && byok.provider !== "local_cli") {
    try {
      const result = await executeByokRequest(prompt, currentTimeline, byok);
      return {
        updatedTimeline: result.timeline,
        logMessage: result.message,
        source: "byok_api",
      };
    } catch (e: any) {
      console.warn("BYOK API call failed, falling back to built-in rules:", e);
    }
  }

  // ── Path 2: Local CLI Bridge (If online and configured) ──
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
  let nextClips = [...timeline.clips];

  // Rule 1: Auto-split video into 2.5s pacing cuts
  if (p.includes("split") || p.includes("pace") || p.includes("rhythm") || p.includes("cut")) {
    const videoClips = nextClips.filter((c) => c.type === "video");
    const otherClips = nextClips.filter((c) => c.type !== "video");
    const splitClips: TimelineClip[] = [];

    for (const vc of videoClips) {
      if (vc.duration > 3.5) {
        const segDuration = 2.5;
        let offset = 0;
        let count = 0;
        while (offset < vc.duration) {
          const dur = Math.min(segDuration, Math.round((vc.duration - offset) * 10) / 10);
          if (dur < 0.5 && splitClips.length > 0) {
            // merge remainder with last clip
            splitClips[splitClips.length - 1].duration += dur;
            break;
          }
          splitClips.push({
            ...vc,
            id: `${vc.id}-seg-${count}-${Date.now()}`,
            name: `${vc.name} (Cut ${count + 1})`,
            start: vc.start + offset,
            duration: dur,
            trimStart: (vc.trimStart || 0) + offset,
          });
          offset += dur;
          count++;
        }
      } else {
        splitClips.push(vc);
      }
    }

    return {
      timeline: { ...timeline, clips: [...splitClips, ...otherClips] },
      message: `Built-in Rule: Sliced video into ${splitClips.length} dynamic 2.5s pacing cuts.`,
    };
  }

  // Rule 2: Amber Serif or Caption Styling
  if (p.includes("amber") || p.includes("caption") || p.includes("serif") || p.includes("subtitles")) {
    // If text clips exist on T0, restyle them; if not, create new Amber captions synced across timeline
    const textClips = nextClips.filter((c) => c.type === "text" && c.trackIndex === 0);
    if (textClips.length > 0) {
      nextClips = nextClips.map((c) => {
        if (c.type === "text") {
          return {
            ...c,
            style: {
              ...c.style,
              fontFamily: "'Playfair Display', serif",
              color: "#FBBF24",
              shadow: "0 0 24px rgba(251, 191, 36, 0.5)",
              fontWeight: 700,
            },
            animation: { in: "word-reveal" as const, out: "fade" as const, duration: 0.5 },
          };
        }
        return c;
      });
    } else {
      // Create 2 Amber Caption clips along the timeline
      const duration = timeline.duration || 12.0;
      nextClips.push(
        {
          id: `amber-cap-1-${Date.now()}`,
          name: "Amber Caption 1",
          type: "text",
          start: 0.5,
          duration: Math.min(3.5, duration / 2),
          trackIndex: 0,
          text: "Welcome to KINO Video Director",
          transform: { x: 0, y: 35, width: 80, height: 14, scale: 1, rotation: 0, opacity: 1 },
          style: {
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            color: "#FBBF24",
            fontWeight: 700,
            shadow: "0 0 20px rgba(251, 191, 36, 0.5)",
            textAlign: "center",
          },
          animation: { in: "word-reveal", out: "fade", duration: 0.5 },
        },
        {
          id: `amber-cap-2-${Date.now()}`,
          name: "Amber Caption 2",
          type: "text",
          start: Math.min(4.5, duration * 0.5),
          duration: Math.min(4.0, duration * 0.45),
          trackIndex: 0,
          text: "Build Faster with Pure OpenCut + AI Control",
          transform: { x: 0, y: 35, width: 85, height: 14, scale: 1, rotation: 0, opacity: 1 },
          style: {
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            color: "#FBBF24",
            fontWeight: 700,
            shadow: "0 0 20px rgba(251, 191, 36, 0.5)",
            textAlign: "center",
          },
          animation: { in: "word-reveal", out: "fade", duration: 0.5 },
        }
      );
    }

    return {
      timeline: { ...timeline, clips: nextClips },
      message: "Built-in Rule: Applied Amber Serif Glow captions across the timeline.",
    };
  }

  // Rule 3: Format Canvas to 9:16 Vertical (TikTok/Reels)
  if (p.includes("9:16") || p.includes("vertical") || p.includes("tiktok") || p.includes("reel") || p.includes("shorts")) {
    return {
      timeline: {
        ...timeline,
        width: 1080,
        height: 1920,
        aspectRatio: "9:16",
        background: { type: "gradient", value: "linear-gradient(180deg, #181817 0%, #0A0A09 100%)" },
      },
      message: "Built-in Rule: Formatted stage canvas to 9:16 Vertical (1080×1920).",
    };
  }

  // Rule 4: Format Canvas to 16:9 Landscape (YouTube)
  if (p.includes("16:9") || p.includes("landscape") || p.includes("youtube") || p.includes("horizontal")) {
    return {
      timeline: {
        ...timeline,
        width: 1920,
        height: 1080,
        aspectRatio: "16:9",
        background: { type: "color", value: "#0F0F0E" },
      },
      message: "Built-in Rule: Formatted stage canvas to 16:9 Landscape (1920×1080).",
    };
  }

  // Rule 5: Format Canvas to 1:1 Square (Instagram)
  if (p.includes("1:1") || p.includes("square") || p.includes("feed")) {
    return {
      timeline: {
        ...timeline,
        width: 1080,
        height: 1080,
        aspectRatio: "1:1",
        background: { type: "color", value: "#000000" },
      },
      message: "Built-in Rule: Formatted stage canvas to 1:1 Square (1080×1080).",
    };
  }

  // Rule 6: Color filter / Noir / Vintage / Glow
  if (p.includes("bw") || p.includes("noir") || p.includes("black and white") || p.includes("vintage") || p.includes("glow") || p.includes("contrast")) {
    const filter = p.includes("bw") || p.includes("noir") ? "bw" : p.includes("vintage") ? "vintage" : p.includes("glow") ? "glow" : "contrast";
    nextClips = nextClips.map((c) => (c.type === "video" ? { ...c, filter } : c));
    return {
      timeline: { ...timeline, clips: nextClips },
      message: `Built-in Rule: Applied '${filter}' color filter across video clips.`,
    };
  }

  // Rule 7: Generic Title / Headline addition
  const titleText = prompt.replace(/^(add|create|insert)\s+(title|heading|text|headline)[:\s]*/i, "").trim() || "KINO VIDEO DIRECT";
  const newTitleClip: TimelineClip = {
    id: `title-${Date.now()}`,
    name: "AI Headline",
    type: "text",
    start: 0.0,
    duration: 3.5,
    trackIndex: 0,
    text: titleText,
    transform: { x: 0, y: 0, width: 85, height: 20, scale: 1, rotation: 0, opacity: 1 },
    style: {
      fontSize: 48,
      color: "#FFFFFF",
      fontFamily: "Inter, sans-serif",
      fontWeight: 800,
      textAlign: "center",
      shadow: "0 4px 20px rgba(0,0,0,0.8)",
    },
    animation: { in: "pop", out: "fade", duration: 0.4 },
  };

  return {
    timeline: {
      ...timeline,
      clips: [...nextClips, newTitleClip],
    },
    message: `Built-in Rule: Inserted new headline layer: "${newTitleClip.text}".`,
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
  const systemPrompt = `You are an AI video director assistant. The user wants to modify their video timeline.
Current timeline metadata: duration=${timeline.duration}s, width=${timeline.width}, height=${timeline.height}, aspectRatio=${timeline.aspectRatio}, totalClips=${timeline.clips.length}.
Respond ONLY with a JSON object:
{
  "summary": "Brief description of changes made",
  "aspectRatio": "16:9" | "9:16" | "1:1",
  "actions": [
    {
      "action": "add_text",
      "text": "Caption text",
      "start": 0.0,
      "duration": 3.0,
      "style": { "fontSize": 32, "color": "#FFFFFF", "fontFamily": "Inter, sans-serif" },
      "animation": "pop" | "word-reveal" | "slide-up" | "fade"
    },
    {
      "action": "split_clips",
      "interval": 2.5
    },
    {
      "action": "set_filter",
      "filter": "none" | "glow" | "bw" | "vintage" | "contrast"
    }
  ]
}`;

  let rawResponse = "";

  if (byok.provider === "gemini") {
    const model = byok.model || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${byok.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Directives: ${prompt}` }] }
        ],
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error: HTTP ${res.status}`);
    const data = await res.json();
    rawResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else if (byok.provider === "openai") {
    const model = byok.model || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${byok.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: HTTP ${res.status}`);
    const data = await res.json();
    rawResponse = data?.choices?.[0]?.message?.content || "";
  } else {
    // OpenRouter fallback
    const model = byok.model || "google/gemini-2.5-flash";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${byok.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter API error: HTTP ${res.status}`);
    const data = await res.json();
    rawResponse = data?.choices?.[0]?.message?.content || "";
  }

  // Parse structured actions
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return executeBuiltinRule(prompt, timeline);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  let nextTimeline = { ...timeline };
  let nextClips = [...nextTimeline.clips];

  if (parsed.aspectRatio) {
    nextTimeline.aspectRatio = parsed.aspectRatio;
    if (parsed.aspectRatio === "9:16") {
      nextTimeline.width = 1080;
      nextTimeline.height = 1920;
    } else if (parsed.aspectRatio === "16:9") {
      nextTimeline.width = 1920;
      nextTimeline.height = 1080;
    } else if (parsed.aspectRatio === "1:1") {
      nextTimeline.width = 1080;
      nextTimeline.height = 1080;
    }
  }

  if (Array.isArray(parsed.actions)) {
    for (const act of parsed.actions) {
      if (act.action === "add_text") {
        nextClips.push({
          id: `ai-text-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: act.text || "AI Overlay",
          type: "text",
          start: act.start ?? 0,
          duration: act.duration ?? 3.5,
          trackIndex: 0,
          text: act.text,
          transform: { x: 0, y: 0, width: 85, height: 20, scale: 1, rotation: 0, opacity: 1 },
          style: {
            fontSize: act.style?.fontSize || 36,
            color: act.style?.color || "#FFFFFF",
            fontFamily: act.style?.fontFamily || "Inter, sans-serif",
            fontWeight: 700,
            textAlign: "center",
          },
          animation: { in: act.animation || "pop", out: "fade", duration: 0.4 },
        });
      } else if (act.action === "set_filter") {
        nextClips = nextClips.map((c) => (c.type === "video" ? { ...c, filter: act.filter } : c));
      }
    }
  }

  nextTimeline.clips = nextClips;
  return {
    timeline: nextTimeline,
    message: parsed.summary || "AI Director updated the composition successfully.",
  };
}
