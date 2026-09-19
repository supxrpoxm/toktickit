import { expect, test, type Page, type Route } from "@playwright/test";

// Lab 3 (Issue 6) responsive screenshot suite — captures every Lab 3 flow at
// Desktop / Tablet / Mobile viewports into
// artifacts/lab-03/screenshots/<flow>/<viewport>-<screen>.png.
// APIs are route-mocked (same convention as the other lab-03 E2E specs) so
// captures are deterministic. Every protected screen signs in through the
// Login UI with a seeded account from server/prisma/seed.ts
// (initial password: Password123!).

// Screenshots resolve relative to the client/ cwd (playwright config dir).
// ../artifacts/... from client/ lands in the repo-root artifacts/ folder.
const SCREENSHOT_ROOT = "../artifacts/lab-03/screenshots";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 667 },
] as const;

const PASSWORD = "Password123!";

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
};

const ACCOUNTS: Record<string, SessionUser> = {
  "brandon@company.com": {
    id: 4, name: "Brandon Lee", email: "brandon@company.com", role: "Requester",
    isActive: true, requiresPasswordChange: true, mustChangePassword: true,
  },
  "staff1@company.com": {
    id: 7, name: "IT Staff One", email: "staff1@company.com", role: "IT Staff",
    isActive: true, requiresPasswordChange: false, mustChangePassword: false,
  },
  "admin@company.com": {
    id: 11, name: "Admin User", email: "admin@company.com", role: "Administrator",
    isActive: true, requiresPasswordChange: false, mustChangePassword: false,
  },
};

