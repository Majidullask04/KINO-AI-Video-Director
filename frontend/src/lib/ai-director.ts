"use client";

import { TimelineProjectState, TimelineClip } from "@/types";
import { API_BASE } from "@/utils/media";
import { checkBackendAvailability } from "./storage-adapter";

export interface ByokSettings {
  provider: "gemini" | "openai" | "anthropic" | "openrouter" | "local_cli";
  apiKey: string;
  model?: string;
  customModel?: string;
  discoveredModels?: string[];
}

export interface AiActionResult {
  updatedTimeline: TimelineProjectState;
  logMessage: string;
  actionsTaken: Array<{ type: string; description: string }>;
  source: "local_cli" | "byok_api" | "builtin_rule";
  previousTimeline?: TimelineProjectState;
}

const BYOK_STORAGE_KEY = "kino_byok_settings";

export const GEMINI_MODEL_CASCADE = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

export function getByokSettings(): ByokSettings {
  if (typeof window === "undefined") {
    return { provider: "gemini", apiKey: "" };
  }
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const cachedActiveModel = localStorage.getItem("kino_active_gemini_model");
      if (cachedActiveModel && !parsed.model) {
        parsed.model = cachedActiveModel;
      }
      return parsed;
    }
  } catch {}
  return { provider: "gemini", apiKey: "" };
}

export function saveByokSettings(settings: ByokSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(settings));
    if (settings.model) {
      localStorage.setItem("kino_active_gemini_model", settings.model);
    }
  } catch {}
}

/**
 * Discovers available Gemini models for this API key via GET /v1beta/models
 * Filters for supportedGenerationMethods includes 'generateContent' and name includes 'gemini'.
 * Strips 'models/' prefix to avoid models/models/ errors.
 */
export async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  const key = apiKey.trim();
  if (!key) return [];
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
    });

    if (!res.ok) {
      // If Vertex AQ key, generativelanguage might return 403/404
      return [];
    }

    const data = await res.json().catch(() => ({}));
    if (!Array.isArray(data.models)) return [];

    const discovered = data.models
      .filter(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent") &&
          typeof m.name === "string" &&
          m.name.toLowerCase().includes("gemini")
      )
      .map((m: any) => m.name.replace(/^models\//, ""));

    return discovered;
  } catch {
    return [];
  }
}

/**
 * Calls Gemini with an automatic retry cascade across known models
 * Supports Vertex AI Express mode for 'AQ.' keys
 */
export async function callGeminiWithCascade(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  preferredModel?: string
): Promise<{ text: string; workingModel: string }> {
  const key = apiKey.trim();
  const isVertexAqKey = key.startsWith("AQ.");

  // Build model priority cascade: preferred -> discovered/cascade
  const tryModels = [
    preferredModel,
    ...GEMINI_MODEL_CASCADE,
  ].filter((m, idx, arr): m is string => !!m && arr.indexOf(m) === idx);

  let lastError = "";

  for (const rawModel of tryModels) {
    const cleanModel = rawModel.replace(/^models\//, "");
    try {
      // 1. Try Google AI Studio (generativelanguage.googleapis.com) with x-goog-api-key header
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nUser Directives: ${prompt}` }],
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (typeof window !== "undefined") {
          localStorage.setItem("kino_active_gemini_model", cleanModel);
        }
        return { text, workingModel: cleanModel };
      }

      const errData = await res.json().catch(() => ({}));
      lastError = errData?.error?.message || `HTTP ${res.status} (${res.statusText})`;

      // If 404 (model not entitled) or 503 (overloaded), cascade to next candidate
      if (res.status === 404 || res.status === 503) {
        continue;
      }

      // If 403 or 404 on an AQ. key, try Vertex AI Express Mode endpoint
      if (isVertexAqKey && (res.status === 403 || res.status === 404)) {
        const vertexUrl = `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/${cleanModel}:generateContent`;
        const vRes = await fetch(vertexUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser Directives: ${prompt}` }],
              },
            ],
          }),
        });

        if (vRes.ok) {
          const vData = await vRes.json();
          const text = vData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (typeof window !== "undefined") {
            localStorage.setItem("kino_active_gemini_model", cleanModel);
          }
          return { text, workingModel: cleanModel };
        }
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  throw new Error(`Gemini API: ${lastError || "All model endpoints returned an error."}`);
}

