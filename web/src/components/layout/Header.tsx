"use client";


const navItems = [
  { href: "#finding-01", num: "1.", label: "Their Names" },
  { href: "#finding-02", num: "2.", label: "Their Aesthetic" },
  { href: "#finding-03", num: "3.", label: "Conclusion" },
  { href: "#agent-methodology", num: "4.", label: "Agent Methodology" },
  { href: "#aesthetic-methodology", num: "5.", label: "Aesthetic Methodology" },
  { href: "#appendix", num: "6.", label: "Appendix" },
  { href: "#contact", num: "7.", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-[0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 items-center" style={{ maxWidth: "var(--grid-max-width)", paddingRight: "var(--grid-margin)" }}>
        {/* WHERE THEY LIVE — sits in the left margin, right border aligns with content edge */}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex shrink-0 items-center border-r border-black whitespace-pre font-black uppercase leading-[1.1] text-foreground transition-colors hover:text-[#B87333]"
          style={{
            fontFamily: "futura-pt, sans-serif",
            fontSize: "clamp(9px, 1.1vw, 14px)",
            fontWeight: 800,
            width: "var(--grid-margin)",
            paddingRight: "clamp(4px, 0.8vw, 16px)",
            justifyContent: "flex-end",
            textAlign: "right",
          }}
        >
          {"Where\nThey\nLive"}
        </a>

        {/* Nav items — plain <a> tags for same-page hash links.
            Next.js <Link> would trigger a full soft navigation + server
            component re-render on every click. Native anchors scroll instantly. */}
        <nav
          className="flex flex-1 items-center justify-between font-bold"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "clamp(7px, 0.95vw, 13px)",
            gap: "clamp(4px, 0.8vw, 16px)",
            paddingLeft: "clamp(4px, 0.8vw, 16px)",
          }}
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex flex-col items-center text-center leading-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{item.num}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
