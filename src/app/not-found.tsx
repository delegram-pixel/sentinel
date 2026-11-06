import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section
      aria-label="Page unavailable"
      className="mx-auto flex min-h-[65dvh] max-w-2xl flex-col justify-center gap-6 px-5 py-12"
    >
      <p className="font-mono text-xs text-text-secondary">404</p>
      <PageHeader
        title="This page is unavailable"
        description="The address may be incorrect, or this research record may not be available in your workspace."
      />
      <Button asChild variant="outline" className="self-start">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </section>
  );
}
