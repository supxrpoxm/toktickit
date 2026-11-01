import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

process.env.SESSION_SECRET = "lab-04-integration-session-secret-min-16";

import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Real PostgreSQL integration coverage for the Actions Taken edge cases.
// The test creates its own users/category/ticket and removes them afterwards,
// so it does not depend on the seed script and does not leave data behind.

const prisma = getPrisma();
const PASSWORD = "Password123!";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let staffId = 0;
let staffEmail = "";
let requesterId = 0;
let categoryId = 0;
let ticketId = 0;
let cookie = "";

function sessionCookie(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const raw = list.find((c) => c.startsWith("toktickit.session="));
  expect(raw).toBeTruthy();
  return raw!.split(";")[0];
}

function validAction(overrides: Record<string, unknown> = {}) {
  return {
    description: "Integration test action.",
    result: "Integration test result.",
    followUpRequired: false,
    ...overrides,
  };
}

function postAction(body: Record<string, unknown>) {
  return request(app)
    .post(`/api/staff/tickets/${ticketId}/actions`)
    .set("Cookie", cookie)
    .send(body);
}

function patchAction(actionId: number, body: Record<string, unknown>) {
  return request(app)
    .patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
    .set("Cookie", cookie)
    .send(body);
}

describe("Lab 4 Actions Taken integration edge cases (Issue 2)", () => {
  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        name: "Actions Integration Staff",
        email: `actions-staff-${suffix}@example.test`,
        passwordHash: bcrypt.hashSync(PASSWORD, 4),
        role: "IT_STAFF",
        isActive: true,
        requiresPasswordChange: false,
      },
      select: { id: true, email: true },
    });
    staffId = staff.id;
    staffEmail = staff.email;

    const requester = await prisma.user.create({
      data: {
        name: "Actions Integration Requester",
        email: `actions-requester-${suffix}@example.test`,
        passwordHash: bcrypt.hashSync(PASSWORD, 4),
        role: "REQUESTER",
        isActive: true,
        requiresPasswordChange: false,
      },
      select: { id: true },
    });
    requesterId = requester.id;

    const category = await prisma.category.create({
      data: { name: `Actions Integration Category ${suffix}` },
      select: { id: true },
    });
    categoryId = category.id;

    const ticket = await prisma.ticket.create({
      data: {
        title: "Actions Taken integration ticket",
        description: "Temporary ticket created by the Lab 4 integration test.",
        requesterId,
        categoryId,
      },
      select: { id: true },
    });
    ticketId = ticket.id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: staffEmail, password: PASSWORD });
    expect(login.status).toBe(200);
    cookie = sessionCookie(login.headers["set-cookie"]);
  });

  beforeEach(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
  });

  afterAll(async () => {
    if (ticketId) {
      await prisma.ticket.deleteMany({ where: { id: ticketId } });
    }
    if (requesterId || staffId) {
      await prisma.user.deleteMany({
        where: { id: { in: [requesterId, staffId].filter((id) => id > 0) } },
      });
    }
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    await prisma.$disconnect();
  });

  it("rejects whitespace-only followUpNote when followUpRequired is true", async () => {
    const response = await postAction(
      validAction({ followUpRequired: true, followUpNote: "   " }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toMatchObject({
      followUpNote: expect.any(String),
    });
    await expect(prisma.actionTaken.count({ where: { ticketId } })).resolves.toBe(0);
  });

  it("keeps a valid followUpNote when followUpRequired is false", async () => {
    const note = "Optional note that must survive.";
    const response = await postAction(
      validAction({ followUpRequired: false, followUpNote: note }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      followUpRequired: false,
      followUpNote: note,
    });

    const stored = await prisma.actionTaken.findUnique({
      where: { id: response.body.data.id },
      select: { followUpRequired: true, followUpNote: true },
    });
    expect(stored).toEqual({ followUpRequired: false, followUpNote: note });
  });

  it("keeps a provided followUpNote when updating followUpRequired to false", async () => {
    const created = await postAction(
      validAction({ followUpRequired: true, followUpNote: "Initial required note." }),
    );
    expect(created.status).toBe(201);

    const updated = await patchAction(created.body.data.id, {
      version: created.body.data.version,
      followUpRequired: false,
      followUpNote: "Kept on update.",
    });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      followUpRequired: false,
      followUpNote: "Kept on update.",
    });
    const stored = await prisma.actionTaken.findUnique({
      where: { id: created.body.data.id },
      select: { followUpRequired: true, followUpNote: true },
    });
    expect(stored).toEqual({ followUpRequired: false, followUpNote: "Kept on update." });
  });

  it("does not silently clear an existing followUpNote when followUpRequired becomes false", async () => {
    const created = await postAction(
      validAction({ followUpRequired: true, followUpNote: "Existing note must remain." }),
    );
    expect(created.status).toBe(201);

    const updated = await patchAction(created.body.data.id, {
      version: created.body.data.version,
      followUpRequired: false,
    });

    expect(updated.status).toBe(200);
    expect(updated.body.data.followUpNote).toBe("Existing note must remain.");
    const stored = await prisma.actionTaken.findUnique({
      where: { id: created.body.data.id },
      select: { followUpNote: true },
    });
    expect(stored?.followUpNote).toBe("Existing note must remain.");
  });

  it("accepts followUpNote null when followUpRequired is false", async () => {
    const response = await postAction(
      validAction({ followUpRequired: false, followUpNote: null }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      followUpRequired: false,
      followUpNote: null,
    });
    const stored = await prisma.actionTaken.findUnique({
      where: { id: response.body.data.id },
      select: { followUpNote: true },
    });
    expect(stored?.followUpNote).toBeNull();
  });

  it("clears attachmentNotes when updated with null or an empty string", async () => {
    const created = await postAction(
      validAction({ attachmentNotes: "Original attachment note." }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.attachmentNotes).toBe("Original attachment note.");

    const clearedWithNull = await patchAction(created.body.data.id, {
      version: created.body.data.version,
      attachmentNotes: null,
    });
    expect(clearedWithNull.status).toBe(200);
    expect(clearedWithNull.body.data.attachmentNotes).toBeNull();

    const restored = await patchAction(created.body.data.id, {
      version: clearedWithNull.body.data.version,
      attachmentNotes: "Restored attachment note.",
    });
    expect(restored.status).toBe(200);
    expect(restored.body.data.attachmentNotes).toBe("Restored attachment note.");

    const clearedWithEmpty = await patchAction(created.body.data.id, {
      version: restored.body.data.version,
      attachmentNotes: "",
    });
    expect(clearedWithEmpty.status).toBe(200);
    expect(clearedWithEmpty.body.data.attachmentNotes).toBeNull();

    const stored = await prisma.actionTaken.findUnique({
      where: { id: created.body.data.id },
      select: { attachmentNotes: true },
    });
    expect(stored?.attachmentNotes).toBeNull();
  });

  it("rejects raw database inserts that violate check_followup_note_required", async () => {
    for (const invalidNote of [null, "   "]) {
      let inserted = false;
      let caught: unknown;

      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `INSERT INTO "ActionTaken"
               ("ticketId", "description", "result", "performedById",
                "followUpRequired", "followUpNote", "updatedAt")
             VALUES ($1, $2, $3, $4, true, $5, NOW())`,
            ticketId,
            "Raw constraint test",
            "This row must never persist.",
            staffId,
            invalidNote,
          );
          inserted = true;
          throw new Error("__ROLLBACK_AFTER_INSERT__");
        });
      } catch (error) {
        caught = error;
      }

      expect(inserted).toBe(false);
      expect(caught).toBeTruthy();
      const meta = (caught as { meta?: { code?: string; message?: string } }).meta;
      expect(meta?.code).toBe("23514");
      expect(meta?.message).toContain("check_followup_note_required");
    }

    await expect(prisma.actionTaken.count({ where: { ticketId } })).resolves.toBe(0);
  });
});
