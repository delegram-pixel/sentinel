import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ClerkSetupNotice } from "@/components/auth/clerk-setup-notice";
import { isClerkConfigured } from "@/config/clerk";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return <ClerkSetupNotice />;
  }

  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-strong">
          Loading sign-in form…
        </p>
      }
    >
      <SignIn />
    </Suspense>
  );
}
