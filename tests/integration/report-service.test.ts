import { afterAll, describe, expect, it } from "vitest";

import {
  approveReport,
  archiveReport,
  createReport,
  createReportTemplate,
  exportReport,
  getReport,
  listReportTemplates,
  readReportExport,
  reopenReport,
  saveReportRevision,
  setReportTemplateActive,
  submitReport,
} from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";
import type { ReportActor } from "@/modules/reports/application/ports";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

async function seedConfirmedFinding(tx: Parameters<typeof createTenancy>[0]) {
  const tenancy = await createTenancy(tx);

  await tx.finding.update({
    where: { id: tenancy.finding.id },
    data: {
      status: "CONFIRMED",
      severity: "HIGH",
      severityRationale: "Script execution in an authenticated session.",
      affectedAsset: "https://lab.example.test/search",
      affectedAssetType: "API",
      impact: "An attacker can execute script in a victim's session.",
      remediation: "Encode the output and add a regression test.",
      approvedBy: tenancy.user.id,
      approvedAt: tenancy.now,
      verifiedAt: tenancy.now,
    },
  });

  const evidence = await tx.evidence.create({
    data: {
      workspaceId: tenancy.workspace.id,
      investigationId: tenancy.investigation.id,
      evidenceType: "SCREENSHOT",
      title: "Search response with payload",
      fileName: "search-response.png",
      storageKey: `evidence/${tenancy.workspace.id}/${tenancy.investigation.id}/report-test-v1`,
      mimeType: "image/png",
      fileSize: 2048,
      checksum: "a".repeat(64),
      redactionStatus: "VERIFIED_SAFE",
      uploadValidatedAt: tenancy.now,
      redactionMethod: "HUMAN_REVIEW",
      uploadedBy: tenancy.user.id,
      activatedAt: tenancy.now,
    },
  });

  await tx.evidenceLink.create({
    data: {
      evidenceId: evidence.id,
      findingId: tenancy.finding.id,
      relationshipType: "SUPPORTS",
    },
  });

  return { ...tenancy, evidence };
}

function actor(
  tenancy: { user: { id: string }; workspace: { id: string } },
  role: ReportActor["role"] = "OWNER",
): ReportActor {
  return {
    userId: tenancy.user.id,
    workspaceId: tenancy.workspace.id,
    role,
  };
}

