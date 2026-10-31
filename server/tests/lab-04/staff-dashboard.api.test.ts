import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-04-dashboard-test-secret-min-16";

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
    id: 7,
    name: "IT Staff One",
    email: "staff1@company.com",
    passwordHash: bcrypt.hashSync(CURRENT_PASSWORD, 4),
    role: "IT_STAFF",
    isActive: true,
    requiresPasswordChange: false,
    ...overrides,
  };
}

const staffUser = () => makeUser();
const requesterUser = () =>
  makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" });
const forcedStaff = () =>
  makeUser({ id: 8, name: "IT Staff Two", email: "staff2@company.com", requiresPasswordChange: true });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "staff1@company.com": staffUser,
  "alice@company.com": requesterUser,
  "staff2@company.com": forcedStaff,
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
    id: 101,
    title: "Cannot login to VPN",
    status: "Open",
    priority: "High",
    itPriority: "High",
    requesterResolved: false,
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    updatedAt: new Date("2026-10-02T09:00:00.000Z"),
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 2, name: "VPN Gateway" },
    actionsTaken: [],
    ...overrides,
  };
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    ticketId: 101,
    actionAt: new Date("2026-10-28T09:00:00.000Z"),
    description: "Reset the VPN gateway certificate binding.",
    result: "Requester can connect again.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    version: 1,
    createdAt: new Date("2026-10-28T09:05:00.000Z"),
    updatedAt: new Date("2026-10-28T09:05:00.000Z"),
    performedBy: { id: 7, name: "IT Staff One", role: "IT_STAFF" },
    ticket: { id: 101, title: "Cannot login to VPN" },
    ...overrides,
  };
}

function stubCounts() {
  prisma.ticket.count.mockImplementation(async (args: { where?: Record<string, any> }) => {
    const where = args?.where ?? {};
    if (where.ownerId === 7) return 4;
    if (where.ownerId === null) return 2;
    if (where.status === "In Progress") return 3;
    if (where.status === "Waiting for Requester") return 2;
    if (where.requesterResolved === true) return 1;
    return 0;
  });
  prisma.actionTaken.count.mockImplementation(async (args: { where?: Record<string, any> }) => {
    return args?.where?.actionAt ? 2 : 5;
  });
}

describe("Lab 4 staff dashboard API (Issue 5)", () => {
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

  it("returns staff KPIs and bounded work/attention lists", async () => {
    const cookie = await loginAs("staff1@company.com");
    stubCounts();

    prisma.ticket.findMany.mockImplementation(async (args: { where?: Record<string, any> }) => {
      const where = args?.where ?? {};
      if (where.ownerId === 7) {
        return [
          ticket({
            actionsTaken: [
              { id: 900, actionAt: new Date("2026-10-01T09:00:00.000Z"), followUpRequired: true },
            ],
          }),
        ];
      }
      if (where.ownerId === null) return [ticket({ id: 102, owner: null })];
      return [
        ticket({
          id: 103,
          status: "Waiting for Requester",
          requesterResolved: true,
          actionsTaken: [
            { id: 901, actionAt: new Date("2026-10-01T09:00:00.000Z"), followUpRequired: true },
          ],
        }),
      ];
    });
    prisma.actionTaken.findMany.mockResolvedValue([action()]);

    const response = await request(app)
      .get("/api/staff/dashboard?limit=4&window=30d")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toEqual({
      myOpenTickets: 4,
      unassignedTickets: 2,
      inProgressTickets: 3,
      waitingForRequester: 2,
      requesterResolvedTickets: 1,
      incompleteActions: 5,
      overdueActions: 2,
    });
    expect(response.body.data.myWork[0]).toMatchObject({
      id: 101,
      ticketNumber: "TT-0101",
      title: "Cannot login to VPN",
      incompleteActionCount: 1,
      overdueActionCount: 1,
      category: "Network",
      relatedSystem: "VPN Gateway",
    });
    expect(response.body.data.unassigned[0].owner).toBeNull();
    expect(response.body.data.attention[0].attentionReasons).toEqual(
      expect.arrayContaining(["Requester says resolved", "Overdue action"]),
    );
    expect(response.body.data.recentActions[0]).toMatchObject({
      id: 501,
      ticketNumber: "TT-0101",
      summary: "Reset the VPN gateway certificate binding.",
      details: "Requester can connect again.",
      status: "Completed",
      performedBy: { id: 7, name: "IT Staff One", role: "IT Staff" },
    });
    expect(typeof response.body.data.generatedAt).toBe("string");

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4 }),
    );
    expect(prisma.actionTaken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { updatedAt: { gte: expect.any(Date) } },
        take: 4,
      }),
    );
  });

  it("falls back safely for invalid limit/window values", async () => {
    const cookie = await loginAs("staff1@company.com");
    stubCounts();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.actionTaken.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/staff/dashboard?limit=999&window=whenever")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
    expect(prisma.actionTaken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { updatedAt: { gte: expect.any(Date) } }, take: 10 }),
    );
  });

  it("rejects unauthenticated, requester, and forced-password sessions", async () => {
    const unauthenticated = await request(app).get("/api/staff/dashboard");
    expect(unauthenticated.status).toBe(401);

    const requesterCookie = await loginAs("alice@company.com");
    const forbidden = await request(app)
      .get("/api/staff/dashboard")
      .set("Cookie", requesterCookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    const forcedCookie = await loginAs("staff2@company.com");
    const passwordGate = await request(app)
      .get("/api/staff/dashboard")
      .set("Cookie", forcedCookie);
    expect(passwordGate.status).toBe(403);
    expect(passwordGate.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(prisma.ticket.count).not.toHaveBeenCalled();
  });
});
