import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  className?: string;
}

export function StatCard({ label, value, sublabel, className = "" }: StatCardProps) {
  return (
    <Card className={`border-border ${className}`}>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-tight">
          {value}
        </p>
        {sublabel && (
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
