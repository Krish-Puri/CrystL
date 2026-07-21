import { test, expect } from "@playwright/test";

test.describe("Safety Crisis Flow", () => {
  // SKIP: requires Supabase auth session for real API calls
  test.skip(true, "Requires Supabase auth — run after connecting Supabase");

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

  test("safety overlay appears for crisis-related message and shows helpline resources", async ({ page }) => {
    // 1. App loads and user starts a session
    await expect(page.locator("body")).toBeVisible();

    // 2. Session greeting appears - select mood and mode to reach chat
    const greeting = page.locator("text=/how are you|what's on your mind|how are you feeling/i");
    await expect(
      greeting.or(page.locator('[data-testid="mood-picker"]')).or(page.locator('[data-testid="mode-picker"]'))
    ).toBeVisible({ timeout: 10000 });

    // Select a mood
    const moodOption = page
      .locator("button, [role='button']")
      .filter({ hasText: /okay|good|great|not great|struggling/i })
      .first();
    if (await moodOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await moodOption.click();
    }

    // Select a conversation mode
    const modeOption = page
      .locator("button, [role='button']")
      .filter({ hasText: /deep work|quick chat|explore|creative|focused/i })
      .first();
    if (await modeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modeOption.click();
    }

    // Wait for chat state
    await page.waitForTimeout(1000);

    // 3. Mock orchestrate to return safety trigger response
    await page.route("**/api/orchestrate", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            content: "This should NOT be shown in safety level 2",
            decision: {
              open_safety: true,
              safety_level: 2,
              show_reflection: false,
            },
            phase: "support",
          }),
        });
      }
    });

    // 4. User types a crisis-related message
    const messageInput = page.locator("textarea, [contenteditable='true'], input[type='text']").first();
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill("I want to die");

    // Find and click send button
    const sendButton = page.locator("button").filter({ hasText: /send|submit|go/i }).first();
    await sendButton.click();

    // 5. Safety overlay appears (NOT a regular AI response)
    // The safety overlay should be visible - look for its distinctive content
    const safetyOverlay = page.locator("text=/I'm really glad you told me|you don't have to carry this/i");
    await expect(safetyOverlay).toBeVisible({ timeout: 10000 });

    // 6. Safety overlay shows crisis helpline resources
    // US Suicide & Crisis Lifeline: 988
    await expect(page.locator("text=/988/")).toBeVisible({ timeout: 5000 });
    // Crisis Text Line: 741741
    await expect(page.locator("text=/741741/")).toBeVisible({ timeout: 5000 });

    // 7. Safety overlay does NOT contain AI-generated response about dying
    const aiDyingResponse = page.locator("text=/This should NOT be shown in safety level 2/");
    await expect(aiDyingResponse).not.toBeVisible({ timeout: 3000 });

    // 8. "Continue talking" button exists and is clickable
    const continueTalkingButton = page.locator("button").filter({ hasText: /continue talking with me/i });
    await expect(continueTalkingButton).toBeVisible({ timeout: 5000 });

    // 9. Clicking "Continue talking" returns to chat (overlay dismisses)
    await continueTalkingButton.click();
    await expect(safetyOverlay).not.toBeVisible({ timeout: 5000 });
  });

  test("safety overlay also triggers for alternative crisis phrasing", async ({ page }) => {
    // 1. App loads
    await expect(page.locator("body")).toBeVisible();

    // 2. Navigate to chat
    const greeting = page.locator("text=/how are you|what's on your mind/i");
    await expect(greeting.or(page.locator('[data-testid="mood-picker"]'))).toBeVisible({ timeout: 10000 });

    const moodOption = page
      .locator("button, [role='button']")
      .filter({ hasText: /okay|good/i })
      .first();
    if (await moodOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await moodOption.click();
    }

    const modeOption = page
      .locator("button, [role='button']")
      .filter({ hasText: /deep work|quick chat/i })
      .first();
    if (await modeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modeOption.click();
    }

    await page.waitForTimeout(1000);

    // 3. Mock orchestrate for safety
    await page.route("**/api/orchestrate", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            content: "Ignore this AI response",
            decision: {
              open_safety: true,
              safety_level: 2,
              show_reflection: false,
            },
            phase: "support",
          }),
        });
      }
    });

    // 4. User types alternate crisis message
    const messageInput = page.locator("textarea, [contenteditable='true'], input[type='text']").first();
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill("I don't want to be alive anymore");

    const sendButton = page.locator("button").filter({ hasText: /send|submit|go/i }).first();
    await sendButton.click();

    // 5. Safety overlay appears
    const safetyOverlay = page.locator("text=/I'm really glad you told me/i");
    await expect(safetyOverlay).toBeVisible({ timeout: 10000 });

    // 6. Helpline resources visible
    await expect(page.locator("text=/988/")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=/741741/")).toBeVisible({ timeout: 5000 });

    // 7. Continue talking returns to chat
    const continueTalkingButton = page.locator("button").filter({ hasText: /continue talking with me/i });
    await expect(continueTalkingButton).toBeVisible({ timeout: 5000 });
    await continueTalkingButton.click();

    await expect(safetyOverlay).not.toBeVisible({ timeout: 5000 });
  });

  test("safety overlay contains warm bounded message - not AI-generated", async ({ page }) => {
    // Setup session to chat
    await expect(page.locator("body")).toBeVisible();

    const greeting = page.locator("text=/how are you|what's on your mind/i");
    await expect(greeting.or(page.locator('[data-testid="mood-picker"]'))).toBeVisible({ timeout: 10000 });

    const moodOption = page
      .locator("button, [role='button']")
      .filter({ hasText: /okay|good/i })
      .first();
    if (await moodOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await moodOption.click();
    }

    const modeOption = page
      .locator("button, [role='button']")
      .filter({ hasText: /deep work|quick chat/i })
      .first();
    if (await modeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modeOption.click();
    }

    await page.waitForTimeout(1000);

    // Mock orchestrate returning safety trigger with a deceptive AI response
    await page.route("**/api/orchestrate", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            content: "Here's why you shouldn't die - AI generated response",
            decision: {
              open_safety: true,
              safety_level: 2,
              show_reflection: false,
            },
            phase: "support",
          }),
        });
      }
    });

    // Type crisis message
    const messageInput = page.locator("textarea, [contenteditable='true'], input[type='text']").first();
    await messageInput.fill("I want to die");
    const sendButton = page.locator("button").filter({ hasText: /send|submit|go/i }).first();
    await sendButton.click();

    // Safety overlay should be shown
    const safetyOverlay = page.locator("text=/I'm really glad you told me/i");
    await expect(safetyOverlay).toBeVisible({ timeout: 10000 });

    // The AI-generated content should NOT appear in the safety overlay
    await expect(page.locator("text=/Here's why you shouldn't die/")).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=/AI generated response/")).not.toBeVisible({ timeout: 3000 });

    // Helplines should be present
    await expect(page.locator("text=/988/")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=/741741/")).toBeVisible({ timeout: 5000 });
  });
});
