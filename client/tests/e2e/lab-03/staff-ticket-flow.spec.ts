import { expect, test, type Page, type Route } from "@playwright/test";

// Lab 3 (Issue 3) E2E: IT Staff queue flow — search, filter, pagination,
// open-detail navigation, and requester forbidden handling.

type MockTicket = {
  id: number;
  title: string;
  category: string;
  requestedPriority: string;
  itPriority: string;
  status: string;
  owner: { id: number; name: string } | null;
  requester: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
};

const STAFF = {
  id: 7,
  name: "IT Staff One",
  email: "staff1@company.com",
  role: "IT Staff",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const REQUESTER = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

function ticketNumber(id: number): string {
  return `TT-${String(id).padStart(4, "0")}`;
}

const BASE_TICKETS: MockTicket[] = [
  {
    id: 101, title: "Cannot login to VPN", category: "Network",
    requestedPriority: "High", itPriority: "High", status: "Open",
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    createdAt: "2026-09-04T10:00:00.000Z", updatedAt: "2026-09-05T10:00:00.000Z",
  },
  {
    id: 102, title: "VPN disconnects during video calls", category: "Network",
    requestedPriority: "Medium", itPriority: "High", status: "In Progress",
    owner: null,
    requester: { id: 4, name: "Brandon Lee" },
    createdAt: "2026-09-03T10:00:00.000Z", updatedAt: "2026-09-04T10:00:00.000Z",
  },
  {
    id: 103, title: "Request new laptop", category: "Hardware",
    requestedPriority: "Low", itPriority: "Low", status: "Open",
    owner: { id: 8, name: "IT Staff Two" },
    requester: { id: 5, name: "Carmen Diaz" },
    createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-03T10:00:00.000Z",
  },
  {
    id: 104, title: "Reset email password", category: "Account and Access",
    requestedPriority: "Medium", itPriority: "Medium", status: "Resolved",
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 6, name: "Darius Patel" },
    createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z",
  },
];

// Extra rows so pagination has a second page (UI page size is 10).
const EXTRA_TICKETS: MockTicket[] = Array.from({ length: 8 }, (_, i) => ({
  id: 200 + i,
  title: `Routine workstation check ${i + 1}`,
  category: "Hardware",
  requestedPriority: "Low",
  itPriority: "Low",
  status: "Closed",
  owner: null,
  requester: { id: 3, name: "Alice Johnson" },
  createdAt: `2026-08-${String(10 + i).padStart(2, "0")}T10:00:00.000Z`,
  updatedAt: `2026-08-${String(11 + i).padStart(2, "0")}T10:00:00.000Z`,
}));

const ALL_TICKETS = [...BASE_TICKETS, ...EXTRA_TICKETS];

function toItem(ticket: MockTicket) {
  return { ...ticket, ticketNumber: ticketNumber(ticket.id) };
}

async function fulfillQueue(route: Route) {
  const url = new URL(route.request().url());
  const q = url.searchParams;
  const search = (q.get("search") ?? "").toLowerCase();
  const status = q.get("status") ?? "";
  const itPriority = q.get("itPriority") ?? "";
  const owner = q.get("owner") ?? "";
  const categoryId = q.get("categoryId") ?? "";
  const page = Math.max(1, Number(q.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(q.get("limit")) || 10));

  let rows = ALL_TICKETS.filter((t) => {
    if (search && !(`${t.id} tt-${String(t.id).padStart(4, "0")} ${t.title}`.toLowerCase().includes(search))) return false;
    if (status && t.status !== status) return false;
    if (itPriority && t.itPriority !== itPriority) return false;
    if (owner === "unassigned" && t.owner !== null) return false;
    if (owner === "me" && t.owner?.id !== STAFF.id) return false;
    if (categoryId && !t.category.toLowerCase().includes(categoryId === "4" ? "network" : "###")) return false;
    return true;
  });

  const sort = q.get("sort") ?? "updatedAt:desc";
  rows = [...rows].sort((a, b) => {
    if (sort === "title:asc") return a.title.localeCompare(b.title) || a.id - b.id;
    if (sort === "createdAt:asc") return a.createdAt.localeCompare(b.createdAt) || a.id - b.id;
    if (sort === "createdAt:desc") return b.createdAt.localeCompare(a.createdAt) || a.id - b.id;
    return b.updatedAt.localeCompare(a.updatedAt) || a.id - b.id;
  });

  const total = rows.length;
  const items = rows.slice((page - 1) * limit, page * limit).map(toItem);

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
    }),
  });
}

