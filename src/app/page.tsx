import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const RECORD_PARTS = [
  {
    title: "Research context",
    description: "The project, target, and authorization that define the work.",
  },
  { title: "Observations", description: "What you saw, with a source and confidence recorded." },
  {
    title: "Hypotheses",
    description: "What the observations might mean, and what is still missing.",
  },
  {
    title: "Human review",
    description: "The decisions that turn a suspected issue into a finding.",
  },
];
const PRINCIPLES = [
  {
    title: "Scope gives research its boundaries",
    body: "Record the assets, permitted activities, and effective window. Authorization remains an explicit human attestation.",
  },
  {
    title: "Keep the reasoning traceable",
    body: "Connect observations to hypotheses. Record supporting and contradicting information, open questions, and the next step.",
  },
  {
    title: "Use AI with a clear point of view",
    body: "Ask contextual questions or run a bounded analysis. AI-generated interpretations remain distinct from your research and human decisions.",
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
              A focused workspace for professional security research. Keep what was authorized, what
              was observed, and what still needs verification in one clear research record.
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
