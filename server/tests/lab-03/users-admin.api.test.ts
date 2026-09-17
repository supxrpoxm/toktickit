import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-03-test-session-secret-min-16";

const prisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
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
    id: 11,
    name: "Admin User",
    email: "admin@company.com",
    passwordHash: bcrypt.hashSync(CURRENT_PASSWORD, 4),
    role: "ADMINISTRATOR",
    isActive: true,
    requiresPasswordChange: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const adminUser = () => makeUser();
const secondAdmin = () =>
  makeUser({ id: 12, name: "Second Admin", email: "admin2@company.com" });
const staffUser = () =>
  makeUser({ id: 7, name: "IT Staff One", email: "staff1@company.com", role: "IT_STAFF" });
const requesterUser = () =>
  makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" });
const forcedAdmin = () =>
  makeUser({ id: 13, name: "New Admin", email: "newadmin@company.com", requiresPasswordChange: true });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "admin@company.com": adminUser,
  "admin2@company.com": secondAdmin,
  "staff1@company.com": staffUser,
  "alice@company.com": requesterUser,
  "newadmin@company.com": forcedAdmin,
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

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    name: "Alice Johnson",
    email: "alice@company.com",
    role: "REQUESTER",
    isActive: true,
    requiresPasswordChange: false,
    ...overrides,
  };
}

