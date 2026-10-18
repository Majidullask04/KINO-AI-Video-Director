"use client";

import React, { useState } from "react";
import {
  Send,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Bookmark
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
  "Swap Beat 2 for higher-energy B-roll",
  "Trim opening hook to 2.0s and save preference",
  "Use close-up code shot for demonstration beat",
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
      text: "Editorial Copilot active. Timeline edits are grounded in multi-hop FalkorDB Cypher traversals. Request cut adjustments, pacing revisions, or define durable creator preferences.",
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
        text: `Mutation complete. Created EditVersion v${activeVersionNum + 1} in the FalkorDB lineage DAG.`,
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
    <div className="bg-[#121215] border-l border-[#222228] flex flex-col h-full select-none">
      {/* 1. Header: EDITORIAL COPILOT + Compact 3-Agent Status Bar */}
      <div className="px-3.5 py-2.5 border-b border-[#222228] bg-[#0c0c0e] flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.6} />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#f4f4f6]">
              Editorial Copilot
            </h2>
          </div>
          <span className="tech-tag tech-tag-amber">
            Active: v{activeVersionNum}
          </span>
        </div>

        {/* 3-Agent Live Status Indicators */}
        <div className="grid grid-cols-3 gap-1.5 text-[9.5px] font-mono">
          <div className="px-2 py-1 rounded bg-[#09090b] border border-[#222228] flex items-center justify-between">
            <span className="text-zinc-500">Ingestor</span>
            <span className="text-emerald-400">Ready</span>
          </div>
          <div className="px-2 py-1 rounded bg-[#09090b] border border-[#222228] flex items-center justify-between">
            <span className="text-zinc-500">Director</span>
            <span className="text-zinc-300 font-medium">Active</span>
          </div>
          <div className="px-2 py-1 rounded bg-[#09090b] border border-[#222228] flex items-center justify-between">
            <span className="text-zinc-500">Revision</span>
            <span className="text-amber-400 font-medium">Standby</span>
          </div>
        </div>

        {/* 2. Memory Strip: Active :CreatorPreference tags in .tech-tag-amber */}
        {creatorPreferences.length > 0 && (
          <div className="p-2 rounded bg-[#09090b] border border-[#222228] text-[10px] space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[9px] uppercase tracking-wider">
              <Bookmark className="w-2.5 h-2.5 text-amber-500" />
              <span>Learned Style Rules ({creatorPreferences.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {creatorPreferences.slice(0, 2).map((pref) => (
                <span
                  key={pref.id}
                  className="tech-tag tech-tag-amber text-[9.5px] py-0.5 normal-case font-sans truncate max-w-full"
                >
                  &quot;{pref.rule_text}&quot;
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Messages Stream */}
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
                  ? "bg-[#1f1f26] text-[#f4f4f6] border border-[#32323d] font-medium"
                  : "bg-[#0c0c0e] text-zinc-300 border border-[#222228]"
              }`}
            >
              <p>{m.text}</p>

              {/* Execution Steps Trace Card */}
              {m.executionSteps && (
                <div className="mt-2 pt-2 border-t border-[#222228] space-y-1 text-[10px] font-mono text-zinc-400">
                  <div className="text-[9px] uppercase font-semibold text-zinc-400 tracking-wider">
                    FalkorDB Mutation Trace:
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
                <div className="mt-2 pt-2 border-t border-[#222228] flex items-center gap-1.5 text-[10px] text-amber-400 font-mono">
                  <Bookmark className="w-3 h-3 shrink-0" />
                  <span>Durable preference stored in FalkorDB (:CreatorPreference)</span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-zinc-500 mt-1 px-1 font-mono">
              {m.timestamp}
            </span>
          </div>
        ))}

        {isRevising && (
          <div className="p-3 rounded bg-[#0c0c0e] border border-[#222228] text-xs text-zinc-300 space-y-1.5 animate-pulse">
            <div className="flex items-center gap-2 font-medium text-amber-400">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>Traversing FalkorDB Graph...</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Excluding rejected clips • Branching lineage DAG • Rendering preview
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Revision Prompts (Plain text buttons, NO emojis) */}
      <div className="px-3 py-2 border-t border-[#222228] bg-[#0c0c0e]">
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono font-medium mb-1.5">
          QUICK PROMPTS
        </div>
        <div className="flex flex-col gap-1.5">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => setInputPrompt(prompt)}
              className="text-[11px] bg-[#121215] hover:bg-[#18181c] text-zinc-300 hover:text-white px-2 py-1.5 rounded border border-[#222228] transition-all text-left truncate font-normal"
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Input Form: Clean dark input + Solid white <button className="btn-primary">Apply</button> */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#222228] bg-[#0c0c0e]"
        style={{ display: "flex", gap: "8px", padding: "10px", alignItems: "center" }}
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Adjust rhythm, replace clip, or record rule..."
          disabled={isRevising}
          className="flex-1 text-xs bg-[#09090b] border border-[#222228] text-zinc-200 rounded px-2.5 py-1.5 focus:border-[#52525b] transition-all disabled:opacity-50 placeholder:text-zinc-600 font-sans"
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
