import { Suspense } from "react";
import { SearchableIndex } from "@/components/landing/SearchableIndex";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default function FullIndexPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense
        fallback={
          <div
            className="pb-20 pt-10"
            style={{
              paddingLeft: "var(--grid-margin)",
              paddingRight: "var(--grid-margin)",
            }}
          >
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <SearchableIndex pageSize={25} defaultConfirmedOnly={false} />
      </Suspense>
    </main>
  );
}
