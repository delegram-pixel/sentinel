import { afterAll, describe, expect, it } from "vitest";

import {
  assessFindingSeverity,
  changeFindingStatus,
  confirmDuplicateFinding,
  createFinding,
  getFinding,
  linkEvidenceToFinding,
  listDuplicateCandidates,
  reviewFinding,
} from "@/modules/findings/application/finding-service";
import { PrismaFindingStore } from "@/modules/findings/infrastructure/prisma-finding-store";

import { createTestClient, withRollback } from "./helpers/database";
import { createTenancy } from "./helpers/fixtures";

const client = createTestClient();

afterAll(async () => {
  await client.$disconnect();
});

function findingInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Reflected cross-site scripting in search",
    description: "The search parameter is echoed into the results page without encoding.",
    vulnerabilityCategory: "XSS",
    affectedAsset: "https://lab.example.test/search",
    affectedAssetType: "API",
    impact: "An attacker can execute script in a victim's session.",
    remediation: "Encode output and add a regression test.",
    ...overrides,
  };
}

describe("finding lifecycle", () => {
  it("confirms and makes a finding reportable only after severity, asset, and supporting evidence", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaFindingStore(tx);
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };

      const created = await createFinding(store, actor, tenancy.investigation.id, findingInput());

      expect(created.ok).toBe(true);
      if (!created.ok) {
        return null;
      }

      const findingId = created.value.id;
      const evidence = await tx.evidence.create({
        data: {
          workspaceId: tenancy.workspace.id,
          investigationId: tenancy.investigation.id,
          evidenceType: "SCREENSHOT",
          title: "Search response with payload",
          fileName: "search-response.png",
          storageKey: `evidence/${tenancy.workspace.id}/${tenancy.investigation.id}/${findingId}/v1`,
          mimeType: "image/png",
          fileSize: 2048,
          checksum: "a".repeat(64),
          redactionStatus: "VERIFIED_SAFE",
          redactionMethod: "HUMAN_REVIEW",
          uploadedBy: tenancy.user.id,
          activatedAt: tenancy.now,
        },
      });

      const linked = await linkEvidenceToFinding(store, actor, {
        evidenceId: evidence.id,
        findingId,
        relationshipType: "SUPPORTS",
      });
      expect(linked.ok).toBe(true);

      const severity = await assessFindingSeverity(store, actor, findingId, {
        severity: "HIGH",
        severityRationale: "Stored script execution against an authenticated session.",
        affectedAsset: "https://lab.example.test/search",
        affectedAssetType: "API",
      });
      expect(severity.ok).toBe(true);

      expect(
        (await changeFindingStatus(store, actor, findingId, { status: "NEEDS_VALIDATION" })).ok,
      ).toBe(true);
      expect(
        (await changeFindingStatus(store, actor, findingId, { status: "UNDER_REVIEW" })).ok,
      ).toBe(true);

      const review = await reviewFinding(store, actor, findingId, {
        conclusion: "CONFIRMED",
        supportingEvidence: ["Search response screenshot"],
        reasoningSummary: "Reproduced the reflection in a permitted lab session.",
      });
      expect(review.ok).toBe(true);

      const confirmed = await getFinding(store, tenancy.workspace.id, findingId);
      expect(confirmed?.status).toBe("CONFIRMED");
      expect(confirmed?.approvedBy).toBe(tenancy.user.id);
      expect(confirmed?.verifiedAt).not.toBeNull();
      expect(confirmed?.verificationReviews[0]?.reviewerType).toBe("HUMAN");

      const reportable = await changeFindingStatus(store, actor, findingId, {
        status: "REPORTABLE",
      });
      expect(reportable.ok).toBe(true);

      const finalFinding = await getFinding(store, tenancy.workspace.id, findingId);
      expect(finalFinding?.status).toBe("REPORTABLE");

      return finalFinding;
    });

    expect(result?.status).toBe("REPORTABLE");
  });

  it("refuses confirmation when there is no supporting evidence", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaFindingStore(tx);
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };

      const created = await createFinding(store, actor, tenancy.investigation.id, findingInput());
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return null;
      }

      await assessFindingSeverity(store, actor, created.value.id, {
        severity: "HIGH",
        severityRationale: "Impact is clear from the reflection.",
      });
      await changeFindingStatus(store, actor, created.value.id, { status: "NEEDS_VALIDATION" });
      await changeFindingStatus(store, actor, created.value.id, { status: "UNDER_REVIEW" });

      return reviewFinding(store, actor, created.value.id, { conclusion: "CONFIRMED" });
    });

    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.code).toBe("FINDING_NOT_READY");
    }
  });

  it("detects and confirms duplicates, and prevents duplicate cycles", async () => {
    const result = await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaFindingStore(tx);
      const actor = {
        userId: tenancy.user.id,
        workspaceId: tenancy.workspace.id,
        role: "OWNER" as const,
      };

      const first = await createFinding(store, actor, tenancy.investigation.id, findingInput());
      const second = await createFinding(
        store,
        actor,
        tenancy.investigation.id,
        findingInput({ title: "Reflected cross site scripting in the search field" }),
      );

      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) {
        return null;
      }

      const candidates = await listDuplicateCandidates(
        store,
        tenancy.workspace.id,
        second.value.id,
      );
      expect(candidates[0]?.id).toBe(first.value.id);
      expect(candidates[0]?.similarity).toBeGreaterThanOrEqual(0.55);

      await changeFindingStatus(store, actor, second.value.id, { status: "NEEDS_VALIDATION" });
      await changeFindingStatus(store, actor, second.value.id, { status: "UNDER_REVIEW" });

      const confirmed = await confirmDuplicateFinding(store, actor, second.value.id, {
        canonicalFindingId: first.value.id,
      });
      expect(confirmed.ok).toBe(true);

      const rejected = await getFinding(store, tenancy.workspace.id, second.value.id);
      expect(rejected?.status).toBe("REJECTED");
      expect(rejected?.resolutionReason).toBe("DUPLICATE");
      expect(rejected?.duplicateOfId).toBe(first.value.id);

      await changeFindingStatus(store, actor, first.value.id, { status: "NEEDS_VALIDATION" });
      await changeFindingStatus(store, actor, first.value.id, { status: "UNDER_REVIEW" });

      const cycle = await confirmDuplicateFinding(store, actor, first.value.id, {
        canonicalFindingId: second.value.id,
      });
      expect(cycle.ok).toBe(false);

      return { rejected, cycle };
    });

    expect(result?.rejected?.duplicateOfId).toBeTruthy();
    expect(result?.cycle?.ok).toBe(false);
  });

  it("does not let an AI review record a human confirmation", async () => {
    await withRollback(client, async (tx) => {
      const tenancy = await createTenancy(tx);
      const store = new PrismaFindingStore(tx);

      await expect(
        store.createVerificationReview(
          {
            findingId: tenancy.finding.id,
            reviewerType: "AI",
            reviewerUserId: null,
            conclusion: "CONFIRMED",
          },
          null,
          {
            workspaceId: tenancy.workspace.id,
            userId: tenancy.user.id,
            action: "FINDING_VERIFICATION_REVIEWED",
            entityType: "Finding",
          },
        ),
      ).rejects.toThrow(/reviewer type/i);
    });
  });
});
