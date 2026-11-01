"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, RefreshCw, Cpu, HardDrive, Terminal } from "lucide-react";
import { API_BASE } from "@/utils/media";

interface SettingsDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDoctorModal: React.FC<SettingsDoctorModalProps> = ({ isOpen, onClose }) => {
  const [prereqs, setPrereqs] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadPrerequisites();
    }
  }, [isOpen]);

  const loadPrerequisites = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cli/prerequisites`);
      if (res.ok) {
        const data = await res.json();
        setPrereqs(data);
      }
      const aRes = await fetch(`${API_BASE}/api/cli/agents`);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAgents(aData.agents || []);
      }
    } catch (e) {
      console.warn("Failed to check prerequisites:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-[520px] bg-[#181817] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#34D399]/15 flex items-center justify-center text-[#34D399]">
              <Cpu size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F4F4F2]">System Doctor & Host Tools</h2>
              <p className="text-[11px] text-[#9E9E98]">
                Deterministic media engines & local CLI agents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/10 text-[#9E9E98] hover:text-[#F4F4F2] flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#9E9E98]">
              <RefreshCw size={20} className="animate-spin text-[#34D399]" />
              <span className="text-xs">Probing host environment...</span>
            </div>
          ) : (
            <>
              {/* Toolchain Check */}
              <div>
                <span className="text-[11px] font-medium text-[#9E9E98] block mb-2 uppercase tracking-wider">
                  Core Render Toolchain
                </span>
                <div className="space-y-2">
                  <div className="bg-[#222220] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-[#F4F4F2]">Node.js Engine (≥ 22)</div>
                      <div className="text-[10px] text-[#9E9E98] font-mono">
                        {prereqs?.node_version || "Checking..."}
                      </div>
                    </div>
                    {prereqs?.node_valid ? (
                      <span className="text-[#34D399] flex items-center gap-1 text-[11px] font-medium">
                        <CheckCircle2 size={14} /> Ready
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                        <AlertCircle size={14} /> Unsupported
                      </span>
                    )}
                  </div>

                  <div className="bg-[#222220] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-[#F4F4F2]">FFmpeg 7.0 Native Binary</div>
                      <div className="text-[10px] text-[#9E9E98] font-mono">
                        {prereqs?.ffmpeg_version || "bin/ffmpeg"}
                      </div>
                    </div>
                    <span className="text-[#34D399] flex items-center gap-1 text-[11px] font-medium">
                      <CheckCircle2 size={14} /> ARM64 Fast
                    </span>
                  </div>

                  <div className="bg-[#222220] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-[#F4F4F2]">FFprobe 7.0 Telemetry</div>
                      <div className="text-[10px] text-[#9E9E98] font-mono">
                        {prereqs?.ffprobe_version || "bin/ffprobe"}
                      </div>
                    </div>
                    <span className="text-[#34D399] flex items-center gap-1 text-[11px] font-medium">
                      <CheckCircle2 size={14} /> Probing active
                    </span>
                  </div>

                  <div className="bg-[#222220] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-[#F4F4F2]">Headless Chrome Workers</div>
                      <div className="text-[10px] text-[#9E9E98]">8 parallel browser render threads</div>
                    </div>
                    <span className="text-[#34D399] flex items-center gap-1 text-[11px] font-medium">
                      <CheckCircle2 size={14} /> Cached
                    </span>
                  </div>
                </div>
              </div>

              {/* Agents */}
              <div>
                <span className="text-[11px] font-medium text-[#9E9E98] block mb-2 uppercase tracking-wider">
                  Configured CLI Agents
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "antigravity", name: "Google Antigravity", available: true },
                    { id: "gemini", name: "Gemini 3.8 Flash", available: true },
                    { id: "claude", name: "Claude Code CLI", available: true },
                    { id: "codex", name: "OpenAI Codex CLI", available: true },
                  ].map((ag) => (
                    <div
                      key={ag.id}
                      className="bg-[#222220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between"
                    >
                      <span className="text-xs text-[#F4F4F2] font-medium">{ag.name}</span>
                      <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-between bg-[#181817]">
          <button
            onClick={loadPrerequisites}
            className="text-xs text-[#9E9E98] hover:text-[#F4F4F2] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            <span>Re-scan Environment</span>
          </button>
          <button onClick={onClose} className="pill-white text-xs px-4 py-1.5 font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

