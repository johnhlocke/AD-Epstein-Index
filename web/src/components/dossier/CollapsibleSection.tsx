"use client";

import { useState } from "react";

export function CollapsibleSection({
  label,
  title,
  titleBg,
  marginTop = "128px",
  children,
}: {
  label: string;
  title: string;
  titleBg: string;
  marginTop?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginTop }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          fontFamily: "'Lora', serif",
          color: "#1A1A1A",
          lineHeight: 1.4,
        }}
      >
        <span
          style={{
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {label}
          <span
            style={{
              fontFamily: "futura-pt, sans-serif",
              fontSize: "48px",
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {open ? "\u2212" : "+"}
          </span>
        </span>
        <span
          style={{
            fontSize: "18px",
            fontWeight: 700,
            backgroundColor: "#000",
            color: titleBg,
            padding: "6px 8px",
            display: "block",
            marginTop: "-8px",
          }}
        >
          {title}
        </span>
      </button>
      {open && children}
    </div>
  );
}