describe("Lab 3 admin user management API (Issue 5)", () => {
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
    prisma.user.findMany.mockResolvedValue([listRow(), listRow({ id: 7, name: "IT Staff One", email: "staff1@company.com", role: "IT_STAFF" })]);
    prisma.user.count.mockResolvedValue(1);
  });

  it("lists users with safe fields only, ordered by name (AC-21)", async () => {
    const cookie = await loginAs("admin@company.com");

    const response = await request(app).get("/api/admin/users").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toMatchObject({
      id: 3,
      name: "Alice Johnson",
      email: "alice@company.com",
      role: "Requester",
      isActive: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
    );
  });

  it("searches by name or email and filters by one role (AC-21, AC-22)", async () => {
    const cookie = await loginAs("admin@company.com");

    await request(app).get("/api/admin/users?search=alice").set("Cookie", cookie);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "alice", mode: "insensitive" } },
            { email: { contains: "alice", mode: "insensitive" } },
          ],
        }),
      }),
    );

    await request(app).get("/api/admin/users?role=IT Staff").set("Cookie", cookie);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: "IT_STAFF" }) }),
    );

    // An invalid role never errors the list — it is simply unfiltered.
    const invalid = await request(app).get("/api/admin/users?role=Bogus").set("Cookie", cookie);
    expect(invalid.status).toBe(200);
    const lastCall = prisma.user.findMany.mock.calls[prisma.user.findMany.mock.calls.length - 1][0] as {
      where: Record<string, unknown>;
    };
    expect(lastCall.where.role).toBeUndefined();
  });

  it("rejects non-administrators with 403 and no user data (AC-29)", async () => {
    for (const email of ["alice@company.com", "staff1@company.com"]) {
      const cookie = await loginAs(email);
      for (const [method, path] of [
        ["get", "/api/admin/users"],
        ["post", "/api/admin/users"],
        ["patch", "/api/admin/users/3"],
        ["post", "/api/admin/users/3/set-password"],
      ] as const) {
        const response =
          method === "get"
            ? await request(app).get(path).set("Cookie", cookie)
            : method === "post" && path.endsWith("set-password")
              ? await request(app).post(path).set("Cookie", cookie).send({ initialPassword: "Newpass123" })
              : method === "post"
                ? await request(app).post(path).set("Cookie", cookie).send({})
                : await request(app).patch(path).set("Cookie", cookie).send({ name: "X" });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
        expect(response.body.data).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain("alice@company.com");
      }
    }
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and gates forced-password admins (AC-04)", async () => {
    const anonymous = await request(app).get("/api/admin/users");
    expect(anonymous.status).toBe(401);

    const forcedCookie = await loginAs("newadmin@company.com");
    const gated = await request(app).get("/api/admin/users").set("Cookie", forcedCookie);
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("creates a user with a forced initial password (AC-23)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.user.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 21,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(args.data as object),
    }));

    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", cookie)
      .send({
        name: "New Staff",
        email: "Staff4@company.com",
        role: "IT Staff",
        isActive: true,
        initialPassword: "Password123!",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      id: 21,
      name: "New Staff",
      email: "staff4@company.com",
      role: "IT Staff",
      isActive: true,
      mustChangePassword: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("Password123!");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    const storedHash = (prisma.user.create.mock.calls[0][0] as { data: { passwordHash: string } }).data
      .passwordHash;
    expect(storedHash).not.toContain("Password123!");
  });

  it("rejects duplicate emails including case variants with 409 (AC-24)", async () => {
    const cookie = await loginAs("admin@company.com");

    const duplicate = await request(app)
      .post("/api/admin/users")
      .set("Cookie", cookie)
      .send({
        name: "Copycat",
        email: "ALICE@company.com",
        role: "Requester",
        initialPassword: "Password123!",
      });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_EMAIL");
    expect(duplicate.body.error.fields.email).toBeTruthy();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects invalid create payloads with field-level 400 errors (AC-23)", async () => {
    const cookie = await loginAs("admin@company.com");

    const blank = await request(app)
      .post("/api/admin/users")
      .set("Cookie", cookie)
      .send({ name: "   ", email: "not-an-email", role: "Superuser", initialPassword: "short" });

    expect(blank.status).toBe(400);
    expect(blank.body.error.code).toBe("VALIDATION_ERROR");
    expect(blank.body.error.fields.name).toBeTruthy();
    expect(blank.body.error.fields.email).toBeTruthy();
    expect(blank.body.error.fields.role).toBeTruthy();
    expect(blank.body.error.fields.initialPassword).toBeTruthy();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("edits name, email, role, and activation (AC-25)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.user.update.mockImplementation(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({
      ...requesterUser(),
      ...(args.data as object),
    }));

    const response = await request(app)
      .patch("/api/admin/users/3")
      .set("Cookie", cookie)
      .send({ name: "Alice Renamed", isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: 3, name: "Alice Renamed", isActive: false });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");

    const badRole = await request(app)
      .patch("/api/admin/users/3")
      .set("Cookie", cookie)
      .send({ role: "Nobody" });
    expect(badRole.status).toBe(400);

    // Unknown id -> 404 (attachSession consumes the first findUnique call).
    prisma.user.findUnique
      .mockResolvedValueOnce(adminUser())
      .mockResolvedValueOnce(null);
    const missing = await request(app)
      .patch("/api/admin/users/999")
      .set("Cookie", cookie)
      .send({ name: "Ghost" });
    expect(missing.status).toBe(404);

    const empty = await request(app).patch("/api/admin/users/3").set("Cookie", cookie).send({});
    expect(empty.status).toBe(400);
  });

  it("rejects renaming onto an existing email with 409 (AC-24)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.user.update.mockClear();

    const response = await request(app)
      .patch("/api/admin/users/3")
      .set("Cookie", cookie)
      .send({ email: "staff1@company.com" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_EMAIL");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks self-deactivation and leaves the account active (AC-27)", async () => {
    const cookie = await loginAs("admin@company.com");

    const response = await request(app)
      .patch("/api/admin/users/11")
      .set("Cookie", cookie)
      .send({ isActive: false });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ADMIN_SAFETY_RULE");
    expect(response.body.error.message).toMatch(/own account/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("protects the last active Administrator from deactivation and demotion (AC-28)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.user.count.mockResolvedValue(0);

    // Target a DIFFERENT last admin (id 12): point lookups at the second
    // admin record so the session admin (id 11) is not the target.
    prisma.user.findUnique.mockImplementation(async (args: { where?: { id?: number } }) => {
      if (args?.where?.id === 11) return adminUser();
      if (args?.where?.id === 12) return secondAdmin();
      const all = Object.values(usersByEmail).map((fn) => fn());
      return all.find((u) => u.id === args?.where?.id) ?? null;
    });

    const demoteOther = await request(app)
      .patch("/api/admin/users/12")
      .set("Cookie", cookie)
      .send({ role: "IT Staff" });
    expect(demoteOther.status).toBe(409);
    expect(demoteOther.body.error.code).toBe("ADMIN_SAFETY_RULE");

    const deactivateOther = await request(app)
      .patch("/api/admin/users/12")
      .set("Cookie", cookie)
      .send({ isActive: false });
    expect(deactivateOther.status).toBe(409);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows deactivation when another active Administrator remains (AC-28)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findUnique.mockImplementation(async (args: { where?: { id?: number } }) => {
      if (args?.where?.id === 11) return adminUser();
      if (args?.where?.id === 12) return secondAdmin();
      return null;
    });
    prisma.user.update.mockImplementation(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({
      ...secondAdmin(),
      ...(args.data as object),
    }));

    const response = await request(app)
      .patch("/api/admin/users/12")
      .set("Cookie", cookie)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: 12, isActive: false });
  });

  it("sets a new initial password that forces a change at next login (AC-26)", async () => {
    const cookie = await loginAs("admin@company.com");
    prisma.user.update.mockResolvedValue({ ...requesterUser(), requiresPasswordChange: true });

    const response = await request(app)
      .post("/api/admin/users/3/set-password")
      .set("Cookie", cookie)
      .send({ initialPassword: "Brandnew123" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: 3, mustChangePassword: true });
    expect(JSON.stringify(response.body)).not.toContain("Brandnew123");
    const storedHash = (prisma.user.update.mock.calls[0][0] as { data: { passwordHash: string } }).data
      .passwordHash;
    expect(storedHash).not.toContain("Brandnew123");

    const weak = await request(app)
      .post("/api/admin/users/3/set-password")
      .set("Cookie", cookie)
      .send({ initialPassword: "short" });
    expect(weak.status).toBe(400);

    prisma.user.findUnique
      .mockResolvedValueOnce(adminUser())
      .mockResolvedValueOnce(null);
    const missing = await request(app)
      .post("/api/admin/users/999/set-password")
      .set("Cookie", cookie)
      .send({ initialPassword: "Brandnew123" });
    expect(missing.status).toBe(404);
  });

  it("exposes no delete route — users are deactivated, never deleted (BR-11)", async () => {
    const cookie = await loginAs("admin@company.com");

    const response = await request(app).delete("/api/admin/users/3").set("Cookie", cookie);

    expect(response.status).toBe(404);
  });

  it("serves the stakeholder aliases under /api/users (PUT + reset-password)", async () => {
    const cookie = await loginAs("admin@company.com");

    const list = await request(app).get("/api/users?search=alice").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(2);

    prisma.user.update.mockImplementation(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({
      ...requesterUser(),
      ...(args.data as object),
    }));
    const edit = await request(app).put("/api/users/3").set("Cookie", cookie).send({ name: "Alias Edit" });
    expect(edit.status).toBe(200);
    expect(edit.body.data.user.name).toBe("Alias Edit");

    const reset = await request(app)
      .post("/api/users/3/reset-password")
      .set("Cookie", cookie)
      .send({ initialPassword: "Aliasnew123" });
    expect(reset.status).toBe(200);
    expect(reset.body.data.mustChangePassword).toBe(true);

    const requesterCookie = await loginAs("alice@company.com");
    const forbidden = await request(app).get("/api/users").set("Cookie", requesterCookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.data).toBeUndefined();
  });
});
