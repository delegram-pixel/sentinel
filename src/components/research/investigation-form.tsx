"use client";

import { FieldHelpLabel } from "@/components/shared/field-help-label";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createInvestigationAction,
  updateInvestigationAction,
} from "@/app/(dashboard)/dashboard/investigations/actions";
import {
  INITIAL_INVESTIGATION_FORM_STATE,
  type InvestigationFormField,
  type InvestigationFormState,
} from "@/components/research/investigation-form-state";
import { Field, FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResearchSection } from "@/components/shared/research-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProjectOption = {
  id: string;
  name: string;
};

type TargetOption = {
  id: string;
  projectId: string;
  name: string;
  assetIdentifier: string;
};

type EditableInvestigation = {
  id: string;
  projectId: string;
  projectName: string;
  targetName: string;
  targetAssetIdentifier: string;
  title: string;
  description: string | null;
  objective: string | null;
  category: string | null;
};

type InvestigationFormProps =
  | {
      mode: "create";
      projects: ProjectOption[];
      targets: TargetOption[];
      defaultProjectId?: string;
    }
  | {
      mode: "edit";
      investigation: EditableInvestigation;
    };

function initialState(props: InvestigationFormProps): InvestigationFormState {
  if (props.mode === "create") {
    return {
      status: "idle",
      values: {
        ...INITIAL_INVESTIGATION_FORM_STATE.values,
        projectId: props.defaultProjectId ?? props.projects[0]?.id ?? "",
      },
    };
  }

  return {
    status: "idle",
    values: {
      projectId: props.investigation.projectId,
      targetId: "",
      title: props.investigation.title,
      description: props.investigation.description ?? "",
      objective: props.investigation.objective ?? "",
      category: props.investigation.category ?? "",
    },
  };
}

function FieldError({
  field,
  state,
}: {
  field: InvestigationFormField;
  state: InvestigationFormState;
}) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`investigation-${field}-error`} className="text-xs text-danger">
      {message}
    </p>
  );
}

function describedBy(field: InvestigationFormField, state: InvestigationFormState) {
  return state.fieldErrors?.[field] ? `investigation-${field}-error` : undefined;
}

export function InvestigationForm(props: InvestigationFormProps) {
  const action = props.mode === "create" ? createInvestigationAction : updateInvestigationAction;
  const [state, formAction, pending] = useActionState(action, initialState(props));
  const formRef = useFormErrorFocus(state);
  const [projectId, setProjectId] = useState(state.values.projectId);
  const [targetId, setTargetId] = useState(state.values.targetId);

  const projectOptions = props.mode === "create" ? props.projects : [];
  const targets =
    props.mode === "create" ? props.targets.filter((target) => target.projectId === projectId) : [];

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      {props.mode === "create" ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        <>
          <input type="hidden" name="investigationId" value={props.investigation.id} />
          <input type="hidden" name="projectId" value={props.investigation.projectId} />
        </>
      )}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <ResearchSection
        id="form-research-question"
        title="Research question"
        description={
          <>
            {" "}
            Name the investigation and record what you are trying to establish. Investigations can
            be created before a scope is active, but every target action still requires an active
            scope.{" "}
          </>
        }
      >
        <FieldGroup>
          {props.mode === "create" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(state.fieldErrors?.projectId)}>
                <Label htmlFor="investigation-project">Project</Label>
                <Select
                  id="investigation-project"
                  name="projectSelect"
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setTargetId("");
                  }}
                  aria-invalid={Boolean(state.fieldErrors?.projectId)}
                  aria-describedby={describedBy("projectId", state)}
                >
                  {projectOptions.length === 0 ? <option value="">No projects</option> : null}
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
                <FieldError field="projectId" state={state} />
              </Field>

              <Field data-invalid={Boolean(state.fieldErrors?.targetId)}>
                <Label htmlFor="investigation-target">Target</Label>
                <Select
                  id="investigation-target"
                  name="targetId"
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  aria-invalid={Boolean(state.fieldErrors?.targetId)}
                  aria-describedby={describedBy("targetId", state)}
                >
                  <option value="">Choose a target</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name} — {target.assetIdentifier}
                    </option>
                  ))}
                </Select>
                {targets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This project has no targets yet.{" "}
                    <Link
                      href={`/dashboard/projects/${projectId}/targets/new`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Register one first
                    </Link>
                    .
                  </p>
                ) : null}
                <FieldError field="targetId" state={state} />
              </Field>
            </div>
          ) : (
            <div className="border-l-2 border-control-border py-2 pl-4 text-sm">
              <p className="text-xs text-muted-foreground">Investigating</p>
              <p className="mt-1 font-medium">{props.investigation.targetName}</p>
              <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                {props.investigation.targetAssetIdentifier}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Project: {props.investigation.projectName}
              </p>
            </div>
          )}

          <Field data-invalid={Boolean(state.fieldErrors?.title)}>
            <Label htmlFor="investigation-title">Title</Label>
            <Input
              id="investigation-title"
              name="title"
              required
              minLength={2}
              maxLength={150}
              autoComplete="off"
              defaultValue={state.values.title}
              aria-invalid={Boolean(state.fieldErrors?.title)}
              aria-describedby={describedBy("title", state)}
            />
            <FieldError field="title" state={state} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.category)}>
            <Label htmlFor="investigation-category">Research category</Label>
            <Input
              id="investigation-category"
              name="category"
              maxLength={80}
              autoComplete="off"
              placeholder="Authentication, access control, business logic…"
              defaultValue={state.values.category}
              aria-invalid={Boolean(state.fieldErrors?.category)}
              aria-describedby={describedBy("category", state)}
            />
            <FieldError field="category" state={state} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.objective)}>
            <FieldHelpLabel
              htmlFor="investigation-objective"
              help={{
                description:
                  "State one question the investigation should answer and what evidence would resolve it. A focused objective improves research decisions and AI context.",
                example:
                  "Determine whether the supplied response exposes another account's data, and identify the evidence needed to rule out expected behavior.",
                note: "Describe the research question here; record confirmed impact only after verification.",
              }}
            >
              Research objective
            </FieldHelpLabel>
            <Textarea
              id="investigation-objective"
              name="objective"
              rows={4}
              maxLength={4000}
              placeholder="What should be true or false when this investigation is complete?"
              defaultValue={state.values.objective}
              aria-invalid={Boolean(state.fieldErrors?.objective)}
              aria-describedby={describedBy("objective", state)}
            />
            <FieldError field="objective" state={state} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.description)}>
            <Label htmlFor="investigation-description">Description</Label>
            <Textarea
              id="investigation-description"
              name="description"
              rows={4}
              maxLength={4000}
              placeholder="Context, starting points, and any constraints."
              defaultValue={state.values.description}
              aria-invalid={Boolean(state.fieldErrors?.description)}
              aria-describedby={describedBy("description", state)}
            />
            <FieldError field="description" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving…" : props.mode === "create" ? "Create investigation" : "Save changes"}
        </Button>
        <Button asChild variant="ghost">
          <Link
            href={
              props.mode === "edit"
                ? `/dashboard/investigations/${props.investigation.id}`
                : "/dashboard/investigations"
            }
          >
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
