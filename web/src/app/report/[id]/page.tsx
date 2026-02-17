import { notFound } from "next/navigation";
import { getFeatureReport } from "@/lib/queries";
import { ReportDetail } from "@/components/report/ReportDetail";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const report = await getFeatureReport(Number(id));

  if (!report) {
    return { title: "Feature Not Found" };
  }

  const name = report.dossier?.subject_name ?? report.feature.homeowner_name ?? "Unknown";
  const label = report.dossier ? "Dossier" : "Feature Report";

  return {
    title: `${name} — ${label} — AD-Epstein Index`,
    description: `${label} for ${name}, featured in Architectural Digest.`,
  };
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const report = await getFeatureReport(Number(id));

  if (!report) {
    notFound();
  }

  return <ReportDetail report={report} />;
}
