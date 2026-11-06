"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <div className="page-stack">
      <PageHeader title="Research overview" />
      <Alert variant="destructive">
        <h2 className="mb-2 text-sm font-medium">Your workspace could not be loaded</h2>
        <AlertDescription>
          Your research overview is temporarily unavailable. Try loading it again.
        </AlertDescription>
        <Button className="mt-4" onClick={() => retry()}>
          Try again
        </Button>
      </Alert>
    </div>
  );
}