/**
 * Validates an API key against the selected provider and auto-discovers models
 */
export async function testApiKey(
  settings: ByokSettings
): Promise<{ ok: boolean; message: string; workingModel?: string; discoveredModels?: string[] }> {
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
      // 1. Discover models via GET /v1beta/models
      const discovered = await discoverGeminiModels(key);

      // 2. Test actual generateContent with a tiny ping prompt
      const preferred = settings.model || (discovered.length > 0 ? discovered[0] : "gemini-3.8-flash");
      const result = await callGeminiWithCascade(
        "Ping. Reply with: OK",
        "You are an AI test probe. Reply with valid text.",
        key,
        preferred
      );

      return {
        ok: true,
        message: `✓ Connected (Using model: ${result.workingModel})`,
        workingModel: result.workingModel,
        discoveredModels: discovered,
      };
    }

    if (settings.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return { ok: true, message: "OpenAI API connected successfully!", workingModel: "gpt-4o" };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: data.error?.message || `OpenAI check returned HTTP ${res.status}` };
    }

    if (settings.provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return { ok: true, message: "OpenRouter connected successfully!", workingModel: "google/gemini-2.5-flash" };
      }
      return { ok: false, message: `OpenRouter returned HTTP ${res.status}` };
    }

    return { ok: true, message: "Key saved successfully." };
  } catch (err: any) {
    return { ok: false, message: `Connection test failed: ${err.message}` };
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
): Promise<AiActionResult> {
  const byok = getByokSettings();
  const isOnline = await checkBackendAvailability();

  // ── Path 1: In-Browser BYOK API (Gemini, OpenAI, OpenRouter) ──
  if (byok.apiKey && byok.apiKey.trim().length > 5 && byok.provider !== "local_cli") {
    try {
      const result = await executeByokRequest(prompt, currentTimeline, byok);
      return {
        updatedTimeline: result.timeline,
        logMessage: result.message,
        actionsTaken: result.actionsTaken,
        source: "byok_api",
        previousTimeline: currentTimeline,
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
          actionsTaken: [{ type: "cli_plan", description: "Executed CLI agent plan" }],
          source: "local_cli",
          previousTimeline: currentTimeline,
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
    actionsTaken: ruleResult.actionsTaken,
    source: "builtin_rule",
    previousTimeline: currentTimeline,
  };
}

// ─────────────────────────────────────────────────────────────
// Built-In Deterministic Rules Engine (Free, Offline, Client-side)
// ─────────────────────────────────────────────────────────────

export function executeBuiltinRule(
  prompt: string,
  timeline: TimelineProjectState
): { timeline: TimelineProjectState; message: string; actionsTaken: Array<{ type: string; description: string }> } {
  const p = prompt.toLowerCase();
  let nextClips = [...timeline.clips];
  const actionsTaken: Array<{ type: string; description: string }> = [];

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
            splitClips[splitClips.length - 1].duration += dur;
            break;
          }
          splitClips.push({
            ...vc,
            id: `${vc.id}-seg-${count}-${Date.now()}`,
            name: `${vc.name} (Beat ${count + 1})`,
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

    actionsTaken.push({ type: "split_clip", description: `Split video into ${splitClips.length} pacing cuts of 2.5s` });

    return {
      timeline: { ...timeline, clips: [...splitClips, ...otherClips] },
      message: `Built-in Rule: Sliced video into ${splitClips.length} dynamic 2.5s pacing cuts.`,
      actionsTaken,
    };
  }

  // Rule 2: Amber Serif or Caption Styling
  if (p.includes("amber") || p.includes("caption") || p.includes("serif") || p.includes("subtitles")) {
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
      actionsTaken.push({ type: "update_text_style", description: "Restyled captions to Amber Serif Glow" });
    } else {
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
      actionsTaken.push({ type: "add_text_overlay", description: "Added Amber Serif Reveal captions" });
    }

    return {
      timeline: { ...timeline, clips: nextClips },
      message: "Built-in Rule: Applied Amber Serif Glow captions across the timeline.",
      actionsTaken,
    };
  }

  // Rule 3: Format Canvas to 9:16 Vertical
  if (p.includes("9:16") || p.includes("vertical") || p.includes("tiktok") || p.includes("reel") || p.includes("shorts")) {
    actionsTaken.push({ type: "set_aspect_ratio", description: "Canvas set to 9:16 Vertical (1080×1920)" });
    return {
      timeline: {
        ...timeline,
        width: 1080,
        height: 1920,
        aspectRatio: "9:16",
        background: { type: "gradient", value: "linear-gradient(180deg, #181817 0%, #0A0A09 100%)" },
      },
      message: "Built-in Rule: Formatted stage canvas to 9:16 Vertical (1080×1920).",
      actionsTaken,
    };
  }

  // Rule 4: Format Canvas to 16:9 Landscape
  if (p.includes("16:9") || p.includes("landscape") || p.includes("youtube") || p.includes("horizontal")) {
    actionsTaken.push({ type: "set_aspect_ratio", description: "Canvas set to 16:9 Landscape (1920×1080)" });
    return {
      timeline: {
        ...timeline,
        width: 1920,
        height: 1080,
        aspectRatio: "16:9",
        background: { type: "color", value: "#0F0F0E" },
      },
      message: "Built-in Rule: Formatted stage canvas to 16:9 Landscape (1920×1080).",
      actionsTaken,
    };
  }

  // Rule 5: Format Canvas to 1:1 Square
  if (p.includes("1:1") || p.includes("square") || p.includes("feed")) {
    actionsTaken.push({ type: "set_aspect_ratio", description: "Canvas set to 1:1 Square (1080×1080)" });
    return {
      timeline: {
        ...timeline,
        width: 1080,
        height: 1080,
        aspectRatio: "1:1",
        background: { type: "color", value: "#000000" },
      },
      message: "Built-in Rule: Formatted stage canvas to 1:1 Square (1080×1080).",
      actionsTaken,
    };
  }

  // Rule 6: Color filter / Noir / Vintage / Glow
  if (p.includes("bw") || p.includes("noir") || p.includes("black and white") || p.includes("vintage") || p.includes("glow") || p.includes("contrast")) {
    const filter = p.includes("bw") || p.includes("noir") ? "bw" : p.includes("vintage") ? "vintage" : p.includes("glow") ? "glow" : "contrast";
    nextClips = nextClips.map((c) => (c.type === "video" ? { ...c, filter } : c));
    actionsTaken.push({ type: "apply_video_filter", description: `Applied '${filter}' filter to video clips` });
    return {
      timeline: { ...timeline, clips: nextClips },
      message: `Built-in Rule: Applied '${filter}' color filter across video clips.`,
      actionsTaken,
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

  actionsTaken.push({ type: "add_text_overlay", description: `Inserted headline: "${titleText}"` });

  return {
    timeline: {
      ...timeline,
      clips: [...nextClips, newTitleClip],
    },
    message: `Built-in Rule: Inserted new headline layer: "${titleText}".`,
    actionsTaken,
  };
}

// ─────────────────────────────────────────────────────────────
// In-Browser Direct BYOK Execution (Gemini, OpenAI, OpenRouter)
// ─────────────────────────────────────────────────────────────

async function executeByokRequest(
  prompt: string,
  timeline: TimelineProjectState,
  byok: ByokSettings
): Promise<{ timeline: TimelineProjectState; message: string; actionsTaken: Array<{ type: string; description: string }> }> {
  const systemPrompt = `You are an AI video director assistant. The user wants to modify their video timeline.
Current timeline metadata: duration=${timeline.duration}s, width=${timeline.width}, height=${timeline.height}, aspectRatio=${timeline.aspectRatio}, totalClips=${timeline.clips.length}.
Existing clips summary:
${timeline.clips.map((c, i) => `[Clip ${i + 1}] id=${c.id}, name="${c.name}", type=${c.type}, start=${c.start}s, dur=${c.duration}s, track=${c.trackIndex}`).join("\n")}

Respond ONLY with a JSON object conforming to this schema:
{
  "summary": "Clear, concise sentence describing the exact changes made",
  "aspectRatio": "16:9" | "9:16" | "1:1",
  "actions": [
    {
      "action": "add_text_overlay",
      "text": "Caption text",
      "start": 0.0,
      "duration": 3.0,
      "style": { "fontSize": 32, "color": "#FFFFFF", "fontFamily": "Inter, sans-serif", "shadow": "0 2px 10px rgba(0,0,0,0.5)" },
      "animation": "pop" | "word-reveal" | "slide-up" | "fade"
    },
    {
      "action": "split_clip",
      "interval": 2.5
    },
    {
      "action": "apply_video_filter",
      "filter": "none" | "glow" | "bw" | "vintage" | "contrast"
    },
    {
      "action": "set_playback_speed",
      "speed": 1.0
    }
  ]
}`;

  let rawResponse = "";

  if (byok.provider === "gemini") {
    const result = await callGeminiWithCascade(prompt, systemPrompt, byok.apiKey, byok.model);
    rawResponse = result.text;
  } else if (byok.provider === "openai") {
    const model = byok.model || "gpt-4o";
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
  const actionsTaken: Array<{ type: string; description: string }> = [];

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
    actionsTaken.push({ type: "set_aspect_ratio", description: `Canvas set to ${parsed.aspectRatio}` });
  }

  if (Array.isArray(parsed.actions)) {
    for (const act of parsed.actions) {
      if (act.action === "add_text_overlay" || act.action === "add_text") {
        nextClips.push({
          id: `ai-text-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: act.text || "AI Overlay",
          type: "text",
          start: act.start ?? 0,
          duration: act.duration ?? 3.5,
          trackIndex: 0,
          text: act.text,
          transform: { x: 0, y: 30, width: 85, height: 18, scale: 1, rotation: 0, opacity: 1 },
          style: {
            fontSize: act.style?.fontSize || 32,
            color: act.style?.color || "#FFFFFF",
            fontFamily: act.style?.fontFamily || "Inter, sans-serif",
            fontWeight: 700,
            textAlign: "center",
            shadow: act.style?.shadow || "0 2px 12px rgba(0,0,0,0.7)",
          },
          animation: { in: act.animation || "pop", out: "fade", duration: 0.4 },
        });
        actionsTaken.push({ type: "add_text_overlay", description: `Added text overlay "${act.text}"` });
      } else if (act.action === "split_clip" || act.action === "split_clips") {
        const interval = act.interval || 2.5;
        const videoClips = nextClips.filter((c) => c.type === "video");
        const otherClips = nextClips.filter((c) => c.type !== "video");
        const splitClips: TimelineClip[] = [];

        for (const vc of videoClips) {
          if (vc.duration > interval + 0.5) {
            let offset = 0;
            let count = 0;
            while (offset < vc.duration) {
              const dur = Math.min(interval, Math.round((vc.duration - offset) * 10) / 10);
              if (dur < 0.5 && splitClips.length > 0) {
                splitClips[splitClips.length - 1].duration += dur;
                break;
              }
              splitClips.push({
                ...vc,
                id: `${vc.id}-seg-${count}-${Date.now()}`,
                name: `${vc.name} (Beat ${count + 1})`,
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
        nextClips = [...splitClips, ...otherClips];
        actionsTaken.push({ type: "split_clip", description: `Split video into ${splitClips.length} beats (${interval}s)` });
      } else if (act.action === "apply_video_filter" || act.action === "set_filter") {
        nextClips = nextClips.map((c) => (c.type === "video" ? { ...c, filter: act.filter } : c));
        actionsTaken.push({ type: "apply_video_filter", description: `Applied '${act.filter}' filter` });
      } else if (act.action === "set_playback_speed") {
        const speed = act.speed || 1.0;
        nextClips = nextClips.map((c) => (c.type === "video" ? { ...c, audio: { ...(c.audio || { volume: 100, muted: false, fadeIn: 0, fadeOut: 0, speed: 1.0 }), speed } } : c));
        actionsTaken.push({ type: "set_playback_speed", description: `Set video playback speed to ${speed}x` });
      }
    }
  }

  nextTimeline.clips = nextClips;
  return {
    timeline: nextTimeline,
    message: parsed.summary || "AI Director updated the composition successfully.",
    actionsTaken,
  };
}
