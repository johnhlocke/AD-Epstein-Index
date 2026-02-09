"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EvidenceSectionProps {
  title: string;
  data: Record<string, unknown> | null;
  defaultOpen?: boolean;
}

export function EvidenceSection({ title, data, defaultOpen = false }: EvidenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!data) return null;

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
            {Object.entries(data).map(([key, value]) => {
              if (value === null || value === undefined) return null;
              const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
