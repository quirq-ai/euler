import { test, expect, type Page } from "@playwright/test";
import { parseSessionDocument } from "../../engine/schema.mjs";

// UI behavior must not depend on third-party photo or font servers being online.
test.beforeEach(async ({ page }) => {
  await page.route(
    /https:\/\/(images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com)/,
    (route) => route.abort(),
  );
});
const dock = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name, exact: true });

async function openReady(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator('[data-app-ready="true"]')).toBeAttached();
  if (new URL(page.url()).pathname !== "/motion") {
    await expect(page.locator("[data-session-status]")).toHaveAttribute(
      "data-session-status",
      "saved",
    );
  }
}

async function waitForSaved(page: Page) {
  await expect(page.locator("[data-session-status]")).toHaveAttribute(
    "data-session-status",
    "saved",
  );
}

async function readSession(page: Page) {
  // Read with the application's browser cookies, including Secure cookies on
  // loopback production previews; APIRequestContext uses different cookie rules.
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/session", { cache: "no-store" });
    if (!response.ok)
      throw new Error("Session read failed: " + response.status);
    return response.json();
  });
  if (
    !result ||
    typeof result !== "object" ||
    !("mode" in result) ||
    result.mode !== "file" ||
    !("session" in result)
  ) {
    throw new Error("Expected a file-backed session response.");
  }
  return {
    mode: "file" as const,
    session: parseSessionDocument(result.session),
  };
}

async function useBrowserStorage(page: Page) {
  await page.route("**/api/session", async (route) => {
    if (route.request().method() !== "GET") {
      throw new Error(
        "Browser persistence must not send activity to the server.",
      );
    }
    await route.fulfill({ json: { mode: "browser", session: null } });
  });
}

