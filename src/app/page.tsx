import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const RECORD_PARTS = [
  {
    title: "Research context",
    description:
      "Start with the project, the asset you're exploring, and your permission to research it.",
  },
  {
    title: "Observations",
    description: "Save what you saw, where it came from, and how confident you are about it.",
  },
  {
    title: "Hypotheses",
    description: "Explore what the clues might mean and what evidence would help you decide.",
  },
  {
    title: "Human review",
    description:
      "Have a human reviewer check the evidence and decide whether the suspected issue is a finding.",
  },
];
const PRINCIPLES = [
  {
    title: "Scope gives research its boundaries",
    body: "Record which assets and activities are allowed, and when permission applies. You explicitly attest to that permission before using the scope.",
  },
  {
    title: "Keep the reasoning traceable",
    body: "Connect what you saw to what you suspect. Keep supporting and conflicting evidence, open questions, and the next step together.",
  },
  {
    title: "Use AI with a clear point of view",
    body: "Ask AI about your saved research or run a focused analysis. Review its suggestions against the evidence before making a human decision.",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-20 items-center justify-between gap-6 border-b border-border">
          <Link href="/" className="text-base font-medium tracking-tight">
            Sentinel <span className="font-normal text-text-secondary">Research</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </header>
        <section className="grid items-start gap-12 py-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-20 lg:py-24">
          <div>
            <h1 className="max-w-2xl font-display text-5xl leading-[1.08] font-normal tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Evidence, not assertions.
            </h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-text-secondary">
              Give your security research a place to come together. Record your permission, follow
              the clues, and keep the evidence and open questions close so you can explain what you
              found.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">Open the workspace</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <a href="#principles">Read the principles</a>
              </Button>
            </div>
          </div>
          <div className="min-w-0 lg:pt-2">
            <h2 className="max-w-sm font-display text-3xl leading-tight font-normal tracking-tight">
              A continuous research record.
            </h2>
            <dl className="mt-7">
              {RECORD_PARTS.map((part) => (
                <div
                  key={part.title}
                  className="grid gap-2 border-t border-border py-4 sm:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[9rem_minmax(0,1fr)]"
                >
                  <dt className="text-sm font-medium">{part.title}</dt>
                  <dd className="text-sm leading-relaxed text-text-secondary">
                    {part.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <section id="principles" className="scroll-mt-8 pb-16">
          <Separator className="mb-8" />
          <div className="grid gap-8 sm:grid-cols-3 lg:gap-12">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <h2 className="max-w-xs text-base leading-relaxed font-medium">
                  {principle.title}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
                  {principle.body}
                </p>
              </div>
            ))}
          </div>
        </section>
        <footer className="mt-auto flex flex-col justify-between gap-3 border-t border-border py-6 text-xs text-text-secondary sm:flex-row">
          <p>Sentinel Research</p>
          <p>Structured security research</p>
        </footer>
      </div>
    </main>
  );
}
