import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => ({
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
  $transaction: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => prisma,
}));

import { app } from "../../src/app.js";

describe("Lab 2 ticket API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a valid ticket with HTTP 201", async () => {
    prisma.ticket.create.mockResolvedValue({ id: 101, requesterId: 1, title: "VPN access" });

    const response = await request(app)
      .post("/api/tickets")
      .send({ requesterId: 1, categoryId: 2, title: "VPN access", description: "Remote access is required." });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 101, requesterId: 1 });
  });

  it("rejects ticket creation when required fields are missing", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send({ requesterId: 1, categoryId: 2, title: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/required/i);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("returns only the requester's tickets with search, filter, sort, and pagination", async () => {
    prisma.ticket.findMany.mockResolvedValue([{ id: 101, requesterId: 1, title: "VPN access", status: "Open" }]);
    prisma.ticket.count.mockResolvedValue(1);

    const response = await request(app)
      .get("/api/tickets?search=VPN&status=Open&sortBy=title&page=2&limit=10")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: 1, status: "Open" }),
      orderBy: { title: "desc" },
      skip: 10,
      take: 10,
    }));
  });

  it("rejects ticket detail access when ownership does not match", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 101, requesterId: 2, title: "Private ticket", attachments: [] });

    const response = await request(app)
      .get("/api/tickets/101")
      .set("x-requester-id", "1");

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/Forbidden/i);
  });

  it("returns 404 when the requested ticket does not exist", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/tickets/999")
      .set("x-requester-id", "1");

    expect(response.status).toBe(404);
  });

  it("rejects an invalid attachment type before storing it", async () => {
    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("x-requester-id", "1")
      .attach("files", Buffer.from("not an image"), "notes.txt");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid attachment/i);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("soft-removes an attachment without deleting its record", async () => {
    prisma.attachment.findUnique.mockResolvedValue({ id: 501, deletedAt: null, ticket: { requesterId: 1 } });
    prisma.attachment.update.mockResolvedValue({ id: 501, fileName: "evidence.png", deletedAt: new Date().toISOString() });

    const response = await request(app)
      .delete("/api/attachments/501")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.attachment.deletedAt).toBeTruthy();
    expect(prisma.attachment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 501 },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    }));
  });

  it("blocks download of a soft-removed attachment", async () => {
    prisma.attachment.findUnique.mockResolvedValue({
      id: 501,
      deletedAt: new Date(),
      url: "uploads/evidence.png",
      fileName: "evidence.png",
      ticket: { requesterId: 1 },
    });

    const response = await request(app)
      .get("/api/attachments/501/download")
      .set("x-requester-id", "1");

    expect(response.status).toBe(403);
  });

  it("rejects ticket creation with a non-existent category", async () => {
    prisma.ticket.create.mockRejectedValue(
      new Error("Foreign key constraint failed"),
    );

    const response = await request(app)
      .post("/api/tickets")
      .send({ requesterId: 1, categoryId: 999, title: "Test", description: "Desc" });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/failed/i);
  });

  it("rejects attachment upload when ticket already has 5 active attachments", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      requesterId: 1,
      _count: { attachments: 5 },
    });

    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("x-requester-id", "1")
      .attach("files", Buffer.from("fake image data"), "photo.jpg");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/at most 5/i);
  });

  it("rejects attachment upload with invalid file type", async () => {
    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("x-requester-id", "1")
      .attach("files", Buffer.from("not an image"), "notes.txt");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid attachment/i);
  });

  it("rejects ticket creation with empty title", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send({ requesterId: 1, categoryId: 1, title: "", description: "Some description" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/required/i);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects ticket creation with empty description", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send({ requesterId: 1, categoryId: 1, title: "Test ticket", description: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/required/i);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("returns 403 when no requesterId header is provided for ticket list", async () => {
    const response = await request(app).get("/api/tickets");

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/requesterId/i);
  });

  it("returns ticket detail for the owner", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: 101,
      requesterId: 1,
      title: "VPN access",
      description: "Remote access required",
      status: "Open",
      createdAt: new Date().toISOString(),
      category: { name: "Hardware" },
      relatedSystem: null,
      attachments: [],
    });

    const response = await request(app)
      .get("/api/tickets/101")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("VPN access");
  });

  it("sorts tickets by ticket number", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);

    const response = await request(app)
      .get("/api/tickets?sortBy=id&order=asc")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { id: "asc" },
    }));
  });

  it("sorts tickets by priority with highest first by default", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);

    const response = await request(app)
      .get("/api/tickets?sortBy=priority")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { priority: "desc" },
    }));
  });
});