test("mobile glass dock, shared review responses, and persisted theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await expect(page).toHaveTitle("Instants");
  await expect(page.locator('.mobile-brand img[alt="quirq"]')).toBeVisible();
  await expect(page.locator(".mobile-nav button")).toHaveCount(5);
  const glass = await page.locator(".mobile-nav").evaluate((el) => ({
    blur: getComputedStyle(el).backdropFilter,
    x: el.getBoundingClientRect().x,
  }));
  expect(glass.blur).toContain("blur(24px)");
  expect(glass.x).toBe(16);
  const post = page.locator(".post-card").first();
  await post.getByRole("button", { name: "Approve", exact: true }).click();
  await post
    .getByRole("button", { name: "View comments", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog
    .getByRole("button", { name: "Needs changes", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    post.getByRole("button", { name: "Needs changes", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(".mobile-header")
    .getByRole("button", { name: "Switch appearance" })
    .click();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await waitForSaved(page);
  await expect(
    post.getByRole("button", { name: "Needs changes", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("navigation restores the feed and repeated Home returns to the top", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await expect(page.locator(".post-card").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(900);
  await dock(page, "Search").click();
  await expect(
    page.getByRole("heading", { name: "Explore", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await dock(page, "Home").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(900);
  await dock(page, "Home").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test("carousel mouse drag, keyboard navigation, and double-click liking", async ({
  page,
}) => {
  await openReady(page);
  const first = page.locator(".post-card").first();
  const track = first.locator(".motion-carousel-track");
  await track.scrollIntoViewIfNeeded();
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, box.y + 100, { steps: 12 });
  await page.mouse.up();
  await expect(first.locator(".slide-count")).toHaveText("2/3");
  await track.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(first.locator(".slide-count")).toHaveText("1/3");
  await track.dblclick();
  await expect(
    first.getByRole("button", { name: "Unlike post", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("team and request-kind filters show the right people and work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await expect(page.locator("[data-queue-id]")).toHaveCount(6);
  await expect(page.locator(".post-card")).toHaveCount(4);
  await page.getByRole("tab", { name: "xo_builders", exact: true }).click();
  await expect(page.locator(".post-card")).toHaveCount(2);
  await expect(page.locator("[data-queue-id]")).toHaveCount(3);
  await expect(page.locator('[data-queue-id="a1"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "quirq_ai", exact: true }).click();
  await expect(page.locator(".post-card")).toHaveCount(2);
  await expect(page.locator("[data-queue-id]")).toHaveCount(3);
  await page.getByRole("button", { name: /^DMs/ }).click();
  await expect(page.locator("[data-queue-id]")).toHaveCount(2);
  await expect(page.locator('[data-queue-id="a1"]')).toBeVisible();
  await expect(page.locator('[data-queue-id="a5"]')).toBeVisible();
  await page.getByRole("tab", { name: "All teams", exact: true }).click();
  await expect(page.locator("[data-queue-id]")).toHaveCount(3);
  for (const [label, id] of [
    ["Comments", "a4"],
    ["Mentions", "a3"],
    ["Reviews", "a2"],
  ]) {
    await page.getByRole("button", { name: new RegExp("^" + label) }).click();
    await expect(page.locator("[data-queue-id]")).toHaveCount(1);
    await expect(page.locator('[data-queue-id="' + id + '"]')).toBeVisible();
  }
  await dock(page, "Search").click();
  await page.getByRole("tab", { name: "Testing", exact: true }).click();
  await expect(page.locator(".explore-tile")).toHaveCount(2);
  await page.getByRole("tab", { name: "Research", exact: true }).click();
  await expect(page.locator(".explore-tile")).toHaveCount(2);
});

test("reply queue waits for you, swipes between requests and dismisses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await page.locator('[data-queue-id="a1"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("A quick look at the handoff?");
  // Request dialogs must never disappear on an Instagram-style story timer.
  await page.clock.install();
  await page.clock.fastForward(12_000);
  await expect(dialog).toContainText("A quick look at the handoff?");
  await page.clock.resume();
  const frame = page.locator(".attention-swipe-zone");
  const box = (await frame.boundingBox())!;
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 180, y, { steps: 10 });
  await page.mouse.up();
  await expect(dialog).toContainText("Your design approval is up next");
  const nextBox = (await frame.boundingBox())!;
  await page.mouse.move(
    nextBox.x + nextBox.width * 0.6,
    nextBox.y + nextBox.height * 0.65,
  );
  await page.mouse.down();
  await page.mouse.move(
    nextBox.x + nextBox.width * 0.6,
    nextBox.y + nextBox.height * 0.65 + 140,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-queue-id="a1"]')).toBeVisible();
});

test("queue replies reach the correct post or DM and survive a refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await expect(page.locator("[data-session-mode]")).toHaveAttribute(
    "data-session-mode",
    "file",
  );
  const comment = "The empty-state copy is clear. Please ship v0.8.";
  await page.locator('[data-queue-id="a4"]').click();
  await page
    .getByRole("textbox", { name: "Your reply", exact: true })
    .fill(comment);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await waitForSaved(page);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-queue-id="a4"]')).toHaveCount(0);
  const dm = "The human checkpoint is clear. Ready for our team sync.";
  await page.locator('[data-queue-id="a1"]').click();
  await page.getByRole("textbox", { name: "Your reply", exact: true }).fill(dm);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await waitForSaved(page);
  await page.keyboard.press("Escape");
  await page.reload();
  await waitForSaved(page);
  await expect(page.locator('[data-queue-id="a4"]')).toHaveCount(0);
  await expect(page.locator('[data-queue-id="a1"]')).toHaveCount(0);
  await expect(page.locator("[data-queue-id]")).toHaveCount(4);
  await page
    .locator(".post-card")
    .filter({ hasText: "james.chen" })
    .getByRole("button", { name: "View comments", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(comment, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(dm, { exact: false }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await dock(page, "Messages").click();
  await page
    .locator(".thread-row")
    .filter({ hasText: "Ella Williams" })
    .click();
  await expect(
    page.locator(".message-bubble").filter({ hasText: dm }),
  ).toBeVisible();
  await expect(
    page.locator(".message-bubble").filter({ hasText: comment }),
  ).toHaveCount(0);
  const result = await readSession(page);
  expect(result.mode).toBe("file");
  expect(
    result.session.activity.filter(
      (event: { type: string }) => event.type === "queue.reply",
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({ itemId: "a4", text: comment }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ itemId: "a1", text: dm }),
      }),
    ]),
  );
});

test("browser storage persists a review response and an ordinary DM", async ({
  page,
}) => {
  await useBrowserStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await expect(page.locator("[data-session-mode]")).toHaveAttribute(
    "data-session-mode",
    "browser",
  );
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await dock(page, "Messages").click();
  await page
    .locator(".thread-row")
    .filter({ hasText: "Ella Williams" })
    .click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("I will review the handoff before our sync.");
  await page
    .locator(".message-input")
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await waitForSaved(page);
  await page.reload();
  await waitForSaved(page);
  await expect(
    page
      .locator(".post-card")
      .first()
      .getByRole("button", { name: "Approve", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-queue-id="a1"]')).toHaveCount(0);
  await dock(page, "Messages").click();
  await page
    .locator(".thread-row")
    .filter({ hasText: "Ella Williams" })
    .click();
  await expect(
    page.getByText("I will review the handoff before our sync.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("a full device store keeps the draft and leaves the request unresolved", async ({
  page,
}) => {
  await useBrowserStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("instants-session-v1"),
  );
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "instants-session-v1")
        throw new DOMException("Device storage is full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.locator('[data-queue-id="a1"]').click();
  const reply = page.getByRole("textbox", { name: "Your reply", exact: true });
  await reply.fill("Please keep this unsent draft.");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.locator("[data-session-status]")).toHaveAttribute(
    "data-session-status",
    "error",
  );
  await expect(reply).toHaveValue("Please keep this unsent draft.");
  expect(
    await page.evaluate(() => localStorage.getItem("instants-session-v1")),
  ).toBe(before);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-queue-id="a1"]')).toBeVisible();
  await page.reload();
  await waitForSaved(page);
  await expect(page.locator('[data-queue-id="a1"]')).toBeVisible();
});

test("an unreadable device session is preserved for recovery", async ({
  page,
}) => {
  await useBrowserStorage(page);
  await page.addInitScript(() =>
    localStorage.setItem("instants-session-v1", "{this is not valid JSON"),
  );
  await page.goto("/");
  await expect(page.locator("[data-session-mode]")).toHaveAttribute(
    "data-session-mode",
    "unavailable",
  );
  await expect(page.locator("[data-session-status]")).toHaveAttribute(
    "data-session-status",
    "error",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("instants-session-v1")),
  ).toBe("{this is not valid JSON");
});

test("an interrupted local save exports the pending reply and retries once after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  let unavailable = true;
  const attemptedIds: string[] = [];
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") {
      attemptedIds.push(
        ...route
          .request()
          .postDataJSON()
          .events.map((event: { id: string }) => event.id),
      );
      if (unavailable) {
        await route.fulfill({
          status: 503,
          json: {
            error: "storage_unavailable",
            message: "Activity could not be saved. Please try again.",
          },
        });
        return;
      }
    }
    await route.continue();
  });
  const replyText =
    "The checkpoint is ready. Please include it in our team review.";
  await page.locator('[data-queue-id="a1"]').click();
  await page
    .getByRole("textbox", { name: "Your reply", exact: true })
    .fill(replyText);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.locator("[data-session-status]")).toHaveAttribute(
    "data-session-status",
    "error",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-queue-id="a1"]')).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Export session", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^instants-session-[a-f0-9-]+\.json$/,
  );
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(exported.schemaVersion).toBe(1);
  const pendingReply = exported.activity.find(
    (event: { type: string }) => event.type === "queue.reply",
  );
  expect(pendingReply.data).toMatchObject({
    itemId: "a1",
    userId: "ella",
    text: replyText,
  });
  expect(attemptedIds).toContain(pendingReply.id);
  const outboxKey = "instants-outbox:" + exported.id;
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "[]").length,
      outboxKey,
    ),
  ).toBe(1);
  unavailable = false;
  await page.reload();
  await waitForSaved(page);
  await expect(page.locator('[data-queue-id="a1"]')).toHaveCount(0);
  const result = await readSession(page);
  const savedReplies = result.session.activity.filter(
    (event: { type: string }) => event.type === "queue.reply",
  );
  expect(savedReplies).toHaveLength(1);
  expect(savedReplies[0].id).toBe(pendingReply.id);
  expect(attemptedIds.every((id) => id === pendingReply.id)).toBe(true);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), outboxKey),
  ).toBeNull();
  await page.reload();
  await waitForSaved(page);
  const reloaded = await readSession(page);
  expect(
    reloaded.session.activity.filter(
      (event: { type: string }) => event.type === "queue.reply",
    ),
  ).toHaveLength(1);
});

test("sharing to two teammates is atomic when device storage fails", async ({
  page,
}) => {
  await useBrowserStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("instants-session-v1"),
  );
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "Share post", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator(".search-result")
    .filter({ hasText: "Ella Williams" })
    .click();
  await dialog
    .locator(".search-result")
    .filter({ hasText: "James Chen" })
    .click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failNextWrite = true;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "instants-session-v1" && failNextWrite) {
        failNextWrite = false;
        throw new DOMException("Device storage is full", "QuotaExceededError");
      }
      original.call(this, key, value);
    };
  });
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("[data-session-status]")).toHaveAttribute(
    "data-session-status",
    "error",
  );
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".share-people .checked")).toHaveCount(2);
  expect(
    await page.evaluate(() => localStorage.getItem("instants-session-v1")),
  ).toBe(before);
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await waitForSaved(page);
  const activity = await page.evaluate(
    () => JSON.parse(localStorage.getItem("instants-session-v1")!).activity,
  );
  const messages = activity.filter(
    (event: { type: string }) => event.type === "message.send",
  );
  expect(messages).toHaveLength(2);
  expect(
    messages
      .map((event: { data: { userId: string } }) => event.data.userId)
      .sort(),
  ).toEqual(["ella", "james"]);
  expect(new Set(messages.map((event: { id: string }) => event.id)).size).toBe(
    2,
  );
  await page.reload();
  await waitForSaved(page);
  await dock(page, "Messages").click();
  for (const name of ["Ella Williams", "James Chen"]) {
    await page.locator(".thread-row").filter({ hasText: name }).click();
    await expect(
      page.locator(".message-bubble").filter({ hasText: "Shared work:" }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Back to inbox", exact: true })
      .click();
  }
});

