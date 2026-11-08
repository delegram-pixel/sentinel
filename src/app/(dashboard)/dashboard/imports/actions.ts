"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResearchFormState } from "@/components/research/research-action-form";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import {
  requestToolImport,
  reviewImportedResult,
} from "@/modules/imports/application/import-service";
import { PrismaImportStore } from "@/modules/imports/infrastructure/prisma-import-store";
import { IMPORT_MAX_BYTES } from "@/modules/imports/domain/tool-import";
export async function createImportAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const s = await getSessionContext();
  const file = data.get("importFile");
  let rawContent = String(data.get("rawContent") ?? "");
  let fileName = String(data.get("fileName") ?? "supplied-results");
  if (file instanceof File && file.size) {
    if (file.size > IMPORT_MAX_BYTES)
      return {
        status: "error",
        message: "This export is too large. Choose a file smaller than 500 KB.",
      };
    try {
      rawContent = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return {
        status: "error",
        message:
          "We couldn't read this file as UTF-8 text. Save the export in UTF-8, then upload it again.",
      };
    }
    fileName = file.name;
  }
  let fieldMapping: unknown = {};
  try {
    const mapping = String(data.get("fieldMapping") ?? "").trim();
    if (mapping) fieldMapping = JSON.parse(mapping);
  } catch {
    return {
      status: "error",
      message:
        "Enter the field mapping as a JSON object. The example beside the field shows the format.",
    };
  }
  const result = await requestToolImport(
    new PrismaImportStore(getDb()),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    { ...Object.fromEntries(data.entries()), rawContent, fileName, fieldMapping },
  );
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/imports");
  redirect(`/dashboard/imports/${result.value.id}`);
}
export async function reviewImportAction(
  _state: ResearchFormState,
  data: FormData,
): Promise<ResearchFormState> {
  const s = await getSessionContext();
  const values = Object.fromEntries(data.entries());
  const result = await reviewImportedResult(
    new PrismaImportStore(getDb()),
    { workspaceId: s.workspace.id, userId: s.user.id, role: s.role },
    {
      ...values,
      investigationId: values.investigationId || undefined,
      assetId: values.assetId || undefined,
    },
  );
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/imports", "layout");
  revalidatePath("/dashboard/findings");
  revalidatePath("/dashboard/investigations");
  return {
    status: "success",
    message:
      "Your review is saved. Any adopted observations or findings stay in Draft for further review.",
  };
}
