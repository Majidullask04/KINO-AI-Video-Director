import React from "react";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", userSelect: "none" }}>
      <div
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "6px",
          background: "linear-gradient(180deg, #1C1C22 0%, #101014 100%)",
          border: "1px solid #2C2C35",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 8V5C3 3.89543 3.89543 3 5 3H8" stroke="#71717A" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M16 3H19C20.1046 3 21 3.89543 21 5V8" stroke="#71717A" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M21 16V19C21 20.1046 20.1046 21 19 21H16" stroke="#71717A" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M8 21H5C3.89543 21 3 20.1046 3 19V16" stroke="#71717A" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M8.5 8.2L16.8 12L8.5 15.8V8.2Z" fill="rgba(245, 158, 11, 0.15)" stroke="#F4F4F6" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="8.5" cy="8.2" r="1.7" fill="#F4F4F6" />
          <circle cx="8.5" cy="15.8" r="1.7" fill="#F4F4F6" />
          <circle cx="16.8" cy="12" r="2.1" fill="#F59E0B" />
        </svg>
      </div>
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13.5px", fontWeight: 600, letterSpacing: "-0.03em", color: "#F4F4F6" }}>
              KINO
            </span>
            <span
              style={{
                fontSize: "9px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "#F59E0B",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.28)",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              STUDIO
            </span>
          </div>
          <span style={{ fontSize: "10px", color: "#71717A", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
            FalkorDB NLE • v2.4
          </span>
        </div>
      )}
    </div>
  );
}
