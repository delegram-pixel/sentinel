"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  ReportContentFormState,
  ReportCreateFormField,
  ReportCreateFormState,
  ReportCreateFormValues,
  ReportStatusFormState,
} from "@/components/research/report-form-state";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  approveReport,
  archiveReport,
  createReport,
  exportReport,
  reopenReport,
  saveReportRevision,
  submitReport,
} from "@/modules/reports/application/report-service";
import { reportContentSchema, reportCreateSchema } from "@/modules/reports/domain/report";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

const REPORT_CREATE_FIELDS: readonly ReportCreateFormField[] = [
  "title",
  "templateId",
  "findingIds",
];

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function toFieldErrors<Field extends string>(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  allowed: readonly Field[],
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && allowed.includes(field as Field)) {
      const key = field as Field;

      if (!errors[key]) {
        errors[key] = issue.message;
      }
    }
  }

  return errors;
}

function revalidateReport(reportId: string, investigationId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/reports/${reportId}`);
  revalidatePath("/dashboard/findings");

  if (investigationId) {
    revalidatePath(`/dashboard/investigations/${investigationId}`);
  }
}

export async function createReportAction(
  _previousState: ReportCreateFormState,
  formData: FormData,
): Promise<ReportCreateFormState> {
  const investigationId = stringValue(formData, "investigationId");
  const templateId = stringValue(formData, "templateId");
  const values: ReportCreateFormValues = {
    title: stringValue(formData, "title"),
    templateId,
    findingIds: formData
      .getAll("findingIds")
      .map((value) => String(value))
      .filter(Boolean),
  };

  if (!investigationId) {
    return { status: "error", message: "The investigation identifier is missing.", values };
  }

  const payload = {
    investigationId,
    title: values.title,
    findingIds: values.findingIds,
    ...(templateId ? { templateId } : {}),
  };
  const parsed = reportCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: toFieldErrors(parsed.error.issues, REPORT_CREATE_FIELDS),
      values,
    };
  }

  const session = await getSessionContext();
  const result = await createReport(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateReport(result.value.id, investigationId);

  redirect(`/dashboard/reports/${result.value.id}`);
}

export async function saveReportRevisionAction(
  _previousState: ReportContentFormState,
  formData: FormData,
): Promise<ReportContentFormState> {
  const reportId = stringValue(formData, "reportId");
  const investigationId = stringValue(formData, "investigationId");
  const values = { content: stringValue(formData, "content") };

  if (!reportId) {
    return { status: "error", message: "The report identifier is missing.", values };
  }

  const parsed = reportContentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the report content.",
      values,
    };
  }

  const session = await getSessionContext();
  const result = await saveReportRevision(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    reportId,
    parsed.data,
  );

  if (!result.ok) {
    return { status: "error", message: result.message, values };
  }

  revalidateReport(reportId, investigationId || undefined);

  redirect(`/dashboard/reports/${reportId}`);
}

export async function submitReportAction(
  _previousState: ReportStatusFormState,
  formData: FormData,
): Promise<ReportStatusFormState> {
  const reportId = stringValue(formData, "reportId");
  const investigationId = stringValue(formData, "investigationId");

  if (!reportId) {
    return { status: "error", message: "The report identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await submitReport(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    reportId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateReport(reportId, investigationId || undefined);

  redirect(`/dashboard/reports/${reportId}`);
}

export async function approveReportAction(
  _previousState: ReportStatusFormState,
  formData: FormData,
): Promise<ReportStatusFormState> {
  const reportId = stringValue(formData, "reportId");
  const investigationId = stringValue(formData, "investigationId");

  if (!reportId) {
    return { status: "error", message: "The report identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await approveReport(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    reportId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateReport(reportId, investigationId || undefined);

  redirect(`/dashboard/reports/${reportId}`);
}

export async function reopenReportAction(
  _previousState: ReportStatusFormState,
  formData: FormData,
): Promise<ReportStatusFormState> {
  const reportId = stringValue(formData, "reportId");
  const investigationId = stringValue(formData, "investigationId");

  if (!reportId) {
    return { status: "error", message: "The report identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await reopenReport(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    reportId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateReport(reportId, investigationId || undefined);

  redirect(`/dashboard/reports/${reportId}`);
}

export async function archiveReportAction(
  _previousState: ReportStatusFormState,
  formData: FormData,
): Promise<ReportStatusFormState> {
  const reportId = stringValue(formData, "reportId");
  const investigationId = stringValue(formData, "investigationId");

  if (!reportId) {
    return { status: "error", message: "The report identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await archiveReport(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    reportId,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateReport(reportId, investigationId || undefined);

  redirect(`/dashboard/reports/${reportId}`);
}

export async function exportReportAction(
  _previousState: ReportStatusFormState,
  formData: FormData,
): Promise<ReportStatusFormState> {
  const reportId = stringValue(formData, "reportId");
  const investigationId = stringValue(formData, "investigationId");
  const requestedFormat = stringValue(formData, "format");
  const format = requestedFormat === "PDF" ? "PDF" : "MARKDOWN";

  if (!reportId) {
    return { status: "error", message: "The report identifier is missing." };
  }

  const session = await getSessionContext();
  const result = await exportReport(
    new PrismaReportStore(getDb()),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    reportId,
    format,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidateReport(reportId, investigationId || undefined);

  redirect(
    format === "PDF"
      ? `/api/reports/${reportId}/export?format=pdf`
      : `/api/reports/${reportId}/export`,
  );
}
