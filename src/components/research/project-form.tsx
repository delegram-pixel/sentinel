"use client";

import { FieldHelpLabel } from "@/components/shared/field-help-label";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  createProjectAction,
  updateProjectAction,
} from "@/app/(dashboard)/dashboard/projects/actions";
import {
  INITIAL_PROJECT_FORM_STATE,
  type ProjectFormState,
} from "@/components/research/project-form-state";
import { Field, FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResearchSection } from "@/components/shared/research-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/modules/research/domain/project";

type ProjectFormProps =
  | { mode: "create"; project?: undefined }
  | {
      mode: "edit";
      project: {
        id: string;
        name: string;
        description: string | null;
        projectType: ProjectType;
      };
    };

function initialValues(project: ProjectFormProps["project"]): ProjectFormState {
  if (!project) {
    return INITIAL_PROJECT_FORM_STATE;
  }

  return {
    status: "idle",
    values: {
      name: project.name,
      description: project.description ?? "",
      projectType: project.projectType,
    },
  };
}

export function ProjectForm(props: ProjectFormProps) {
  const action = props.mode === "create" ? createProjectAction : updateProjectAction;
  const [state, formAction, pending] = useActionState(action, initialValues(props.project));
  const formRef = useFormErrorFocus(state);

  const fieldErrors = state.fieldErrors;
  const cancelHref =
    props.mode === "edit" ? `/dashboard/projects/${props.project.id}` : "/dashboard/projects";

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      {props.mode === "edit" ? (
        <input type="hidden" name="projectId" value={props.project.id} />
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <ResearchSection
        id="form-project-details"
        title="Project details"
        description={
          <>
            {" "}
            The name and description are shown in the workspace. The project type sets expectations
            for how targets should be authorised.{" "}
          </>
        }
      >
        <FieldGroup>
          <Field data-invalid={Boolean(fieldErrors?.name)}>
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.values.name}
              aria-invalid={Boolean(fieldErrors?.name)}
              aria-describedby={fieldErrors?.name ? "project-name-error" : undefined}
            />
            {fieldErrors?.name ? (
              <p id="project-name-error" className="text-xs text-danger">
                {fieldErrors.name}
              </p>
            ) : null}
          </Field>

          <Field data-invalid={Boolean(fieldErrors?.projectType)}>
            <FieldHelpLabel
              htmlFor="project-type"
              help={{
                description:
                  "Describe the setting for this work so the project has the right research context. This classification does not grant testing permission.",
                example:
                  "Choose Learning lab for an isolated practice application; use the appropriate assessment type for explicitly authorized work.",
                note: "Each target still needs its own approved, active scope.",
              }}
            >
              Project type
            </FieldHelpLabel>
            <Select
              id="project-type"
              name="projectType"
              defaultValue={state.values.projectType}
              aria-invalid={Boolean(fieldErrors?.projectType)}
              aria-describedby={fieldErrors?.projectType ? "project-type-error" : undefined}
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROJECT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            {fieldErrors?.projectType ? (
              <p id="project-type-error" className="text-xs text-danger">
                {fieldErrors.projectType}
              </p>
            ) : null}
          </Field>

          <Field data-invalid={Boolean(fieldErrors?.description)}>
            <FieldHelpLabel
              htmlFor="project-description"
              help={{
                description:
                  "Explain the purpose of the project, its intended research boundaries, and useful background for someone reviewing it later.",
                example:
                  "Review access control in a local practice application using supplied request/response captures.",
              }}
            >
              Description
            </FieldHelpLabel>
            <Textarea
              id="project-description"
              name="description"
              rows={5}
              maxLength={2000}
              placeholder="What are you researching, and what would a useful result look like?"
              defaultValue={state.values.description}
              aria-invalid={Boolean(fieldErrors?.description)}
              aria-describedby={fieldErrors?.description ? "project-description-error" : undefined}
            />
            {fieldErrors?.description ? (
              <p id="project-description-error" className="text-xs text-danger">
                {fieldErrors.description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Optional. Do not include secrets or personal data.
              </p>
            )}
          </Field>
        </FieldGroup>
      </ResearchSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending
            ? props.mode === "create"
              ? "Creating…"
              : "Saving…"
            : props.mode === "create"
              ? "Create project"
              : "Save changes"}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
