"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { createReportTemplateAction } from "@/app/(dashboard)/dashboard/reports/templates/actions";
import {
  INITIAL_REPORT_TEMPLATE_FORM_STATE,
  type ReportTemplateFormState,
} from "@/components/research/report-form-state";
import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  REPORT_TEMPLATE_SECTION_OPTIONS,
  REQUIRED_REPORT_TEMPLATE_SECTION_IDS,
} from "@/modules/reports/domain/report";

function errorFor(state: ReportTemplateFormState, field: "name" | "sectionIds") {
  const message = state.fieldErrors?.[field];

  return message ? <FieldError>{message}</FieldError> : null;
}

export function ReportTemplateForm() {
  const [state, formAction, pending] = useActionState(
    createReportTemplateAction,
    INITIAL_REPORT_TEMPLATE_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);
  const selected: readonly string[] =
    state.status === "error"
      ? state.values.sectionIds
      : [...REQUIRED_REPORT_TEMPLATE_SECTION_IDS];

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="template-name">Template name</FieldLabel>
          <Input
            id="template-name"
            name="name"
            defaultValue={state.status === "error" ? state.values.name : ""}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            placeholder="Internal assessment report"
          />
          {errorFor(state, "name")}
        </Field>

        <FieldSet>
          <FieldLegend>Template sections</FieldLegend>
          <FieldDescription>
            Required sections are always included so reports keep findings, evidence, assumptions,
            and missing information separate. Add optional methodology or recommendations sections
            when the report needs them.
          </FieldDescription>
          <div className="mt-3 flex flex-col gap-2">
            {REPORT_TEMPLATE_SECTION_OPTIONS.map((section) => (
              <label
                key={section.id}
                className="flex cursor-pointer items-start gap-3 rounded-sm border border-control-border bg-surface-elevated p-3"
              >
                <input
                  type="checkbox"
                  name="sectionIds"
                  value={section.id}
                  defaultChecked={selected.includes(section.id)}
                  disabled={section.required}
                  className="mt-1"
                />
                {section.required ? (
                  <input type="hidden" name="sectionIds" value={section.id} />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{section.title}</span>
                  <span className="mt-1 block text-xs text-text-secondary">
                    {section.required ? "Required section" : "Optional section"}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {errorFor(state, "sectionIds")}
        </FieldSet>

        {state.status === "error" && state.message ? (
          <p role="alert" className="text-xs text-danger">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Creating…" : "Create workspace template"}
        </Button>
      </FieldGroup>
    </form>
  );
}
