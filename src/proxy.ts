import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/config/clerk";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

const clerkProxy = clerkMiddleware(
  async (auth, request) => {
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

/**
 * Next.js 16 proxy (formerly middleware). When Clerk is not configured the app
 * still builds and the authenticated layout shows a configuration notice; it
 * never falls back to an implicit identity.
 */
const proxy = isClerkConfigured() ? clerkProxy : () => NextResponse.next();

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and static assets unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Always run for Clerk's frontend API routes.
    "/__clerk/(.*)",
  ],
};
