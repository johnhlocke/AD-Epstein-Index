"use client";

import { useEffect, useState } from "react";

const COLUMNS = 12;
const MARGIN = 100; // px — matches our editorial grid

export function GridOverlay() {
  const [visible, setVisible] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === "g") {
        e.preventDefault();
        setVisible((v) => !v);
      }
      if (e.ctrlKey && e.shiftKey && e.key === "G") {
        e.preventDefault();
        setShowBaseline((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Left margin guide */}
      <div
        className="absolute bottom-0 top-0 w-px bg-[#FF3B8B]/40"
        style={{ left: MARGIN }}
      />
      {/* Right margin guide */}
      <div
        className="absolute bottom-0 top-0 w-px bg-[#FF3B8B]/40"
        style={{ right: MARGIN }}
      />

      {/* Margin labels */}
      <div
        className="absolute top-3 font-mono text-[9px] font-medium text-[#FF3B8B]/60"
        style={{ left: MARGIN + 6 }}
      >
        100px
      </div>
      <div
        className="absolute top-3 font-mono text-[9px] font-medium text-[#FF3B8B]/60"
        style={{ right: MARGIN + 6 }}
      >
        100px
      </div>

      {/* 12-column grid between margins */}
      <div
        className="absolute bottom-0 top-0"
        style={{
          left: MARGIN,
          right: MARGIN,
          display: "grid",
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          gap: 0,
        }}
      >
        {Array.from({ length: COLUMNS }).map((_, i) => (
          <div key={i} className="relative h-full">
            {/* Column fill */}
            <div className="absolute inset-0 bg-[#00D4FF]/[0.04]" />
            {/* Left border */}
            <div className="absolute bottom-0 left-0 top-0 w-px bg-[#00D4FF]/[0.12]" />
            {/* Right border on last column */}
            {i === COLUMNS - 1 && (
              <div className="absolute bottom-0 right-0 top-0 w-px bg-[#00D4FF]/[0.12]" />
            )}
            {/* Column number */}
            <span className="absolute left-1/2 top-3 -translate-x-1/2 font-mono text-[9px] font-medium text-[#00D4FF]/40">
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Baseline grid (8px rhythm) — toggle with Ctrl+Shift+G */}
      {showBaseline && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
            backgroundSize: "100% 8px",
          }}
        />
      )}

      {/* Shortcut hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 font-mono text-[10px] text-white/70">
        Ctrl+G grid &nbsp;·&nbsp; Ctrl+Shift+G baseline
      </div>
    </div>
  );
}
