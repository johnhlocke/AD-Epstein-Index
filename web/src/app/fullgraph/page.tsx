import type { Metadata } from "next";
import { ConnectionExplorer } from "@/components/graph/ConnectionExplorer";

export const metadata: Metadata = {
  title: "Knowledge Graph | Where They Live",
  description:
    "Interactive knowledge graph exploring connections between AD-featured homeowners, designers, locations, and Epstein records.",
};

export default function FullGraphPage() {
  return (
    <main className="h-screen bg-background">
      <ConnectionExplorer navOffset={0} />
    </main>
  );
}
