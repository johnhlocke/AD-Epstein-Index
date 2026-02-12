"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const GUTTER = 24;
const MAX_WIDTH = 1440;

// Colors
const MARGIN_COLOR = "rgba(255,59,139,0.45)"; // Magenta — margin guides
const SLICE_COLOR = "rgba(0,212,255,0.07)"; // Cyan fill — slice area
const SLICE_BORDER = "rgba(0,212,255,0.18)"; // Cyan line — slice edges
const COL_BORDER = "rgba(255,180,0,0.5)"; // Amber — major column boundaries
const GUTTER_COLOR = "rgba(255,180,0,0.06)"; // Amber fill — gutter zones
const LABEL_COLOR = "rgba(0,212,255,0.5)";
const COL_LABEL_COLOR = "rgba(255,180,0,0.7)";

// ── External store subscriptions ──

/** Subscribe to viewport changes (resize + breakpoint transitions) */
function subscribeToViewport(callback: () => void) {
  window.addEventListener("resize", callback);
  const mq768 = window.matchMedia("(min-width: 768px)");
  const mq1024 = window.matchMedia("(min-width: 1024px)");
  mq768.addEventListener("change", callback);
  mq1024.addEventListener("change", callback);
  return () => {
    window.removeEventListener("resize", callback);
    mq768.removeEventListener("change", callback);
    mq1024.removeEventListener("change", callback);
  };
}

function subscribeToResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

/** Serialized grid params from CSS custom properties */
function getGridSnapshot() {
  const style = getComputedStyle(document.documentElement);
  const margin = parseInt(style.getPropertyValue("--grid-margin"), 10) || 24;
  const slices = parseInt(style.getPropertyValue("--grid-slices"), 10) || 6;
  const columns = parseInt(style.getPropertyValue("--grid-columns"), 10) || 3;
  return `${margin},${slices},${columns}`;
}

function getServerGridSnapshot() {
  return "96,6,3";
}

function getViewportWidth() {
  return String(window.innerWidth);
}

function getServerViewportWidth() {
  return "1440";
}

// ── Hooks ──

function useGridParams() {
  const snapshot = useSyncExternalStore(subscribeToViewport, getGridSnapshot, getServerGridSnapshot);
  const [margin, slices, columns] = snapshot.split(",").map(Number);
  return { margin, slices, columns };
}

function useViewportWidth() {
  return Number(useSyncExternalStore(subscribeToResize, getViewportWidth, getServerViewportWidth));
}

// ── Components ──

