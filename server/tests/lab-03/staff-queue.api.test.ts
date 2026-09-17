import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-03-test-session-secret-min-16";

const prisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  ticket: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  attachment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
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

const staffUser = () => makeUser();
const adminUser = () =>
  makeUser({ id: 11, name: "Admin User", email: "admin@company.com", role: "ADMINISTRATOR" });
const requesterUser = () =>
  makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" });
const forcedStaff = () =>
  makeUser({ id: 8, name: "IT Staff Two", email: "staff2@company.com", requiresPasswordChange: true });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "staff1@company.com": staffUser,
  "admin@company.com": adminUser,
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

function queueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    title: "Cannot login to VPN",
    status: "Open",
    priority: "High",
    itPriority: "High",
    createdAt: new Date("2026-09-04T10:00:00.000Z"),
    updatedAt: new Date("2026-09-05T10:00:00.000Z"),
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    category: { id: 4, name: "Network" },
    ...overrides,
  };
}

function lastFindManyArgs() {
  expect(prisma.ticket.findMany).toHaveBeenCalled();
  return prisma.ticket.findMany.mock.calls[prisma.ticket.findMany.mock.calls.length - 1][0] as {
    where: Record<string, unknown>;
    orderBy: unknown;
    skip: number;
    take: number;
  };
}

describe("Lab 3 staff queue API (Issue 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findFirst.mockImplementation(async (args: { where?: { email?: { equals?: string } } }) => {
      const email = args?.where?.email?.equals?.toLowerCase() ?? "";
      return usersByEmail[email]?.() ?? null;
    });
    prisma.user.findUnique.mockImplementation(async (args: { where?: { id?: number } }) => {
      const all = Object.values(usersByEmail).map((fn) => fn());
      return all.find((u) => u.id === args?.where?.id) ?? null;
    });
    prisma.ticket.findMany.mockResolvedValue([queueRow()]);
    prisma.ticket.count.mockResolvedValue(1);
  });

  it("returns the queue with items and pagination metadata for IT Staff (AC-11)", async () => {
    const cookie = await loginAs("staff1@company.com");

    const response = await request(app).get("/api/staff/tickets").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: 101,
      ticketNumber: "TT-0101",
      title: "Cannot login to VPN",
      category: "Network",
      requestedPriority: "High",
      itPriority: "High",
      status: "Open",
      owner: { id: 7, name: "IT Staff One" },
      requester: { id: 3, name: "Alice Johnson" },
    });
    expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("allows Administrators to read the queue", async () => {
    const cookie = await loginAs("admin@company.com");

    const response = await request(app).get("/api/staff/tickets").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
  });

  it("rejects Requesters with 403 and no ticket data (AC-08)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app).get("/api/staff/tickets").set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(response.body)).not.toContain("Cannot login to VPN");
    expect(response.body.data).toBeUndefined();
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const response = await request(app).get("/api/staff/tickets");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("gates forced-password staff sessions until they change passwords (AC-04)", async () => {
    const cookie = await loginAs("staff2@company.com");

    const response = await request(app).get("/api/staff/tickets").set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("searches by summary keyword (AC-11)", async () => {
    const cookie = await loginAs("staff1@company.com");

    const response = await request(app).get("/api/staff/tickets?search=vpn").set("Cookie", cookie);

    expect(response.status).toBe(200);
    const where = lastFindManyArgs().where as { AND: { OR: unknown[] }[] };
    expect(JSON.stringify(where)).toContain("vpn");
    expect(where.AND[0]).toHaveProperty("OR");
  });

  it("searches by ticket number, tolerating the TT- prefix", async () => {
    const cookie = await loginAs("staff1@company.com");

    await request(app).get("/api/staff/tickets?search=TT-0101").set("Cookie", cookie);
    expect(JSON.stringify(lastFindManyArgs().where)).toContain('"id":101');

    await request(app).get("/api/staff/tickets?search=101").set("Cookie", cookie);
    expect(JSON.stringify(lastFindManyArgs().where)).toContain('"id":101');
  });

  it("applies status, priority, owner, and category filters (AC-12)", async () => {
    const cookie = await loginAs("staff1@company.com");

    await request(app)
      .get("/api/staff/tickets?status=Open&itPriority=High&requestedPriority=Medium&owner=unassigned&categoryId=4")
      .set("Cookie", cookie);

    const where = lastFindManyArgs().where as { AND: Record<string, unknown>[] };
    expect(where.AND).toContainEqual({ status: "Open" });
    expect(where.AND).toContainEqual({ itPriority: "High" });
    expect(where.AND).toContainEqual({ priority: "Medium" });
    expect(where.AND).toContainEqual({ ownerId: null });
    expect(where.AND).toContainEqual({ categoryId: 4 });
  });

  it("resolves owner=me from the session and accepts numeric owner ids", async () => {
    const cookie = await loginAs("staff1@company.com");

    await request(app).get("/api/staff/tickets?owner=me").set("Cookie", cookie);
    expect((lastFindManyArgs().where as { AND: Record<string, unknown>[] }).AND).toContainEqual({ ownerId: 7 });

    await request(app).get("/api/staff/tickets?owner=28").set("Cookie", cookie);
    expect((lastFindManyArgs().where as { AND: Record<string, unknown>[] }).AND).toContainEqual({ ownerId: 28 });
  });

  it("falls back to defaults on invalid filter values without erroring (AC-12)", async () => {
    const cookie = await loginAs("staff1@company.com");

    const response = await request(app)
      .get("/api/staff/tickets?status=Bogus&itPriority=Urgent&owner=nonsense&categoryId=abc&sort=bogus&page=0&limit=999")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    const args = lastFindManyArgs();
    expect(args.where).toEqual({});
    expect(args.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
    expect(args.skip).toBe(0);
    expect(args.take).toBe(50);
  });

  it("sorts and paginates with accurate metadata (AC-12)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.count.mockResolvedValue(48);

    const response = await request(app)
      .get("/api/staff/tickets?sort=createdAt:asc&page=2&limit=5")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    const args = lastFindManyArgs();
    expect(args.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(response.body.data.pagination).toMatchObject({ page: 2, limit: 5, total: 48, totalPages: 10 });
  });

  it("reads a single ticket for staff, 404 when missing, 403 for requesters", async () => {
    const staffCookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue({
      ...queueRow(),
      description: "Remote access required",
      relatedSystem: { id: 3, name: "VPN" },
      attachments: [],
    });

    const detail = await request(app).get("/api/staff/tickets/101").set("Cookie", staffCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: 101,
      ticketNumber: "TT-0101",
      title: "Cannot login to VPN",
      requestedPriority: "High",
      owner: { id: 7, name: "IT Staff One" },
    });

    prisma.ticket.findUnique.mockResolvedValue(null);
    const missing = await request(app).get("/api/staff/tickets/999").set("Cookie", staffCookie);
    expect(missing.status).toBe(404);

    const requesterCookie = await loginAs("alice@company.com");
    const forbidden = await request(app).get("/api/staff/tickets/101").set("Cookie", requesterCookie);
    expect(forbidden.status).toBe(403);
    expect(JSON.stringify(forbidden.body)).not.toContain("Remote access required");
  });
});
