"use client";

// REVERT: uncomment this import + the guard block below if SSR images cause issues
// import { useMounted } from "@/lib/use-mounted";
import type { MosaicTile } from "@/lib/types";

interface HeroMosaicClientProps {
  tiles: MosaicTile[];
}

const EAGER_ROWS = 3;

function strengthClass(strength: MosaicTile["strength"]): string {
  switch (strength) {
    case "HIGH":
      return "mosaic-tag-high";
    case "MEDIUM":
      return "mosaic-tag-medium";
    case "LOW":
      return "mosaic-tag-low";
    case "COINCIDENCE":
      return "mosaic-tag-coincidence";
    default:
      return "";
  }
}

function strengthLabel(strength: MosaicTile["strength"]): string {
  switch (strength) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Med";
    case "LOW":
      return "Low";
    case "COINCIDENCE":
      return "Coinc";
    default:
      return "";
  }
}

export function HeroMosaicClient({ tiles }: HeroMosaicClientProps) {
  // No useMounted() guard — the mosaic is pure CSS (grid + animation).
  // Rendering images in SSR HTML lets the browser start downloading
  // them immediately as the page streams in, instead of waiting for
  // JS hydration.
  //
  // REVERT: uncomment this block to gate rendering behind client hydration:
  // const mounted = useMounted();
  // if (!mounted) {
  //   return (
  //     <div
  //       className="mosaic-wrap"
  //       style={{ height: "clamp(320px, 50vh, 600px)", background: "#222" }}
  //       aria-hidden="true"
  //     />
  //   );
  // }

  // Eager-load first 3 rows (desktop 24 cols = 72 images)
  const eagerCount = EAGER_ROWS * 24;

  const renderTile = (tile: MosaicTile, index: number, keyPrefix: string) => (
    <div
      key={`${keyPrefix}-${tile.id}`}
      className={`mosaic-tile${tile.confirmed ? " mosaic-tile-confirmed" : ""}`}
      style={tile.confirmed ? { animationDelay: `${(tile.id * 397) % 1200}ms` } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.url}
        alt=""
        width={123}
        height={164}
        loading={index < eagerCount ? "eager" : "lazy"}
        fetchPriority={index < eagerCount ? "high" : "auto"}
        decoding="async"
      />
      {tile.confirmed && tile.strength && (
        <span className={`mosaic-tag ${strengthClass(tile.strength)}`}>
          {strengthLabel(tile.strength)}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="mosaic-wrap"
      style={{ height: "clamp(320px, 50vh, 600px)" }}
      aria-hidden="true"
    >
      <div className="mosaic-scroller">
        {/* Copy 1 */}
        <div className="mosaic-grid">
          {tiles.map((tile, i) => renderTile(tile, i, "a"))}
        </div>
        {/* Copy 2 — seamless loop */}
        <div className="mosaic-grid">
          {tiles.map((tile, i) => renderTile(tile, i + tiles.length, "b"))}
        </div>
      </div>
    </div>
  );
}
