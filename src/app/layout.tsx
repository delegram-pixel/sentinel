import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";

import { getClerkPublishableKey, isClerkConfigured } from "@/config/clerk";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sentinel Research",
    template: "%s · Sentinel Research",
  },
  description:
    "A security research workspace for scoped investigations, evidence-backed findings, and human-verified conclusions.",
  applicationName: "Sentinel Research",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkConfigured = isClerkConfigured();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif.variable}`}
    >
      <body>
        {clerkConfigured ? (
          <ClerkProvider
            publishableKey={getClerkPublishableKey()}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            appearance={{
              variables: {
                colorPrimary: "var(--primary)",
                colorBackground: "var(--surface-elevated)",
                colorForeground: "var(--foreground)",
                colorMutedForeground: "var(--text-secondary)",
                colorInput: "var(--surface-elevated)",
                colorInputForeground: "var(--foreground)",
                fontFamily: "var(--font-sans)",
                borderRadius: "0.25rem",
              },
              elements: {
                cardBox: "shadow-none",
                card: "border border-border shadow-none",
                headerTitle: "font-display font-normal",
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
        <Toaster theme="light" position="bottom-right" closeButton />
        <Analytics />
      </body>
    </html>
  );
}
