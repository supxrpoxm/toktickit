import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-04-workflow-test-session-secret-min-16";

const prisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  ticket: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  actionTaken: {
    count: vi.fn(),
  },
  publicComment: {
    create: vi.fn(),
  },
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => prisma,
}));

import { app } from "../../src/app.js";

const CURRENT_PASSWORD = "Password123!";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: "IT Staff One",
    email: "staff1@company.com",
    passwordHash: bcrypt.hashSync(CURRENT_PASSWORD, 4),
    role: "IT_STAFF",
    isActive: true,
    requiresPasswordChange: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "staff1@company.com": () => makeUser(),
  "admin@company.com": () =>
    makeUser({ id: 11, name: "Admin User", email: "admin@company.com", role: "ADMINISTRATOR" }),
  "alice@company.com": () =>
    makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" }),
};

function sessionCookie(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const raw = list.find((c) => c.startsWith("toktickit.session="));
  expect(raw).toBeTruthy();
  return raw!.split(";")[0];
}

async function loginAs(email: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password: CURRENT_PASSWORD });
  expect(response.status).toBe(200);
  return sessionCookie(response.headers["set-cookie"]);
}

const TICKET_UPDATED_AT = new Date("2026-10-30T10:00:00.000Z");

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    status: "Open",
    updatedAt: TICKET_UPDATED_AT,
    ...overrides,
  };
}

function patchStatus(cookie: string, status: string, updatedAt?: string) {
  return request(app)
    .patch("/api/staff/tickets/101/status")
    .set("Cookie", cookie)
    .send(updatedAt ? { status, updatedAt } : { status });
}

