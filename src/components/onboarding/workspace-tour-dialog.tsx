"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  FileCheck2,
  FolderOpen,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DismissWorkspaceTourResult } from "@/modules/auth/domain/workspace-tour";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { ResearchRoutePreview } from "@/components/onboarding/research-route-preview";

const STEPS = [
  {
    label: "Welcome",
    title: "Your research starts here.",
    description:
      "Welcome to Sentinel. Let's give your research a home, follow the clues, and build findings you can explain with confidence.",
    icon: Compass,
    location: "Workspace → Dashboard",
    points: [
      "Start a project, add your targets, and set clear testing boundaries.",
      "Follow a question in an investigation, keeping observations, ideas, and evidence together.",
      "Review the findings, write them up, and keep track of what happens next.",
    ],
    note: "This tour is short. Skip whenever you like and replay it from Settings. There won't be a quiz.",
    example:
      "Try a lab project with one target and one question. Record your observations, connect the evidence, then write up the finding once a human reviewer has verified it.",
    outcome: "You'll be able to follow your work from the first question to the final outcome.",
  },
  {
    label: "Projects & scope",
    title: "Start with a clear boundary.",
    description:
      "Create a project to keep related work together. Add a target and record your permission, then define its scope before testing. You can start an investigation to take notes along the way.",
    icon: FolderOpen,
    location: "Workspace → Projects · Research → Targets",
    points: [
      "Give your lab, assessment, or research programme its own project.",
      "Add targets, then activate an approved scope covering the allowed assets, activities, and dates.",
      "Use an engagement to give a round of work a shared objective.",
    ],
    note: "The active scope defines what you can do. Creating an engagement or finishing this tour doesn't grant permission.",
    example:
      "Create a Learning lab project and add lab.example.test. Record where your permission comes from, then set allowed assets, exclusions, activities, and dates. Save and review the scope draft, then activate it before testing.",
    outcome:
      "You'll have a project, a target, and clear boundaries for the work you're allowed to do.",
  },
  {
    label: "Investigations",
    title: "Follow the question.",
    description:
      "An investigation is where you work through a question. Save what you saw, describe what it might mean, and leave yourself a useful next step.",
    icon: Search,
    location: "Workspace → Investigations",
    points: [
      "Keep what you saw, what you suspect, and what you decided in one place.",
      "Ask a focused question in Guided mode, or use Delegated mode for a staged review of saved material.",
      "Check the AI's sources and reasoning before bringing a suggestion into your research.",
    ],
    note: "AI helps you reason about saved material. It doesn't test targets on its own, and a human reviewer still needs to confirm findings.",
    example:
      "Ask whether a saved response exposes another account's profile. Record the observation, your possible explanation, and what could prove or rule it out. Try a Guided question or Delegated analysis, then check the result's sources and task history.",
    outcome:
      "You'll have a focused question, a record of how you explored it, and suggestions you can check.",
  },
  {
    label: "Evidence",
    title: "Keep the source with the claim.",
    description:
      "Help someone else follow the clues. Save supporting material in the investigation and link approved evidence to the findings it supports or challenges.",
    icon: FileCheck2,
    location: "Research → Evidence · Tool imports",
    points: [
      "Note where each piece of evidence came from and how you collected it.",
      "Check and redact sensitive content before evidence approval or AI-safe review.",
      "Bring in tool exports, then check the results before adopting them as research drafts.",
    ],
    note: "Treat imported results as leads. Keep their source details and verify the claims before relying on them.",
    example:
      "Upload a redacted response capture with its source, date, and collection method. Check upload validation, complete the human evidence review, and separately review whether it's safe for AI. Then link approved evidence as support, contradiction, or context. Tool exports go in Tool imports.",
    outcome:
      "You'll have evidence someone can trace back to its source, with clear review status and links to your claims.",
  },
  {
    label: "Verification",
    title: "Make the finding defensible.",
    description:
      "Explain the issue, identify the affected asset, and show the supporting evidence. A human reviewer checks whether the claim is ready to stand on its own.",
    icon: ShieldCheck,
    location: "Research → Findings",
    points: [
      "Say who's affected, what can happen, and why you've chosen that severity.",
      "Link approved evidence and explain how it supports your conclusion.",
      "Ask AI to challenge your assumptions, then have a human reviewer verify the finding.",
    ],
    note: "Check both the finding's status and its evidence approval before adding the claim to a report.",
    example:
      "Start a draft with the affected endpoint and demonstrated impact. Link approved evidence and explain the severity. A human reviewer records the conclusion, including any conflicting or missing evidence. Once confirmed and ready, the finding can move into reporting.",
    outcome:
      "You'll have a finding a human has reviewed, with evidence behind its impact and severity.",
  },
  {
    label: "Reports & outcomes",
    title: "Share the work. Track what follows.",
    description:
      "Give the reviewed findings a clear write-up, track fixes and retests, and save what you learned for the next investigation.",
    icon: FileCheck2,
    location: "Research → Reports · Remediation & outcomes · Knowledge",
    points: [
      "Start your report with a template or an AI draft you can review.",
      "Get human approval before exporting, then record fixes and authorized manual retest outcomes.",
      "Save reviewed references and lessons in Knowledge. Future you will appreciate the shortcut.",
    ],
    note: "You're ready to explore. Create your first project now, or finish the tour and have a look around.",
    example:
      "Choose ready findings and a template, or review an AI report draft. Check the write-up and sources before human approval and export. Record the fix and an authorized manual retest with follow-up evidence. Save useful lessons in Knowledge and check Research insights for progress.",
    outcome:
      "You'll have a report you can share after approval, a record of the follow-up, and lessons ready for next time.",
  },
] as const;

