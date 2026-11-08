"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  activateScopeAction,
  revokeScopeAction,
} from "@/app/(dashboard)/dashboard/projects/[projectId]/targets/[targetId]/scopes/actions";
import {
  INITIAL_SCOPE_ACTIVATION_STATE,
  INITIAL_SCOPE_REVOKE_STATE,
} from "@/components/research/scope-form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Disclosure } from "@/components/shared/disclosure";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ScopeActionsProps = {
  projectId: string;
  targetId: string;
  scopeId: string;
};

export function ActivateScopeForm({ projectId, targetId, scopeId }: ScopeActionsProps) {
  const [state, formAction, pending] = useActionState(
    activateScopeAction,
    INITIAL_SCOPE_ACTIVATION_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending}>
      <FieldGroup>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="scopeId" value={scopeId} />

        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="activation-source">Authorization source</Label>
          <Input
            id="activation-source"
            name="authorizationSource"
            required
            minLength={3}
            maxLength={300}
            autoComplete="off"
            placeholder="Program policy, signed letter, self-attested local lab…"
            aria-invalid={Boolean(state.fieldErrors?.authorizationSource)}
            aria-describedby={
              state.fieldErrors?.authorizationSource ? "activation-source-error" : undefined
            }
          />
          {state.fieldErrors?.authorizationSource ? (
            <p id="activation-source-error" className="text-xs text-danger">
              {state.fieldErrors.authorizationSource}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="activation-date">Authorization date</Label>
          <Input
            id="activation-date"
            name="authorizationDate"
            type="date"
            required
            aria-invalid={Boolean(state.fieldErrors?.authorizationDate)}
            aria-describedby={
              state.fieldErrors?.authorizationDate ? "activation-date-error" : undefined
            }
          />
          {state.fieldErrors?.authorizationDate ? (
            <p id="activation-date-error" className="text-xs text-danger">
              {state.fieldErrors.authorizationDate}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="activation-notes">Attestation notes</Label>
          <Textarea
            id="activation-notes"
            name="attestationNotes"
            rows={3}
            maxLength={2000}
            placeholder="Any limits or reporting requirements the team must respect."
            aria-invalid={Boolean(state.fieldErrors?.attestationNotes)}
            aria-describedby={
              state.fieldErrors?.attestationNotes ? "activation-notes-error" : undefined
            }
          />
          {state.fieldErrors?.attestationNotes ? (
            <p id="activation-notes-error" className="text-xs text-danger">
              {state.fieldErrors.attestationNotes}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-11 items-start gap-3 border-l-2 border-warning py-2 pl-4">
          <input
            id="activation-acknowledged"
            type="checkbox"
            name="acknowledged"
            className="mt-0.5 size-4 rounded border-input accent-primary"
            aria-invalid={Boolean(state.fieldErrors?.acknowledged)}
            aria-describedby={
              state.fieldErrors?.acknowledged ? "activation-acknowledged-error" : undefined
            }
          />
          <div>
            <Label htmlFor="activation-acknowledged" className="font-normal">
              I confirm that I hold authorization for the assets in this scope and that this
              attestation is accurate.
            </Label>
            {state.fieldErrors?.acknowledged ? (
              <p id="activation-acknowledged-error" className="mt-1 text-xs text-danger">
                {state.fieldErrors.acknowledged}
              </p>
            ) : null}
          </div>
        </div>

        <Button type="submit" className="self-start" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Activating…" : "Activate scope"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RevokeScopeForm({ projectId, targetId, scopeId }: ScopeActionsProps) {
  const [state, formAction, pending] = useActionState(
    revokeScopeAction,
    INITIAL_SCOPE_REVOKE_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <Disclosure title="Revoke active scope">
      <Alert variant="warning">
        <AlertDescription>
          Revoking stops this scope&apos;s permission immediately. It can&apos;t be reactivated, so
          further work will need a new active scope.
        </AlertDescription>
      </Alert>
      <form
        ref={formRef}
        action={formAction}
        aria-busy={pending}
        className="mt-5 flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="scopeId" value={scopeId} />
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Revoking…" : "Confirm revocation"}
        </Button>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </form>
    </Disclosure>
  );
}
