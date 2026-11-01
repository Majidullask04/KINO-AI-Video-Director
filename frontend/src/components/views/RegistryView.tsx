"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Layers,
  Code2,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Play,
  Copy,
  Plus
} from "lucide-react";
import { Project, HyperFramesRegistryBlock } from "@/types";
import { API_BASE } from "@/utils/media";

interface RegistryViewProps {
  activeProject: Project | null;
  onApplyBlockToBeat?: (blockId: string, beatIndex: number) => Promise<void>;
}

export const RegistryView: React.FC<RegistryViewProps> = ({
  activeProject,
  onApplyBlockToBeat,
}) => {
  const [blocks, setBlocks] = useState<HyperFramesRegistryBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<HyperFramesRegistryBlock | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "css" | "gsap">("preview");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [targetBeatOrder, setTargetBeatOrder] = useState<number>(1);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/hyperframes/registry/blocks`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.blocks) {
          setBlocks(data.blocks);
          if (data.blocks.length > 0) {
            setSelectedBlock(data.blocks[0]);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch HyperFrames blocks:", err);
      });
  }, []);

  const categories = [
    { id: "all", label: "All Blocks" },
    { id: "titles", label: "Titles & Kinetic" },
    { id: "transitions", label: "Transitions" },
    { id: "overlays", label: "HUD & Overlays" },
    { id: "cards", label: "Cards & Callouts" },
    { id: "data", label: "Data & Metrics" },
  ];

  const filteredBlocks = blocks.filter((b) => {
    const matchesCategory = selectedCategory === "all" || b.category === selectedCategory;
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleApply = async () => {
    if (!selectedBlock || !activeProject) return;
    setIsApplying(true);
    setStatusNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/hyperframes/projects/${activeProject.id}/apply-block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: selectedBlock.id,
          target_beat_order: targetBeatOrder,
          badge_text: "KINO · HYPERFRAMES",
          title_text: selectedBlock.name.toUpperCase(),
          sub_text: selectedBlock.description
        })
      });
      if (res.ok) {
        setStatusNotice(`✓ Successfully injected '${selectedBlock.name}' into Beat #${targetBeatOrder}`);
      } else {
        setStatusNotice(`Failed to apply block`);
      }
    } catch (e) {
      setStatusNotice(`Error applying block`);
    } finally {
      setIsApplying(false);
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  const handleCopyCli = (blockId: string) => {
    navigator.clipboard.writeText(`npx hyperframes add ${blockId}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="page-scroll-container">
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between pb-5 border-b border-[#2a2a2a] mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="flex items-center gap-2 mb-1.5" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="tech-tag tech-tag-green">
              KINO REGISTRY
            </span>
            <span className="font-mono text-xs text-zinc-500">v1.0.0</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 m-0">
            Installable Blocks & Components
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Editable HTML, CSS, and GSAP motion blocks designed for AI agents and creators.
            Add ready-made kinetic titles, HUD viewfinders, freeze cuts, and cards to any timeline beat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopyCli(selectedBlock?.id || "beat-freeze-cut")}
            className="btn-green text-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? "Copied!" : "Copy CLI Install"}</span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="flex items-center justify-between gap-4 mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ display: "flex", gap: "6px" }}>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                selectedCategory === c.id
                  ? "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 font-semibold"
                  : "bg-[#141414] text-zinc-400 border border-[#2a2a2a] hover:text-zinc-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search blocks or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#141414] border border-[#2a2a2a] rounded"
          />
        </div>
      </div>

      {/* 3. Main Grid (Blocks List + Inspector) */}
      <div className="grid grid-cols-12 gap-6" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "24px" }}>
        {/* Left Column: Blocks Grid (7 cols) */}
        <div className="col-span-7 space-y-3" style={{ gridColumn: "span 7" }}>
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
            AVAILABLE BLOCKS ({filteredBlocks.length})
          </div>

          <div className="grid grid-cols-2 gap-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {filteredBlocks.map((b) => {
              const isSelected = selectedBlock?.id === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBlock(b)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#18181b] border-[#22c55e]/50 shadow-lg shadow-[#22c55e]/5"
                      : "bg-[#141414] border-[#2a2a2a] hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono text-[10px] text-zinc-500 uppercase">
                      {b.category}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {b.default_duration}s
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                    {b.name}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
                    {b.description}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap" style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {b.tags.map((t) => (
                      <span key={t} className="text-[9.5px] font-mono text-zinc-500 bg-[#0a0a0a] px-1.5 py-0.5 rounded border border-[#2a2a2a]">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Code & Inspector (5 cols) */}
        <div className="col-span-5" style={{ gridColumn: "span 5" }}>
          {selectedBlock ? (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5 sticky top-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2a2a2a] mb-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="text-base font-bold text-zinc-100 m-0">
                    {selectedBlock.name}
                  </h2>
                  <div className="font-mono text-xs text-zinc-500 mt-0.5">
                    ID: {selectedBlock.id} · {selectedBlock.author}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {(["preview", "html", "css", "gsap"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-2 py-1 text-[11px] font-mono rounded ${
                        activeTab === tab
                          ? "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 font-semibold"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code / Visual Preview Content */}
              {activeTab === "preview" && (
                <div className="space-y-4">
                  <div className="h-48 rounded bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center p-6 text-center relative overflow-hidden">
                    <div className="text-center z-10">
                      <div className="tech-tag tech-tag-green mb-2">
                        {selectedBlock.name}
                      </div>
                      <div className="text-lg font-bold text-white tracking-tight">
                        LIVE STUDIO PREVIEW
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Seekable frame-by-frame on Track {selectedBlock.track_index}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a] text-xs space-y-2">
                    <div className="flex justify-between" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-zinc-500">Track Kind:</span>
                      <span className="font-mono text-zinc-300">{selectedBlock.track_kind}</span>
                    </div>
                    <div className="flex justify-between" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-zinc-500">Default Duration:</span>
                      <span className="font-mono text-emerald-400">{selectedBlock.default_duration}s</span>
                    </div>
                    <div className="flex justify-between" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-zinc-500">CLI Scaffold:</span>
                      <span className="font-mono text-zinc-400">npx hyperframes add {selectedBlock.id}</span>
                    </div>
                  </div>

                  {/* 1-Click Inject into Beat */}
                  <div className="pt-2 border-t border-[#2a2a2a] space-y-3">
                    <div className="text-xs font-semibold text-zinc-300">
                      Apply to Active Production
                    </div>
                    <div className="flex items-center gap-2" style={{ display: "flex", gap: "8px" }}>
                      <label className="text-xs text-zinc-500 shrink-0">Target Beat:</label>
                      <select
                        value={targetBeatOrder}
                        onChange={(e) => setTargetBeatOrder(Number(e.target.value))}
                        className="text-xs bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 flex-1"
                      >
                        <option value={1}>Beat #1 (Opening Hook)</option>
                        <option value={2}>Beat #2 (Problem Statement)</option>
                        <option value={3}>Beat #3 (Solution Demo)</option>
                        <option value={4}>Beat #4 (Call to Action)</option>
                      </select>
                      <button
                        onClick={handleApply}
                        disabled={isApplying}
                        className="btn-green text-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isApplying ? "Injecting..." : "Apply"}</span>
                      </button>
                    </div>

                    {statusNotice && (
                      <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
                        {statusNotice}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "html" && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">
                    HTML COMPOSITION TEMPLATE
                  </div>
                  <pre className="p-3 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-80 leading-relaxed">
                    {selectedBlock.html}
                  </pre>
                </div>
              )}

              {activeTab === "css" && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">
                    CSS SPECIFICATION
                  </div>
                  <pre className="p-3 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-80 leading-relaxed">
                    {selectedBlock.css}
                  </pre>
                </div>
              )}

              {activeTab === "gsap" && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">
                    SEEKABLE GSAP TIMELINE SCRIPT
                  </div>
                  <pre className="p-3 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-80 leading-relaxed">
                    {selectedBlock.gsap_tween}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-[#141414] border border-[#2a2a2a] rounded-lg text-zinc-500 text-xs">
              Select a block to inspect its specifications
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