describe("Lab 4 ticket workflow API (Issue 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findFirst.mockImplementation(
      async (args: { where?: { email?: { equals?: string } } }) => {
        const email = args?.where?.email?.equals?.toLowerCase() ?? "";
        return usersByEmail[email]?.() ?? null;
      },
    );
    prisma.user.findUnique.mockImplementation(async (args: { where?: { id?: number } }) => {
      const all = Object.values(usersByEmail).map((fn) => fn());
      return all.find((user) => user.id === args?.where?.id) ?? null;
    });
  });

  it("allows every permitted transition for IT Staff and returns the persisted status", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.update.mockImplementation(
      async (args: { data: { status: string }; where: { id: number } }) => ({
        id: args.where.id,
        status: args.data.status,
        updatedAt: new Date("2026-10-30T10:05:00.000Z"),
      }),
    );

    const permitted: Array<[string, string]> = [
      ["New", "Open"],
      ["Open", "In Progress"],
      ["Open", "Waiting for Requester"],
      ["Open", "Cancelled"],
      ["In Progress", "Waiting for Requester"],
      ["In Progress", "Resolved"],
      ["Waiting for Requester", "In Progress"],
      ["Waiting for Requester", "Resolved"],
      ["Resolved", "Closed"],
      ["Resolved", "Reopened"],
      ["Reopened", "In Progress"],
      ["Reopened", "Resolved"],
      ["Reopened", "Cancelled"],
    ];

    for (const [from, to] of permitted) {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: from }));
      prisma.actionTaken.count.mockResolvedValue(1);

      const response = await patchStatus(cookie, to, TICKET_UPDATED_AT.toISOString());

      expect(response.status, `${from} -> ${to}`).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { id: 101, status: to },
      });
    }

    expect(prisma.ticket.update).toHaveBeenCalledTimes(permitted.length);
  });

  it("lets an Administrator perform formal transitions", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: "Open" }));
    prisma.ticket.update.mockResolvedValue({
      id: 101,
      status: "In Progress",
      updatedAt: new Date("2026-10-30T10:05:00.000Z"),
    });

    const response = await patchStatus(cookie, "In Progress", TICKET_UPDATED_AT.toISOString());

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("In Progress");
  });

  it("rejects illegal transitions with 400 and does not persist them", async () => {
    const cookie = await loginAs("staff1@company.com");

    const illegal: Array<[string, string]> = [
      ["New", "In Progress"],
      ["New", "Resolved"],
      ["Open", "Resolved"],
      ["Open", "Closed"],
      ["In Progress", "Closed"],
      ["Resolved", "In Progress"],
      ["Resolved", "Cancelled"],
      ["Closed", "Open"],
      ["Closed", "Reopened"],
      ["Cancelled", "Open"],
      ["Cancelled", "Reopened"],
      ["Reopened", "New"],
      ["Reopened", "Open"],
    ];

    for (const [from, to] of illegal) {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: from }));

      const response = await patchStatus(cookie, to, TICKET_UPDATED_AT.toISOString());

      expect(response.status, `${from} -> ${to}`).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: "INVALID_TRANSITION" },
      });
    }

    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects requester attempts to change status with 403", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await patchStatus(cookie, "Resolved", TICKET_UPDATED_AT.toISOString());

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects a stale updatedAt with 409 before writing", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(
      makeTicket({ status: "Open", updatedAt: new Date("2026-10-30T10:10:00.000Z") }),
    );

    const response = await patchStatus(cookie, "In Progress", TICKET_UPDATED_AT.toISOString());

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "STALE_UPDATE" },
    });
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("requires at least one Action Taken before resolving", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: "In Progress" }));
    prisma.actionTaken.count.mockResolvedValue(0);

    const response = await patchStatus(cookie, "Resolved", TICKET_UPDATED_AT.toISOString());

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "RESOLUTION_REQUIRED_ACTIONS" },
    });
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("permits resolving once an Action Taken exists", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: "In Progress" }));
    prisma.actionTaken.count.mockResolvedValue(2);
    prisma.ticket.update.mockResolvedValue({
      id: 101,
      status: "Resolved",
      updatedAt: new Date("2026-10-30T10:05:00.000Z"),
    });

    const response = await patchStatus(cookie, "Resolved", TICKET_UPDATED_AT.toISOString());

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("Resolved");
    expect(prisma.actionTaken.count).toHaveBeenCalledWith({ where: { ticketId: 101 } });
  });

  it("accepts updates without updatedAt for legacy callers", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(makeTicket({ status: "Open" }));
    prisma.ticket.update.mockResolvedValue({
      id: 101,
      status: "In Progress",
      updatedAt: new Date("2026-10-30T10:05:00.000Z"),
    });

    const response = await patchStatus(cookie, "In Progress");

    expect(response.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalled();
  });

  it("stores a requester advisory note without changing the ticket status", async () => {
    const cookie = await loginAs("alice@company.com");
    prisma.ticket.findUnique.mockResolvedValue(
      makeTicket({
        status: "In Progress",
        requesterId: 3,
        requesterResolved: false,
        requesterResolvedAt: null,
      }),
    );
    prisma.ticket.update.mockResolvedValue({
      id: 101,
      status: "In Progress",
      requesterResolved: true,
      requesterResolvedAt: new Date("2026-10-30T10:05:00.000Z"),
    });
    prisma.publicComment.create.mockResolvedValue({ id: 900 });

    const response = await request(app)
      .post("/api/tickets/101/resolved-signal")
      .set("Cookie", cookie)
      .send({ note: "The VPN works again." });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ requesterResolved: true });
    expect(prisma.publicComment.create).toHaveBeenCalledWith({
      data: { ticketId: 101, authorId: 3, body: "The VPN works again." },
    });

    const updateData = prisma.ticket.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateData.data.status).toBeUndefined();
  });

  it("rejects an overlong requester advisory note without writing", async () => {
    const cookie = await loginAs("alice@company.com");
    prisma.ticket.findUnique.mockResolvedValue(
      makeTicket({
        status: "In Progress",
        requesterId: 3,
        requesterResolved: false,
        requesterResolvedAt: null,
      }),
    );

    const response = await request(app)
      .post("/api/tickets/101/resolved-signal")
      .set("Cookie", cookie)
      .send({ note: "x".repeat(2001) });

    expect(response.status).toBe(400);
    expect(response.body.error.fields.note).toBeTruthy();
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.publicComment.create).not.toHaveBeenCalled();
  });
});
