import Link from "next/link";

import { Disclosure } from "@/components/shared/disclosure";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

/** Honest configuration state. Research data remains protected. */
export function ClerkSetupNotice() {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-2xl flex-col justify-center gap-8 px-5 py-12">
      <PageHeader
        title="Authentication is not configured"
        description="Sign-in is unavailable in this environment. Authentication must be configured before you can open research records."
      />
      <Disclosure title="Local setup details">
        <p className="text-sm leading-relaxed text-text-secondary">
          Configure the Clerk publishable key and secret key in{" "}
          <code className="font-mono text-xs">.env.local</code>. The webhook signing secret enables
          background profile synchronization.
        </p>
        <ul className="mt-4 flex flex-col gap-2 font-mono text-xs text-text-secondary">
          <li>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</li>
          <li>CLERK_SECRET_KEY</li>
          <li>CLERK_WEBHOOK_SIGNING_SECRET</li>
        </ul>
      </Disclosure>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Return to Sentinel Research</Link>
      </Button>
    </div>
  );
}
