"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/#finding-01", label: "1. Their Names" },
  { href: "/#finding-02", label: "2. Their Aesthetic" },
  { href: "/#finding-03", label: "3. Conclusion" },
  { href: "/#agent-methodology", label: "4. Agent Methodology" },
  { href: "/#aesthetic-methodology", label: "5. Aesthetic Methodology" },
  { href: "/#appendix", label: "6. Appendix" },
  { href: "/#contact", label: "7. Contact" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-[0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 items-center" style={{ maxWidth: "var(--grid-max-width)", paddingRight: "var(--grid-margin)" }}>
        {/* WHERE THEY LIVE — sits in the left margin, right border aligns with content edge */}
        <Link
          href="/"
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
        </Link>

        {/* Nav items — fill the content area */}
        <nav
          className="flex flex-1 items-center justify-between whitespace-nowrap font-bold"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "clamp(7px, 0.95vw, 13px)",
            gap: "clamp(4px, 0.8vw, 16px)",
            paddingLeft: "clamp(4px, 0.8vw, 16px)",
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors hover:text-foreground ${
                pathname === item.href
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
