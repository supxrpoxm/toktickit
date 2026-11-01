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
    update: vi.fn(),
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
  publicComment: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  internalNote: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
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

const staffOne = () => makeUser();
const staffTwo = () =>
  makeUser({ id: 8, name: "IT Staff Two", email: "staff2@company.com" });
const inactiveStaff = () =>
  makeUser({ id: 9, name: "Former Staff", email: "staff.off@company.com", isActive: false });
const adminUser = () =>
  makeUser({ id: 11, name: "Admin User", email: "admin@company.com", role: "ADMINISTRATOR" });
const requesterAlice = () =>
  makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" });
const requesterBrandon = () =>
  makeUser({ id: 4, name: "Brandon Lee", email: "brandon@company.com", role: "REQUESTER" });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "staff1@company.com": staffOne,
  "staff2@company.com": staffTwo,
  "staff.off@company.com": inactiveStaff,
  "admin@company.com": adminUser,
  "alice@company.com": requesterAlice,
  "brandon@company.com": requesterBrandon,
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

function staffTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    title: "Cannot login to VPN",
    description: "Remote access required",
    status: "Open",
    priority: "High",
    itPriority: "High",
    requesterId: 3,
    requesterResolved: false,
    requesterResolvedAt: null,
    createdAt: new Date("2026-09-04T10:00:00.000Z"),
    updatedAt: new Date("2026-09-05T10:00:00.000Z"),
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 3, name: "VPN" },
    attachments: [],
    _count: { publicComments: 2, internalNotes: 1 },
    ...overrides,
  };
}

