import { clerkSetup } from "@clerk/testing/playwright";

export default async function globalSetup(): Promise<void> {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) return;

  if (!publishableKey.startsWith("pk_test_") || !secretKey.startsWith("sk_test_")) {
    throw new Error("End-to-end tests require Clerk development keys (ADR-021).");
  }

  await clerkSetup({ publishableKey, secretKey, dotenv: false });
}
