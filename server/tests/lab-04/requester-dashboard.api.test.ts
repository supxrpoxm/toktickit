import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-04-requester-dashboard-secret-16";

const prisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  ticket: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  actionTaken: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => prisma,
}));

import { app } from "../../src/app.js";

const CURRENT_PASSWORD = "Password123!";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    name: "Alice Johnson",
    email: "alice@company.com",
    passwordHash: bcrypt.hashSync(CURRENT_PASSWORD, 4),
    role: "REQUESTER",
    isActive: true,
    requiresPasswordChange: false,
    ...overrides,
  };
}

const alice = () => makeUser();
const bob = () => makeUser({ id: 4, name: "Bob Smith", email: "bob@company.com" });
const staffUser = () => makeUser({ id: 7, name: "IT Staff One", email: "staff1@company.com", role: "IT_STAFF" });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "alice@company.com": alice,
  "bob@company.com": bob,
  "staff1@company.com": staffUser,
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

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 201,
    title: "Laptop will not boot",
    status: "In Progress",
    priority: "Medium",
    itPriority: "High",
    requesterResolved: false,
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    updatedAt: new Date("2026-10-03T09:00:00.000Z"),
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 5, name: "Laptop Fleet" },
    actionsTaken: [],
    ...overrides,
  };
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 601,
    ticketId: 201,
    actionAt: new Date("2026-10-02T09:00:00.000Z"),
    description: "Ordered a replacement battery.",
    result: "Delivery expected in two business days.",
    followUpRequired: true,
    followUpNote: "Call Alice after delivery.",
    attachmentNotes: null,
    version: 1,
    createdAt: new Date("2026-10-02T09:05:00.000Z"),
    updatedAt: new Date("2026-10-02T09:05:00.000Z"),
    performedBy: { id: 7, name: "IT Staff One", role: "IT_STAFF" },
    ticket: { id: 201, title: "Laptop will not boot" },
    ...overrides,
  };
}

function stubCounts() {
  prisma.ticket.count.mockImplementation(async (args: { where?: Record<string, any> }) => {
    const where = args?.where ?? {};
    if (where.status === "Waiting for Requester") return 1;
    if (where.status === "In Progress") return 2;
    if (where.status === "Resolved") return 3;
    if (where.status === "Closed") return 4;
    if (where.status === "Cancelled") return 1;
    if (where.status && typeof where.status === "object") return 5;
    return 16;
  });
}

describe("Lab 4 requester dashboard API (Issue 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findFirst.mockImplementation(
      async (args: { where?: { email?: { equals?: string } } }) => {
        const email = args?.where?.email?.equals?.toLowerCase() ?? "";
        return usersByEmail[email]?.() ?? null;
      },
    );
    prisma.user.findUnique.mockImplementation(async (args: { where?: { id?: number } }) => {
      return Object.values(usersByEmail)
        .map((fn) => fn())
        .find((user) => user.id === args?.where?.id) ?? null;
    });
  });

  it("returns only the signed-in requester's summary and lists", async () => {
    const cookie = await loginAs("alice@company.com");
    stubCounts();
    prisma.ticket.findMany.mockImplementation(async (args: { where?: Record<string, any> }) => {
      if (args?.where?.status === "Waiting for Requester") {
        return [ticket({ id: 202, status: "Waiting for Requester", title: "Need more info" })];
      }
      return [ticket()];
    });
    prisma.actionTaken.findMany.mockResolvedValue([action()]);

    const response = await request(app)
      .get("/api/requester/dashboard?limit=3")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toEqual({
      totalTickets: 16,
      openTickets: 5,
      inProgressTickets: 2,
      waitingForRequester: 1,
      resolvedTickets: 3,
      closedTickets: 4,
      cancelledTickets: 1,
    });
    expect(response.body.data.recentTickets[0]).toMatchObject({
      id: 201,
      ticketNumber: "TT-0201",
      title: "Laptop will not boot",
      requestedPriority: "Medium",
      itPriority: "High",
      category: "Hardware",
    });
    expect(response.body.data.latestActions[0]).toMatchObject({
      id: 601,
      ticketNumber: "TT-0201",
      summary: "Ordered a replacement battery.",
      details: "Delivery expected in two business days.",
      status: "Open",
    });
    expect(response.body.data.needsAttention[0]).toMatchObject({
      id: 202,
      status: "Waiting for Requester",
    });

    for (const [args] of prisma.ticket.count.mock.calls) {
      expect(args.where.requesterId).toBe(3);
    }
    for (const [args] of prisma.ticket.findMany.mock.calls) {
      expect(args.where.requesterId).toBe(3);
      expect(args.take).toBe(3);
    }
    expect(prisma.actionTaken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticket: { requesterId: 3 } },
        take: 3,
      }),
    );
  });

  it("rejects unauthenticated and staff sessions", async () => {
    const unauthenticated = await request(app).get("/api/requester/dashboard");
    expect(unauthenticated.status).toBe(401);

    const staffCookie = await loginAs("staff1@company.com");
    const forbidden = await request(app)
      .get("/api/requester/dashboard")
      .set("Cookie", staffCookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
    expect(prisma.ticket.count).not.toHaveBeenCalled();
  });

  it("caps invalid limits and never exposes another requester", async () => {
    const cookie = await loginAs("alice@company.com");
    stubCounts();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.actionTaken.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/requester/dashboard?limit=0")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterId: 3 }, take: 1 }),
    );
    expect(prisma.actionTaken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticket: { requesterId: 3 } }, take: 1 }),
    );
  });
});