describe("report lifecycle", () => {
  it("creates a revisioned draft and requires human approval before export", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await seedConfirmedFinding(tx);
      const store = new PrismaReportStore(tx);

      const created = await createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Search review report",
        findingIds: [tenancy.finding.id],
      });

      expect(created.ok).toBe(true);
      if (!created.ok) {
        return null;
      }

      const draft = await getReport(store, tenancy.workspace.id, created.value.id);
      expect(draft?.status).toBe("DRAFT");
      expect(draft?.revisions).toHaveLength(1);
      expect(draft?.revisions[0]?.version).toBe(1);
      expect(draft?.revisions[0]?.content).toContain("Reflected input");
      expect(draft?.revisions[0]?.evidenceSnapshot).toHaveLength(1);
      expect(draft?.revisions[0]?.findingSnapshot).toHaveLength(1);

      const saved = await saveReportRevision(store, actor(tenancy), created.value.id, {
        content: "# Edited report\n\nHuman-written summary.",
      });
      expect(saved.ok).toBe(true);

      const revised = await getReport(store, tenancy.workspace.id, created.value.id);
      expect(revised?.revisions[0]?.version).toBe(2);
      expect(revised?.revisions[0]?.content).toContain("Human-written summary.");

      const submitted = await submitReport(store, actor(tenancy), created.value.id);
      expect(submitted.ok).toBe(true);

      const underReview = await getReport(store, tenancy.workspace.id, created.value.id);
      expect(underReview?.status).toBe("UNDER_REVIEW");

      const denied = await approveReport(store, actor(tenancy, "RESEARCHER"), created.value.id);
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.code).toBe("FORBIDDEN_REPORT_ACTOR");
      }

      const approved = await approveReport(store, actor(tenancy, "REVIEWER"), created.value.id);
      expect(approved.ok).toBe(true);

      const approvedReport = await getReport(store, tenancy.workspace.id, created.value.id);
      expect(approvedReport?.status).toBe("APPROVED");
      expect(approvedReport?.approvedBy).toBe(tenancy.user.id);
      expect(approvedReport?.approvedAt).not.toBeNull();

      const exported = await exportReport(store, actor(tenancy), created.value.id);
      expect(exported.ok).toBe(true);
      if (!exported.ok) {
        return null;
      }
      expect(exported.value.fileName).toBe("search-review-report.md");
      expect(exported.value.format).toBe("MARKDOWN");
      expect(String(exported.value.body)).toContain("Human-written summary.");

      const exportedReport = await getReport(store, tenancy.workspace.id, created.value.id);
      expect(exportedReport?.status).toBe("EXPORTED");

      const readable = await readReportExport(store, tenancy.workspace.id, created.value.id);
      expect(String(readable?.body)).toContain("Human-written summary.");

      const pdf = await readReportExport(store, tenancy.workspace.id, created.value.id, "PDF");
      expect(pdf?.fileName).toBe("search-review-report.pdf");
      expect(pdf?.contentType).toBe("application/pdf");
      expect(pdf?.body).toBeInstanceOf(Uint8Array);
      expect(
        Buffer.from(pdf?.body ?? [])
          .subarray(0, 5)
          .toString("latin1"),
      ).toBe("%PDF-");

      const archived = await archiveReport(store, actor(tenancy), created.value.id);
      expect(archived.ok).toBe(true);

      const audits = await tx.auditLog.findMany({
        where: { entityType: "Report", entityId: created.value.id },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      });

      return { audits: audits.map((audit) => audit.action) };
    });

    expect(result?.audits).toEqual([
      "REPORT_CREATED",
      "REPORT_REVISION_SAVED",
      "REPORT_STATUS_CHANGED",
      "REPORT_STATUS_CHANGED",
      "REPORT_EXPORTED",
      "REPORT_STATUS_CHANGED",
    ]);
  });

  it("rejects findings that are not confirmed or reportable", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaReportStore(tx);

      return createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Draft report",
        findingIds: [tenancy.finding.id],
      });
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REPORT_FINDING_NOT_ELIGIBLE");
    }
  });

  it("rejects creation from an archived project", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await seedConfirmedFinding(tx);
      const store = new PrismaReportStore(tx);

      await tx.project.update({
        where: { id: tenancy.project.id },
        data: { status: "ARCHIVED", archivedAt: tenancy.now },
      });

      return createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Archived report",
        findingIds: [tenancy.finding.id],
      });
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PROJECT_ARCHIVED");
    }
  });

  it("revalidates finding readiness before review", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await seedConfirmedFinding(tx);
      const store = new PrismaReportStore(tx);

      const created = await createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Readiness report",
        findingIds: [tenancy.finding.id],
      });

      if (!created.ok) {
        return created;
      }

      await tx.finding.update({
        where: { id: tenancy.finding.id },
        data: { impact: null },
      });

      return submitReport(store, actor(tenancy), created.value.id);
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REPORT_NOT_READY");
      expect(result.message).toContain("impact");
    }
  });

  it("returns an under-review report to draft without discarding revisions", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await seedConfirmedFinding(tx);
      const store = new PrismaReportStore(tx);

      const created = await createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Reopen report",
        findingIds: [tenancy.finding.id],
      });

      if (!created.ok) {
        return null;
      }

      await submitReport(store, actor(tenancy), created.value.id);
      const reopened = await reopenReport(store, actor(tenancy), created.value.id);

      if (!reopened.ok) {
        return null;
      }

      return getReport(store, tenancy.workspace.id, created.value.id);
    });

    expect(result?.status).toBe("DRAFT");
    expect(result?.revisions).toHaveLength(1);
    expect(result?.approvedAt).toBeNull();
  });

  it("creates versioned workspace templates and uses them for new reports", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await seedConfirmedFinding(tx);
      const store = new PrismaReportStore(tx);
      const systemTemplates = await listReportTemplates(store, tenancy.workspace.id, {
        activeOnly: true,
      });

      const created = await createReportTemplate(store, actor(tenancy), {
        name: "Internal assessment report",
        sectionIds: [
          "summary",
          "findings",
          "evidence",
          "assumptions",
          "missing-information",
          "methodology",
          "recommendations",
        ],
      });

      if (!created.ok) {
        return created;
      }

      const versionTwo = await createReportTemplate(store, actor(tenancy), {
        name: "Internal assessment report",
        sectionIds: [
          "summary",
          "findings",
          "evidence",
          "assumptions",
          "missing-information",
          "methodology",
        ],
      });

      const report = await createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Templated report",
        templateId: created.value.id,
        findingIds: [tenancy.finding.id],
      });

      if (!report.ok) {
        return report;
      }

      const detail = await getReport(store, tenancy.workspace.id, report.value.id);
      return {
        systemTemplateCount: systemTemplates.length,
        versionTwoOk: versionTwo.ok,
        detail,
      };
    });

    expect(result && "ok" in result).toBe(false);
    if (!result || "ok" in result) {
      return;
    }
    expect(result.systemTemplateCount).toBeGreaterThanOrEqual(3);
    expect(result.versionTwoOk).toBe(true);
    expect(result.detail?.templateName).toBe("Internal assessment report");
    expect(result.detail?.templateVersion).toBe(1);
    expect(result.detail?.revisions[0]?.content).toContain("## Methodology");
    expect(result.detail?.revisions[0]?.content).toContain("## Recommendations");
  });

  it("rejects inactive templates and template management by a researcher", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await seedConfirmedFinding(tx);
      const store = new PrismaReportStore(tx);
      const created = await createReportTemplate(store, actor(tenancy), {
        name: "Temporary template",
        sectionIds: ["summary", "findings", "evidence", "assumptions", "missing-information"],
      });

      if (!created.ok) {
        return created;
      }

      const deactivated = await setReportTemplateActive(
        store,
        actor(tenancy),
        created.value.id,
        false,
      );
      const selected = await createReport(store, actor(tenancy), {
        investigationId: tenancy.investigation.id,
        title: "Inactive template report",
        templateId: created.value.id,
        findingIds: [tenancy.finding.id],
      });
      const denied = await createReportTemplate(store, actor(tenancy, "RESEARCHER"), {
        name: "Researcher template",
        sectionIds: ["summary", "findings", "evidence", "assumptions", "missing-information"],
      });

      return { deactivated, selected, denied };
    });

    expect(result && "ok" in result).toBe(false);
    if (!result || "ok" in result) {
      return;
    }
    expect(result.deactivated.ok).toBe(true);
    expect(result.selected.ok).toBe(false);
    if (!result.selected.ok) {
      expect(result.selected.code).toBe("REPORT_TEMPLATE_NOT_FOUND");
    }
    expect(result.denied.ok).toBe(false);
    if (!result.denied.ok) {
      expect(result.denied.code).toBe("FORBIDDEN_REPORT_ACTOR");
    }
  });
});
