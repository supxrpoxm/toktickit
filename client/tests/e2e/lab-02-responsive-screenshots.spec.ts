import { expect, test, type Page } from "@playwright/test";

// Screenshots resolve relative to the client/ cwd (playwright config dir).
// ../artifacts/... from client/ lands in the repo-root artifacts/ folder.
const SCREENSHOT_ROOT = "../artifacts/lab-02/screenshots";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 667 },
] as const;

const MOCK_REQUESTERS = [
  { id: 1, name: "Alice Johnson", email: "alice@company.com" },
  { id: 2, name: "Brandon Lee", email: "brandon@company.com" },
];

const MOCK_TICKETS = [
  {
    id: 101,
    createdAt: "2026-09-04T10:00:00.000Z",
    title: "VPN access request for development team",
    status: "Open",
    priority: "High",
    category: { id: 4, name: "Network" },
  },
  {
    id: 102,
    createdAt: "2026-09-03T09:00:00.000Z",
    title: "Laptop battery drains quickly",
    status: "In Progress",
    priority: "Medium",
    category: { id: 2, name: "Hardware" },
  },
];

const MOCK_TICKET_DETAIL = {
  id: 101,
  title: "VPN access request for development team",
  description: "Remote VPN access is required for the development team to reach staging.",
  status: "Open",
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-04T10:00:00.000Z",
  category: { id: 4, name: "Network" },
  relatedSystem: { id: 3, name: "VPN" },
  attachments: [
    { id: 1, fileName: "vpn-guide.pdf", mimeType: "application/pdf", sizeBytes: 1024 * 350 },
    { id: 2, fileName: "network-diagram-with-a-very-long-file-name-to-test-wrapping.png", mimeType: "image/png", sizeBytes: 1024 * 900 },
  ],
};

async function mockLab02Apis(page: Page) {
  await page.route("**/api/requesters", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REQUESTERS),
    });
  });

  await page.route("**/api/tickets**", async (route) => {
    const url = route.request().url();

    // Ticket detail: /api/tickets/<id> (no /attachments suffix)
    const detailMatch = url.match(/\/api\/tickets\/(\d+)(\?|$)/);
    if (detailMatch && !url.includes("/attachments")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TICKET_DETAIL),
      });
      return;
    }

    if (url.includes("/attachments")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { attachments: [] } }),
      });
      return;
    }

    // List (also handles POST create)
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 103, status: "Open" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tickets: MOCK_TICKETS,
        pagination: { page: 1, limit: 10, total: MOCK_TICKETS.length, totalPages: 1 },
      }),
    });
  });
}

