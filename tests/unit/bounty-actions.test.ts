import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  importBountyAction,
  saveBountyProjectAction,
} from "@/app/(dashboard)/dashboard/projects/bounty-actions";
import type { BountyReview } from "@/modules/bounty/domain/bounty-import";

const { session, enqueue, save, redirect, revalidate } = vi.hoisted(() => ({
  session: vi.fn(),
  enqueue: vi.fn(),
  save: vi.fn(),
  redirect: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext: session }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/modules/tasks/infrastructure/prisma-job-store", () => ({
  PrismaJobStore: class {
    enqueue = enqueue;
  },
}));
vi.mock("@/modules/bounty/infrastructure/save-bounty-project", () => ({ saveBountyProject: save }));
beforeEach(() => {
  session.mockReset().mockResolvedValue({
    user: { id: "session-user" },
    workspace: { id: "session-workspace" },
    role: "OWNER",
  });
  enqueue.mockReset().mockResolvedValue({ id: "job" });
  save.mockReset().mockResolvedValue({ id: "project" });
  redirect.mockReset();
  revalidate.mockReset();
});
describe("bounty actions", () => {
  it("derives queue ownership from the session and strips submitted actor identifiers", async () => {
    const result = await importBountyAction(
      {
        programUrl: "",
        details: "In scope: app.example.com",
        readUrl: false,
        workspaceId: "attacker-workspace",
        userId: "attacker-user",
      },
      "request-key",
    );
    expect(result).toMatchObject({ ok: true });
    expect(enqueue).toHaveBeenCalledWith(
      { userId: "session-user", workspaceId: "session-workspace", role: "OWNER" },
      "BOUNTY_IMPORT",
      "request-key",
      { programUrl: "", details: "In scope: app.example.com", readUrl: false },
    );
  });
  it("does not enqueue or save after an authentication redirect", async () => {
    const boundary = new Error("NEXT_REDIRECT");
    session.mockRejectedValue(boundary);
    await expect(importBountyAction({}, "request-key")).rejects.toBe(boundary);
    await expect(saveBountyProjectAction({} as BountyReview)).rejects.toBe(boundary);
    expect(enqueue).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it("returns a safe persistence failure while retaining the form", async () => {
    save.mockRejectedValue(new Error("private database credentials"));
    const result = await saveBountyProjectAction({} as BountyReview);
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("credentials");
    expect(redirect).not.toHaveBeenCalled();
  });
});
