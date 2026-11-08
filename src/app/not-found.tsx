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
        description="We can't find this page in your workspace. Check the address, or head back to the dashboard to choose a record you can open."
      />
      <Button asChild variant="outline" className="self-start">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </section>
  );
}
