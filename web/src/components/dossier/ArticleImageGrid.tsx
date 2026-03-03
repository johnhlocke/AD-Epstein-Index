"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";

interface ArticleImage {
  id: number;
  public_url: string | null;
  page_number: number | null;
}

interface ArticleImageGridProps {
  images: ArticleImage[];
}

export function ArticleImageGrid({ images }: ArticleImageGridProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const visibleImages = expanded ? images : images.slice(0, 6);
  const hasMore = images.length > 6;

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);

  const goPrev = useCallback(() => {
    setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setLightboxIdx((i) => (i !== null && i < images.length - 1 ? i + 1 : i));
  }, [images.length]);

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

  const lightboxImage = lightboxIdx !== null ? images[lightboxIdx] : null;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px", marginTop: "16px" }}>
        {visibleImages.map((img, i) => (
          <div
            key={img.id}
            className="overflow-hidden"
            style={{ cursor: img.public_url ? "pointer" : undefined }}
            onClick={() => img.public_url && setLightboxIdx(i)}
          >
            {img.public_url && (
              <Image
                src={img.public_url}
                alt={`Article page ${img.page_number ?? ""}`}
                width={300}
                height={400}
                className="w-full object-cover"
                style={{ filter: "grayscale(100%) contrast(1.3)" }}
              />
            )}
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: "12px",
            fontFamily: "futura-pt, sans-serif",
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#1A1A1A",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "Show less" : `Show all ${images.length} pages`}
        </button>
      )}

      {/* Lightbox overlay */}
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
          {/* Prev arrow */}
          {lightboxIdx !== null && lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              style={{
                position: "absolute",
                left: 24,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: "36px",
                cursor: "pointer",
                padding: "12px",
                fontFamily: "futura-pt, sans-serif",
              }}
            >
              &larr;
            </button>
          )}

          {/* Image */}
          <Image
            src={lightboxImage.public_url}
            alt={`Article page ${lightboxImage.page_number ?? ""}`}
            width={900}
            height={1200}
            style={{
              maxHeight: "70vh",
              maxWidth: "60vw",
              objectFit: "contain",
              filter: "grayscale(100%) contrast(1.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next arrow */}
          {lightboxIdx !== null && lightboxIdx < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              style={{
                position: "absolute",
                right: 24,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: "36px",
                cursor: "pointer",
                padding: "12px",
                fontFamily: "futura-pt, sans-serif",
              }}
            >
              &rarr;
            </button>
          )}

          {/* Page label */}
          {lightboxImage.page_number && (
            <span
              style={{
                position: "absolute",
                bottom: 24,
                fontFamily: "futura-pt, sans-serif",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.5)",
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
