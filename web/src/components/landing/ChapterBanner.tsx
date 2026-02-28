/**
 * Chapter Banner — copper filled bar with oversized chapter number,
 * title, and sidenote-column-aligned summary. Creates an unmistakable
 * structural break between major sections. — Sable
 */

interface ChapterBannerProps {
  id?: string;
  num: string;
  title: string;
  summary?: string;
}

export function ChapterBanner({ id, num, title, summary }: ChapterBannerProps) {
  return (
    <div
      id={id}
      className="relative z-20 mt-20 bg-background"
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        {/* Copper bar — grid-aligned interior */}
        <div
          style={{
            backgroundColor: "#B87333",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            padding: "0 28px",
            minHeight: "96px",
          }}
        >
          {/* Left: oversized chapter number */}
          <span
            className="select-none text-white"
            style={{
              fontFamily: "futura-pt, sans-serif",
              fontSize: "clamp(80px, 10vw, 120px)",
              fontWeight: 900,
              lineHeight: 1,
              marginRight: "24px",
            }}
          >
            {num}
          </span>

          {/* Center: title — vertically centered in bar */}
          <h2
            className="text-[26px] font-black uppercase leading-[1.1] tracking-[0.04em] text-white sm:text-[32px] md:text-[38px]"
            style={{ fontFamily: "futura-pt, sans-serif" }}
          >
            {title}
          </h2>

          {/* Right: summary — monospace, left-aligned narrative */}
          {summary && (
            <p
              className="hidden text-left text-[10px] leading-[1.6] text-white/60 md:block"
              style={{
                fontFamily: "var(--font-jetbrains-mono), monospace",
                maxWidth: "280px",
                marginLeft: "var(--grid-gutter)",
              }}
            >
              {summary}
            </p>
          )}
        </div>
      </div>

      {/* Tight spacing below banner — subsection padding handles the rest — Sable */}
      <div style={{ height: "12px" }} />
    </div>
  );
}
