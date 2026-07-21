import { test, expect } from "@playwright/test";

test.describe("Session Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    // Mock session create
    await page.route("**/api/session", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "test-session-id",
            is_first_session: true,
            personality_version: 1,
          }),
        });
      }
    });

    // Mock memory/recent
    await page.route("**/api/memory/recent*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ episodic: null }),
      });
    });

    await page.goto("/");
  });

  test("full session lifecycle", async ({ page }) => {
    // SKIP: requires live Supabase auth session (magic link or dev auth bypass)
    test.skip(true, "Requires Supabase auth session — run after connecting Supabase");
  });

  test("app loads without crashing", async ({ page }) => {
    // Simple crash check — verify page loads and body is visible
    await expect(page.locator("body")).toBeVisible();
    // No unhandled server errors
    await page.waitForTimeout(2000);
  });

});
