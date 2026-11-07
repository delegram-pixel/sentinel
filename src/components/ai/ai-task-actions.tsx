"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";
import { useAiOperationAction } from "./use-ai-operation-key";

import { LoaderCircle } from "lucide-react";

import {
  generateSessionSummaryAction,
  runHypothesisGenerationAction,
  runReconAnalysisAction,
} from "@/app/(dashboard)/dashboard/investigations/[investigationId]/ai/actions";
import { INITIAL_AI_FORM_STATE } from "@/components/ai/ai-form-state";
import { Button } from "@/components/ui/button";

function ActionError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

export function ReconAnalysisForm({
  investigationId,
  conversationId,
  disabled,
}: {
  investigationId: string;
  conversationId: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useAiOperationAction(
    runReconAnalysisAction,
    INITIAL_AI_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="flex flex-col gap-2">
      <input type="hidden" name="investigationId" value={investigationId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <Button
        className="self-start"
        type="submit"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
      >
        {pending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : null}
        {pending ? "Analysing…" : "Reconnaissance analysis"}
      </Button>
      <ActionError message={state.status === "error" ? state.message : undefined} />
    </form>
  );
}

export function HypothesisGenerationForm({
  investigationId,
  conversationId,
  disabled,
}: {
  investigationId: string;
  conversationId: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useAiOperationAction(
    runHypothesisGenerationAction,
    INITIAL_AI_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="flex flex-col gap-2">
      <input type="hidden" name="investigationId" value={investigationId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <Button
        className="self-start"
        type="submit"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
      >
        {pending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : null}
        {pending ? "Generating…" : "Suggest hypotheses"}
      </Button>
      <ActionError message={state.status === "error" ? state.message : undefined} />
    </form>
  );
}

export function AiSessionSummaryForm({
  investigationId,
  disabled,
}: {
  investigationId: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useAiOperationAction(
    generateSessionSummaryAction,
    INITIAL_AI_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="flex flex-col gap-2">
      <input type="hidden" name="investigationId" value={investigationId} />
      <Button
        className="self-start"
        type="submit"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
      >
        {pending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : null}
        {pending ? "Summarising…" : "Generate session summary"}
      </Button>
      <ActionError message={state.status === "error" ? state.message : undefined} />
    </form>
  );
}
