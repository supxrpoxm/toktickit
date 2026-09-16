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
    id: 3,
    name: "Alice Johnson",
    email: "alice@company.com",
    passwordHash: bcrypt.hashSync(CURRENT_PASSWORD, 4),
    role: "REQUESTER",
    isActive: true,
    requiresPasswordChange: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const requester = () => makeUser();
const forcedUser = () =>
  makeUser({ id: 4, name: "Brandon Lee", email: "brandon@company.com", requiresPasswordChange: true });
const staffUser = () =>
  makeUser({ id: 7, name: "IT Staff One", email: "staff1@company.com", role: "IT_STAFF" });
const adminUser = () =>
  makeUser({ id: 11, name: "Admin User", email: "admin@company.com", role: "ADMINISTRATOR" });
const inactiveUser = () =>
  makeUser({ id: 6, name: "Evelyn Gray", email: "evelyn@company.com", isActive: false });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "alice@company.com": requester,
  "brandon@company.com": forcedUser,
  "staff1@company.com": staffUser,
  "admin@company.com": adminUser,
  "evelyn@company.com": inactiveUser,
};

function sessionCookie(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const raw = list.find((c) => c.startsWith("toktickit.session="));
  expect(raw).toBeTruthy();
  return raw!.split(";")[0];
}

describe("Lab 3 auth API (Issue 2)", () => {
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
  });

  it("logs in a valid user with a safe user object and a session cookie (AC-01)", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@company.com", password: CURRENT_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      id: 3,
      name: "Alice Johnson",
      email: "alice@company.com",
      role: "Requester",
      isActive: true,
      mustChangePassword: false,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(sessionCookie(response.headers["set-cookie"])).toContain("toktickit.session=");
  });

  it("maps staff and administrator roles to their display labels", async () => {
    for (const [email, label] of [
      ["staff1@company.com", "IT Staff"],
      ["admin@company.com", "Administrator"],
    ] as const) {
      const response = await request(app).post("/api/auth/login").send({ email, password: CURRENT_PASSWORD });
      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe(label);
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    }
  });

  it("returns the identical generic 401 for unknown emails and wrong passwords (AC-02)", async () => {
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@company.com", password: "Whatever123" });
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@company.com", password: "Wrongpass1" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.error.message).toBe("Invalid email or password.");
    expect(unknown.headers["set-cookie"]).toBeUndefined();
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects missing credentials with field-level 400 errors", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields.email).toBeTruthy();
    expect(response.body.error.fields.password).toBeTruthy();
  });

  it("refuses inactive accounts without creating a session (AC-03)", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "evelyn@company.com", password: CURRENT_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_INACTIVE");
    expect(response.body.error.message).toMatch(/inactive/i);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("gates normal APIs until the initial password is changed, then clears the flag (AC-04, AC-05)", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "brandon@company.com", password: CURRENT_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
    const cookie = sessionCookie(login.headers["set-cookie"]);

    const gated = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const weak = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ newPassword: "short", confirmPassword: "short" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.newPassword).toBeTruthy();

    const mismatch = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ newPassword: "Newpass123", confirmPassword: "Other123" });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.fields.confirmPassword).toMatch(/match/i);

    const same = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ newPassword: CURRENT_PASSWORD, confirmPassword: CURRENT_PASSWORD });
    expect(same.status).toBe(400);
    expect(same.body.error.fields.newPassword).toMatch(/different/i);

    prisma.user.update.mockResolvedValueOnce(
      makeUser({ id: 4, name: "Brandon Lee", email: "brandon@company.com", requiresPasswordChange: false }),
    );
    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ newPassword: "Newpass123", confirmPassword: "Newpass123" });
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.mustChangePassword).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 4 }, data: expect.objectContaining({ requiresPasswordChange: false }) }),
    );
    // The stored hash must differ from the plaintext password.
    const storedHash = (prisma.user.update.mock.calls[0][0] as { data: { passwordHash: string } }).data.passwordHash;
    expect(storedHash).not.toContain("Newpass123");
  });

  it("destroys the session on logout and blocks protected endpoints afterwards (AC-06)", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@company.com", password: CURRENT_PASSWORD });
    const cookie = sessionCookie(login.headers["set-cookie"]);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("alice@company.com");

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);
    expect(logout.body.data).toEqual({ loggedOut: true });

    const after = await request(app).get("/api/auth/me");
    expect(after.status).toBe(401);

    // Logout is idempotent: no session still returns success.
    const again = await request(app).post("/api/auth/logout");
    expect(again.status).toBe(200);
  });

  it("returns 401 from /me without a session", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("ignores spoofed requesterIds once a session exists (AC-07)", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@company.com", password: CURRENT_PASSWORD });
    const cookie = sessionCookie(login.headers["set-cookie"]);

    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);

    const response = await request(app)
      .get("/api/tickets?requesterId=999")
      .set("Cookie", cookie)
      .set("x-requester-id", "999");

    expect(response.status).toBe(200);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ requesterId: 3 }) }),
    );
  });

  it("creates tickets under the session identity, ignoring a spoofed body requesterId", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@company.com", password: CURRENT_PASSWORD });
    const cookie = sessionCookie(login.headers["set-cookie"]);

    prisma.ticket.create.mockResolvedValue({ id: 201, requesterId: 3, title: "VPN access" });

    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookie)
      .send({ requesterId: 999, categoryId: 2, title: "VPN access", description: "Remote access is required." });

    expect(response.status).toBe(201);
    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requesterId: 3 }) }),
    );
  });
});
