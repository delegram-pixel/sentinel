import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() && process.env.CLERK_SECRET_KEY?.trim(),
);
const storageState = process.env.CLERK_E2E_STORAGE_STATE;

test.beforeEach(async ({ context }) => {
  if (clerkConfigured) await setupClerkTestingToken({ context });
});

async function expectGuestBoundary(page: Page) {
  if (clerkConfigured) {
    await expect(page).toHaveURL(/\/sign-in(?:\/|\?|$)/);
    await clerk.loaded({ page });
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  } else {
    await expect(page.getByText("Authentication is not configured", { exact: true })).toBeVisible();
  }

  await expect(page.locator("#recent-investigations")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Account", exact: true })).toHaveCount(
    0,
  );
}

test("the landing page leads to the workspace authentication boundary", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Evidence, not assertions." }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Open the workspace/ }).click();

  await expectGuestBoundary(page);
});

test("Settings does not expose workspace details to a guest", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await expectGuestBoundary(page);
});

for (const path of [
  "/dashboard/engagements",
  "/dashboard/knowledge",
  "/dashboard/imports",
  "/dashboard/remediation",
  "/dashboard/tasks",
  "/dashboard/insights",
]) {
  test(`${path} enforces the workspace authentication boundary`, async ({ page }) => {
    await page.goto(path);
    await expectGuestBoundary(page);
  });
}

for (const route of [
  { path: "/sign-in", title: /sign in/i },
  { path: "/sign-up", title: /create your account|sign up/i },
]) {
  test(`${route.path} renders without client runtime errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);

    if (clerkConfigured) {
      await clerk.loaded({ page });
      await expect(page.getByRole("heading", { name: route.title })).toBeVisible();
    } else {
      await expect(
        page.getByText("Authentication is not configured", { exact: true }),
      ).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
  });
}

test.describe("authenticated workspace", () => {
  test.skip(!clerkConfigured, "Clerk development keys are required.");
  test.skip(!storageState, "Set CLERK_E2E_STORAGE_STATE to a saved Clerk development login.");
  test.use({ storageState });

  test("the research overview shows real records and links to Settings", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Research overview" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Dashboard");

    const numericCount = /^\d[\d,]*$/;
    await expect(page.locator('#finding-review [data-count="validation"]')).toHaveText(
      numericCount,
    );
    await expect(page.locator('#finding-review [data-count="confirmed"]')).toHaveText(numericCount);
    for (const name of [
      "Requires attention",
      "Findings awaiting validation",
      "Next actions",
      "Evidence activity",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }

    const recent = page.locator("#recent-investigations");
    await expect(
      recent.getByRole("heading", { level: 2, name: /^Recent investigations/ }),
    ).toBeVisible();
    const records = recent.getByRole("table", { name: "Recent investigations", exact: true });
    if (await records.count()) {
      const recordCount = await records.locator("tbody tr").count();
      expect(recordCount).toBeGreaterThan(0);
      expect(recordCount).toBeLessThanOrEqual(6);
    } else {
      await expect(
        recent.getByRole("heading", { name: "No investigations yet", exact: true }),
      ).toBeVisible();
    }

    const activity = page.locator("#audit-history");
    await expect(
      activity.getByRole("heading", { name: "Recent activity", exact: true }),
    ).toBeVisible();
    const events = activity.getByRole("list", { name: "Recent audit events" });
    if (await events.count()) {
      const eventCount = await events.getByRole("listitem").count();
      expect(eventCount).toBeGreaterThan(0);
      expect(eventCount).toBeLessThanOrEqual(5);
    } else {
      await expect(activity.getByText("No activity recorded yet", { exact: true })).toBeVisible();
    }

    await activity.getByRole("link", { name: "View history" }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings#audit-history$/);
    for (const name of ["Account", "Workspace", "Audit history"]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
  });

  test("sidebar navigation reaches the findings registry", async ({ page }) => {
    await page.goto("/dashboard");

    const primaryNav = page.getByRole("navigation", { name: "Primary navigation" });
    await primaryNav.getByRole("link", { name: "Findings" }).click();

    await expect(page).toHaveURL(/\/dashboard\/findings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Findings" })).toBeVisible();
    const records = page.getByRole("table", { name: "Finding records", exact: true });
    if (await records.count()) {
      await expect(records.locator("thead th")).toHaveText([
        "Finding",
        "Affected asset",
        "Verification",
        "Severity",
        "Evidence",
        "Updated",
      ]);
      expect(await records.locator("tbody tr").count()).toBeGreaterThan(0);
    } else {
      await expect(
        page.getByRole("heading", { name: "No findings recorded", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Open investigations", exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Findings");
  });

  test.describe("mobile navigation", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("opens and closes the navigation drawer", async ({ page }) => {
      await page.goto("/dashboard");

      await page.getByRole("button", { name: "Open navigation" }).click();

      const drawer = page.getByRole("dialog", { name: "Navigation" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Projects" })).toBeVisible();

      await drawer.getByRole("button", { name: "Close navigation" }).click();
      await expect(drawer).toBeHidden();
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();

      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();

      await page.getByRole("button", { name: "Open navigation" }).click();
      await drawer.getByRole("link", { name: "Projects", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard\/projects$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Projects", exact: true }),
      ).toBeVisible();
      await expect(drawer).toBeHidden();
    });
  });
});
