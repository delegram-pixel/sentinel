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

const STEPS = [
  {
    label: "Welcome",
    title: "Your research starts here.",
    description:
      "Welcome to Sentinel Research. Turn observations into evidence, and evidence into findings you can stand behind.",
    icon: Compass,
    location: "Workspace → Dashboard",
    points: [
      "Plan your work in a project with clear targets and scope.",
      "Build an investigation from observations, hypotheses, and evidence.",
      "Review your findings, then prepare a report and track the outcome.",
    ],
    note: "This is a short tour. You can skip it at any time and replay it from Settings.",
    example:
      "A typical workflow starts with a lab project and target, follows one research question in an investigation, then connects the verified claim to evidence and a report.",
    outcome: "Your work stays connected from the original question to the final outcome.",
  },
  {
    label: "Projects & scope",
    title: "Start with a clear boundary.",
    description:
      "Projects keep related research together. Add a target, document permission, and define the scope before starting an investigation.",
    icon: FolderOpen,
    location: "Workspace → Projects · Research → Targets",
    points: [
      "Create a project for a lab, an assessment, or a research programme.",
      "Add targets and activate an approved scope with allowed assets, activities, and dates.",
      "Use engagements to group related work and record its objective.",
    ],
    note: "An engagement or tour step never grants permission. The active scope controls what the platform permits.",
    example:
      "Create a Learning lab project, add lab.example.test as a target, and record the permission source. Define allowed assets, excluded assets, permitted activities, and the effective window. Save the scope draft, review it, then activate it before relying on it.",
    outcome: "A project and target with an explicit, current research boundary.",
  },
  {
    label: "Investigations",
    title: "Follow the question.",
    description:
      "An investigation is your working research record. Capture what you observed, form a hypothesis, and keep track of the next decision.",
    icon: Search,
    location: "Workspace → Investigations",
    points: [
      "Keep observations, hypotheses, and research decisions in one place.",
      "Use guided AI for a focused question or delegated analysis for a staged review of supplied material.",
      "Inspect the sources and reasoning before adopting an AI suggestion.",
    ],
    note: "AI is advisory. It analyses supplied context; it does not autonomously test targets or confirm findings.",
    example:
      "Create an investigation with the objective ‘Determine whether the supplied response exposes another account’s profile’. Save the observation, describe a possible explanation, and record which evidence would confirm or contradict it. Ask a guided follow-up question or run a delegated analytical review, then inspect its recorded sources and execution history.",
    outcome: "A focused question, an attributable research trail, and proposals you can review.",
  },
  {
    label: "Evidence",
    title: "Keep the source with the claim.",
    description:
      "Evidence makes your work reviewable. Attach supporting material to the investigation and link it to the findings it supports.",
    icon: FileCheck2,
    location: "Research → Evidence · Tool imports",
    points: [
      "Record the source and collection details for each piece of evidence.",
      "Review and redact sensitive content before approving evidence or making it available to AI.",
      "Import supplied tool results, then review them before adopting records.",
    ],
    note: "An imported result is a research lead. Keep its provenance and verify it before treating it as a finding.",
    example:
      "Upload a redacted response capture with its source, collection date, and method. Inspect upload validation and complete the human evidence review. Decide separately whether the material is AI-safe, then link approved material to the finding as support, contradiction, or context. Use Tool imports for supplied JSON, CSV, or SARIF results.",
    outcome: "Traceable source material with explicit review status and relationships to claims.",
  },
  {
    label: "Verification",
    title: "Make the finding defensible.",
    description:
      "A finding connects an affected asset, an explanation, and supporting evidence. Human review determines whether the claim is ready.",
    icon: ShieldCheck,
    location: "Research → Findings",
    points: [
      "Describe the impact and affected asset, then explain the severity.",
      "Link supporting evidence and record your verification reasoning.",
      "Use an AI review to challenge assumptions; a human must confirm the finding.",
    ],
    note: "Finding status and evidence approval are separate decisions. Review both before including a claim in a report.",
    example:
      "Write the claim as a draft, identify the affected endpoint, and explain the demonstrated impact. Link approved supporting evidence and record a severity rationale. A human reviewer records the conclusion and supporting, contradictory, or missing evidence. If the claim is confirmed and ready, move it through the reporting workflow.",
    outcome: "A human-reviewed finding whose impact and severity are supported by evidence.",
  },
  {
    label: "Reports & outcomes",
    title: "Share the work. Track what follows.",
    description:
      "Bring reviewed findings into a report, record remediation and retests, and preserve useful research for your next investigation.",
    icon: FileCheck2,
    location: "Research → Reports · Remediation & outcomes · Knowledge",
    points: [
      "Prepare a report using a template or a reviewable AI draft.",
      "Approve the report before exporting, then record remediation and retest outcomes.",
      "Save reviewed knowledge so future investigations can build on it.",
    ],
    note: "Ready to begin? Create your first project, or finish the tour and explore the workspace.",
    example:
      "Select ready findings and a report template, or review and adopt an AI report draft. Check the narrative and sources before human approval and export. Record remediation and a human retest with follow-up evidence. Preserve reviewed methodology or lessons in Knowledge, and use Research insights to see the recorded outcomes.",
    outcome:
      "A reviewable report, documented follow-up, and reusable knowledge for the next investigation.",
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
          "We couldn’t save your tour preference. Try again, or close for now. You may see the tour on your next visit.",
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
                    description="On a desktop, use the sidebar to open a workspace section. On a smaller screen, open the navigation menu in the header. The question-mark buttons beside navigation items explain each section."
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