async function mockStaffSession(page: Page, session: typeof STAFF | typeof REQUESTER | null, queueStatus = 200) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
  });

  await page.route("**/api/auth/me", async (route) => {
    if (!session) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user: session } }),
    });
  });

  await page.route("**/api/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 4, name: "Network" },
      ]),
    });
  });

  await page.route("**/api/staff/tickets/*", async (route) => {
    if (!session || session.role === "Requester" || queueStatus !== 200) {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "FORBIDDEN", message: "No access." } }),
      });
      return;
    }
    const match = route.request().url().match(/\/api\/staff\/tickets\/(\d+)/);
    const ticket = ALL_TICKETS.find((t) => t.id === Number(match?.[1]));
    if (!ticket) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Missing." } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...toItem(ticket),
          description: "Remote access required for the team.",
          relatedSystem: { id: 3, name: "VPN" },
          attachments: [],
        },
      }),
    });
  });

  await page.route("**/api/staff/tickets*", async (route) => {
    if (!session || session.role === "Requester" || queueStatus !== 200) {
      await route.fulfill({
        status: session ? 403 : 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: session ? "FORBIDDEN" : "UNAUTHENTICATED" } }),
      });
      return;
    }
    await fulfillQueue(route);
  });
}

test.describe("lab-03 staff ticket flow (E-02 queue part)", () => {
  test("staff lands on My Queue with rows, badges, and role nav", async ({ page }) => {
    await mockStaffSession(page, STAFF);
    await page.goto("/");

    await expect(page).toHaveURL(/\/staff\/queue/);
    await expect(page.getByRole("heading", { name: "My Queue" })).toBeVisible();
    const table = page.locator(".staff-queue-table");
    await expect(table.getByText("Cannot login to VPN")).toBeVisible();
    await expect(table.getByText("TT-0101")).toBeVisible();
    await expect(table.getByText("Unassigned").first()).toBeVisible();
    await expect(table.getByText("IT Staff One").first()).toBeVisible();
    // Requester destinations are hidden for staff.
    await expect(page.getByRole("link", { name: /My Tickets/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Create Ticket/i })).not.toBeVisible();
  });

  test("search narrows the queue and clearing restores it", async ({ page }) => {
    await mockStaffSession(page, STAFF);
    await page.goto("/staff/queue");
    const table = page.locator(".staff-queue-table");

    await expect(table.getByText("Cannot login to VPN")).toBeVisible();
    await page.getByLabel("Search tickets").fill("vpn");

    await expect(table.getByText("VPN disconnects during video calls")).toBeVisible();
    await expect(table.getByText("Request new laptop")).not.toBeVisible();

    await page.getByLabel("Search tickets").fill("");
    await expect(table.getByText("Request new laptop")).toBeVisible();
  });

  test("status and ownership filters combine", async ({ page }) => {
    await mockStaffSession(page, STAFF);
    await page.goto("/staff/queue");
    const table = page.locator(".staff-queue-table");

    await page.getByLabel("Filter by status").selectOption("Open");
    await expect(table.getByText("Cannot login to VPN")).toBeVisible();
    await expect(table.getByText("VPN disconnects during video calls")).not.toBeVisible();

    await page.getByLabel("Filter by ownership").selectOption("unassigned");
    await expect(table.getByText("Cannot login to VPN")).not.toBeVisible();
    await expect(page.getByText("No matching tickets")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).last().click();
    await expect(table.getByText("Cannot login to VPN")).toBeVisible();
  });

  test("pagination walks through the queue", async ({ page }) => {
    await mockStaffSession(page, STAFF);
    await page.goto("/staff/queue");

    await expect(page.getByText("Showing 10 of 12 tickets")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Showing 2 of 12 tickets")).toBeVisible();
    await expect(page.getByRole("button", { name: "2", exact: true }).first()).toBeVisible();
  });

  test("open navigates to the staff ticket detail and back", async ({ page }) => {
    await mockStaffSession(page, STAFF);
    await page.goto("/staff/queue");

    await page.getByRole("button", { name: "Open ticket TT-0101" }).first().click();

    await expect(page).toHaveURL(/\/staff\/tickets\/101/);
    await expect(page.getByRole("heading", { name: "Cannot login to VPN" })).toBeVisible();
    await expect(page.getByText("Ticket TT-0101")).toBeVisible();
    await expect(page.getByText("Remote access required for the team.")).toBeVisible();

    await page.getByRole("button", { name: /Back to My Queue/i }).click();
    await expect(page).toHaveURL(/\/staff\/queue/);
    await expect(page.getByRole("heading", { name: "My Queue" })).toBeVisible();
  });

  test("requester gets the forbidden screen with no queue data", async ({ page }) => {
    await mockStaffSession(page, REQUESTER);
    await page.goto("/staff/queue");

    await expect(page.getByText(/You don't have access to this area/)).toBeVisible();
    await expect(page.getByText("Cannot login to VPN")).not.toBeVisible();
    await expect(page.getByText("TT-0101")).not.toBeVisible();
  });
});
