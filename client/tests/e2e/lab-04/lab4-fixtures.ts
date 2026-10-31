import type { Page } from "@playwright/test";

export type Lab4User = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
};

export type Lab4Person = {
  id: number;
  name: string;
  role: string;
};

export type Lab4Action = {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string;
  performedBy: Lab4Person;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Lab4Ticket = {
  id: number;
  title: string;
  description: string;
  status: string;
  requestedPriority: string;
  itPriority: string | null;
  owner: { id: number; name: string } | null;
  requester: { id: number; name: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string } | null;
  requesterResolved: boolean;
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  notesCount: number;
  actions: Lab4Action[];
};

export type Lab4State = {
  currentUser: Lab4User;
  tickets: Lab4Ticket[];
  nextActionId: number;
  failDashboard?: boolean;
};

export const STAFF_USER: Lab4User = {
  id: 7,
  name: "IT Staff One",
  email: "staff1@company.com",
  role: "IT Staff",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

export const STAFF_TWO: Lab4User = {
  id: 8,
  name: "IT Staff Two",
  email: "staff2@company.com",
  role: "IT Staff",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

export const ADMIN_USER: Lab4User = {
  id: 9,
  name: "Admin User",
  email: "admin@company.com",
  role: "Administrator",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

export const REQUESTER_USER: Lab4User = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

export const OTHER_REQUESTER: Lab4User = {
  id: 4,
  name: "Brandon Lee",
  email: "brandon@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const ACTIVE_STATUSES = new Set([
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Reopened",
]);

const OPEN_STATUSES = new Set(["New", "Open", "Reopened"]);

const PRIORITY_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function person(user: Lab4User): Lab4Person {
  return { id: user.id, name: user.name, role: user.role };
}

function ticketNumber(id: number): string {
  return `TT-${String(id).padStart(4, "0")}`;
}

function actionItem(action: Lab4Action) {
  return {
    ...action,
    ticketNumber: ticketNumber(action.ticketId),
  };
}

function queueItem(ticket: Lab4Ticket) {
  return {
    id: ticket.id,
    ticketNumber: ticketNumber(ticket.id),
    title: ticket.title,
    category: ticket.category.name,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    owner: ticket.owner,
    requester: ticket.requester,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function staffDashboardTicket(ticket: Lab4Ticket, cutoff: number, reasons?: string[]) {
  const followUps = ticket.actions.filter((action) => action.followUpRequired);
  return {
    id: ticket.id,
    ticketNumber: ticketNumber(ticket.id),
    title: ticket.title,
    status: ticket.status,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    owner: ticket.owner,
    requester: ticket.requester,
    requesterResolved: ticket.requesterResolved,
    category: ticket.category.name,
    relatedSystem: ticket.relatedSystem?.name ?? null,
    incompleteActionCount: followUps.length,
    overdueActionCount: followUps.filter(
      (action) => new Date(action.actionAt).getTime() < cutoff,
    ).length,
    ...(reasons ? { attentionReasons: reasons } : {}),
    updatedAt: ticket.updatedAt,
  };
}

function requesterTicket(ticket: Lab4Ticket) {
  return {
    id: ticket.id,
    ticketNumber: ticketNumber(ticket.id),
    title: ticket.title,
    status: ticket.status,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    owner: ticket.owner,
    category: ticket.category.name,
    relatedSystem: ticket.relatedSystem?.name ?? null,
    updatedAt: ticket.updatedAt,
  };
}

function dashboardAction(action: Lab4Action & { ticketTitle?: string }) {
  const item = actionItem(action);
  return {
    ...item,
    ticketTitle: action.ticketTitle ?? `Ticket ${item.ticketId}`,
    summary: action.description,
    details: action.result,
    status: action.followUpRequired ? "Open" : "Completed",
    dueAt: null,
    completedAt: action.followUpRequired ? null : action.updatedAt,
  };
}

function withTicketTitle(ticket: Lab4Ticket, action: Lab4Action) {
  return {
    ...action,
    ticketTitle: ticket.title,
  };
}

export function seedLab4State(): Lab4State {
  return {
    currentUser: STAFF_USER,
    nextActionId: 700,
    tickets: [
      {
        id: 101,
        title: "VPN certificate expired",
        description: "Remote access fails after the certificate expired.",
        status: "In Progress",
        requestedPriority: "High",
        itPriority: "High",
        owner: { id: STAFF_USER.id, name: STAFF_USER.name },
        requester: { id: REQUESTER_USER.id, name: REQUESTER_USER.name },
        category: { id: 4, name: "Network" },
        relatedSystem: { id: 3, name: "VPN" },
        requesterResolved: false,
        requesterResolvedAt: null,
        createdAt: isoHoursAgo(72),
        updatedAt: isoHoursAgo(1),
        commentsCount: 0,
        notesCount: 0,
        actions: [],
      },
      {
        id: 102,
        title: "Shared drive permissions missing",
        description: "The requester cannot open the finance shared drive.",
        status: "Waiting for Requester",
        requestedPriority: "Medium",
        itPriority: "Medium",
        owner: { id: STAFF_USER.id, name: STAFF_USER.name },
        requester: { id: REQUESTER_USER.id, name: REQUESTER_USER.name },
        category: { id: 1, name: "Account and Access" },
        relatedSystem: { id: 2, name: "File Share" },
        requesterResolved: false,
        requesterResolvedAt: null,
        createdAt: isoHoursAgo(96),
        updatedAt: isoHoursAgo(48),
        commentsCount: 0,
        notesCount: 0,
        actions: [
          {
            id: 501,
            ticketId: 102,
            actionAt: isoHoursAgo(48),
            description: "Re-applied the finance group membership.",
            result: "Waiting for the requester to confirm access after signing out and back in.",
            performedBy: person(STAFF_USER),
            followUpRequired: true,
            followUpNote: "Confirm access after the group change.",
            attachmentNotes: null,
            version: 1,
            createdAt: isoHoursAgo(48),
            updatedAt: isoHoursAgo(48),
          },
        ],
      },
      {
        id: 103,
        title: "New monitor flickers",
        description: "The second monitor flickers when connected through the dock.",
        status: "Open",
        requestedPriority: "Low",
        itPriority: "Low",
        owner: null,
        requester: { id: REQUESTER_USER.id, name: REQUESTER_USER.name },
        category: { id: 2, name: "Hardware" },
        relatedSystem: { id: 5, name: "Laptop" },
        requesterResolved: false,
        requesterResolvedAt: null,
        createdAt: isoHoursAgo(30),
        updatedAt: isoHoursAgo(3),
        commentsCount: 0,
        notesCount: 0,
        actions: [],
      },
      {
        id: 104,
        title: "Badge reader offline",
        description: "The east entrance badge reader is not responding.",
        status: "In Progress",
        requestedPriority: "High",
        itPriority: "High",
        owner: null,
        requester: { id: REQUESTER_USER.id, name: REQUESTER_USER.name },
        category: { id: 2, name: "Hardware" },
        relatedSystem: { id: 6, name: "Badge Reader" },
        requesterResolved: true,
        requesterResolvedAt: isoHoursAgo(2),
        createdAt: isoHoursAgo(20),
        updatedAt: isoHoursAgo(0.5),
        commentsCount: 0,
        notesCount: 0,
        actions: [],
      },
      {
        id: 201,
        title: "Payroll export fails",
        description: "The monthly payroll export stops at 80 percent.",
        status: "Open",
        requestedPriority: "Medium",
        itPriority: "Medium",
        owner: { id: STAFF_TWO.id, name: STAFF_TWO.name },
        requester: { id: OTHER_REQUESTER.id, name: OTHER_REQUESTER.name },
        category: { id: 7, name: "Software" },
        relatedSystem: { id: 8, name: "Payroll" },
        requesterResolved: false,
        requesterResolvedAt: null,
        createdAt: isoHoursAgo(50),
        updatedAt: isoHoursAgo(4),
        commentsCount: 0,
        notesCount: 0,
        actions: [],
      },
    ],
  };
}

function json(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function ok(data: unknown) {
  return json(200, { success: true, data });
}

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json(status, { success: false, error: { code, message, ...extra } });
}

function actionForTicket(ticket: Lab4Ticket, actionId: number) {
  return ticket.actions.find((action) => action.id === actionId);
}

function staffDashboard(state: Lab4State) {
  const active = state.tickets.filter((ticket) => ACTIVE_STATUSES.has(ticket.status));
  const own = active.filter((ticket) => ticket.owner?.id === state.currentUser.id);
  const unassigned = active.filter((ticket) => ticket.owner === null);
  const cutoff = Date.now() - 24 * 3_600_000;
  const allFollowUps = active.flatMap((ticket) =>
    ticket.actions.filter((action) => action.followUpRequired),
  );

  const attention = active
    .map((ticket) => {
      const reasons: string[] = [];
      const overdue = ticket.actions.filter(
        (action) =>
          action.followUpRequired && new Date(action.actionAt).getTime() < cutoff,
      ).length;
      if (ticket.requesterResolved) reasons.push("Requester says resolved");
      if (overdue > 0) reasons.push("Overdue action");
      if (ticket.status === "Waiting for Requester") reasons.push("Waiting for requester");
      const rank = ticket.requesterResolved ? 0 : overdue > 0 ? 1 : 2;
      return { ticket, reasons, rank };
    })
    .filter((entry) => entry.reasons.length > 0)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        new Date(a.ticket.updatedAt).getTime() - new Date(b.ticket.updatedAt).getTime() ||
        a.ticket.id - b.ticket.id,
    );

  const recentActions = state.tickets
    .flatMap((ticket) => ticket.actions.map((action) => withTicketTitle(ticket, action)))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map(dashboardAction);

  const sortedOwn = [...own].sort(
    (a, b) =>
      (PRIORITY_RANK[b.itPriority ?? ""] ?? 0) - (PRIORITY_RANK[a.itPriority ?? ""] ?? 0) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return {
    summary: {
      myOpenTickets: own.length,
      unassignedTickets: unassigned.length,
      inProgressTickets: active.filter((ticket) => ticket.status === "In Progress").length,
      waitingForRequester: active.filter(
        (ticket) => ticket.status === "Waiting for Requester",
      ).length,
      requesterResolvedTickets: active.filter((ticket) => ticket.requesterResolved).length,
      incompleteActions: allFollowUps.length,
      overdueActions: allFollowUps.filter(
        (action) => new Date(action.actionAt).getTime() < cutoff,
      ).length,
    },
    myWork: sortedOwn.slice(0, 5).map((ticket) => staffDashboardTicket(ticket, cutoff)),
    unassigned: [...unassigned]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((ticket) => staffDashboardTicket(ticket, cutoff)),
    attention: attention
      .slice(0, 5)
      .map(({ ticket, reasons }) => staffDashboardTicket(ticket, cutoff, reasons)),
    recentActions,
    generatedAt: new Date().toISOString(),
  };
}

function requesterDashboard(state: Lab4State) {
  const own = state.tickets.filter((ticket) => ticket.requester.id === state.currentUser.id);
  const sorted = [...own].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const latestActions = own
    .flatMap((ticket) => ticket.actions.map((action) => withTicketTitle(ticket, action)))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map(dashboardAction);

  return {
    summary: {
      totalTickets: own.length,
      openTickets: own.filter((ticket) => OPEN_STATUSES.has(ticket.status)).length,
      inProgressTickets: own.filter((ticket) => ticket.status === "In Progress").length,
      waitingForRequester: own.filter(
        (ticket) => ticket.status === "Waiting for Requester",
      ).length,
      resolvedTickets: own.filter((ticket) => ticket.status === "Resolved").length,
      closedTickets: own.filter((ticket) => ticket.status === "Closed").length,
      cancelledTickets: own.filter((ticket) => ticket.status === "Cancelled").length,
    },
    recentTickets: sorted.slice(0, 5).map(requesterTicket),
    latestActions,
    needsAttention: sorted
      .filter((ticket) => ticket.status === "Waiting for Requester")
      .slice(0, 5)
      .map(requesterTicket),
    generatedAt: new Date().toISOString(),
  };
}

function filterQueue(state: Lab4State, url: URL) {
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "";
  const itPriority =
    url.searchParams.get("itPriority") ?? url.searchParams.get("priority") ?? "";
  const requestedPriority = url.searchParams.get("requestedPriority") ?? "";
  const owner = url.searchParams.get("owner") ?? "";
  const categoryId = url.searchParams.get("categoryId") ?? "";
  const department = (url.searchParams.get("department") ?? "").trim().toLowerCase();
  const sort = url.searchParams.get("sort") ?? "updatedAt:desc";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));

  const rows = state.tickets.filter((ticket) => {
    if (
      search &&
      !`${ticket.id} ${ticketNumber(ticket.id)} ${ticket.title} ${ticket.description}`
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }
    if (status && ticket.status !== status) return false;
    if (itPriority && ticket.itPriority !== itPriority) return false;
    if (requestedPriority && ticket.requestedPriority !== requestedPriority) return false;
    if (owner === "unassigned" && ticket.owner !== null) return false;
    if (owner === "me" && ticket.owner?.id !== state.currentUser.id) return false;
    if (
      owner &&
      owner !== "all" &&
      owner !== "me" &&
      owner !== "unassigned" &&
      ticket.owner?.id !== Number(owner)
    ) {
      return false;
    }
    if (categoryId && String(ticket.category.id) !== categoryId) return false;
    if (
      department &&
      !`${ticket.category.name} ${ticket.relatedSystem?.name ?? ""}`
        .toLowerCase()
        .includes(department)
    ) {
      return false;
    }
    return true;
  });

  rows.sort((a, b) => {
    if (sort === "title:asc") return a.title.localeCompare(b.title) || a.id - b.id;
    if (sort === "createdAt:asc") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id;
    }
    if (sort === "createdAt:desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id - b.id;
    }
    if (sort === "itPriority:desc") {
      return (
        (PRIORITY_RANK[b.itPriority ?? ""] ?? 0) -
          (PRIORITY_RANK[a.itPriority ?? ""] ?? 0) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || a.id - b.id;
  });

  const total = rows.length;
  return {
    items: rows.slice((page - 1) * limit, page * limit).map(queueItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function installLab4Mocks(
  page: Page,
  state: Lab4State,
): Promise<Lab4State> {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const ticketMatch = path.match(/^\/api\/tickets\/(\d+)$/);
    const requesterActionsMatch = path.match(/^\/api\/tickets\/(\d+)\/actions$/);
    const requesterCommentsMatch = path.match(/^\/api\/tickets\/(\d+)\/comments$/);
    const resolvedSignalMatch = path.match(/^\/api\/tickets\/(\d+)\/resolved-signal$/);
    const staffTicketMatch = path.match(/^\/api\/staff\/tickets\/(\d+)$/);
    const staffActionsMatch = path.match(/^\/api\/staff\/tickets\/(\d+)\/actions$/);
    const staffActionMatch = path.match(/^\/api\/staff\/tickets\/(\d+)\/actions\/(\d+)$/);
    const staffCommentsMatch = path.match(/^\/api\/staff\/tickets\/(\d+)\/comments$/);
    const staffNotesMatch = path.match(/^\/api\/staff\/tickets\/(\d+)\/notes$/);
    const staffStatusMatch = path.match(/^\/api\/staff\/tickets\/(\d+)\/status$/);

    if (path === "/api/health") {
      await route.fulfill(json(200, { status: "ok" }));
      return;
    }

    if (path === "/api/auth/me") {
      await route.fulfill(ok({ user: state.currentUser }));
      return;
    }

    if (path === "/api/auth/logout") {
      await route.fulfill(ok({ loggedOut: true }));
      return;
    }

    if (path === "/api/categories") {
      await route.fulfill(
        json(200, [
          { id: 1, name: "Account and Access" },
          { id: 2, name: "Hardware" },
          { id: 4, name: "Network" },
          { id: 7, name: "Software" },
        ]),
      );
      return;
    }

    if (path === "/api/staff/dashboard" && method === "GET") {
      if (state.failDashboard) {
        await route.fulfill(fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
        return;
      }
      await route.fulfill(ok(staffDashboard(state)));
      return;
    }

    if (path === "/api/requester/dashboard" && method === "GET") {
      if (state.failDashboard) {
        await route.fulfill(fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
        return;
      }
      await route.fulfill(ok(requesterDashboard(state)));
      return;
    }

    if (path === "/api/staff/tickets" && method === "GET") {
      await route.fulfill(ok(filterQueue(state, url)));
      return;
    }

    if (path === "/api/staff/users" && method === "GET") {
      await route.fulfill(
        ok({
          items: [STAFF_USER, STAFF_TWO, ADMIN_USER].map((user) => ({
            id: user.id,
            name: user.name,
            role: user.role,
          })),
        }),
      );
      return;
    }

    if (staffTicketMatch && method === "GET") {
      const ticket = state.tickets.find((item) => item.id === Number(staffTicketMatch[1]));
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      await route.fulfill(
        ok({
          id: ticket.id,
          ticketNumber: ticketNumber(ticket.id),
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          requestedPriority: ticket.requestedPriority,
          itPriority: ticket.itPriority,
          owner: ticket.owner,
          requester: ticket.requester,
          category: ticket.category,
          relatedSystem: ticket.relatedSystem,
          attachments: [],
          requesterResolved: ticket.requesterResolved,
          requesterResolvedAt: ticket.requesterResolvedAt,
          commentsCount: ticket.commentsCount,
          notesCount: ticket.notesCount,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        }),
      );
      return;
    }

    if (staffActionsMatch && method === "GET") {
      const ticket = state.tickets.find((item) => item.id === Number(staffActionsMatch[1]));
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      const items = [...ticket.actions]
        .sort(
          (a, b) =>
            new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime() || b.id - a.id,
        )
        .map(actionItem);
      await route.fulfill(
        ok({
          items,
          pagination: { page: 1, limit: 50, total: items.length, totalPages: 1 },
        }),
      );
      return;
    }

    if (staffActionsMatch && method === "POST") {
      const ticket = state.tickets.find((item) => item.id === Number(staffActionsMatch[1]));
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      if (state.currentUser.role === "Requester") {
        await route.fulfill(fail(403, "FORBIDDEN", "You don't have access to this area."));
        return;
      }
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      const now = new Date().toISOString();
      const action: Lab4Action = {
        id: state.nextActionId++,
        ticketId: ticket.id,
        actionAt: typeof body.actionAt === "string" ? body.actionAt : now,
        description: typeof body.description === "string" ? body.description : "",
        result: typeof body.result === "string" ? body.result : "",
        performedBy: person(state.currentUser),
        followUpRequired: body.followUpRequired === true,
        followUpNote: typeof body.followUpNote === "string" ? body.followUpNote : null,
        attachmentNotes: typeof body.attachmentNotes === "string" ? body.attachmentNotes : null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      ticket.actions.push(action);
      ticket.updatedAt = now;
      await route.fulfill(json(201, { success: true, data: actionItem(action) }));
      return;
    }

    if (staffActionMatch && method === "PATCH") {
      const ticket = state.tickets.find((item) => item.id === Number(staffActionMatch[1]));
      const action = ticket ? actionForTicket(ticket, Number(staffActionMatch[2])) : undefined;
      if (!ticket || !action) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that action."));
        return;
      }
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      if (body.version !== action.version) {
        await route.fulfill(
          json(409, {
            success: false,
            error: {
              code: "STALE_UPDATE",
              message: "This action was updated by someone else. Review the latest version and try again.",
              conflict: {
                expectedVersion: body.version,
                currentVersion: action.version,
                current: actionItem(action),
              },
            },
          }),
        );
        return;
      }
      const now = new Date().toISOString();
      if (typeof body.description === "string") action.description = body.description;
      if (typeof body.result === "string") action.result = body.result;
      if (typeof body.actionAt === "string") action.actionAt = body.actionAt;
      if (typeof body.followUpRequired === "boolean") {
        action.followUpRequired = body.followUpRequired;
      }
      if (body.followUpNote === null || typeof body.followUpNote === "string") {
        action.followUpNote = body.followUpNote;
      }
      if (body.attachmentNotes === null || typeof body.attachmentNotes === "string") {
        action.attachmentNotes = body.attachmentNotes;
      }
      action.version += 1;
      action.updatedAt = now;
      ticket.updatedAt = now;
      await route.fulfill(ok(actionItem(action)));
      return;
    }

    if (staffStatusMatch && method === "PATCH") {
      const ticket = state.tickets.find((item) => item.id === Number(staffStatusMatch[1]));
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      const next = typeof body.status === "string" ? body.status : "";
      if (next === "Resolved" && ticket.actions.length === 0) {
        await route.fulfill(
          fail(
            409,
            "RESOLUTION_REQUIRED_ACTIONS",
            "Record at least one Action Taken before resolving this ticket.",
            { actionTakenCount: 0 },
          ),
        );
        return;
      }
      ticket.status = next;
      ticket.updatedAt = new Date().toISOString();
      await route.fulfill(
        ok({ id: ticket.id, status: ticket.status, updatedAt: ticket.updatedAt }),
      );
      return;
    }

    if (staffCommentsMatch && method === "GET") {
      await route.fulfill(
        ok({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }),
      );
      return;
    }

    if (staffNotesMatch && method === "GET") {
      await route.fulfill(
        ok({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }),
      );
      return;
    }

    if (ticketMatch && method === "GET") {
      const ticket = state.tickets.find((item) => item.id === Number(ticketMatch[1]));
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      if (
        state.currentUser.role === "Requester" &&
        ticket.requester.id !== state.currentUser.id
      ) {
        await route.fulfill(fail(403, "FORBIDDEN", "You don't have access to this ticket."));
        return;
      }
      await route.fulfill(
        json(200, {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.requestedPriority,
          itPriority: ticket.itPriority,
          owner: ticket.owner,
          requesterResolved: ticket.requesterResolved,
          requesterResolvedAt: ticket.requesterResolvedAt,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          category: { name: ticket.category.name },
          relatedSystem: ticket.relatedSystem
            ? { name: ticket.relatedSystem.name }
            : null,
          requester: ticket.requester,
          attachments: [],
        }),
      );
      return;
    }

    if (requesterActionsMatch && method === "GET") {
      const ticket = state.tickets.find(
        (item) => item.id === Number(requesterActionsMatch[1]),
      );
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      if (
        state.currentUser.role === "Requester" &&
        ticket.requester.id !== state.currentUser.id
      ) {
        await route.fulfill(fail(403, "FORBIDDEN", "You don't have access to this ticket."));
        return;
      }
      const items = [...ticket.actions]
        .sort(
          (a, b) =>
            new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime() || b.id - a.id,
        )
        .map(actionItem);
      await route.fulfill(
        ok({
          items,
          pagination: { page: 1, limit: 50, total: items.length, totalPages: 1 },
        }),
      );
      return;
    }

    if (requesterCommentsMatch && method === "GET") {
      await route.fulfill(
        ok({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }),
      );
      return;
    }

    if (resolvedSignalMatch && method === "POST") {
      const ticket = state.tickets.find(
        (item) => item.id === Number(resolvedSignalMatch[1]),
      );
      if (!ticket) {
        await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that ticket."));
        return;
      }
      ticket.requesterResolved = true;
      ticket.requesterResolvedAt = new Date().toISOString();
      await route.fulfill(
        ok({
          id: ticket.id,
          requesterResolved: ticket.requesterResolved,
          requesterResolvedAt: ticket.requesterResolvedAt,
        }),
      );
      return;
    }

    await route.fulfill(fail(404, "NOT_FOUND", "We couldn't find that resource."));
  });

  return state;
}
