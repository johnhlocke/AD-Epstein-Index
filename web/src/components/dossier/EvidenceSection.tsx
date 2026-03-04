"use client";

import { useState } from "react";

interface EvidenceSectionProps {
  title: string;
  data: Record<string, unknown> | unknown[] | null;
  defaultOpen?: boolean;
  pageBg?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  doj_library: "DOJ Library",
  black_book: "Black Book",
  flight_logs: "Flight Logs",
};

/** Feltron card styles */
const CARD = {
  backgroundColor: "#FAFAFA",
  borderColor: "#000",
  borderWidth: "1px",
  boxShadow: "4px 4px 0 0 #000",
} as const;

const CARD_HEADER = {
  borderBottom: "1px solid #000",
  backgroundColor: "#EDEDED",
} as const;

const LABEL: React.CSSProperties = {
  fontFamily: "futura-pt, sans-serif",
  fontSize: "9px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#000",
};

function isEvidenceItem(item: unknown): item is {
  source?: string;
  evidence?: string;
  context?: string;
  match_type?: string;
  document_urls?: string[];
} {
  return typeof item === "object" && item !== null && ("evidence" in item || "context" in item);
}

function extractFilename(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1] || url;
}

function EvidenceItem({ item }: { item: ReturnType<typeof isEvidenceItem extends (x: unknown) => x is infer T ? () => T : never> }) {
  const data = item as { source?: string; evidence?: string; context?: string; match_type?: string; document_urls?: string[] };
  const sourceLabel = SOURCE_LABELS[data.source || ""] || data.source || "Unknown";
  const urls = data.document_urls?.filter((u) => u && u.length > 0) || [];

  return (
    <div className="border-b border-[#E5E5E5] px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        <span
          className="inline-block border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]"
          style={{ fontFamily: "futura-pt, sans-serif", borderColor: "#000", color: "#000" }}
        >
          {sourceLabel}
        </span>
        {data.match_type && (
          <span
            className="inline-block px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]"
            style={{ fontFamily: "futura-pt, sans-serif", backgroundColor: "#EDEDED", color: "#666" }}
          >
            {data.match_type}
          </span>
        )}
      </div>
      {data.evidence && (
        <p className="mt-2 text-[14px] leading-[1.65]" style={{ fontFamily: "'Lora', serif", color: "#333" }}>
          {data.evidence}
        </p>
      )}
      {data.context && data.context !== data.evidence && (
        <p className="mt-2 text-[12px] leading-[1.6]" style={{ fontFamily: "'Lora', serif", color: "#999" }}>
          {data.context}
        </p>
      )}
      {urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-[#ccc] bg-[#EDEDED] px-2 py-1 font-mono text-[10px] text-[#666] transition-colors hover:border-[#000] hover:text-[#000]"
            >
              {extractFilename(url)}
              <span className="text-[9px]">{'\u2197'}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function EvidenceSection({ title, data, defaultOpen = false, pageBg }: EvidenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!data) return null;

  const isTopLevelArray = Array.isArray(data);
  const entries = isTopLevelArray ? [["items", data]] as [string, unknown][] : Object.entries(data);

  return (
    <div className="overflow-hidden border" style={{ ...CARD, ...(pageBg ? { backgroundColor: pageBg } : {}) }}>
      {/* Header bar — click to toggle */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-2"
        style={{ ...CARD_HEADER, ...(pageBg ? { backgroundColor: pageBg } : {}) }}
        onClick={() => setOpen(!open)}
      >
        <p style={LABEL}>{title}</p>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.1em]"
          style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}
        >
          {open ? "Collapse" : "Expand"}
        </span>
      </div>
      {open && (
        <div>
          {entries.map(([key, value]) => {
            if (value === null || value === undefined) return null;
            const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

            // Array of evidence-like objects
            if (Array.isArray(value) && value.length > 0 && isEvidenceItem(value[0])) {
              return (
                <div key={key}>
                  {!isTopLevelArray && (
                    <div className="border-b border-[#E5E5E5] bg-[#F5F5F5] px-4 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}>
                        {label}
                      </p>
                    </div>
                  )}
                  {value.map((item, i) => (
                    <EvidenceItem key={i} item={item} />
                  ))}
                </div>
              );
            }

            // Single evidence-like object
            if (typeof value === "object" && !Array.isArray(value) && isEvidenceItem(value)) {
              return (
                <div key={key}>
                  <div className="border-b border-[#E5E5E5] bg-[#F5F5F5] px-4 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}>
                      {label}
                    </p>
                  </div>
                  <EvidenceItem item={value} />
                </div>
              );
            }

            // Generic object fallback
            if (typeof value === "object" && !Array.isArray(value)) {
              return (
                <div key={key} className="border-b border-[#E5E5E5] px-4 py-4 last:border-b-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}>
                    {label}
                  </p>
                  <pre className="mt-2 overflow-x-auto bg-[#F5F5F5] p-3 font-mono text-[11px] text-[#666]">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              );
            }

            // Generic array fallback
            if (Array.isArray(value)) {
              return (
                <div key={key} className="border-b border-[#E5E5E5] px-4 py-4 last:border-b-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}>
                    {label}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {value.map((item, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-[1.6]" style={{ fontFamily: "'Lora', serif", color: "#333" }}>
                        <span className="shrink-0 font-mono text-[11px] text-[#999]">{String(i + 1).padStart(2, "0")}</span>
                        <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            return (
              <div key={key} className="border-b border-[#E5E5E5] px-4 py-4 last:border-b-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: "futura-pt, sans-serif", color: "#666" }}>
                  {label}
                </p>
                <p className="mt-1 text-[13px] leading-[1.6]" style={{ fontFamily: "'Lora', serif", color: "#333" }}>
                  {String(value)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
