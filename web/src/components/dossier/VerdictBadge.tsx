import { Badge } from "@/components/ui/badge";

const verdictStyles = {
  CONFIRMED: "bg-confirmed-bg text-confirmed border-confirmed/20",
  REJECTED: "bg-rejected-bg text-rejected border-rejected/20",
  PENDING_REVIEW: "bg-pending-bg text-pending border-pending/20",
} as const;

const verdictLabels = {
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  PENDING_REVIEW: "Pending Review",
} as const;

interface VerdictBadgeProps {
  verdict: "CONFIRMED" | "REJECTED" | "PENDING_REVIEW";
  size?: "sm" | "lg";
}

export function VerdictBadge({ verdict, size = "sm" }: VerdictBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${verdictStyles[verdict]} ${
        size === "lg" ? "px-3 py-1 text-sm" : "text-xs"
      }`}
    >
      {verdictLabels[verdict]}
    </Badge>
  );
}
