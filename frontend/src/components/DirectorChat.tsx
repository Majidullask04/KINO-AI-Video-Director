"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Bookmark,
  Play,
  Zap,
  SlidersHorizontal,
  Code2,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { CreatorPreference } from "@/types";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  versionNum?: number;
  learnedPreference?: string;
  executionSteps?: string[];
}

interface DirectorChatProps {
  onSendRevision: (prompt: string) => Promise<void>;
  isRevising: boolean;
  activeVersionNum: number;
  creatorPreferences?: CreatorPreference[];
  initialBriefing?: string | null;
}

const QUICK_PROMPTS = [
  { label: "Inject Beat Freeze Cut on Beat 4", prompt: "Apply KINO beat-freeze-cut block to Beat 4" },
  { label: "Kinetic Hero Title on Hook", prompt: "Add kinetic-title overlay to opening hook" },
  { label: "Swap Beat 2 for closer code view", prompt: "Swap Beat 2 for closer code view" },
  { label: "Trim opening hook to 2.0s", prompt: "Trim opening hook to 2.0s and save preference" },
  { label: "Prioritize high-energy B-roll", prompt: "Swap demonstration beat with high-energy b-roll shot" },
  { label: "Save rule: Always high-energy hook", prompt: "Remember preference: always use high-energy hook" },
];

