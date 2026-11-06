import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ClerkSetupNotice } from "@/components/auth/clerk-setup-notice";
import { isClerkConfigured } from "@/config/clerk";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return <ClerkSetupNotice />;
  }

  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-strong">
          Loading sign-up form…
        </p>
      }
    >
      <SignUp />
    </Suspense>
  );
}