describe("Lab 3 staff ticket detail API (Issue 4)", () => {
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
    prisma.user.findMany.mockResolvedValue([
      { id: 11, name: "Admin User", role: "ADMINISTRATOR" },
      { id: 7, name: "IT Staff One", role: "IT_STAFF" },
      { id: 8, name: "IT Staff Two", role: "IT_STAFF" },
    ]);
  });

  it("returns the staff ticket with resolved flag and thread counts (AC-13–AC-16, AC-20)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket());

    const response = await request(app).get("/api/staff/tickets/101").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 101,
      ticketNumber: "TT-0101",
      requestedPriority: "High",
      itPriority: "High",
      status: "Open",
      owner: { id: 7, name: "IT Staff One" },
      requesterResolved: false,
      commentsCount: 2,
      notesCount: 1,
    });
  });

  it("rejects Requesters from the staff detail with no ticket data (AC-08)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app).get("/api/staff/tickets/101").set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(response.body.data).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Remote access required");
    expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
  });

  it("claims an unassigned ticket for the session user (AC-13)", async () => {
    const cookie = await loginAs("staff2@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket({ owner: null }));
    prisma.ticket.update.mockResolvedValue({ id: 101, owner: { id: 8, name: "IT Staff Two" } });

    const response = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({ claim: true });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: 101, owner: { id: 8, name: "IT Staff Two" } });
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 101 }, data: { ownerId: 8 } }),
    );
  });

  it("assigns and reassigns to another active staff member (AC-13)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket());
    prisma.ticket.update.mockResolvedValue({ id: 101, owner: { id: 8, name: "IT Staff Two" } });

    const response = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({ ownerId: 8 });

    expect(response.status).toBe(200);
    expect(response.body.data.owner).toMatchObject({ id: 8 });
  });

  it("unassigns with ownerId null (AC-13)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket());
    prisma.ticket.update.mockResolvedValue({ id: 101, owner: null });

    const response = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({ ownerId: null });

    expect(response.status).toBe(200);
    expect(response.body.data.owner).toBeNull();
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ownerId: null } }),
    );
  });

  it("rejects assignment to Requesters, inactive, and unknown users (AC-13)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket());

    for (const ownerId of [3, 9, 999]) {
      const response = await request(app)
        .patch("/api/staff/tickets/101/owner")
        .set("Cookie", cookie)
        .send({ ownerId });
      expect(response.status).toBe(422);
      expect(response.body.error.fields.ownerId).toBeTruthy();
    }
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects malformed ownership bodies with 400 (AC-13)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket());

    const both = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({ claim: true, ownerId: 8 });
    expect(both.status).toBe(400);

    const neither = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({});
    expect(neither.status).toBe(400);

    const badId = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({ ownerId: "nonsense" });
    expect(badId.status).toBe(400);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects Requester ownership writes with 403 (AC-13)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app)
      .patch("/api/staff/tickets/101/owner")
      .set("Cookie", cookie)
      .send({ claim: true });

    expect(response.status).toBe(403);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("returns 404 for ownership changes on missing tickets", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .patch("/api/staff/tickets/999/owner")
      .set("Cookie", cookie)
      .send({ claim: true });

    expect(response.status).toBe(404);
  });

  it("lists assignable staff for the owner select (AC-13)", async () => {
    const cookie = await loginAs("staff1@company.com");

    const response = await request(app).get("/api/staff/users").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(3);
    expect(response.body.data.items[0]).toMatchObject({ id: 11, role: "Administrator" });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");

    const requesterCookie = await loginAs("alice@company.com");
    const forbidden = await request(app).get("/api/staff/users").set("Cookie", requesterCookie);
    expect(forbidden.status).toBe(403);
  });

  it("updates IT Priority while requestedPriority stays immutable (AC-14)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket({ priority: "Medium", itPriority: "Medium" }));
    prisma.ticket.update.mockResolvedValue({ id: 101, priority: "Medium", itPriority: "High" });

    const response = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", cookie)
      .send({ itPriority: "High", requestedPriority: "Low" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 101,
      requestedPriority: "Medium",
      itPriority: "High",
    });
    // The stray requestedPriority is ignored, never written.
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { itPriority: "High" } }),
    );
  });

  it("rejects invalid IT Priority values with 400 (AC-14)", async () => {
    const cookie = await loginAs("staff1@company.com");

    for (const body of [{ itPriority: "Urgent" }, { itPriority: "" }, {}]) {
      const response = await request(app)
        .patch("/api/staff/tickets/101/priority")
        .set("Cookie", cookie)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.fields.itPriority).toBeTruthy();
    }
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects Requester priority writes with 403 (AC-14)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", cookie)
      .send({ itPriority: "Low" });

    expect(response.status).toBe(403);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("applies a legal status transition (AC-15)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket({ status: "Open" }));
    prisma.ticket.update.mockResolvedValue({
      id: 101,
      status: "In Progress",
      updatedAt: new Date("2026-09-06T10:00:00.000Z"),
    });

    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie)
      .send({ status: "In Progress" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: 101, status: "In Progress" });
    expect(response.body.data.updatedAt).toBeTruthy();
  });

  it("rejects an illegal transition with 422 and the allowed list (AC-15)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket({ status: "Open" }));

    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie)
      .send({ status: "Closed" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_TRANSITION");
    expect(response.body.error.message).toContain("In Progress");
    expect(response.body.error.message).toContain("Waiting for Requester");
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects backwards resets to New and unknown statuses (AC-15)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket({ status: "Open" }));

    const backwards = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie)
      .send({ status: "New" });
    expect(backwards.status).toBe(422);

    const unknown = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie)
      .send({ status: "Archived" });
    expect(unknown.status).toBe(400);

    const missing = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie)
      .send({});
    expect(missing.status).toBe(400);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("walks the full lifecycle without an Actions-Taken gate (AC-15)", async () => {
    const cookie = await loginAs("staff1@company.com");
    const chain: Array<[string, string]> = [
      ["New", "Open"],
      ["Open", "In Progress"],
      ["In Progress", "Resolved"],
      ["Resolved", "Closed"],
      ["Closed", "Reopened"],
      ["Reopened", "Open"],
    ];
    for (const [from, to] of chain) {
      prisma.ticket.findUnique.mockResolvedValueOnce(staffTicket({ status: from }));
      prisma.ticket.update.mockResolvedValueOnce({ id: 101, status: to, updatedAt: new Date().toISOString() });
      const response = await request(app)
        .patch("/api/staff/tickets/101/status")
        .set("Cookie", cookie)
        .send({ status: to });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(to);
    }
  });

  it("rejects Requester status writes including Resolve/Close (AC-16)", async () => {
    const cookie = await loginAs("alice@company.com");

    for (const status of ["In Progress", "Resolved", "Closed"]) {
      const response = await request(app)
        .patch("/api/staff/tickets/101/status")
        .set("Cookie", cookie)
        .send({ status });
      expect(response.status).toBe(403);
    }
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("sets the requester resolved-signal flag without changing status (AC-20)", async () => {
    const cookie = await loginAs("alice@company.com");
    prisma.ticket.findUnique.mockResolvedValue(
      staffTicket({ status: "In Progress", requesterResolved: false, requesterResolvedAt: null }),
    );
    prisma.ticket.update.mockResolvedValue({
      id: 101,
      status: "In Progress",
      requesterResolved: true,
      requesterResolvedAt: new Date("2026-09-06T12:00:00.000Z"),
    });

    const response = await request(app).post("/api/tickets/101/resolved-signal").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: 101, requesterResolved: true });
    expect(response.body.data.requesterResolvedAt).toBeTruthy();
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requesterResolved: true }) }),
    );
    // The formal status is untouched by the update payload.
    const updateData = prisma.ticket.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateData.data.status).toBeUndefined();
  });

  it("keeps the resolved-signal idempotent, preserving the first timestamp (AC-20)", async () => {
    const cookie = await loginAs("alice@company.com");
    prisma.ticket.findUnique.mockResolvedValue(
      staffTicket({ requesterResolved: true, requesterResolvedAt: new Date("2026-09-06T12:00:00.000Z") }),
    );

    const response = await request(app).post("/api/tickets/101/resolved-signal").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.requesterResolved).toBe(true);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("rejects resolved-signals for other requesters, staff, and missing tickets (AC-20)", async () => {
    const brandonCookie = await loginAs("brandon@company.com");
    prisma.ticket.findUnique.mockResolvedValue(staffTicket({ requesterId: 3 }));

    const other = await request(app).post("/api/tickets/101/resolved-signal").set("Cookie", brandonCookie);
    expect(other.status).toBe(403);

    const staffCookie = await loginAs("staff1@company.com");
    const staffAttempt = await request(app)
      .post("/api/tickets/101/resolved-signal")
      .set("Cookie", staffCookie);
    expect(staffAttempt.status).toBe(403);

    prisma.ticket.findUnique.mockResolvedValue(null);
    const missing = await request(app).post("/api/tickets/999/resolved-signal").set("Cookie", brandonCookie);
    expect(missing.status).toBe(404);

    const anonymous = await request(app).post("/api/tickets/101/resolved-signal");
    expect(anonymous.status).toBe(401);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});
