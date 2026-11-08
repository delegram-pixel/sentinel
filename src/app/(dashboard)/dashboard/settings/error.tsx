"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function SettingsError({ retry }: { retry: () => void }) {
  return (
    <div className="page-stack">
      <PageHeader title="Settings could not be loaded" />
      <Alert variant="destructive">
        <AlertDescription>
          We couldn&apos;t load your account and workspace details. Give it a moment, then try
          again.
        </AlertDescription>
      </Alert>
      <Button onClick={() => retry()} className="self-start">
        Try again
      </Button>
    </div>
  );
}