test("sharing work rejects unsupported uploads and persists a raster preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page);
  await page
    .locator(".mobile-header")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const upload = dialog.locator('input[type="file"]');
  await upload.setInputFiles({
    name: "vector.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(
    page.getByText("Choose a PNG, JPEG, WebP, GIF or AVIF image.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.locator(".upload-area")).toBeVisible();
  await upload.setInputFiles({
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(1024 * 1024 + 1),
  });
  await expect(
    page.getByText("Choose an image no larger than 1 MB.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".upload-area")).toBeVisible();
  await upload.setInputFiles({
    name: "review.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO5kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const caption = "Please review the empty state for keyboard navigation.";
  await dialog
    .getByRole("textbox", { name: "Write a caption", exact: true })
    .fill(caption);
  await dialog
    .getByRole("button", { name: "Share to your feed", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await waitForSaved(page);
  await expect(page.locator(".post-card").first()).toContainText(caption);
  await page.reload();
  await waitForSaved(page);
  const post = page.locator(".post-card").first();
  await expect(post).toContainText(caption);
  await expect(post.locator('img[src^="data:image/png;base64,"]')).toHaveCount(
    1,
  );
  const result = await readSession(page);
  const created = result.session.activity.filter(
    (event) => event.type === "post.create",
  );
  expect(created).toHaveLength(1);
  expect(created[0].data.post).toMatchObject({
    userId: "you",
    companyId: "quirq_ai",
    workType: "Feedback",
    caption,
  });
});

test("motion lab controls, focus return, and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, "/motion");
  await expect(
    page.getByRole("heading", { name: "Made to feel natural." }),
  ).toBeVisible();
  await expect(page.getByText("Reduced motion is on")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Scroll preview", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator(".motion-lab-phone-scroll").evaluate((el) => el.scrollTop),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Preview Profile dock state" })
    .click();
  await expect(
    page.getByRole("button", { name: "Preview Profile dock state" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    parseFloat(
      await page
        .locator(".motion-lab-dock-indicator")
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ),
  ).toBeLessThanOrEqual(0.001);
  const open = page.getByRole("button", { name: "Open dialog" });
  await open.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await page.getByRole("button", { name: "Open sheet" }).click();
  const choice = page.locator(".motion-lab-audience button").nth(1);
  const choiceTitle = await choice.locator("strong").innerText();
  await choice.click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".motion-lab-saved-choice")).toHaveText(
    choiceTitle,
  );
});

test("native touch swipe and double tap work in the feed", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.route(
    /https:\/\/(images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com)/,
    (route) => route.abort(),
  );
  await openReady(
    page,
    process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5180",
  );
  const first = page.locator(".post-card").first();
  const track = first.locator(".motion-carousel-track");
  await track.scrollIntoViewIfNeeded();
  const box = (await track.boundingBox())!;
  const client = await context.newCDPSession(page);
  // Start above the Next button's expanded touch target.
  const y = box.y + box.height * 0.3;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width - 40, y }],
  });
  for (let step = 1; step <= 12; step++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + box.width - 40 - step * 24, y }],
    });
    await page.waitForTimeout(16);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(first.locator(".slide-count")).toHaveText("2/3");
  await page.touchscreen.tap(box.x + 120, y);
  await page.touchscreen.tap(box.x + 120, y);
  await expect(
    first.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
  await context.close();
});
