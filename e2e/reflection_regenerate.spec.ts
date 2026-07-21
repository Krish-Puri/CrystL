import { test, expect, Page } from "@playwright/test";

test.describe("Reflection Draft Lifecycle", () => {
  // SKIP: requires Supabase auth session for real API calls
  test.skip(true, "Requires Supabase auth — run after connecting Supabase");

  test.beforeEach(async ({ page }) => {
    // Mock summarize endpoint (session start / message send)
    await page.route("**/api/memory/summarize", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          episodic_summary: "Test conversation",
          draft: {
            id: "draft-123",
            content:
              "You spent this session thinking about an upcoming presentation at work. The theme seems to be presentation anxiety.",
            theme_slug: "presentation-anxiety",
            mood: "overwhelmed",
            next_step:
              "Try writing down the three main points you want to cover.",
          },
        }),
      });
    });

    // Mock regenerate endpoint (POST /api/reflections/*/draft)
    let regenerateCallCount = 0;
    await page.route("**/api/reflections/*/draft", async (route) => {
      if (route.request().method() === "POST") {
        regenerateCallCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            draft: {
              id: "draft-456",
              content:
                regenerateCallCount === 1
                  ? "A fresh perspective on your upcoming presentation."
                  : "You seem ready to tackle this presentation with more confidence.",
              theme_slug: "presentation-anxiety",
              mood: "okay",
              next_step: "Practice the opening line three times.",
            },
          }),
        });
      }
    });

    // Mock save reflection endpoint (POST /api/reflections)
    await page.route("**/api/reflections", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reflection: { id: "ref-123", content: "..." },
          }),
        });
      }
    });
  });

  test("full reflection draft lifecycle with regenerate and edit", async ({
    page,
  }) => {
    // 1. App loads → session starts
    await page.goto("/");

    // Wait for app to initialize
    await page.waitForLoadState("networkidle");

    // 2. User sends messages (mock orchestrator)
    const messageInput = page.getByPlaceholder(/message|input/i);
    if (await messageInput.isVisible()) {
      await messageInput.fill("I'm nervous about my presentation next week");
      await messageInput.press("Enter");
      // Wait for the mock response
      await page.waitForTimeout(500);
    }

    // 3. User clicks "End session"
    const endSessionButton = page.getByRole("button", { name: /end session/i });
    await expect(endSessionButton).toBeVisible();
    await endSessionButton.click();

    // 4. "Generating reflection…" loading state appears
    const generatingText = page.getByText(/generating reflection/i);
    await expect(generatingText).toBeVisible({ timeout: 5000 });

    // 5. Reflection draft sheet slides up from bottom
    const draftSheet = page.getByText("Your reflection");
    await expect(draftSheet).toBeVisible({ timeout: 10000 });

    // 6. Draft shows theme tag and mood label
    // Theme slug displayed as title case: "presentation-anxiety" → "Presentation Anxiety"
    const themeTag = page.getByText("Presentation Anxiety");
    await expect(themeTag).toBeVisible();

    // Mood label shown (e.g. "Overwhelmed", "Calm", etc.)
    const moodLabel = page.getByText(/overwhelmed|calm|okay|anxious|confident/i);
    await expect(moodLabel).toBeVisible();

    // 7. User clicks "Regenerate" → button shows "Generating…" state → new draft replaces old
    const regenerateButton = page.getByRole("button", { name: /regenerate/i });
    await expect(regenerateButton).toBeVisible();
    await regenerateButton.click();

    // Button shows "Generating…" state
    const generatingButton = page.getByRole("button", { name: /generating/i });
    await expect(generatingButton).toBeVisible({ timeout: 5000 });

    // Wait for new draft to replace old
    await page.waitForTimeout(1000);

    // Verify new draft content is displayed
    const updatedContent = page.getByText(
      /you seem ready to tackle this presentation with more confidence/i
    );
    await expect(updatedContent).toBeVisible({ timeout: 5000 });

    // 8. User clicks "Edit" → textarea appears with draft content
    const editButton = page.getByRole("button", { name: /edit/i });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Textarea appears with draft content
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });
    const textareaValue = await textarea.inputValue();
    expect(textareaValue.length).toBeGreaterThan(0);

    // 9. User edits content
    await textarea.clear();
    await textarea.fill(
      "I am working on my presentation skills and feeling more confident."
    );

    // 10. User clicks "Save edit" → reflection is saved
    const saveEditButton = page.getByRole("button", { name: /save edit/i });
    await expect(saveEditButton).toBeVisible();
    await saveEditButton.click();

    // 11. Sheet dismisses (draft sheet no longer visible)
    await expect(draftSheet).not.toBeVisible({ timeout: 5000 });
  });

  test("displays all key UI elements on draft sheet", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Trigger session end to show draft sheet
    const messageInput = page.getByPlaceholder(/message|input/i);
    if (await messageInput.isVisible()) {
      await messageInput.fill("Test message");
      await messageInput.press("Enter");
      await page.waitForTimeout(500);
    }

    const endSessionButton = page.getByRole("button", { name: /end session/i });
    await endSessionButton.click();

    // Wait for draft sheet
    const draftSheet = page.getByText("Your reflection");
    await expect(draftSheet).toBeVisible({ timeout: 10000 });

    // Verify "Regenerate" button exists
    await expect(
      page.getByRole("button", { name: /regenerate/i })
    ).toBeVisible();

    // Verify "Edit" button exists
    await expect(
      page.getByRole("button", { name: /edit/i })
    ).toBeVisible();

    // Verify theme is displayed in title case
    await expect(page.getByText("Presentation Anxiety")).toBeVisible();

    // Verify mood label is displayed
    await expect(
      page.getByText(/overwhelmed|calm|okay|anxious|confident/i)
    ).toBeVisible();
  });

  test("textarea appears after clicking Edit", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const messageInput = page.getByPlaceholder(/message|input/i);
    if (await messageInput.isVisible()) {
      await messageInput.fill("Test message");
      await messageInput.press("Enter");
      await page.waitForTimeout(500);
    }

    const endSessionButton = page.getByRole("button", { name: /end session/i });
    await endSessionButton.click();

    // Wait for draft sheet and Edit button
    await expect(page.getByText("Your reflection")).toBeVisible({ timeout: 10000 });
    const editButton = page.getByRole("button", { name: /edit/i });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // After clicking "Edit", a <textarea> appears
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });
});