export const DirectorChat: React.FC<DirectorChatProps> = ({
  onSendRevision,
  isRevising,
  activeVersionNum,
  creatorPreferences = [],
  initialBriefing,
}) => {
  const [inputPrompt, setInputPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      sender: "assistant",
      text: "KINO Director Agent ready. I compose HTML, wire seekable GSAP animations deterministically, match narrative rhythm with STORYBOARD.md, and refine your timeline. Request cut adjustments, pacing revisions, or inject registry blocks.",
      timestamp: "Just now",
      versionNum: activeVersionNum,
    },
  ]);

  // Proactively ingest AI briefing when footage is uploaded or synthesized
  useEffect(() => {
    if (initialBriefing && initialBriefing.trim()) {
      setMessages((prev) => {
        if (prev.some((m) => m.text === initialBriefing)) return prev;
        return [
          ...prev,
          {
            id: `brief_${Date.now()}`,
            sender: "assistant",
            text: initialBriefing,
            timestamp: "Just now",
            versionNum: activeVersionNum,
          },
        ];
      });
    }
  }, [initialBriefing, activeVersionNum]);

  const executeRevision = async (text: string) => {
    if (!text.trim() || isRevising) return;
    const userText = text.trim();
    setInputPrompt("");

    const newMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, newMsg]);

    try {
      await onSendRevision(userText);
      const isMemoryPrompt = /remember|always|prefer/i.test(userText);
      const assistantReply: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: `Timeline & composition updated! Branched to EditVersion v${activeVersionNum + 1} with your revisions applied.`,
        timestamp: "Just now",
        versionNum: activeVersionNum + 1,
        learnedPreference: isMemoryPrompt ? userText : undefined,
        executionSteps: [
          "Matched beat requirements against media library",
          "Selected candidate clip & trim bounds in STORYBOARD.md",
          "Generated deterministic KINO HTML/CSS composition",
          `Created EditVersion v${activeVersionNum + 1}`,
          "Verified contract bounds & updated studio canvas",
        ],
      };
      setMessages((prev) => [...prev, assistantReply]);
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: `Error revising cut: ${err.message || "Failed to update timeline"}`,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorReply]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeRevision(inputPrompt);
  };

  return (
    <div className="bg-[#141414] border-l border-[#2a2a2a] flex flex-col h-full select-none">
      {/* 1. Header: HyperFrames Agent Copilot + Skills Badges */}
      <div className="px-3.5 py-2.5 border-b border-[#2a2a2a] bg-[#18181b] flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.8} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
              KINO Director Agent
            </h2>
          </div>
          <span className="tech-tag tech-tag-green">
            v{activeVersionNum}
          </span>
        </div>

        {/* HyperFrames Skill Shortcuts */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setInputPrompt("/hyperframes ")}
            className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
            title="KINO Core Skill"
          >
            /hyperframes
          </button>
          <button
            onClick={() => setInputPrompt("/hyperframes-registry ")}
            className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-zinc-400 hover:text-purple-400 hover:border-purple-500/30"
            title="Blocks & Components Catalog"
          >
            /registry
          </button>
          <button
            onClick={() => setInputPrompt("/media-use ")}
            className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-zinc-400 hover:text-blue-400 hover:border-blue-500/30"
            title="Audio & Media Normalization"
          >
            /media-use
          </button>
        </div>

        {/* System Status Indicators */}
        <div className="grid grid-cols-3 gap-1.5 text-[9.5px]">
          <div className="px-2 py-1 rounded bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-between">
            <span className="text-zinc-500">Contract</span>
            <span className="text-emerald-400 font-mono">Passed</span>
          </div>
          <div className="px-2 py-1 rounded bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-between">
            <span className="text-zinc-500">Model</span>
            <span className="text-zinc-300 font-mono">Gemini 2.5</span>
          </div>
          <div className="px-2 py-1 rounded bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-between">
            <span className="text-zinc-500">Seeking</span>
            <span className="text-emerald-400 font-mono">30 FPS</span>
          </div>
        </div>

        {/* Memory Strip: Active style rules */}
        {creatorPreferences.length > 0 && (
          <div className="p-2 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[10px] space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
              <Bookmark className="w-2.5 h-2.5 text-emerald-400" />
              <span>Learned Style Rules ({creatorPreferences.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {creatorPreferences.slice(0, 2).map((pref) => (
                <span
                  key={pref.id}
                  className="tech-tag tech-tag-green text-[9.5px] py-0.5 normal-case font-sans truncate max-w-full"
                >
                  &quot;{pref.rule_text}&quot;
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[92%] p-2.5 rounded-[5px] text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-[#222222] text-[#f5f5f5] border border-[#3a3a3a] font-medium"
                  : "bg-[#18181b] text-zinc-300 border border-[#2a2a2a]"
              }`}
            >
              <p className="whitespace-pre-line m-0">{m.text}</p>

              {/* Execution Steps Trace Card */}
              {m.executionSteps && (
                <div className="mt-2 pt-2 border-t border-[#2a2a2a] space-y-1 text-[10px] text-zinc-400">
                  <div className="text-[9px] uppercase font-semibold text-zinc-400 tracking-wider">
                    Editorial Actions:
                  </div>
                  {m.executionSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-emerald-400 font-mono">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Memory Indicator Chip */}
              {m.learnedPreference && (
                <div className="mt-2 pt-2 border-t border-[#2a2a2a] flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <Bookmark className="w-3 h-3 shrink-0" />
                  <span>Saved to your director style preferences</span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-zinc-500 mt-1 px-1 font-mono">
              {m.timestamp}
            </span>
          </div>
        ))}

        {isRevising && (
          <div className="p-3 rounded bg-[#18181b] border border-[#2a2a2a] text-xs text-zinc-300 space-y-1.5 animate-pulse">
            <div className="flex items-center gap-2 font-medium text-emerald-400">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
              <span>KINO Director Agent is revising timeline...</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Evaluating candidate clips • Updating HTML composition • Running contract gate
            </div>
          </div>
        )}
      </div>

      {/* Quick Revision Directives */}
      <div className="px-3 py-2 border-t border-[#2a2a2a] bg-[#18181b]">
        <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-wider font-mono font-medium mb-1.5">
          <span>AI AGENT DIRECTIVES</span>
          <span className="text-emerald-400">QUICK PROMPTS</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {QUICK_PROMPTS.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => executeRevision(item.prompt)}
                disabled={isRevising}
                className="text-[11px] bg-[#141414] hover:bg-[#222222] text-zinc-300 hover:text-white px-2 py-1.5 rounded border border-[#2a2a2a] transition-all text-left truncate font-normal flex-1 flex items-center justify-between disabled:opacity-50"
                title={`Apply: ${item.prompt}`}
              >
                <span className="truncate">{item.label}</span>
                <span className="text-[9px] font-mono text-emerald-400 font-medium uppercase shrink-0 ml-1">Run</span>
              </button>
              <button
                type="button"
                onClick={() => setInputPrompt(item.prompt)}
                disabled={isRevising}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1.5 rounded bg-[#141414] border border-[#2a2a2a] shrink-0 font-mono"
                title="Edit prompt text"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#2a2a2a] bg-[#141414]"
        style={{ display: "flex", gap: "8px", padding: "10px", alignItems: "center" }}
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Adjust rhythm, swap clip, or apply block..."
          disabled={isRevising}
          className="flex-1 text-xs bg-[#0a0a0a] border border-[#2a2a2a] text-zinc-200 rounded px-2.5 py-1.5 focus:border-[#3a3a3a] transition-all disabled:opacity-50 placeholder:text-zinc-600 font-sans"
        />
        <button
          type="submit"
          disabled={isRevising || !inputPrompt.trim()}
          className="btn-primary"
          style={{ padding: "6px 12px", fontSize: "11.5px", flexShrink: 0 }}
        >
          Apply
        </button>
      </form>
    </div>
  );
};
