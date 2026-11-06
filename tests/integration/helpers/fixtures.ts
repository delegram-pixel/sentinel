import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Create the minimum valid tenancy chain: user, personal workspace, owner
 * membership, project, target, active scope, investigation, and a draft
 * finding. Every id is returned so tests can mutate one invariant at a time.
 */
export async function createTenancy(tx: Prisma.TransactionClient) {
  const suffix = randomUUID();
  const now = new Date();
  const effectiveFrom = new Date(now.getTime() - 60 * 60 * 1000);
  const effectiveUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const user = await tx.user.create({
    data: {
      authProviderId: `clerk_${suffix}`,
      email: `researcher-${suffix}@example.test`,
      displayName: "Test Researcher",
    },
  });

  const workspace = await tx.workspace.create({
    data: {
      name: "Personal Workspace",
      slug: `personal-${suffix}`,
      kind: "PERSONAL",
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  const project = await tx.project.create({
    data: {
      workspaceId: workspace.id,
      ownerId: user.id,
      name: "Local Lab",
      slug: `local-lab-${suffix}`,
      projectType: "LEARNING_LAB",
    },
  });

  const target = await tx.target.create({
    data: {
      projectId: project.id,
      name: "Practice Target",
      assetIdentifier: `lab-${suffix}.example.test`,
      assetType: "DOMAIN",
      environmentType: "PRACTICE_LAB",
      authorizationStatus: "AUTHORIZED",
      authorizationExpiresAt: effectiveUntil,
      authorizationSource: "Self-attested local lab",
      authorizationDate: now,
    },
  });

  const scope = await tx.scopeVersion.create({
    data: {
      targetId: target.id,
      version: 1,
      status: "ACTIVE",
      createdBy: user.id,
      approvedBy: user.id,
      approvedAt: now,
      effectiveFrom,
      effectiveUntil,
      assets: {
        create: {
          assetIdentifier: `lab-${suffix}.example.test`,
          assetType: "DOMAIN",
          matchType: "DOMAIN",
          effect: "ALLOWED",
        },
      },
      activities: {
        create: {
          activity: "READ_PROJECT_CONTEXT",
          effect: "PERMITTED",
        },
      },
    },
  });

  const investigation = await tx.investigation.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      targetId: target.id,
      title: "Investigation",
      createdBy: user.id,
      status: "ACTIVE",
    },
  });

  const finding = await tx.finding.create({
    data: {
      workspaceId: workspace.id,
      investigationId: investigation.id,
      title: "Reflected input",
      titleNormalized: "reflected input",
      description: "User input is reflected without encoding.",
      vulnerabilityCategory: "XSS",
      createdBy: user.id,
    },
  });

  return { user, workspace, project, target, scope, investigation, finding, now, effectiveUntil };
}
