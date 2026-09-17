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
const adminUser = () =>
  makeUser({ id: 11, name: "Admin User", email: "admin@company.com", role: "ADMINISTRATOR" });
const requesterAlice = () =>
  makeUser({ id: 3, name: "Alice Johnson", email: "alice@company.com", role: "REQUESTER" });
const requesterBrandon = () =>
  makeUser({ id: 4, name: "Brandon Lee", email: "brandon@company.com", role: "REQUESTER" });
const forcedRequester = () =>
  makeUser({ id: 5, name: "Carmen Diaz", email: "carmen@company.com", role: "REQUESTER", requiresPasswordChange: true });

const usersByEmail: Record<string, () => Record<string, unknown>> = {
  "staff1@company.com": staffOne,
  "admin@company.com": adminUser,
  "alice@company.com": requesterAlice,
  "brandon@company.com": requesterBrandon,
  "carmen@company.com": forcedRequester,
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

const TICKET_ID = 101;

function ownTicket(requesterId = 3) {
  return {
    id: TICKET_ID,
    requesterId,
    status: "Open",
    requesterResolved: false,
    requesterResolvedAt: null,
  };
}

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    ticketId: TICKET_ID,
    body: "Still failing after restart.",
    createdAt: new Date("2026-09-06T10:00:00.000Z"),
    author: { id: 3, name: "Alice Johnson", role: "REQUESTER" },
    ...overrides,
  };
}

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    ticketId: TICKET_ID,
    body: "Checking VPN logs for this user.",
    createdAt: new Date("2026-09-06T11:00:00.000Z"),
    author: { id: 7, name: "IT Staff One", role: "IT_STAFF" },
    ...overrides,
  };
}

