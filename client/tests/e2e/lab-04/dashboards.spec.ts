import { expect, test, type Page } from "@playwright/test";
import {
  REQUESTER_USER,
  STAFF_USER,
  installLab4Mocks,
  seedLab4State,
} from "./lab4-fixtures";

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const widest = Array.from(document.querySelectorAll<HTMLElement>("table"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const ancestors: Array<Record<string, unknown>> = [];
        let parent = element.parentElement;
        while (parent && ancestors.length < 6) {
          const style = getComputedStyle(parent);
          ancestors.push({
            tag: parent.tagName,
            className: typeof parent.className === "string" ? parent.className : "",
            clientWidth: parent.clientWidth,
            scrollWidth: parent.scrollWidth,
            overflowX: style.overflowX,
            minWidth: style.minWidth,
            display: style.display,
          });
          parent = parent.parentElement;
        }
        return {
          tag: element.tagName,
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          ancestors,
        };
      })
      .filter((entry) => entry.right > root.clientWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 3);
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      widest,
    };
  });
  expect(metrics.scrollWidth <= metrics.clientWidth + 1, JSON.stringify(metrics)).toBe(true);
}

test.describe("Lab 4 dashboards", () => {
  test("staff dashboard shows accurate workload and links into the queue", async ({ page }) => {
    const state = seedLab4State();
    await installLab4Mocks(page, state);

    await page.goto("/staff/dashboard");
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();

    await expect(
      page.getByLabel("My open tickets: 2. Open filtered queue."),
    ).toBeVisible();
    await expect(page.getByLabel("Unassigned: 2. Open filtered queue.")).toBeVisible();
    await expect(page.getByLabel("In progress: 2. Open filtered queue.")).toBeVisible();
    await expect(
      page.getByLabel("Waiting for requester: 1. Open filtered queue."),
    ).toBeVisible();
    await expect(
      page.getByLabel("Requester says resolved: 1. Open filtered queue."),
    ).toBeVisible();
    await expect(
      page.getByLabel("Incomplete actions: 1. Open filtered queue."),
    ).toBeVisible();
    await expect(page.getByLabel("Overdue actions: 1. Open filtered queue.")).toBeVisible();

    const attention = page.getByRole("region", { name: "Needs Attention" });
    await expect(attention.getByText("Badge reader offline")).toBeVisible();
    await expect(attention.getByText("Requester says resolved")).toBeVisible();
    await expect(attention.getByText("Shared drive permissions missing")).toBeVisible();
    await expect(attention.getByText("Overdue action")).toBeVisible();
    await expect(attention.getByText("Waiting for requester")).toBeVisible();

    const myWork = page.getByRole("region", { name: "My Work" });
    const myWorkTable = myWork.locator(".staff-dashboard-table");
    await expect(myWorkTable.getByText("VPN certificate expired")).toBeVisible();
    await expect(myWorkTable.getByText("Shared drive permissions missing")).toBeVisible();
    await expect(myWorkTable.getByText("Badge reader offline")).toHaveCount(0);

    await page.getByLabel("Keyword").fill("VPN");
    await page.getByRole("button", { name: "Search queue" }).click();

    await expect(page).toHaveURL(/\/staff\/queue\?.*search=VPN/);
    await expect(page.getByRole("heading", { name: "My Queue" })).toBeVisible();
    const queueTable = page.locator(".staff-queue-table");
    await expect(queueTable.getByText("VPN certificate expired")).toBeVisible();
    await expect(queueTable.getByText("Payroll export fails")).toHaveCount(0);

    await page.goto("/staff/dashboard");
    await page
      .getByRole("link", { name: "Waiting for requester: 1. Open filtered queue." })
      .click();

    await expect(page).toHaveURL(/status=Waiting\+for\+Requester/);
    await expect(
      page.locator(".staff-queue-table").getByText("Shared drive permissions missing"),
    ).toBeVisible();
    await expect(
      page.locator(".staff-queue-table").getByText("VPN certificate expired"),
    ).toHaveCount(0);
  });

  test("requester dashboard is scoped to the signed-in requester", async ({ page }) => {
    const state = seedLab4State();
    state.currentUser = REQUESTER_USER;
    await installLab4Mocks(page, state);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome, Alice Johnson" })).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Total tickets: 4. View matching tickets." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open: 1. View matching tickets." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "In progress: 2. View matching tickets." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Waiting for you: 1. View matching tickets." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resolved: 0. View matching tickets." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Closed: 0. View matching tickets." }),
    ).toBeVisible();

    const recentTickets = page.getByRole("region", { name: "Recent Tickets" });
    const recentTable = recentTickets.locator(".requester-dashboard-table");
    await expect(recentTable.getByText("VPN certificate expired")).toBeVisible();
    await expect(recentTable.getByText("Payroll export fails")).toHaveCount(0);

    const latestActions = page.getByRole("region", { name: "Latest Actions Taken" });
    const latestActionsTable = latestActions.locator(".requester-dashboard-table");
    await expect(
      latestActionsTable.getByText("Re-applied the finance group membership."),
    ).toBeVisible();
    await expect(
      latestActionsTable.getByText("Shared drive permissions missing"),
    ).toBeVisible();

    const needsAttention = page.getByRole("region", { name: "Needs Your Attention" });
    await expect(
      needsAttention.getByText("Shared drive permissions missing"),
    ).toBeVisible();
    await expect(page.getByText("Internal notes")).toHaveCount(0);

    await page.goto("/staff/dashboard");
    await expect(page.getByText("You don't have access to this area.")).toBeVisible();
  });

  test("dashboard failures show a safe retry state", async ({ page }) => {
    const state = seedLab4State();
    state.failDashboard = true;
    await installLab4Mocks(page, state);

    await page.goto("/staff/dashboard");
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(page.getByText("Unable to load the dashboard right now.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("region", { name: "My Work" })).toHaveCount(0);
  });

  test("responsive dashboard and queue layouts do not overflow", async ({ page }) => {
    const state = seedLab4State();
    await installLab4Mocks(page, state);

    const staffViewports = [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 390, height: 844 },
    ];

    for (const viewport of staffViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      state.currentUser = STAFF_USER;
      await page.goto("/staff/dashboard");
      await expect(
        page.getByLabel("My open tickets: 2. Open filtered queue."),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (viewport.name === "mobile") {
        const statusBox = await page.getByRole("combobox", { name: "Status" }).boundingBox();
        const priorityBox = await page.getByRole("combobox", { name: "Priority" }).boundingBox();
        expect(statusBox).not.toBeNull();
        expect(priorityBox).not.toBeNull();
        expect(priorityBox!.y).toBeGreaterThan(statusBox!.y);
        await expect(page.locator(".staff-dashboard-mobile-card")).toHaveCount(4);
        await expect(page.locator(".staff-dashboard-table").first()).toBeHidden();
      }
      await page.screenshot({
        path: `../artifacts/lab-04/screenshots/staff-dashboard/staff-dashboard-${viewport.name}.png`,
        fullPage: true,
      });
    }

    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      state.currentUser = REQUESTER_USER;
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Welcome, Alice Johnson" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (viewport.name === "mobile") {
        await expect(page.locator(".requester-dashboard-mobile-card")).toHaveCount(5);
        await expect(page.locator(".requester-dashboard-table").first()).toBeHidden();
      }
      await page.screenshot({
        path: `../artifacts/lab-04/screenshots/requester-dashboard/requester-dashboard-${viewport.name}.png`,
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    state.currentUser = STAFF_USER;
    await page.goto("/staff/queue");
    await expect(page.getByRole("heading", { name: "My Queue" })).toBeVisible();
    await expect(page.getByText("Showing 5 of 5 tickets")).toBeVisible();
    await expect(page.locator(".staff-queue-cards article")).toHaveCount(5);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: "../artifacts/lab-04/screenshots/staff-dashboard/staff-queue-mobile.png",
      fullPage: true,
    });

    state.currentUser = REQUESTER_USER;
    await page.goto("/tickets/102");
    await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: "../artifacts/lab-04/screenshots/requester-dashboard/requester-ticket-mobile.png",
      fullPage: true,
    });
  });
});
