"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";

import { createConversationAction } from "@/app/(dashboard)/dashboard/investigations/[investigationId]/ai/actions";
import { INITIAL_AI_FORM_STATE } from "@/components/ai/ai-form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function NewConversationForm({
  investigationId,
  disabled,
}: {
  investigationId: string;
  disabled: boolean;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(
    createConversationAction,
    INITIAL_AI_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);
  return (
    <form ref={formRef} action={formAction} aria-busy={pending}>
      <FieldGroup>
        <input type="hidden" name="investigationId" value={investigationId} />
        <Field data-disabled={disabled || pending}>
          <FieldLabel htmlFor={id}>Conversation title</FieldLabel>
          <Input
            id={id}
            name="title"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
            placeholder="Name the research question"
            disabled={disabled || pending}
          />
        </Field>
        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled || pending}
        >
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Creating…" : "Start conversation"}
        </Button>
      </FieldGroup>
    </form>
  );
}
