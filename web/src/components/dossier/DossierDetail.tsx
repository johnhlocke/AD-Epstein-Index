import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SectionContainer } from "@/components/layout/SectionContainer";
import { VerdictBadge } from "./VerdictBadge";
import { EvidenceSection } from "./EvidenceSection";
import { DossierAestheticRadar } from "./DossierAestheticRadar";
import type { DossierWithContext } from "@/lib/types";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DossierDetailProps {
  dossier: DossierWithContext;
}

export function DossierDetail({ dossier }: DossierDetailProps) {
  const feature = dossier.feature;
  const issue = dossier.issue;

  const issueDateStr = issue
    ? `${issue.month ? MONTH_NAMES[issue.month] + " " : ""}${issue.year}`
    : "Unknown issue";

  return (
    <SectionContainer width="narrow" className="py-12">
      <Link
        href="/#verdicts"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Index
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-bold">{dossier.subject_name}</h1>
          <p className="mt-2 text-muted-foreground">
            Featured in <em>Architectural Digest</em>, {issueDateStr}
          </p>
        </div>
        <VerdictBadge verdict={dossier.editor_verdict} size="lg" />
      </div>

      {/* Quick stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {dossier.connection_strength && (
          <Card className="!h-[108px] !py-0 overflow-hidden gap-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Connection Strength</p>
              <p className="mt-1 font-mono font-semibold">{dossier.connection_strength}</p>
            </CardContent>
          </Card>
        )}
        {dossier.confidence_score !== null && (
          <Card className="!h-[108px] !py-0 overflow-hidden gap-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="mt-1 font-mono font-semibold">
                {Math.round(dossier.confidence_score * 100)}%
              </p>
            </CardContent>
          </Card>
        )}
        {feature?.location_city && (
          <Card className="!h-[108px] !py-0 overflow-hidden gap-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="mt-1 font-semibold">
                {[feature.location_city, feature.location_state].filter(Boolean).join(", ")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Editor review */}
      {dossier.editor_reasoning && (
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

      {/* Aesthetic profile */}
      {feature && (
        <>
          <Separator className="my-8" />
          <DossierAestheticRadar feature={feature} />
        </>
      )}

      {/* Evidence sections */}
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

      {/* Article images */}
      {dossier.images.length > 0 && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4 font-serif text-2xl font-bold">Article Pages</h2>
          <div className="grid grid-cols-2 gap-4">
            {dossier.images.map((img) => (
              <div key={img.id} className="overflow-hidden rounded-lg border border-border">
                {img.public_url && (
                  <Image
                    src={img.public_url}
                    alt={`Article page ${img.page_number}`}
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

      {/* Strength rationale */}
      {dossier.strength_rationale && (
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
