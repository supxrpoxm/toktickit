import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-04-test-session-secret-min-16";

const prisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  ticket: {
    findUnique: vi.fn(),
  },
  actionTaken: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
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

const staffOne = () => makeUser();
const adminUser = () =>
  makeUser({ id: 11, name: "Admin User", email: "admin@company.com", role: "ADMINISTRATOR" });
const requesterAlice = () =>
  makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "staff1@company.com": staffOne,
  "admin@company.com": adminUser,
  "alice@company.com": requesterAlice,
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

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    ticketId: 101,
    actionAt: new Date("2026-10-29T09:00:00.000Z"),
    description: "Checked the VPN client logs and reproduced the timeout.",
    result: "Confirmed an expired gateway certificate.",
    followUpRequired: true,
    followUpNote: "Confirm with the requester after the certificate renewal.",
    attachmentNotes: "Log excerpt attached to the ticket.",
    version: 1,
    createdAt: new Date("2026-10-29T09:05:00.000Z"),
    updatedAt: new Date("2026-10-29T09:05:00.000Z"),
    performedBy: { id: 7, name: "IT Staff One", role: "IT_STAFF" },
    ...overrides,
  };
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    actionAt: "2026-10-29T09:00:00.000Z",
    description: "Checked the VPN client logs and reproduced the timeout.",
    result: "Confirmed an expired gateway certificate.",
    followUpRequired: true,
    followUpNote: "Confirm with the requester after the certificate renewal.",
    attachmentNotes: "Log excerpt attached to the ticket.",
    ...overrides,
  };
}

describe("Lab 4 Actions Taken API (Issue 2)", () => {
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
      return all.find((u) => u.id === args?.where?.id) ?? null;
    });
    prisma.ticket.findUnique.mockResolvedValue({ id: 101 });
    prisma.actionTaken.findMany.mockResolvedValue([]);
    prisma.actionTaken.count.mockResolvedValue(0);
  });

  it("creates an Action Taken for an IT Staff user (AC-01, AC-02)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.create.mockResolvedValue(makeAction());

    const response = await request(app)
      .post("/api/staff/tickets/101/actions")
      .set("Cookie", cookie)
      .send(validCreateBody());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 501,
      ticketId: 101,
      ticketNumber: "TT-0101",
      description: "Checked the VPN client logs and reproduced the timeout.",
      result: "Confirmed an expired gateway certificate.",
      performedBy: { id: 7, name: "IT Staff One", role: "IT Staff" },
      followUpRequired: true,
      followUpNote: "Confirm with the requester after the certificate renewal.",
      version: 1,
    });
    expect(prisma.actionTaken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: 101,
          performedById: 7,
          followUpRequired: true,
          followUpNote: "Confirm with the requester after the certificate renewal.",
        }),
      }),
    );
  });

  it("allows Administrators to create an Action Taken (AC-02)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.actionTaken.create.mockResolvedValue(
      makeAction({ performedBy: { id: 11, name: "Admin User", role: "ADMINISTRATOR" } }),
    );

    const response = await request(app)
      .post("/api/staff/tickets/101/actions")
      .set("Cookie", cookie)
      .send(validCreateBody({ followUpRequired: false, followUpNote: undefined }));

    expect(response.status).toBe(201);
    expect(response.body.data.performedBy).toMatchObject({ id: 11, role: "Administrator" });
  });

  it("rejects Requesters from creating actions with no action data (AC-03)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app)
      .post("/api/staff/tickets/101/actions")
      .set("Cookie", cookie)
      .send(validCreateBody());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(response.body.data).toBeUndefined();
    expect(prisma.actionTaken.create).not.toHaveBeenCalled();
  });

  it("validates required fields and follow-up note rules (AC-04)", async () => {
    const cookie = await loginAs("staff1@company.com");

    const response = await request(app)
      .post("/api/staff/tickets/101/actions")
      .set("Cookie", cookie)
      .send({ followUpRequired: true });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toMatchObject({
      description: expect.any(String),
      result: expect.any(String),
      followUpNote: expect.any(String),
    });
    expect(prisma.actionTaken.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the ticket does not exist (AC-05)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/staff/tickets/999/actions")
      .set("Cookie", cookie)
      .send(validCreateBody());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(prisma.actionTaken.create).not.toHaveBeenCalled();
  });

  it("lists the action timeline for staff (AC-06)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.findMany.mockResolvedValue([makeAction()]);
    prisma.actionTaken.count.mockResolvedValue(1);

    const response = await request(app)
      .get("/api/staff/tickets/101/actions?page=1&limit=10")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: 501,
      ticketNumber: "TT-0101",
      performedBy: { id: 7, name: "IT Staff One", role: "IT Staff" },
    });
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("updates an action with a matching version and increments it (AC-07)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.findFirst
      .mockResolvedValueOnce(makeAction())
      .mockResolvedValueOnce(
        makeAction({
          description: "Updated description.",
          result: "Updated result.",
          followUpRequired: false,
          followUpNote: null,
          version: 2,
        }),
      );
    prisma.actionTaken.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions/501")
      .set("Cookie", cookie)
      .send({
        version: 1,
        description: "Updated description.",
        result: "Updated result.",
        followUpRequired: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 501,
      description: "Updated description.",
      result: "Updated result.",
      followUpRequired: false,
      followUpNote: null,
      version: 2,
    });
    expect(prisma.actionTaken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 501, ticketId: 101, version: 1 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
  });

  it("rejects a stale update with 409 and the current action (AC-08)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.findFirst.mockResolvedValue(makeAction({ version: 3 }));

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions/501")
      .set("Cookie", cookie)
      .send({ version: 1, description: "Stale edit." });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("STALE_UPDATE");
    expect(response.body.error.conflict).toMatchObject({
      expectedVersion: 1,
      currentVersion: 3,
      current: { id: 501, version: 3 },
    });
    expect(prisma.actionTaken.updateMany).not.toHaveBeenCalled();
  });

  it("requires a version on update (AC-08)", async () => {
    const cookie = await loginAs("staff1@company.com");

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions/501")
      .set("Cookie", cookie)
      .send({ description: "No version supplied." });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toMatchObject({ version: expect.any(String) });
    expect(prisma.actionTaken.findFirst).not.toHaveBeenCalled();
  });

  it("requires a follow-up note when follow-up is required on update (AC-04)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.findFirst.mockResolvedValue(makeAction({ followUpRequired: false, followUpNote: null }));

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions/501")
      .set("Cookie", cookie)
      .send({ version: 1, followUpRequired: true });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toMatchObject({
      followUpNote: expect.any(String),
    });
    expect(prisma.actionTaken.updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the action is not on the ticket (AC-05)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions/999")
      .set("Cookie", cookie)
      .send({ version: 1, description: "Wrong ticket." });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects Requesters from updating actions (AC-03)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions/501")
      .set("Cookie", cookie)
      .send({ version: 1, description: "Requester edit." });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(prisma.actionTaken.updateMany).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when persistence fails (AC-09)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.actionTaken.create.mockRejectedValue(new Error("SQLSTATE 23505 secret database detail"));

    const response = await request(app)
      .post("/api/staff/tickets/101/actions")
      .set("Cookie", cookie)
      .send(validCreateBody());

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("SQLSTATE");
  });
});
