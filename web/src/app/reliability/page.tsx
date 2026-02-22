import { ReliabilityAppendix } from "./ReliabilityAppendix";

export const metadata = {
  title: "Scoring Reliability Appendix — Where They Live",
  description:
    "Full test-retest results for 100 AD homes scored three independent times across nine aesthetic axes.",
};

export default function ReliabilityPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#1B1815" }}>
      <ReliabilityAppendix />
    </main>
  );
}
