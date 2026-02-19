"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { VerdictBadge } from "@/components/dossier/VerdictBadge";
import { EvidenceSection } from "@/components/dossier/EvidenceSection";
import { DossierAestheticRadar } from "@/components/dossier/DossierAestheticRadar";
import type { FeatureReport } from "@/lib/types";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ReportDetailProps {
  report: FeatureReport;
}

function DesignStyleCard({ style }: { style: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = style.length > 60;

  return (
    <Card className="overflow-hidden gap-0" style={{ height: expanded ? "auto" : 108, paddingTop: 0, paddingBottom: 0 }}>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">Design Style</p>
        <p className={`mt-1 font-semibold ${!expanded && needsTruncation ? "line-clamp-2" : ""}`}>
          {style}
        </p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportDetail({ report }: ReportDetailProps) {
  const { feature, issue, images, dossier } = report;
  const hasDossier = dossier !== null;

  const issueDateStr = issue
    ? `${issue.month ? MONTH_NAMES[issue.month] + " " : ""}${issue.year}`
    : "Unknown issue";

  const displayName = dossier?.subject_name ?? feature.homeowner_name ?? "Unknown";

  // Build location string
  const locationParts = [feature.location_city, feature.location_state, feature.location_country].filter(Boolean);
  const locationStr = locationParts.join(", ");

  return (
    <SectionContainer width="narrow" className="py-12">
      <Link
        href="/#index"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Index
      </Link>

      {/* Header */}
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {hasDossier ? "Dossier" : "Feature Report"}
          </p>
          <h1 className="mt-1 font-serif text-4xl font-bold">{displayName}</h1>
          <p className="mt-2 text-muted-foreground">
            Featured in <em>Architectural Digest</em>, {issueDateStr}
          </p>
        </div>
        {hasDossier && (
          <VerdictBadge verdict={dossier.editor_verdict} size="lg" />
        )}
      </div>

      {/* Quick stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {locationStr && (
          <Card className="overflow-hidden gap-0" style={{ height: 130, paddingTop: 0, paddingBottom: 12 }}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="mt-1 font-semibold">{locationStr}</p>
            </CardContent>
          </Card>
        )}
        {feature.designer_name && (
          <Card className="overflow-hidden gap-0" style={{ height: 130, paddingTop: 0, paddingBottom: 12 }}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Designer</p>
              <p className="mt-1 font-semibold">{feature.designer_name}</p>
            </CardContent>
          </Card>
        )}
        {(feature.year_built || feature.square_footage) && (
          <Card className="overflow-hidden gap-0" style={{ height: 130, paddingTop: 0, paddingBottom: 12 }}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Property</p>
              {feature.year_built && (
                <p className="mt-1 font-mono font-semibold">{feature.year_built}</p>
              )}
              {feature.square_footage && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{feature.square_footage.toLocaleString()}</span> sq ft
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {feature.cost && (
          <Card className="overflow-hidden gap-0" style={{ height: 130, paddingTop: 0, paddingBottom: 12 }}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className="mt-1 font-mono font-semibold">{feature.cost}</p>
            </CardContent>
          </Card>
        )}
        {/* Design style card — disabled for now
        {feature.design_style && (
          <DesignStyleCard style={feature.design_style} />
        )}
        */}
        {hasDossier && (dossier.connection_strength || dossier.confidence_score !== null) ? (
          <Card
            className="overflow-hidden gap-0 border-red-300"
            style={{
              height: 130,
              paddingTop: 0,
              paddingBottom: 12,
              backgroundColor: `rgba(239, 68, 68, ${0.15 + (dossier.confidence_score ?? 0) * 0.55})`,
            }}
          >
            <CardContent className="p-3">
              <p className="text-xs text-red-900/70">Connection</p>
              {dossier.connection_strength && (
                <p className="mt-1 font-mono font-semibold text-red-950">{dossier.connection_strength}</p>
              )}
              {dossier.confidence_score !== null && (
                <p className="mt-1 text-xs text-red-900/70">
                  Confidence: <span className="font-mono font-semibold text-red-950">{Math.round(dossier.confidence_score * 100)}%</span>
                </p>
              )}
            </CardContent>
          </Card>
        ) : (() => {
          const investigated = hasDossier && dossier.editor_verdict === "REJECTED";
          const conf = investigated ? 95 : 40;
          return (
            <Card
              className="overflow-hidden gap-0 border-green-200"
              style={{
                height: 130,
                paddingTop: 0,
                paddingBottom: 12,
                backgroundColor: `rgba(134, 176, 134, ${investigated ? 0.25 : 0.12})`,
              }}
            >
              <CardContent className="p-3">
                <p className="text-xs text-green-900/70">Connection</p>
                <p className="mt-1 font-mono font-semibold text-green-950">None</p>
                <p className="mt-1 text-xs text-green-900/70">
                  Confidence: <span className="font-mono font-semibold text-green-950">{conf}%</span>
                </p>
                {!investigated && (
                  <p className="mt-1 text-[10px] italic text-green-900/50">Not yet investigated</p>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Article title */}
      {feature.article_title && (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="font-serif text-lg font-semibold">
              &ldquo;{feature.article_title}&rdquo;
            </h2>
            {feature.article_author && (
              <p className="mt-1 text-sm text-muted-foreground">
                By {feature.article_author}
              </p>
            )}
          </div>
        </>
      )}

      {/* Editor review — only if dossier exists */}
      {hasDossier && dossier.editor_reasoning && (
        <>
          <Separator className="my-8" />
          <div className="rounded-lg border border-border bg-muted/50 p-6">
            <h2 className="font-serif text-lg font-semibold">Editor&rsquo;s Review</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {dossier.editor_reasoning}
            </p>
            {dossier.editor_reviewed_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reviewed: {new Date(dossier.editor_reviewed_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </>
      )}

      {/* Aesthetic profile — works for all features with scores */}
      <Separator className="my-8" />
      <DossierAestheticRadar feature={feature} />

      {/* Evidence sections — only if dossier exists */}
      {hasDossier && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4 font-serif text-2xl font-bold">Evidence</h2>
          <div className="space-y-4">
            <EvidenceSection
              title="AD Appearance"
              data={dossier.ad_appearance}
              defaultOpen
            />
            <EvidenceSection
              title="Epstein Connections"
              data={dossier.epstein_connections}
              defaultOpen
            />
            <EvidenceSection title="Home Analysis" data={dossier.home_analysis} />
            <EvidenceSection title="Pattern Analysis" data={dossier.pattern_analysis} />
            <EvidenceSection title="Key Findings" data={dossier.key_findings} />
            <EvidenceSection title="Visual Analysis" data={dossier.visual_analysis} />
          </div>
        </>
      )}

      {/* Article images */}
      {images.length > 0 && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4 font-serif text-2xl font-bold">Article Pages</h2>
          <div className="grid grid-cols-2 gap-4">
            {images.map((img) => (
              <div key={img.id} className="overflow-hidden rounded-lg border border-border">
                {img.public_url && (
                  <Image
                    src={img.public_url}
                    alt={`Article page ${img.page_number ?? ""}`}
                    width={600}
                    height={800}
                    className="w-full object-cover"
                  />
                )}
                {img.page_number && (
                  <p className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    Page {img.page_number}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Connection assessment — only if dossier exists */}
      {hasDossier && dossier.strength_rationale && (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="font-serif text-lg font-semibold">Connection Assessment</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {dossier.strength_rationale}
            </p>
          </div>
        </>
      )}
    </SectionContainer>
  );
}
