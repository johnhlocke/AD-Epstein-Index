"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 items-center justify-center" style={{ maxWidth: "var(--grid-max-width)", paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}>
        <nav className="flex items-center gap-8 text-[11px] font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>
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
