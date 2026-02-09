import { notFound } from "next/navigation";
import { getDossier } from "@/lib/queries";
import { DossierDetail } from "@/components/dossier/DossierDetail";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const dossier = await getDossier(Number(id));

  if (!dossier) {
    return { title: "Dossier Not Found" };
  }

  return {
    title: `${dossier.subject_name} — AD-Epstein Index`,
    description: `Investigation dossier for ${dossier.subject_name}, featured in Architectural Digest.`,
  };
}

export default async function DossierPage({ params }: PageProps) {
  const { id } = await params;
  const dossier = await getDossier(Number(id));

  if (!dossier) {
    notFound();
  }

  return <DossierDetail dossier={dossier} />;
}