export function GridOverlay() {
  const [visible, setVisible] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const { margin, slices, columns } = useGridParams();
  const viewportWidth = useViewportWidth();

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

  const slicesPerCol = columns > 0 ? slices / columns : 2;
  const effectiveMaxWidth = Math.min(viewportWidth, MAX_WIDTH);
  const outerOffset = Math.max(0, (viewportWidth - effectiveMaxWidth) / 2);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* ── Margin guides ── */}
      <div
        className="absolute bottom-0 top-0"
        style={{ left: outerOffset, width: margin, borderRight: `1px solid ${MARGIN_COLOR}` }}
      />
      <div
        className="absolute bottom-0 top-0"
        style={{ right: outerOffset, width: margin, borderLeft: `1px solid ${MARGIN_COLOR}` }}
      />

      {/* Margin labels */}
      <div
        className="absolute top-3 font-mono text-[9px] font-medium"
        style={{ left: outerOffset + margin + 6, color: MARGIN_COLOR }}
      >
        {margin}px
      </div>
      <div
        className="absolute top-3 font-mono text-[9px] font-medium"
        style={{ right: outerOffset + margin + 6, color: MARGIN_COLOR }}
      >
        {margin}px
      </div>

      {/* ── Slice grid with gutters ── */}
      <div
        className="absolute bottom-0 top-0"
        style={{
          left: outerOffset + margin,
          right: outerOffset + margin,
          display: "grid",
          gridTemplateColumns: `repeat(${slices}, 1fr)`,
          gap: `${GUTTER}px`,
        }}
      >
        {Array.from({ length: slices }).map((_, i) => {
          const isColumnStart = slicesPerCol > 0 && i > 0 && i % slicesPerCol === 0;
          const majorColIndex = Math.floor(i / slicesPerCol);
          const isFirstInPair = slicesPerCol > 0 && i % slicesPerCol === 0;

          return (
            <div key={i} className="relative h-full">
              {/* Slice fill */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: SLICE_COLOR }}
              />

              {/* Left edge of slice */}
              <div
                className="absolute bottom-0 left-0 top-0"
                style={{
                  width: 1,
                  backgroundColor: isColumnStart ? COL_BORDER : SLICE_BORDER,
                }}
              />

              {/* Right edge on last slice */}
              {i === slices - 1 && (
                <div
                  className="absolute bottom-0 right-0 top-0"
                  style={{ width: 1, backgroundColor: SLICE_BORDER }}
                />
              )}

              {/* Slice number (top) */}
              <span
                className="absolute left-1/2 top-3 -translate-x-1/2 font-mono text-[9px] font-medium"
                style={{ color: LABEL_COLOR }}
              >
                {i + 1}
              </span>

              {/* Major column label (centered across group) */}
              {isFirstInPair && columns > 1 && (
                <span
                  className="absolute top-10 font-mono text-[10px] font-bold"
                  style={{
                    left: "100%",
                    transform: "translateX(-50%)",
                    color: COL_LABEL_COLOR,
                  }}
                >
                  Col {majorColIndex + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Gutter highlights ── */}
      <GutterOverlays margin={margin} slices={slices} slicesPerCol={slicesPerCol} outerOffset={outerOffset} />

      {/* ── Baseline grid (8px rhythm) — Ctrl+Shift+G ── */}
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 font-mono text-[10px] text-white/70">
        Ctrl+G grid &nbsp;·&nbsp; Ctrl+Shift+G baseline &nbsp;·&nbsp;
        {slices} slices &nbsp;·&nbsp; {margin}px margins &nbsp;·&nbsp;
        <span style={{ color: LABEL_COLOR }}>cyan</span>=slices &nbsp;
        <span style={{ color: COL_LABEL_COLOR }}>amber</span>=columns &nbsp;
        <span style={{ color: MARGIN_COLOR }}>magenta</span>=margins
      </div>
    </div>
  );
}

/**
 * Render visible gutter zones between slices.
 * Computes positions from viewport width + grid params — pure render, no effects.
 */
function GutterOverlays({
  margin,
  slices,
  slicesPerCol,
  outerOffset,
}: {
  margin: number;
  slices: number;
  slicesPerCol: number;
  outerOffset: number;
}) {
  const viewportWidth = useViewportWidth();

  const effectiveMaxWidth = Math.min(viewportWidth, MAX_WIDTH);
  const contentWidth = effectiveMaxWidth - margin * 2;
  const totalGutters = (slices - 1) * GUTTER;
  const sliceWidth = (contentWidth - totalGutters) / slices;

  const positions: number[] = [];
  for (let i = 0; i < slices - 1; i++) {
    positions.push(outerOffset + margin + (i + 1) * sliceWidth + i * GUTTER);
  }

  return (
    <>
      {positions.map((left, i) => {
        const isMajorGutter = slicesPerCol > 0 && (i + 1) % slicesPerCol === 0 && i < slices - 1;

        return (
          <div
            key={i}
            className="absolute bottom-0 top-0"
            style={{
              left,
              width: GUTTER,
              backgroundColor: isMajorGutter
                ? "rgba(255,180,0,0.10)"
                : GUTTER_COLOR,
              borderLeft: `1px dashed ${isMajorGutter ? COL_BORDER : SLICE_BORDER}`,
              borderRight: `1px dashed ${isMajorGutter ? COL_BORDER : SLICE_BORDER}`,
            }}
          >
            <span
              className="absolute left-1/2 top-[52px] -translate-x-1/2 font-mono text-[8px]"
              style={{ color: isMajorGutter ? COL_LABEL_COLOR : LABEL_COLOR, opacity: 0.6 }}
            >
              {GUTTER}
            </span>
          </div>
        );
      })}
    </>
  );
}
