import { test, expect } from "@playwright/test";

test.describe("Voice Recording Flow", () => {
  // SKIP: requires Supabase auth session for real API calls
  test.skip(true, "Requires Supabase auth — run after connecting Supabase");

  test.beforeEach(async ({ page }) => {
    // Mock session endpoints
    await page.route("**/api/session", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "test-session-id", is_first_session: true }),
        });
      }
    });

    await page.route("**/api/memory/recent*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ episodic: null }),
      });
    });

    // Mock orchestrate endpoint
    await page.route("**/api/orchestrate", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            content: "I hear you. That sounds really challenging. Take your time.",
            decision: {
              ai: { response: "...", intent: "vent", suggested_phase: "explore" },
              ui: { open_safety: false, show_reflection: false },
              persistence: { update_theme: null, update_mood: null, end_session: false },
              safety_level: 0,
            },
          }),
        });
      }
    });
  });

  test("complete voice recording flow", async ({ page }) => {
    await page.goto("/");

    // 1. MicOrb button is visible in the chat area (72px, with aria-label or onClick handler)
    const micOrb = page.locator('[aria-label*="mic" i], [aria-label*="record" i]').first();
    await expect(micOrb).toBeVisible();

    // Also verify it has expected size
    const micOrbBox = await micOrb.boundingBox();
    expect(micOrbBox?.width).toBe(72);
    expect(micOrbBox?.height).toBe(72);

    // 2. User clicks MicOrb → recording panel appears
    await micOrb.click();

    // Wait for RecordingPanel to appear
    const recordingPanel = page.locator('text="transcript" i').first();
    await expect(recordingPanel).toBeVisible();

    // 3. Recording panel shows the mic in "recording" state (isListening prop)
    // The isListening state is indicated by the breathing scale animation,
    // which we cannot directly test, but we can verify the panel is active
    const transcriptTextarea = page.locator("textarea").first();
    await expect(transcriptTextarea).toBeVisible();

    // 4. User types in the transcript input field
    await transcriptTextarea.fill("I've been feeling really overwhelmed lately");

    // Verify text was typed
    await expect(transcriptTextarea).toHaveValue("I've been feeling really overwhelmed lately");

    // 5. User clicks Send
    const sendButton = page.locator('button:has-text("Send"), [aria-label*="send" i]').first();
    await expect(sendButton).toBeVisible();
    await sendButton.click();

    // 6. Recording panel closes, chat resumes
    // The transcript textarea should no longer be visible or the panel should be closed
    await expect(transcriptTextarea).not.toBeVisible({ timeout: 5000 });

    // 7. AI response appears
    const aiResponse = page.locator("text=I hear you. That sounds really challenging. Take your time.").first();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
  });

  test("MicOrb is clickable and triggers recording panel", async ({ page }) => {
    await page.goto("/");

    // Find MicOrb button with size 72px
    const micOrb = page.locator("button").filter({ has: page.locator('[data-testid*="mic" i]') }).first();

    // Click MicOrb
    await micOrb.click();

    // Verify recording panel appears with transcript textarea
    const transcriptTextarea = page.locator("textarea").first();
    await expect(transcriptTextarea).toBeVisible();
  });

  test("user can type in transcript and send", async ({ page }) => {
    await page.goto("/");

    // Click MicOrb to open recording panel
    const micOrb = page.locator("button").filter({ has: page.locator('[data-testid*="mic" i]') }).first();
    await micOrb.click();

    // Wait for transcript textarea
    const transcriptTextarea = page.locator("textarea").first();
    await expect(transcriptTextarea).toBeVisible();

    // Type in transcript
    await transcriptTextarea.fill("Test voice message");

    // Click send button
    const sendButton = page.locator('button:has-text("Send")').first();
    await sendButton.click();

    // Verify transcript is cleared after sending
    await expect(transcriptTextarea).not.toBeVisible({ timeout: 5000 });
  });
});
