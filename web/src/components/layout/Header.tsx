"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/#index", label: "Index" },
  { href: "/explorer", label: "Explorer" },
  { href: "/#methodology", label: "Methodology" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 items-center justify-between" style={{ maxWidth: "var(--grid-max-width)", paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-lg font-bold tracking-tight">
            AD-Epstein Index
          </span>
        </Link>
        {/* Nav — aligned to right 2 columns (400px = slices 5–6 at 1440px) */}
        <nav className="flex items-center gap-6 text-sm lg:w-[400px] lg:justify-end">
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
