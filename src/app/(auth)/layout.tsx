import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-20 items-center border-b border-border px-5 sm:px-8 lg:px-12">
        <Link href="/" className="text-base font-medium tracking-tight">
          Sentinel <span className="font-normal text-text-secondary">Research</span>
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div className="max-w-sm">
          <p className="font-display text-4xl leading-tight font-normal tracking-tight">
            A clear record of your research.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-text-secondary">
            Sign in to pick up your projects, revisit investigation notes, and keep the research
            moving.
          </p>
        </div>
        <div className="min-w-0">{children}</div>
      </main>
      <footer className="border-t border-border px-5 py-5 text-xs text-text-secondary sm:px-8 lg:px-12">
        You record and attest to your testing permission. A human reviewer checks research
        conclusions.
      </footer>
    </div>
  );
}