async function fulfill(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

// Session API mock: a shared `session` variable plays the role of the
// httpOnly cookie; only seeded accounts + the initial password sign in.
async function mockAuth(page: Page) {
  let session: SessionUser | null = null;

  await page.route("**/api/health", (route) => fulfill(route, 200, { status: "ok" }));

  await page.route("**/api/auth/me", (route) => {
    if (!session) {
      return fulfill(route, 401, { success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
    }
    return fulfill(route, 200, { success: true, data: { user: session } });
  });

  await page.route("**/api/auth/login", (route) => {
    const payload = route.request().postDataJSON() as { email?: string; password?: string };
    const known = ACCOUNTS[(payload.email ?? "").trim().toLowerCase()] ?? null;
    if (!known || payload.password !== PASSWORD) {
      return fulfill(route, 401, {
        success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
      });
    }
    session = { ...known };
    return fulfill(route, 200, { success: true, data: { user: session } });
  });
}

async function loginAs(page: Page, email: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel(/Email/).fill(email);
  await page.getByPlaceholder("Your password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
}

async function mockCategories(page: Page) {
  await page.route("**/api/categories", (route) =>
    fulfill(route, 200, [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 4, name: "Network" },
    ]),
  );
}

const QUEUE_TICKETS = [
  {
    id: 101, ticketNumber: "TT-0101", title: "Cannot login to VPN", category: "Network",
    requestedPriority: "High", itPriority: "High", status: "Open",
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    createdAt: "2026-09-04T10:00:00.000Z", updatedAt: "2026-09-05T10:00:00.000Z",
  },
  {
    id: 102, ticketNumber: "TT-0102", title: "VPN disconnects during video calls", category: "Network",
    requestedPriority: "Medium", itPriority: "High", status: "In Progress",
    owner: null,
    requester: { id: 4, name: "Brandon Lee" },
    createdAt: "2026-09-03T10:00:00.000Z", updatedAt: "2026-09-04T10:00:00.000Z",
  },
  {
    id: 103, ticketNumber: "TT-0103", title: "Request new laptop", category: "Hardware",
    requestedPriority: "Low", itPriority: "Low", status: "Open",
    owner: { id: 8, name: "IT Staff Two" },
    requester: { id: 5, name: "Carmen Diaz" },
    createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-03T10:00:00.000Z",
  },
  {
    id: 104, ticketNumber: "TT-0104", title: "Reset email password", category: "Account and Access",
    requestedPriority: "Medium", itPriority: "Medium", status: "Resolved",
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 6, name: "Darius Patel" },
    createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z",
  },
];

const DETAIL_COMMENTS = [
  {
    id: 12, ticketId: 101,
    author: { id: 3, name: "Alice Johnson", role: "Requester" },
    body: "Still failing after restart.",
    createdAt: "2026-09-06T10:00:00.000Z",
  },
];

const DETAIL_NOTES = [
  {
    id: 31, ticketId: 101,
    author: { id: 7, name: "IT Staff One", role: "IT Staff" },
    body: "Checking VPN logs for this user.",
    createdAt: "2026-09-06T11:00:00.000Z",
  },
];

// Single dispatching handler for every /api/staff/** path (users, list,
// detail, comments, notes). NOTE: the glob needs `**` — a single `*` does
// not match `/` in Playwright, so it would miss /staff/tickets/101.
async function mockStaffTickets(page: Page) {
  await page.route("**/api/staff/users", (route) =>
    fulfill(route, 200, {
      success: true,
      data: {
        items: [
          { id: 7, name: "IT Staff One", role: "IT Staff" },
          { id: 8, name: "IT Staff Two", role: "IT Staff" },
        ],
      },
    }),
  );

  await page.route("**/api/staff/tickets**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/api/staff/tickets/101/comments" && method === "GET") {
      return fulfill(route, 200, {
        success: true,
        data: { items: DETAIL_COMMENTS, pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
      });
    }
    if (path === "/api/staff/tickets/101/notes" && method === "GET") {
      return fulfill(route, 200, {
        success: true,
        data: { items: DETAIL_NOTES, pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
      });
    }
    if (path === "/api/staff/tickets/101" && method === "GET") {
      return fulfill(route, 200, {
        success: true,
        data: {
          id: 101,
          ticketNumber: "TT-0101",
          title: "Cannot login to VPN",
          description: "Remote access required for the team.",
          status: "In Progress",
          requestedPriority: "High",
          itPriority: "High",
          owner: { id: 7, name: "IT Staff One" },
          requester: { id: 3, name: "Alice Johnson" },
          category: { id: 4, name: "Network" },
          relatedSystem: { id: 3, name: "VPN" },
          attachments: [],
          requesterResolved: false,
          requesterResolvedAt: null,
          commentsCount: DETAIL_COMMENTS.length,
          notesCount: DETAIL_NOTES.length,
          createdAt: "2026-09-04T10:00:00.000Z",
          updatedAt: "2026-09-05T10:00:00.000Z",
        },
      });
    }
    return fulfill(route, 200, {
      success: true,
      data: {
        items: QUEUE_TICKETS,
        pagination: { page: 1, limit: 10, total: QUEUE_TICKETS.length, totalPages: 1 },
      },
    });
  });
}

const ADMIN_USERS = [
  { ...ACCOUNTS["admin@company.com"] },
  {
    id: 3, name: "Alice Johnson", email: "alice@company.com", role: "Requester",
    isActive: true, requiresPasswordChange: false, mustChangePassword: false,
  },
  { ...ACCOUNTS["staff1@company.com"] },
  {
    id: 12, name: "Second Admin", email: "admin2@company.com", role: "Administrator",
    isActive: true, requiresPasswordChange: false, mustChangePassword: false,
  },
];

async function mockAdminUsers(page: Page) {
  await page.route("**/api/admin/users*", (route) =>
    fulfill(route, 200, { success: true, data: { items: ADMIN_USERS } }),
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`lab-03 responsive screenshots (${viewport.name} ${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("authentication: login error and change-password screens", async ({ page }) => {
      await mockAuth(page);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

      await page.getByRole("button", { name: /^Sign in$/ }).click();
      await expect(page.getByText("Email is required.")).toBeVisible();
      await page.screenshot({
        path: `${SCREENSHOT_ROOT}/authentication/${viewport.name}-login-error.png`,
        fullPage: true,
      });

      await loginAs(page, "brandon@company.com");
      await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
      await page.screenshot({
        path: `${SCREENSHOT_ROOT}/authentication/${viewport.name}-change-password.png`,
        fullPage: true,
      });
    });

    test("staff queue: filters and pagination", async ({ page }) => {
      await mockAuth(page);
      await mockCategories(page);
      await mockStaffTickets(page);
      await loginAs(page, "staff1@company.com");

      await expect(page).toHaveURL(/\/staff\/queue/);
      await expect(page.getByRole("heading", { name: "My Queue" })).toBeVisible();
      // Viewport-agnostic: the queue renders a table on desktop and cards
      // on small screens. Wait until the row has rendered in whichever
      // layout is visible (an immediate isVisible check would race the
      // list fetch and pick the wrong branch).
      await page.waitForFunction((rowText) => {
        const visibleWithText = (selector: string) => {
          const el = document.querySelector(selector);
          return !!el && getComputedStyle(el).display !== "none" && (el.textContent ?? "").includes(rowText);
        };
        return visibleWithText(".staff-queue-table") || visibleWithText(".staff-queue-cards");
      }, "Cannot login to VPN");
      await expect(page.getByLabel("Search tickets")).toBeVisible();

      await page.screenshot({
        path: `${SCREENSHOT_ROOT}/staff-queue/${viewport.name}-ticket-queue.png`,
        fullPage: true,
      });
    });

    test("staff ticket detail: comments and notes", async ({ page }) => {
      await mockAuth(page);
      await mockCategories(page);
      await mockStaffTickets(page);
      await loginAs(page, "staff1@company.com");
      await expect(page).toHaveURL(/\/staff\/queue/);

      await page.goto("/staff/tickets/101");
      await expect(page.getByRole("heading", { name: "Cannot login to VPN" })).toBeVisible();
      await expect(page.getByLabel("Ticket owner")).toBeVisible();
      await expect(page.getByLabel("IT Priority")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Public comments/ })).toBeVisible();
      await expect(page.getByText("Still failing after restart.")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Internal notes/ })).toBeVisible();
      await expect(page.getByText("Checking VPN logs for this user.")).toBeVisible();

      await page.screenshot({
        path: `${SCREENSHOT_ROOT}/staff-ticket-detail/${viewport.name}-ticket-detail.png`,
        fullPage: true,
      });
    });

    test("admin user management: list and create-user form", async ({ page }) => {
      await mockAuth(page);
      await mockAdminUsers(page);
      await loginAs(page, "admin@company.com");

      await expect(page).toHaveURL(/\/admin\/users/);
      await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
      // Table on desktop, cards on small screens — wait until the row has
      // rendered in whichever layout is visible (same race as the queue).
      await page.waitForFunction((rowText) => {
        const visibleWithText = (selector: string) => {
          const el = document.querySelector(selector);
          return !!el && getComputedStyle(el).display !== "none" && (el.textContent ?? "").includes(rowText);
        };
        return (
          visibleWithText("div.table-responsive") ||
          Array.from(document.querySelectorAll("article.card")).some(
            (el) => getComputedStyle(el).display !== "none" && (el.textContent ?? "").includes(rowText),
          )
        );
      }, "Alice Johnson");
      await expect(page.getByLabel("Search users")).toBeVisible();

      await page.screenshot({
        path: `${SCREENSHOT_ROOT}/user-management/${viewport.name}-user-list.png`,
        fullPage: true,
      });

      await page.getByRole("button", { name: /^New user$/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({
        path: `${SCREENSHOT_ROOT}/user-management/${viewport.name}-create-user.png`,
        fullPage: true,
      });
    });
  });
}
