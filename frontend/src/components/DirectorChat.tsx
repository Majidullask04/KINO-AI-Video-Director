"use client";

import React, { useState } from "react";
import { Send, Sparkles, Brain, RefreshCw, Zap, MessageSquare } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  versionNum?: number;
  learnedPreference?: string;
}

interface DirectorChatProps {
  onSendRevision: (prompt: string) => Promise<void>;
  isRevising: boolean;
  activeVersionNum: number;
}

const QUICK_PROMPTS = [
  "Replace clip 2 with higher energy B-roll",
  "Trim the opening hook to 2.5 seconds",
  "Remember I always prefer fast 2s hooks in my videos",
  "Swap the third clip for a close-up product demo",
];

export const DirectorChat: React.FC<DirectorChatProps> = ({
  onSendRevision,
  isRevising,
  activeVersionNum,
}) => {
  const [inputPrompt, setInputPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      sender: "assistant",
      text: "Hello! I am your AI Video Director. Ask me to revise any cut, swap clips, tighten pacing, or state standing preferences you want remembered across projects.",
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
        text: `Applied revision! Created EditVersion v${
          activeVersionNum + 1
        } in the FalkorDB lineage DAG. Marked previous clip [:REJECTED_FOR] and rendered updated preview.`,
        timestamp: "Just now",
        versionNum: activeVersionNum + 1,
        learnedPreference: isMemoryPrompt ? userText : undefined,
      };
      setMessages((prev) => [...prev, assistantReply]);
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: `Error updating timeline: ${err.message || "Failed to revise edit"}`,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorReply]);
    }
  };

  return (
    <div className="bg-[#121217] border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col h-full shadow-xl">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            Director Assistant (Revision Agent)
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/60 font-mono">
          Active: v{activeVersionNum}
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[90%] p-3 rounded-xl text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-violet-600 text-white rounded-br-none shadow-md shadow-violet-900/30"
                  : "bg-zinc-900/90 text-zinc-200 border border-zinc-800 rounded-bl-none"
              }`}
            >
              <p>{m.text}</p>

              {/* Memory saved badge if detected */}
              {m.learnedPreference && (
                <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <Brain className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Saved durable CreatorPreference to FalkorDB memory!
                  </span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-zinc-500 mt-1 px-1">
              {m.timestamp}
            </span>
          </div>
        ))}

        {isRevising && (
          <div className="flex items-center gap-2 text-xs text-violet-400 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Mutating FalkorDB Lineage DAG & Rendering New MP4...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompt Pills */}
      <div className="px-3 py-2 border-t border-zinc-800/60 bg-zinc-950/40">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Quick Revisions</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => setInputPrompt(prompt)}
              className="text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2 py-1 rounded border border-zinc-800 transition-colors truncate max-w-full text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="e.g. Trim hook to 2s, swap clip 2 for code..."
          disabled={isRevising}
          className="flex-1 text-xs bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isRevising || !inputPrompt.trim()}
          className="bg-violet-600 hover:bg-violet-500 text-white p-2 rounded-lg transition-colors disabled:opacity-50 shadow-md"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
