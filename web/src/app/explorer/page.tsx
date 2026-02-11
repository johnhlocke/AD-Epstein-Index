import type { Metadata } from "next";
import { ConnectionExplorer } from "@/components/graph/ConnectionExplorer";

export const metadata: Metadata = {
  title: "Connection Explorer | AD-Epstein Index",
  description:
    "Interactive knowledge graph exploring connections between AD-featured homeowners, designers, locations, and Epstein records.",
};

export default function ExplorerPage() {
  return <ConnectionExplorer />;
}
