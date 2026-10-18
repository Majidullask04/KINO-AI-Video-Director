"use client";

import React from "react";
import { ShieldCheck, Share2, CheckCircle2 } from "lucide-react";

interface PublishingViewProps {
  requireHumanApproval: boolean;
  setRequireHumanApproval: (val: boolean) => void;
  sandboxPushed: boolean;
  setSandboxPushed: (val: boolean) => void;
}

export function PublishingView({
  requireHumanApproval,
  setRequireHumanApproval,
  sandboxPushed,
  setSandboxPushed,
}: PublishingViewProps) {
  return (
    <div className="page-scroll-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Compliance Banner */}
      <div
        className="studio-card"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          borderLeft: "3px solid #10B981",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ShieldCheck size={20} strokeWidth={1.75} color="#10B981" />
          <div>
            <h3 style={{ fontSize: "13.5px", fontWeight: 600, color: "#F4F4F6", margin: "0 0 2px 0" }}>
              Human-in-the-Loop Producer Gate
            </h3>
            <p style={{ fontSize: "11.5px", color: "#8E8E98", margin: 0 }}>
              Explicit Producer Approval Required Before External API Dispatch — Enabled.
            </p>
          </div>
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={requireHumanApproval}
            onChange={(e) => setRequireHumanApproval(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <span style={{ fontSize: "12px", color: "#D4D4D8", fontWeight: 500 }}>
            Gate Enforced
          </span>
        </label>
      </div>

      {/* 2x2 Grid of Clean Channel Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {[
          {
            name: "YouTube Studio",
            handle: "@KinoStudioProductions",
            type: "16:9 Long-Form & Shorts",
            connected: true,
            aspectOk: true,
            audioClear: true,
          },
          {
            name: "Vimeo Enterprise",
            handle: "kino-enterprise-master",
            type: "Broadcast Clean Feed",
            connected: true,
            aspectOk: true,
            audioClear: true,
          },
          {
            name: "LinkedIn Media",
            handle: "Kino Autonomous Director",
            type: "1:1 / 16:9 Professional",
            connected: false,
            aspectOk: true,
            audioClear: true,
          },
          {
            name: "Instagram Video",
            handle: "@kino.director.ai",
            type: "9:16 Vertical Reel",
            connected: true,
            aspectOk: false,
            audioClear: true,
          },
        ].map((channel) => (
          <div
            key={channel.name}
            className="studio-card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Share2 size={14} color="#71717A" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#F4F4F6" }}>
                  {channel.name}
                </span>
              </div>
              <span className="tech-tag" style={{ color: channel.connected ? "#10B981" : "#71717A" }}>
                {channel.connected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div style={{ fontSize: "11px", color: "#71717A", fontFamily: "ui-monospace, monospace" }}>
              Handle: {channel.handle} • {channel.type}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#8E8E98" }}>Aspect-Ratio Compatibility:</span>
                <span style={{ color: channel.aspectOk ? "#10B981" : "#F59E0B", fontWeight: 500 }}>
                  {channel.aspectOk ? "Verified (16:9 Match)" : "Scale / Crop Required"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#8E8E98" }}>Audio / Copyright Clearance:</span>
                <span style={{ color: "#10B981", fontWeight: 500 }}>Cleared (Royalty-Free)</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #1C1C22", paddingTop: "10px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="tech-tag-amber" style={{ fontSize: "9px" }}>
                Staged • Awaiting Producer Sign-Off
              </span>
              <button
                onClick={() => setSandboxPushed(true)}
                style={{ padding: "4px 8px", fontSize: "11px" }}
              >
                Stage Cut
              </button>
            </div>
          </div>
        ))}
      </div>

      {sandboxPushed && (
        <div
          style={{
            backgroundColor: "#101014",
            border: "1px solid #10B981",
            borderRadius: "5px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "12px",
            color: "#34D399",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <CheckCircle2 size={16} color="#10B981" />
          <span>Staged dispatch confirmed in FalkorDB ledger. Manual producer sign-off holds release until approval.</span>
        </div>
      )}
    </div>
  );
}
