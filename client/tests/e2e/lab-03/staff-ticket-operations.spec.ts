import { expect, test, type Page, type Route } from "@playwright/test";

// Lab 3 (Issue 4) E2E: IT Staff ticket operations — claim/assign, IT
// Priority, status transitions with confirmations, Public Comments vs.
// Internal Notes visual separation, and the Requester resolved signal.

const STAFF = {
  id: 7,
  name: "IT Staff One",
  email: "staff1@company.com",
  role: "IT Staff",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const STAFF_TWO = { id: 8, name: "IT Staff Two" };

const REQUESTER = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

type Entry = {
  id: number;
  ticketId: number;
  author: { id: number; name: string; role: string };
  body: string;
  createdAt: string;
};

type World = {
  status: string;
  owner: { id: number; name: string } | null;
  itPriority: string;
  requesterResolved: boolean;
  comments: Entry[];
  notes: Entry[];
};

function freshWorld(): World {
  return {
    status: "Open",
    owner: null,
    itPriority: "High",
    requesterResolved: false,
    comments: [
      {
        id: 12,
        ticketId: 101,
        author: { id: 3, name: "Alice Johnson", role: "Requester" },
        body: "Still failing after restart.",
        createdAt: "2026-09-06T10:00:00.000Z",
      },
    ],
    notes: [
      {
        id: 31,
        ticketId: 101,
        author: { id: 7, name: "IT Staff One", role: "IT Staff" },
        body: "Checking VPN logs for this user.",
        createdAt: "2026-09-06T11:00:00.000Z",
      },
    ],
  };
}

// Mirror of the server transition matrix (specification BR-17) so the mock
// API enforces legal vs. illegal transitions like the real backend.
const ALLOWED: Record<string, string[]> = {
  New: ["Open", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Cancelled: ["Reopened"],
  Reopened: ["Open", "In Progress", "Cancelled"],
};

function staffDetailBody(world: World) {
  return {
    success: true,
    data: {
      id: 101,
      ticketNumber: "TT-0101",
      title: "Cannot login to VPN",
      description: "Remote access required for the team.",
      status: world.status,
      requestedPriority: "High",
      itPriority: world.itPriority,
      owner: world.owner,
      requester: { id: 3, name: "Alice Johnson" },
      category: { id: 4, name: "Network" },
      relatedSystem: { id: 3, name: "VPN" },
      attachments: [],
      requesterResolved: world.requesterResolved,
      requesterResolvedAt: world.requesterResolved ? "2026-09-07T10:00:00.000Z" : null,
      commentsCount: world.comments.length,
      notesCount: world.notes.length,
      createdAt: "2026-09-04T10:00:00.000Z",
      updatedAt: "2026-09-05T10:00:00.000Z",
    },
  };
}

function requesterTicketBody(world: World) {
  return {
    id: 101,
    title: "Cannot login to VPN",
    description: "Remote access required for the team.",
    status: world.status,
    priority: "High",
    itPriority: world.itPriority,
    owner: world.owner,
    requesterResolved: world.requesterResolved,
    requesterResolvedAt: world.requesterResolved ? "2026-09-07T10:00:00.000Z" : null,
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    category: { name: "Network" },
    relatedSystem: { name: "VPN" },
    requester: { id: 3, name: "Alice Johnson" },
    attachments: [],
  };
}

async function fulfill(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockWorld(page: Page, session: typeof STAFF | typeof REQUESTER, world: World) {
  await page.unrouteAll({ behavior: "wait" });

  await page.route("**/api/health", (route) => fulfill(route, 200, { status: "ok" }));
  await page.route("**/api/auth/me", (route) =>
    fulfill(route, 200, { success: true, data: { user: session } }),
  );
  await page.route("**/api/categories", (route) => fulfill(route, 200, []));

  const staffOnly = async (route: Route) => {
    if (session.role !== "IT Staff") {
      await fulfill(route, 403, { success: false, error: { code: "FORBIDDEN", message: "No access." } });
      return false;
    }
    return true;
  };

  await page.route("**/api/staff/users", async (route) => {
    if (!(await staffOnly(route))) return;
    await fulfill(route, 200, {
      success: true,
      data: { items: [{ id: 7, name: "IT Staff One", role: "IT Staff" }, { id: 8, name: "IT Staff Two", role: "IT Staff" }] },
    });
  });

  await page.route("**/api/staff/tickets**", async (route) => {
    if (!(await staffOnly(route))) return;
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === "/api/staff/tickets/101/owner" && method === "PATCH") {
      const body = route.request().postDataJSON() as { claim?: boolean; ownerId?: number | null };
      if (body.claim === true) {
        world.owner = { id: STAFF.id, name: STAFF.name };
        await fulfill(route, 200, { success: true, data: { id: 101, owner: world.owner } });
        return;
      }
      if (body.ownerId === null || body.ownerId === undefined) {
        world.owner = null;
        await fulfill(route, 200, { success: true, data: { id: 101, owner: null } });
        return;
      }
      if (body.ownerId === STAFF_TWO.id) {
        world.owner = { ...STAFF_TWO };
        await fulfill(route, 200, { success: true, data: { id: 101, owner: world.owner } });
        return;
      }
      await fulfill(route, 422, {
        success: false,
        error: { code: "INVALID_ASSIGNEE", message: "Tickets can only be assigned to an active IT Staff or Administrator user.", fields: { ownerId: "Invalid assignee." } },
      });
      return;
    }

    if (path === "/api/staff/tickets/101/priority" && method === "PATCH") {
      const body = route.request().postDataJSON() as { itPriority?: string };
      if (!["Low", "Medium", "High"].includes(body.itPriority ?? "")) {
        await fulfill(route, 400, {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Bad priority.", fields: { itPriority: "Must be Low, Medium, or High." } },
        });
        return;
      }
      world.itPriority = body.itPriority!;
      await fulfill(route, 200, { success: true, data: { id: 101, requestedPriority: "High", itPriority: world.itPriority } });
      return;
    }

    if (path === "/api/staff/tickets/101/status" && method === "PATCH") {
      const body = route.request().postDataJSON() as { status?: string };
      const next = body.status ?? "";
      if (!(ALLOWED[world.status] ?? []).includes(next)) {
        const allowed = ALLOWED[world.status] ?? [];
        await fulfill(route, 422, {
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot move from ${world.status} to ${next}. Allowed: ${allowed.join(", ")}.`,
            fields: { status: `Allowed transitions from ${world.status}: ${allowed.join(", ")}.` },
          },
        });
        return;
      }
      world.status = next;
      await fulfill(route, 200, { success: true, data: { id: 101, status: world.status, updatedAt: "2026-09-07T10:00:00.000Z" } });
      return;
    }

    if (path === "/api/staff/tickets/101/comments" && method === "GET") {
      await fulfill(route, 200, {
        success: true,
        data: { items: world.comments, pagination: { page: 1, limit: 50, total: world.comments.length, totalPages: 1 } },
      });
      return;
    }
    if (path === "/api/staff/tickets/101/comments" && method === "POST") {
      const body = route.request().postDataJSON() as { body?: string };
      if (!body.body?.trim()) {
        await fulfill(route, 400, { success: false, error: { code: "VALIDATION_ERROR", message: "Bad.", fields: { body: "Required." } } });
        return;
      }
      const entry: Entry = {
        id: 100 + world.comments.length,
        ticketId: 101,
        author: { id: STAFF.id, name: STAFF.name, role: "IT Staff" },
        body: body.body.trim(),
        createdAt: "2026-09-07T10:00:00.000Z",
      };
      world.comments.push(entry);
      await fulfill(route, 201, { success: true, data: entry });
      return;
    }

    if (path === "/api/staff/tickets/101/notes" && method === "GET") {
      await fulfill(route, 200, {
        success: true,
        data: { items: world.notes, pagination: { page: 1, limit: 50, total: world.notes.length, totalPages: 1 } },
      });
      return;
    }
    if (path === "/api/staff/tickets/101/notes" && method === "POST") {
      const body = route.request().postDataJSON() as { body?: string };
      const entry: Entry = {
        id: 200 + world.notes.length,
        ticketId: 101,
        author: { id: STAFF.id, name: STAFF.name, role: "IT Staff" },
        body: (body.body ?? "").trim(),
        createdAt: "2026-09-07T11:00:00.000Z",
      };
      world.notes.push(entry);
      await fulfill(route, 201, { success: true, data: entry });
      return;
    }

    if (path === "/api/staff/tickets/101" && method === "GET") {
      await fulfill(route, 200, staffDetailBody(world));
      return;
    }

    await fulfill(route, 404, { success: false, error: { code: "NOT_FOUND", message: "Missing." } });
  });

  await page.route("**/api/tickets/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === "/api/tickets/101/comments" && method === "GET") {
      if (session.role !== "Requester") {
        await fulfill(route, 403, { success: false, error: { code: "FORBIDDEN", message: "No access." } });
        return;
      }
      await fulfill(route, 200, {
        success: true,
        data: { items: world.comments, pagination: { page: 1, limit: 50, total: world.comments.length, totalPages: 1 } },
      });
      return;
    }
    if (path === "/api/tickets/101/comments" && method === "POST") {
      const body = route.request().postDataJSON() as { body?: string };
      const entry: Entry = {
        id: 100 + world.comments.length,
        ticketId: 101,
        author: { id: REQUESTER.id, name: REQUESTER.name, role: "Requester" },
        body: (body.body ?? "").trim(),
        createdAt: "2026-09-07T12:00:00.000Z",
      };
      world.comments.push(entry);
      await fulfill(route, 201, { success: true, data: entry });
      return;
    }
    if (path === "/api/tickets/101/resolved-signal" && method === "POST") {
      if (session.role !== "Requester") {
        await fulfill(route, 403, { success: false, error: { code: "FORBIDDEN", message: "No access." } });
        return;
      }
      world.requesterResolved = true;
      await fulfill(route, 200, {
        success: true,
        data: { id: 101, requesterResolved: true, requesterResolvedAt: "2026-09-07T10:00:00.000Z" },
      });
      return;
    }
    if (path === "/api/tickets/101" && method === "GET") {
      await fulfill(route, 200, requesterTicketBody(world));
      return;
    }
    await fulfill(route, 404, { success: false, error: { code: "NOT_FOUND", message: "Missing." } });
  });
}

test.describe("lab-03 staff ticket operations (E-02 detail part)", () => {
  test("staff claims, reprioritizes, and advances a ticket", async ({ page }) => {
    await mockWorld(page, STAFF, freshWorld());
    await page.goto("/staff/tickets/101");

    await expect(page.getByRole("heading", { name: "Cannot login to VPN" })).toBeVisible();
    await expect(page.getByText("Ticket TT-0101")).toBeVisible();

    // Claim ownership of the unassigned ticket.
    await page.getByRole("button", { name: "Claim this ticket" }).click();
    await expect(page.getByText("Ticket claimed. You are now the owner.")).toBeVisible();
    await expect(page.getByLabel("Ticket owner")).toHaveValue("7");

    // Change IT Priority; Requested Priority stays put.
    await page.getByLabel("IT Priority").selectOption("Low");
    await page.getByRole("button", { name: "Save priority" }).click();
    await expect(page.getByText("IT Priority set to Low.")).toBeVisible();

    // Non-destructive transition applies immediately.
    await page.getByLabel("Status", { exact: true }).selectOption("In Progress");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Status changed to In Progress.")).toBeVisible();
  });

  test("destructive status changes require confirmation, illegal ones show the allowed list", async ({ page }) => {
    await mockWorld(page, STAFF, freshWorld());
    await page.goto("/staff/tickets/101");

    await expect(page.getByRole("heading", { name: "Cannot login to VPN" })).toBeVisible();

    // Destructive target opens a confirmation modal first.
    await page.getByLabel("Status", { exact: true }).selectOption("Cancelled");
    await page.getByRole("button", { name: "Save status" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Change status to Cancelled?");
    await expect(dialog).toContainText("without a resolution");
    await dialog.getByRole("button", { name: "Confirm change" }).click();
    await expect(page.getByText("Status changed to Cancelled.")).toBeVisible();

    // From Cancelled, only Reopened is legal — Closed is rejected with the list.
    await page.getByLabel("Status", { exact: true }).selectOption("Closed");
    await page.getByRole("button", { name: "Save status" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
    await expect(page.getByText(/Allowed: Reopened/)).toBeVisible();
  });

  test("ownership changes and threads stay separated end to end", async ({ page }) => {
    const world = freshWorld();
    await mockWorld(page, STAFF, world);
    await page.goto("/staff/tickets/101");

    await expect(page.getByRole("heading", { name: "Cannot login to VPN" })).toBeVisible();

    // Reassign to another staff member via the select.
    await page.getByLabel("Ticket owner").selectOption("8");
    await page.getByRole("button", { name: "Save owner" }).click();
    await expect(page.getByText("Owner updated to IT Staff Two.")).toBeVisible();

    // Visual separation: slate internal header vs. public card.
    await expect(page.getByRole("heading", { name: /Public comments/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Internal notes/ })).toBeVisible();
    await expect(page.getByText("Only staff see this")).toBeVisible();
    const stripeColor = await page
      .locator(".thread-internal > div")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(stripeColor).toBe("rgb(51, 65, 85)");

    // A public reply lands in the public thread only.
    await page.getByLabel("Reply publicly").fill("A fix is on the way.");
    await page.getByRole("button", { name: "Post public reply" }).click();
    const publicCard = page.locator(".thread-public");
    await expect(publicCard.getByText("A fix is on the way.")).toBeVisible();

    // An internal note lands in the internal thread only.
    await page.getByLabel(/Add a private note/).fill("Do not tell the requester yet.");
    await page.getByRole("button", { name: /Add internal note/ }).click();
    const internalCard = page.locator(".thread-internal");
    await expect(internalCard.getByText("Do not tell the requester yet.")).toBeVisible();
    await expect(publicCard.getByText("Do not tell the requester yet.")).not.toBeVisible();
  });

  test("requester sees public thread and signals resolution; staff sees the chip", async ({ page }) => {
    const world = freshWorld();
    await mockWorld(page, REQUESTER, world);
    await page.goto("/tickets/101");

    await expect(page.getByRole("heading", { name: "Cannot login to VPN" })).toBeVisible();
    // Public thread is visible; internal notes are never rendered.
    await expect(page.getByText("Still failing after restart.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Internal notes/ })).not.toBeVisible();
    await expect(page.getByText("Checking VPN logs for this user.")).not.toBeVisible();

    // Requesters cannot formally close: no status control, only the signal.
    await expect(page.getByLabel("Status", { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Problem appears resolved" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("You indicated this problem appears resolved")).toBeVisible();

    // The same flag surfaces as the staff chip on the staff detail.
    await mockWorld(page, STAFF, world);
    await page.goto("/staff/tickets/101");
    await expect(page.getByText("Requester says resolved")).toBeVisible();
    await expect(page.getByText("Still failing after restart.")).toBeVisible();
  });
});
