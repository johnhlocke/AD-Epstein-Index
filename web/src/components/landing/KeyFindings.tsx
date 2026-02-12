import type { StatsResponse } from "@/lib/types";

interface KeyFindingsProps {
  stats: StatsResponse;
}

export function KeyFindings({ stats }: KeyFindingsProps) {
  const coveragePercent = Math.round(
    ((stats.issues.extracted + stats.issues.downloaded) / stats.issues.target) *
      100
  );

  return (
    <section className="bg-[#1A1A1A] py-20" id="findings">
      <div className="mx-auto w-full" style={{ maxWidth: "var(--grid-max-width)", paddingLeft: "var(--grid-margin)", paddingRight: "var(--grid-margin)" }}>
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold text-white">
              Key Findings
            </h2>
            <p className="mt-2 text-sm text-white/40">
              Current progress across all phases of the investigation.
            </p>
          </div>
          <span className="hidden text-xs text-white/20 md:block">
            Live from pipeline
          </span>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Bucket 1: Pipeline Progress */}
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-8">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-copper">
              Pipeline
            </span>
            <p className="mt-3 font-mono text-5xl font-bold tracking-tight text-white">
              {coveragePercent}%
            </p>
            <p className="mt-1 text-sm text-white/40">
              {stats.issues.extracted} of {stats.issues.target} issues extracted
            </p>
            <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-copper transition-all duration-700"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-white/30">
              <span>{stats.issues.downloaded} downloaded</span>
              <span>{stats.issues.discovered} discovered</span>
            </div>
          </div>

          {/* Bucket 2: Investigation Status */}
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-8">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-copper">
              Investigation
            </span>
            <p className="mt-3 font-mono text-5xl font-bold tracking-tight text-white">
              {stats.dossiers.total}
            </p>
            <p className="mt-1 text-sm text-white/40">Dossiers built</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {stats.dossiers.confirmed > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2D6A4F]/20 px-3 py-1 text-xs font-medium text-[#7DDBA3]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7DDBA3]" />
                  {stats.dossiers.confirmed} confirmed
                </span>
              )}
              {stats.dossiers.pending > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B8860B]/20 px-3 py-1 text-xs font-medium text-[#FFD666]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FFD666]" />
                  {stats.dossiers.pending} pending
                </span>
              )}
              {stats.dossiers.rejected > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#9B2226]/20 px-3 py-1 text-xs font-medium text-[#FF9B9B]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FF9B9B]" />
                  {stats.dossiers.rejected} rejected
                </span>
              )}
            </div>
          </div>

          {/* Bucket 3: Archive Stats */}
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-8">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-copper">
              Archive
            </span>
            <p className="mt-3 font-mono text-5xl font-bold tracking-tight text-white">
              {stats.features.total}
            </p>
            <p className="mt-1 text-sm text-white/40">Homes cataloged</p>
            <div className="mt-6 space-y-3">
              <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-2">
                <span className="text-sm text-white/40">Named homeowners</span>
                <span className="font-mono text-sm font-medium text-white">
                  {stats.features.withHomeowner}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-2">
                <span className="text-sm text-white/40">Design styles</span>
                <span className="font-mono text-sm font-medium text-white">
                  {stats.features.topStyles.length}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/40">Locations tracked</span>
                <span className="font-mono text-sm font-medium text-white">
                  {stats.features.topLocations.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
