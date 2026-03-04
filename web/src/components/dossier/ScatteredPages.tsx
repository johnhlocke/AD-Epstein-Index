"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "next/image";

interface ArticleImage {
  id: number;
  public_url: string | null;
  page_number: number | null;
}

interface ScatteredPagesProps {
  images: ArticleImage[];
}

/** Seeded random so scatter is stable per page load */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function ScatteredPages({ images }: ScatteredPagesProps) {
  const validImages = images.filter((img) => img.public_url);
  const containerRef = useRef<HTMLDivElement>(null);
  const [topId, setTopId] = useState<number | null>(null);
  const [zMap, setZMap] = useState<Record<number, number>>({});
  const zCounter = useRef(validImages.length + 1);

  // Lightbox state
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const goPrev = useCallback(() => {
    setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);
  const goNext = useCallback(() => {
    setLightboxIdx((i) => (i !== null && i < validImages.length - 1 ? i + 1 : i));
  }, [validImages.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, closeLightbox, goPrev, goNext]);

  // Generate stable random positions/rotations
  const cardWidth = 82;
  const cardHeight = 110;
  const [containerSize, setContainerSize] = useState({ w: 200, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layouts = useMemo(() => {
    const rand = seededRandom(42);
    const spreadW = Math.max(containerSize.w - cardWidth, 50);
    const spreadH = Math.max(containerSize.h - cardHeight, 50);
    return validImages.map((_, i) => ({
      x: rand() * spreadW,
      y: rand() * spreadH,
      rotation: (rand() - 0.5) * 24,
      z: i,
    }));
  }, [validImages, containerSize]);

  // Drag state
  const dragState = useRef<{
    idx: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});

  const getPos = (i: number) => positions[i] ?? { x: layouts[i].x, y: layouts[i].y };

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[idx] ?? { x: layouts[idx].x, y: layouts[idx].y };
    dragState.current = {
      idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setTopId(idx);
    setZMap((prev) => ({ ...prev, [idx]: zCounter.current++ }));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [positions, layouts]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const { idx, startX, startY, origX, origY } = dragState.current;
    setPositions((prev) => ({
      ...prev,
      [idx]: {
        x: origX + (e.clientX - startX),
        y: origY + (e.clientY - startY),
      },
    }));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const { idx, startX, startY } = dragState.current;
    const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
    // If barely moved, treat as click → open lightbox
    if (dist < 5) {
      setLightboxIdx(idx);
    }
    dragState.current = null;
  }, []);

  const lightboxImage = lightboxIdx !== null ? validImages[lightboxIdx] : null;

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: "100%",
          minHeight: "200px",
          marginTop: "12px",
          overflow: "visible",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {validImages.map((img, i) => {
          const pos = getPos(i);
          const z = zMap[i] ?? layouts[i].z;
          return (
            <div
              key={img.id}
              onPointerDown={(e) => handlePointerDown(e, i)}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: cardWidth,
                zIndex: z,
                cursor: topId === i && dragState.current ? "grabbing" : "grab",
                transform: `rotate(${layouts[i].rotation}deg)`,
                transition: dragState.current?.idx === i ? "none" : "box-shadow 0.2s",
                boxShadow: topId === i
                  ? "3px 5px 12px rgba(0,0,0,0.25)"
                  : "2px 3px 6px rgba(0,0,0,0.15)",
                touchAction: "none",
                userSelect: "none",
              }}
            >
              <Image
                src={img.public_url!}
                alt={`Page ${img.page_number ?? ""}`}
                width={cardWidth}
                height={cardHeight}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  objectFit: "cover",
                                    display: "block",
                  pointerEvents: "none",
                }}
                draggable={false}
              />
              {img.page_number && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 6,
                    fontFamily: "futura-pt, sans-serif",
                    fontSize: "8px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.7)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  p.{img.page_number}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxImage?.public_url && (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {lightboxIdx !== null && lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              style={{
                position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#fff", fontSize: "36px",
                cursor: "pointer", padding: "12px", fontFamily: "futura-pt, sans-serif",
              }}
            >
              &larr;
            </button>
          )}
          <Image
            src={lightboxImage.public_url}
            alt={`Page ${lightboxImage.page_number ?? ""}`}
            width={900}
            height={1200}
            style={{
              maxHeight: "70vh", maxWidth: "60vw",
              objectFit: "contain",             }}
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIdx !== null && lightboxIdx < validImages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              style={{
                position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#fff", fontSize: "36px",
                cursor: "pointer", padding: "12px", fontFamily: "futura-pt, sans-serif",
              }}
            >
              &rarr;
            </button>
          )}
          {lightboxImage.page_number && (
            <span
              style={{
                position: "absolute", bottom: 24,
                fontFamily: "futura-pt, sans-serif", fontSize: "11px", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)",
              }}
            >
              Page {lightboxImage.page_number}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