describe("Lab 3 public comments and internal notes API (Issue 4)", () => {
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
    prisma.ticket.findUnique.mockResolvedValue(ownTicket());
  });

  it("lets staff post a public comment with backend author and time (AC-17)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.publicComment.create.mockResolvedValue(
      commentRow({ id: 13, body: "Looking into this now.", author: { id: 7, name: "IT Staff One", role: "IT_STAFF" } }),
    );

    // Spoofed author/time fields must be ignored.
    const response = await request(app)
      .post("/api/staff/tickets/101/comments")
      .set("Cookie", cookie)
      .send({ body: "Looking into this now.", authorId: 3, createdAt: "2020-01-01T00:00:00.000Z" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      ticketId: 101,
      body: "Looking into this now.",
      author: { id: 7, name: "IT Staff One", role: "IT Staff" },
    });
    expect(response.body.data.createdAt).toBeTruthy();
    expect(prisma.publicComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: 101, authorId: 7 }) }),
    );
  });

  it("lists public comments oldest-first with pagination (AC-17)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.publicComment.findMany.mockResolvedValue([commentRow(), commentRow({ id: 13 })]);
    prisma.publicComment.count.mockResolvedValue(2);

    const response = await request(app).get("/api/staff/tickets/101/comments").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({ page: 1, total: 2, totalPages: 1 });
    expect(prisma.publicComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("lets the owning requester read and post public comments (AC-17)", async () => {
    const cookie = await loginAs("alice@company.com");
    prisma.publicComment.findMany.mockResolvedValue([commentRow()]);
    prisma.publicComment.count.mockResolvedValue(1);
    prisma.publicComment.create.mockResolvedValue(commentRow({ id: 14, body: "Thanks, waiting for the fix." }));

    const list = await request(app).get("/api/tickets/101/comments").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);

    const post = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", cookie)
      .send({ body: "Thanks, waiting for the fix." });
    expect(post.status).toBe(201);
    expect(post.body.data.author).toMatchObject({ id: 3, role: "Requester" });
  });

  it("blocks other requesters from a ticket's public thread (AC-17)", async () => {
    const cookie = await loginAs("brandon@company.com");

    const list = await request(app).get("/api/tickets/101/comments").set("Cookie", cookie);
    expect(list.status).toBe(403);
    expect(list.body.data).toBeUndefined();

    const post = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", cookie)
      .send({ body: "Snooping." });
    expect(post.status).toBe(403);
    expect(prisma.publicComment.create).not.toHaveBeenCalled();
  });

  it("rejects empty, whitespace-only, and overlong content (AC-17)", async () => {
    const cookie = await loginAs("staff1@company.com");

    for (const body of ["", "   ", "\n\t  "]) {
      const response = await request(app)
        .post("/api/staff/tickets/101/comments")
        .set("Cookie", cookie)
        .send({ body });
      expect(response.status).toBe(400);
      expect(response.body.error.fields.body).toBeTruthy();
    }

    const overlong = await request(app)
      .post("/api/staff/tickets/101/comments")
      .set("Cookie", cookie)
      .send({ body: "x".repeat(2001) });
    expect(overlong.status).toBe(400);

    const noteBad = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookie)
      .send({ body: "   " });
    expect(noteBad.status).toBe(400);

    expect(prisma.publicComment.create).not.toHaveBeenCalled();
    expect(prisma.internalNote.create).not.toHaveBeenCalled();
  });

  it("accepts a 2000-character message at the boundary (AC-17)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.publicComment.create.mockResolvedValue(commentRow({ body: "x".repeat(2000) }));

    const response = await request(app)
      .post("/api/staff/tickets/101/comments")
      .set("Cookie", cookie)
      .send({ body: "x".repeat(2000) });

    expect(response.status).toBe(201);
  });

  it("lets staff and admin create and read internal notes (AC-18)", async () => {
    const staffCookie = await loginAs("staff1@company.com");
    prisma.internalNote.create.mockResolvedValue(noteRow());
    prisma.internalNote.findMany.mockResolvedValue([noteRow()]);
    prisma.internalNote.count.mockResolvedValue(1);

    const post = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", staffCookie)
      .send({ body: "Checking VPN logs for this user." });
    expect(post.status).toBe(201);
    expect(post.body.data).toMatchObject({
      ticketId: 101,
      body: "Checking VPN logs for this user.",
      author: { id: 7, role: "IT Staff" },
    });

    const list = await request(app).get("/api/staff/tickets/101/notes").set("Cookie", staffCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);

    const adminCookie = await loginAs("admin@company.com");
    const adminList = await request(app).get("/api/staff/tickets/101/notes").set("Cookie", adminCookie);
    expect(adminList.status).toBe(200);
  });

  it("rejects Requester note reads with 403 and zero note content (AC-09, AC-18)", async () => {
    const cookie = await loginAs("alice@company.com");
    prisma.internalNote.findMany.mockResolvedValue([noteRow()]);
    prisma.internalNote.count.mockResolvedValue(1);

    const response = await request(app).get("/api/staff/tickets/101/notes").set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    // No note array, count, or content may leak — not even the shape.
    expect(response.body.data).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Checking VPN logs");
    expect(JSON.stringify(response.body)).not.toContain("notesCount");
    expect(prisma.internalNote.findMany).not.toHaveBeenCalled();
    expect(prisma.internalNote.count).not.toHaveBeenCalled();
  });

  it("rejects Requester note writes with 403 and creates nothing (AC-09, AC-18)", async () => {
    const cookie = await loginAs("alice@company.com");

    const response = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookie)
      .send({ body: "Trying to read private notes." });

    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("Trying to read private notes");
    expect(prisma.internalNote.create).not.toHaveBeenCalled();
  });

  it("requires authentication for every thread endpoint (AC-08)", async () => {
    for (const [method, path] of [
      ["get", "/api/staff/tickets/101/comments"],
      ["post", "/api/staff/tickets/101/comments"],
      ["get", "/api/staff/tickets/101/notes"],
      ["post", "/api/staff/tickets/101/notes"],
      ["get", "/api/tickets/101/comments"],
      ["post", "/api/tickets/101/comments"],
    ] as const) {
      const response =
        method === "get"
          ? await request(app).get(path)
          : await request(app).post(path).send({ body: "hello" });
      expect(response.status).toBe(401);
    }
    expect(prisma.publicComment.create).not.toHaveBeenCalled();
    expect(prisma.internalNote.create).not.toHaveBeenCalled();
  });

  it("gates forced-password sessions from threads until they change passwords (AC-04)", async () => {
    const cookie = await loginAs("carmen@company.com");

    const response = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", cookie)
      .send({ body: "hello" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(prisma.publicComment.create).not.toHaveBeenCalled();
  });

  it("returns 404 for threads on missing tickets (AC-17, AC-18)", async () => {
    const cookie = await loginAs("staff1@company.com");
    prisma.ticket.findUnique.mockResolvedValue(null);

    const comments = await request(app).get("/api/staff/tickets/999/comments").set("Cookie", cookie);
    expect(comments.status).toBe(404);

    const notes = await request(app).get("/api/staff/tickets/999/notes").set("Cookie", cookie);
    expect(notes.status).toBe(404);
  });

  it("exposes no edit or delete route for comments and notes (AC-19)", async () => {
    const cookie = await loginAs("staff1@company.com");

    for (const [method, path] of [
      ["put", "/api/staff/tickets/101/comments/12"],
      ["patch", "/api/staff/tickets/101/comments/12"],
      ["delete", "/api/staff/tickets/101/comments/12"],
      ["put", "/api/staff/tickets/101/notes/31"],
      ["patch", "/api/staff/tickets/101/notes/31"],
      ["delete", "/api/staff/tickets/101/notes/31"],
      ["delete", "/api/tickets/101/comments/12"],
    ] as const) {
      const response =
        method === "put"
          ? await request(app).put(path).set("Cookie", cookie).send({ body: "edited" })
          : method === "patch"
            ? await request(app).patch(path).set("Cookie", cookie).send({ body: "edited" })
            : await request(app).delete(path).set("Cookie", cookie);
      expect(response.status).toBe(404);
    }
  });
});
