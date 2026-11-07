import { beforeEach, describe, expect, it, vi } from "vitest";

import { dismissWorkspaceTourAction } from "@/app/(dashboard)/dashboard/tour-actions";

const { session, dismiss, revalidate } = vi.hoisted(() => ({
  session: vi.fn(),
  dismiss: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: session }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/modules/auth/infrastructure/prisma-workspace-tour-store", () => ({
  PrismaWorkspaceTourStore: class {
    dismiss = dismiss;
  },
}));

beforeEach(() => {
  session.mockReset().mockResolvedValue({ user: { id: "authenticated-user" } });
  dismiss.mockReset().mockResolvedValue(undefined);
  revalidate.mockReset();
});

describe("tour dismissal authentication", () => {
  it("always derives the user from the session and refreshes the dashboard layout", async () => {
    expect(await dismissWorkspaceTourAction()).toEqual({ ok: true });
    expect(session).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledExactlyOnceWith("authenticated-user");
    expect(revalidate).toHaveBeenCalledExactlyOnceWith("/dashboard", "layout");
  });

  it("does not mutate progress or swallow an authentication redirect", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    session.mockRejectedValue(redirect);
    await expect(dismissWorkspaceTourAction()).rejects.toBe(redirect);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("returns a safe failure message when persistence is unavailable", async () => {
    dismiss.mockRejectedValue(new Error("private database details"));
    const result = await dismissWorkspaceTourAction();
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("close for now") });
    expect(JSON.stringify(result)).not.toContain("private database details");
    expect(revalidate).not.toHaveBeenCalled();
  });
});
