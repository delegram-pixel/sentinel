"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { archiveProjectAction } from "@/app/(dashboard)/dashboard/projects/actions";
import { INITIAL_ARCHIVE_PROJECT_STATE } from "@/components/research/project-form-state";
import { Disclosure } from "@/components/shared/disclosure";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ArchiveProjectForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    archiveProjectAction,
    INITIAL_ARCHIVE_PROJECT_STATE,
  );
  const formRef = useFormErrorFocus(state);
  return (
    <Disclosure title="Archive project">
      <Alert variant="warning">
        <AlertDescription>
          Ready to put this project away? Archiving keeps its history and closes editing, new
          targets, and new investigations. You can&apos;t undo this from the workspace.
        </AlertDescription>
      </Alert>
      <form
        ref={formRef}
        action={formAction}
        aria-busy={pending}
        className="mt-5 flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Archiving…" : "Confirm archive"}
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