type WorkspaceTourDialogProps = {
  onDismiss: () => Promise<DismissWorkspaceTourResult>;
  onCloseForNow: () => void;
  onCreateProject: () => void;
  onRestoreFocus: () => void;
};

export function WorkspaceTourDialog({
  onDismiss,
  onCloseForNow,
  onCreateProject,
  onRestoreFocus,
}: WorkspaceTourDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Guard fast repeated clicks/Escape before React commits the pending state.
  const saving = useRef(false);
  const step = STEPS[stepIndex] ?? STEPS[0];
  const Icon = step.icon;
  const lastStep = stepIndex === STEPS.length - 1;

  function changeStep(index: number) {
    if (body.current) body.current.scrollTop = 0;
    setStepIndex(index);
  }

  function dismiss(createProject = false) {
    if (saving.current) return;
    saving.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onDismiss();
        if (result.ok) {
          if (createProject) onCreateProject();
        } else {
          setError(result.message);
        }
      } catch {
        setError(
          "We couldn't save your tour preference. Try again or close it for now; the tour may reappear on your next visit.",
        );
      } finally {
        saving.current = false;
      }
    });
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/35" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-xl outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            nextButton.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (saving.current) event.preventDefault();
          }}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-text-secondary">
              <Compass className="size-4 text-primary" aria-hidden />
              Sentinel Research · Workspace tour
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Skip tour"
              disabled={pending}
              onClick={() => dismiss()}
            >
              <X aria-hidden />
            </Button>
          </div>
          <Separator />
          <div ref={body} className="flex min-h-0 flex-1 overflow-y-auto">
            <aside
              aria-label="Tour steps"
              className="hidden w-48 shrink-0 border-r border-border bg-surface px-5 py-7 md:block"
            >
              <p className="mb-6 text-xs text-text-secondary">A research workflow</p>
              <ol className="flex flex-col gap-5">
                {STEPS.map((item, index) => (
                  <li
                    key={item.label}
                    aria-current={index === stepIndex ? "step" : undefined}
                    className={cn(
                      "flex items-start gap-3 text-xs text-text-secondary",
                      index === stepIndex && "font-medium text-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px]",
                        index === stepIndex && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {index < stepIndex ? <Check className="size-3" aria-hidden /> : index + 1}
                    </span>
                    <span className="pt-0.5">{item.label}</span>
                  </li>
                ))}
              </ol>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col gap-6 px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex items-center justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-sm bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </div>
                <p className="text-xs text-text-secondary">
                  Step {stepIndex + 1} of {STEPS.length}
                </p>
              </div>
              <div className="sr-only" role="status">
                Step {stepIndex + 1} of {STEPS.length}: {step.title}
              </div>
              <div className="flex flex-col gap-3">
                <Dialog.Title className="font-display text-3xl leading-tight font-normal sm:text-[34px]">
                  {step.title}
                </Dialog.Title>
                <Dialog.Description className="text-sm leading-relaxed text-text-secondary">
                  {step.description}
                </Dialog.Description>
              </div>
              {stepIndex === 0 ? (
                <div className="flex flex-col gap-3 border-y border-border py-4">
                  <ResearchRoutePreview />
                  <p className="text-xs leading-relaxed text-text-secondary">
                    Lost your bearings? Open Workspace map at the top of the sidebar to see where
                    you are and jump to any section. On a small screen, open the menu first.
                  </p>
                </div>
              ) : null}
              <ul className="flex flex-col gap-3">
                {step.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[13px] leading-relaxed">
                    <Check className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 border-l-2 border-primary/40 bg-surface py-3 pr-3 pl-4">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-medium text-text-secondary">
                    Find it in navigation
                  </p>
                  <HelpTooltip
                    label="Finding your way"
                    description="Use the sidebar on a desktop, or open the menu in the header on a smaller screen. Tap a question mark beside a section whenever you want a quick pointer."
                    example="Choose Projects to start organizing work, or Settings to replay this tour later."
                  />
                </div>
                <p className="text-xs leading-relaxed">{step.location}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium">Example workflow</p>
                <p className="text-xs leading-relaxed text-text-secondary">{step.example}</p>
                <p className="text-xs leading-relaxed">
                  <span className="font-medium">You’ll have: </span>
                  {step.outcome}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-text-secondary">{step.note}</p>
              {lastStep ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  disabled={pending}
                  onClick={() => dismiss(true)}
                >
                  Create a project
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
          <Separator />
          {error ? (
            <Alert variant="destructive" className="mx-5 mt-3 sm:mx-7">
              <AlertDescription>{error}</AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={pending}
                onClick={onCloseForNow}
              >
                Close for now
              </Button>
            </Alert>
          ) : null}
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7"
            aria-busy={pending}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => dismiss()}
            >
              Skip tour
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={stepIndex === 0 || pending}
                onClick={() => changeStep(stepIndex - 1)}
              >
                <ArrowLeft data-icon="inline-start" aria-hidden />
                Back
              </Button>
              <Button
                ref={nextButton}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (lastStep) dismiss();
                  else changeStep(stepIndex + 1);
                }}
              >
                {pending
                  ? "Saving…"
                  : lastStep
                    ? "Finish tour"
                    : stepIndex === 0
                      ? "Start tour"
                      : "Next"}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
