"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  ReportTemplateFormField,
  ReportTemplateFormState,
  ReportTemplateFormValues,
} from "@/components/research/report-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  createReportTemplate,
  setReportTemplateActive,
} from "@/modules/reports/application/report-service";
import {
  reportTemplateCreateSchema,
  type ReportTemplateSectionId,
} from "@/modules/reports/domain/report";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

const TEMPLATE_FIELDS: readonly ReportTemplateFormField[] = ["name", "sectionIds"];

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function sectionIds(formData: FormData): string[] {
  return formData
    .getAll("sectionIds")
    .map((value) => String(value))
    .filter(Boolean);
}

function toFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Partial<Record<ReportTemplateFormField, string>> {
  const errors: Partial<Record<ReportTemplateFormField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && TEMPLATE_FIELDS.includes(field as ReportTemplateFormField)) {
      const key = field as ReportTemplateFormField;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

export async function createReportTemplateAction(
  _previousState: ReportTemplateFormState,
  formData: FormData,
): Promise<ReportTemplateFormState> {
  const values: ReportTemplateFormValues = {
    name: stringValue(formData, "name"),
    sectionIds: sectionIds(formData),
  };
  const parsed = reportTemplateCreateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the template details and try again.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values,
    };
  }

  const session = await getSessionContext();
  const result = await createReportTemplate(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    {
      name: parsed.data.name,
      sectionIds: parsed.data.sectionIds as ReportTemplateSectionId[],
    },
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/new");
  revalidatePath("/dashboard/reports/templates");

  redirect("/dashboard/reports/templates");
}

export async function toggleReportTemplateAction(formData: FormData): Promise<void> {
  const templateId = stringValue(formData, "templateId");
  const isActive = stringValue(formData, "isActive") === "true";

  if (!templateId) {
    return;
  }

  const session = await getSessionContext();
  await setReportTemplateActive(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    templateId,
    isActive,
  );

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/new");
  revalidatePath("/dashboard/reports/templates");
}
