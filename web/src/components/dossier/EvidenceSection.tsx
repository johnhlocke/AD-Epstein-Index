"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EvidenceSectionProps {
  title: string;
  data: Record<string, unknown> | unknown[] | null;
  defaultOpen?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  doj_library: "DOJ Library",
  black_book: "Black Book",
  flight_logs: "Flight Logs",
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
  // Safe cast since we already checked with isEvidenceItem
  const data = item as { source?: string; evidence?: string; context?: string; match_type?: string; document_urls?: string[] };
  const sourceLabel = SOURCE_LABELS[data.source || ""] || data.source || "Unknown";
  const urls = data.document_urls?.filter((u) => u && u.length > 0) || [];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{sourceLabel}</Badge>
        {data.match_type && (
          <Badge variant="secondary" className="text-xs">{data.match_type}</Badge>
        )}
      </div>
      {data.evidence && (
        <p className="mt-2 text-sm leading-relaxed text-foreground">{data.evidence}</p>
      )}
      {data.context && data.context !== data.evidence && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.context}</p>
      )}
      {urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              {extractFilename(url)}
              <span className="text-[10px]">&nearr;</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function EvidenceSection({ title, data, defaultOpen = false }: EvidenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!data) return null;

  // Handle top-level arrays (like epstein_connections)
  const isTopLevelArray = Array.isArray(data);
  const entries = isTopLevelArray ? [["items", data]] as [string, unknown][] : Object.entries(data);

  return (
    <Card className="border-border">
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            {open ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <div className="space-y-3 text-sm">
            {entries.map(([key, value]) => {
              if (value === null || value === undefined) return null;
              const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

              // Array of evidence-like objects
              if (Array.isArray(value) && value.length > 0 && isEvidenceItem(value[0])) {
                return (
                  <div key={key} className="space-y-3">
                    {!isTopLevelArray && <p className="font-medium text-foreground">{label}</p>}
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
                    <p className="font-medium text-foreground">{label}</p>
                    <EvidenceItem item={value} />
                  </div>
                );
              }

              // Generic object fallback
              if (typeof value === "object" && !Array.isArray(value)) {
                return (
                  <div key={key}>
                    <p className="font-medium text-foreground">{label}</p>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                );
              }

              // Generic array fallback
              if (Array.isArray(value)) {
                return (
                  <div key={key}>
                    <p className="font-medium text-foreground">{label}</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
                      {value.map((item, i) => (
                        <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                      ))}
                    </ul>
                  </div>
                );
              }

              return (
                <div key={key}>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-muted-foreground">{String(value)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
