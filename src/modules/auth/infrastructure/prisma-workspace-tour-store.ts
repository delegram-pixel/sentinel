import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { WORKSPACE_TOUR_VERSION } from "../domain/workspace-tour";

export class PrismaWorkspaceTourStore {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async readProgress(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { onboardingVersion: true, onboardingCompletedAt: true },
    });
  }

  async dismiss(userId: string): Promise<void> {
    // The first successful dismissal wins. Replays, repeated requests and
    // clients from an older tour version cannot overwrite progress.
    await this.db.user.updateMany({
      where: {
        id: userId,
        onboardingVersion: WORKSPACE_TOUR_VERSION,
        onboardingCompletedAt: null,
      },
      data: { onboardingCompletedAt: new Date() },
    });
  }
}
