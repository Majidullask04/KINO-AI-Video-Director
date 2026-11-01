import React from "react";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 user-select-none">
      {/* HyperFrames Iconic Dual-Triangle Green Mark */}
      <svg
        width="22"
        height="15"
        viewBox="0 0 24 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path d="M2 3L10 8L2 13V3Z" fill="#34D399" />
        <path d="M22 3L14 8L22 13V3Z" fill="#34D399" />
        <circle cx="12" cy="8" r="2.2" fill="#34D399" />
      </svg>

      {!compact && (
        <span className="text-[14px] font-bold tracking-tight text-[#F4F4F2]">
          KINO
        </span>
      )}
    </div>
  );
}

export function FrameyMascot({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className="rounded-full bg-[#34D399] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(52,211,153,0.35)]"
    >
      <div className="flex items-center gap-[3px]">
        <span className="w-[3px] h-[3px] rounded-full bg-[#0F0F0E]" />
        <span className="w-[3px] h-[3px] rounded-full bg-[#0F0F0E]" />
      </div>
    </div>
  );
}
