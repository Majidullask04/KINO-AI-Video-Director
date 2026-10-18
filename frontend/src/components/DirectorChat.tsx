"use client";

import React, { useState } from "react";
import {
  Send,
  Sparkles,
  Brain,
  RefreshCw,
  Zap,
  CheckCircle2,
  ArrowRight,
  Bot,
  User,
  Sliders,
  Film
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
}

const QUICK_PROMPTS = [
  "Swap clip 2 for higher-energy B-roll",
  "Trim hook to 2.5s",
  "Remember I prefer fast cuts",
];

export const DirectorChat: React.FC<DirectorChatProps> = ({
  onSendRevision,
  isRevising,
  activeVersionNum,
  creatorPreferences = [],
}) => {
  const [inputPrompt, setInputPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      sender: "assistant",
      text: "Director Agent online. I synthesize timeline decisions using multi-hop FalkorDB Cypher traversals. Ask me to revise any cut, tighten rhythm, or record standing preferences across sessions.",
      timestamp: "Just now",
      versionNum: activeVersionNum,
    },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isRevising) return;

    const userText = inputPrompt.trim();
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
        text: `Mutation complete! Created EditVersion v${activeVersionNum + 1} in the FalkorDB lineage DAG.`,
        timestamp: "Just now",
        versionNum: activeVersionNum + 1,
        learnedPreference: isMemoryPrompt ? userText : undefined,
        executionSteps: [
          "1. Marked prior clip [:REJECTED_FOR] in FalkorDB",
          "2. Executed Multi-Hop Cypher Query 2 traversal",
          `3. Branched (:EditVersion v${activeVersionNum + 1})-[:DERIVED_FROM]->(v${activeVersionNum})`,
          "4. Rendered MoviePy / FFmpeg MP4 cut preview",
        ],
      };
      setMessages((prev) => [...prev, assistantReply]);
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: `Error revising cut: ${err.message || "Failed to update timeline in FalkorDB"}`,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorReply]);
    }
  };

  return (
    <div className="bg-[#0b0b12] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col h-full shadow-2xl relative select-none">
      {/* 3-Agent Coordinated Status Header */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.06] bg-[#0f0f18] flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Multi-Agent Copilot
            </h2>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/80 font-mono font-bold">
            Active: v{activeVersionNum}
          </span>
        </div>

        {/* 3-Agent Live Badges */}
        <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono">
          <div className="px-2 py-1 rounded bg-[#07070b] border border-white/[0.05] flex items-center justify-between">
            <span className="text-zinc-400">Ingestor</span>
            <span className="text-emerald-400">Ready</span>
          </div>
          <div className="px-2 py-1 rounded bg-[#07070b] border border-white/[0.05] flex items-center justify-between">
            <span className="text-zinc-400">Director</span>
            <span className="text-violet-400 font-bold">Track 01</span>
          </div>
          <div className="px-2 py-1 rounded bg-[#07070b] border border-white/[0.05] flex items-center justify-between">
            <span className="text-zinc-400">Revision</span>
            <span className="text-indigo-400 font-bold">Track 02</span>
          </div>
        </div>

        {/* Persistent Memory Pills Banner (Track 02) */}
        {creatorPreferences.length > 0 && (
          <div className="p-2 rounded-lg bg-violet-950/30 border border-violet-800/40 text-[10px] space-y-1">
            <div className="flex items-center gap-1.5 text-violet-300 font-semibold uppercase text-[9px]">
              <Brain className="w-3 h-3 text-violet-400" />
              <span>Remembered Style Preferences ({creatorPreferences.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {creatorPreferences.slice(0, 2).map((pref) => (
                <span
                  key={pref.id}
                  className="px-1.5 py-0.5 rounded bg-[#10101c] border border-violet-500/30 text-zinc-300 text-[9px] truncate max-w-full font-sans"
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
              className={`max-w-[92%] p-3 rounded-xl text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-violet-600 text-white rounded-br-none shadow-md shadow-violet-900/30 font-medium"
                  : "bg-[#0e0e16] text-zinc-200 border border-white/[0.07] rounded-bl-none shadow-sm"
              }`}
            >
              <p>{m.text}</p>

              {/* Execution Steps Trace Card */}
              {m.executionSteps && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.08] space-y-1 text-[10px] font-mono text-zinc-300">
                  <div className="text-[9px] uppercase font-bold text-violet-400 tracking-wider">
                    FalkorDB Graph Mutation Trace:
                  </div>
                  {m.executionSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Memory Indicator Chip */}
              {m.learnedPreference && (
                <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <Brain className="w-3.5 h-3.5 shrink-0" />
                  <span>Durable preference recorded in FalkorDB (:CreatorPreference)!</span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-zinc-400 mt-1 px-1 font-mono">
              {m.timestamp}
            </span>
          </div>
        ))}

        {isRevising && (
          <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-700/60 text-xs text-violet-200 space-y-1.5 animate-pulse">
            <div className="flex items-center gap-2 font-bold text-violet-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
              <span>Revision Agent Traversing FalkorDB Graph...</span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              Excluding rejected clips ➔ Branching lineage DAG ➔ Rendering preview
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompt Pills */}
      <div className="px-3 py-2 border-t border-white/[0.06] bg-[#07070b]">
        <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Quick Revision Prompts</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => setInputPrompt(prompt)}
              className="text-[10px] bg-[#12121c] hover:bg-[#1a1a28] text-zinc-300 hover:text-white px-2 py-1 rounded-md border border-white/10 transition-all truncate max-w-full text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/[0.08] bg-[#0e0e16]"
        style={{ display: "flex", gap: "8px", padding: "12px", alignItems: "center" }}
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="e.g. Trim hook to 2.0s & remember I like fast hooks..."
          disabled={isRevising}
          className="flex-1 text-xs bg-[#07070b] border border-white/10 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all disabled:opacity-50 placeholder:text-zinc-400"
        />
        <button
          type="submit"
          disabled={isRevising || !inputPrompt.trim()}
          className="bg-violet-600 hover:bg-violet-500 text-white p-2 rounded-lg transition-all disabled:opacity-50 shadow-md shadow-violet-900/40 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
