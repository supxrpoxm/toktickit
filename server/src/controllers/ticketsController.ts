import { Request, Response } from "express";
import { getPrisma } from "../prisma.js";

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export async function getTickets(req: Request, res: Response) {
  try {
    const queryRequesterId = toSafeNumber(req.query.requesterId);
    const headerRequesterId = toSafeNumber(req.headers["x-requester-id"]);
    const requesterId = queryRequesterId ?? headerRequesterId;

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    if (headerRequesterId && queryRequesterId && headerRequesterId !== queryRequesterId) {
      return res.status(403).json({ error: "Forbidden: you can only access your own tickets." });
    }

    if (headerRequesterId && requesterId !== headerRequesterId) {
      return res.status(403).json({ error: "Forbidden: you can only access your own tickets." });
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
    const order = typeof req.query.order === "string" && req.query.order.toLowerCase() === "asc" ? "asc" : "desc";
    const page = Math.max(1, toSafeNumber(req.query.page) ?? 1);
    const limit = Math.min(50, Math.max(1, toSafeNumber(req.query.limit) ?? 10));
    const skip = (page - 1) * limit;

    const validSortFields = ["createdAt", "status", "title", "priority"];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";

    const where: any = {
      requesterId,
      ...(status ? { status } : {}),
      ...(search
        ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
        : {}),
    };

    const orderBy: any = { [safeSortBy]: order };

    const prisma = getPrisma();

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          requesterId: true,
          category: {
            select: { name: true },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return res.status(200).json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load tickets" });
  }
}

export async function getTicketById(req: Request, res: Response) {
  try {
    const ticketId = toSafeNumber(req.params.id);
    const requesterId = toSafeNumber(req.headers["x-requester-id"]);

    if (!ticketId || !requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: true,
        relatedSystem: true,
        attachments: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: you can only access your own tickets." });
    }

    return res.status(200).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: "Failed to load ticket" });
  }
}

export async function createTicket(req: Request, res: Response) {
  try {
    const requesterId = toSafeNumber(req.body.requesterId);
    const categoryId = toSafeNumber(req.body.categoryId);
    const relatedSystemId = req.body.relatedSystemId
      ? toSafeNumber(req.body.relatedSystemId)
      : null;
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";

    if (!requesterId || !categoryId || !title || !description) {
      return res.status(400).json({
        error: "requesterId, categoryId, title, and description are required.",
      });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.create({
      data: {
        requesterId,
        categoryId,
        relatedSystemId,
        title,
        description,
      },
    });

    return res.status(201).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create ticket" });
  }
}