async function selectRequester(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Select Requester" })).toBeVisible();
  await page.getByRole("button", { name: /Alice Johnson/ }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page, viewportWidth: number) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
    };
  });
  // Page must not scroll horizontally (allow 1px rounding tolerance)
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} bodyScroll=${overflow.bodyScrollWidth}`,
  ).toBeLessThanOrEqual(viewportWidth + 1);
}

async function assertZenHeader(page: Page) {
  const headerBg = await page.evaluate(() => {
    const nav = document.querySelector("nav.navbar");
    return nav ? getComputedStyle(nav).backgroundColor : "";
  });
  // #006B3C => rgb(0, 107, 60)
  expect(headerBg).toBe("rgb(0, 107, 60)");
}

async function assertNoClippedLabels(page: Page, viewportWidth: number) {
  const clipped = await page.evaluate((vw) => {
    const bad: string[] = [];
    const els = Array.from(
      document.querySelectorAll("label:not(.visually-hidden), button, input, select, textarea, h1, h2, h3, h4, .alert"),
    );
    for (const el of els) {
      if ((el as HTMLElement).closest(".visually-hidden")) continue;
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // hidden
      if (r.left < -1 || r.right > vw + 1) {
        const label = (el.textContent ?? "").trim().slice(0, 40) || (el as HTMLElement).tagName;
        bad.push(`${(el as HTMLElement).tagName}:${label} left=${Math.round(r.left)} right=${Math.round(r.right)}`);
      }
    }
    return bad;
  }, viewportWidth);
  expect(clipped, `clipped/overflowing elements: ${clipped.join(" | ")}`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  test(`my-tickets @ ${vp.name} (${vp.width}px) screenshot + responsive checks`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockLab02Apis(page);
    page.on("dialog", (d) => void d.dismiss());
    await selectRequester(page);

    // Filters + list must be visible and usable
    await expect(page.getByPlaceholder("Search tickets")).toBeVisible();
    await expect(page.getByLabel("Filter by status")).toBeVisible();
    await expect(page.getByLabel("Sort tickets")).toBeVisible();
    await expect(page.getByText("VPN access request for development team")).toBeVisible();

    await assertZenHeader(page);
    await assertNoHorizontalOverflow(page, vp.width);
    await assertNoClippedLabels(page, vp.width);

    // Pagination visible (Previous/Next) even with single page
    await expect(page.getByRole("button", { name: "Previous" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();

    const out = `${SCREENSHOT_ROOT}/my-tickets/${vp.name}-${vp.width}.png`;
    await page.screenshot({ path: out, fullPage: true });
  });

  test(`create-ticket @ ${vp.name} (${vp.width}px) screenshot + responsive checks`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockLab02Apis(page);
    page.on("dialog", (d) => void d.dismiss());
    await selectRequester(page);

    await page.getByRole("link", { name: /Create Ticket/i }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();

    // Required asterisks + labels visible
    await expect(page.getByLabel(/Category/)).toBeVisible();
    await expect(page.getByPlaceholder("Briefly describe the request")).toBeVisible();
    await expect(
      page.getByPlaceholder("Describe the issue, requested change, or business need."),
    ).toBeVisible();

    // Submit button visible with Zen primary green #006B3C (enabled; validation blocks empty submit)
    const submit = page.getByRole("button", { name: "Submit Ticket" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect
      .poll(async () => submit.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 })
      .toBe("rgb(0, 107, 60)");

    // Fill required fields (button stays enabled, submits when valid)
    await page.getByLabel(/Category/).selectOption("2");
    await page.getByPlaceholder("Briefly describe the request").fill("VPN access request");
    await page
      .getByPlaceholder("Describe the issue, requested change, or business need.")
      .fill("Remote VPN access is required for the development team.");
    const submitEnabled = page.getByRole("button", { name: "Submit Ticket" });
    await expect(submitEnabled).toBeEnabled();
    await expect
      .poll(async () => submitEnabled.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 })
      .toBe("rgb(0, 107, 60)");

    // Read-only fields use pale green #EAF6EF => rgb(234, 246, 239)
    const readonlyBg = await page.evaluate(() => {
      const el = document.querySelector('input[value="TKT-2026-1042"]');
      return el ? getComputedStyle(el).backgroundColor : "";
    });
    expect(readonlyBg).toBe("rgb(234, 246, 239)");

    // Nav links must remain visible (no hidden buttons) at all viewports
    await expect(page.getByRole("link", { name: /My Tickets/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create Ticket/i })).toBeVisible();
    await expect(page.getByLabel("Select requester")).toBeVisible();

    await assertZenHeader(page);
    await assertNoHorizontalOverflow(page, vp.width);
    await assertNoClippedLabels(page, vp.width);

    const out = `${SCREENSHOT_ROOT}/create-ticket/${vp.name}-${vp.width}.png`;
    await page.screenshot({ path: out, fullPage: true });
  });

  test(`ticket-detail @ ${vp.name} (${vp.width}px) screenshot + responsive checks`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockLab02Apis(page);
    page.on("dialog", (d) => void d.dismiss());
    await selectRequester(page);

    await page.getByRole("button", { name: "101", exact: true }).click();
    await expect(page.getByRole("heading", { name: "VPN access request for development team" })).toBeVisible();

    // Metadata + attachments visible
    await expect(page.getByText("Ticket Information")).toBeVisible();
    await expect(page.getByText("Attachments")).toBeVisible();
    await expect(page.locator("#ticket-attachments")).toBeVisible();
    await expect(page.getByText("vpn-guide.pdf")).toBeVisible();
    // Long filename must wrap, not overflow
    await expect(
      page.getByText("network-diagram-with-a-very-long-file-name-to-test-wrapping.png"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Back to My Tickets/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download/i }).first()).toBeVisible();

    await assertZenHeader(page);
    await assertNoHorizontalOverflow(page, vp.width);
    await assertNoClippedLabels(page, vp.width);

    const out = `${SCREENSHOT_ROOT}/ticket-detail/${vp.name}-${vp.width}.png`;
    await page.screenshot({ path: out, fullPage: true });
  });
}
