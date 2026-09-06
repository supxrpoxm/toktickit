import { Request, Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../prisma.js";

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

const uploadDirectory = path.resolve("uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      const safeExtension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(extension));
  },
});

function attachmentOwnerId(req: Request): number | null {
  return toSafeNumber(req.headers["x-requester-id"]);
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

    const validSortFields = ["createdAt", "status", "title", "priority", "id"];
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
          priority: true,
          createdAt: true,
          requesterId: true,
          category: {
            select: { id: true, name: true },
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
    const allowedPriorities = ["High", "Medium", "Low"] as const;
    type PriorityInput = (typeof allowedPriorities)[number];
    const priority: PriorityInput = allowedPriorities.includes(req.body.priority) ? req.body.priority : "Medium";

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
        priority,
      },
    });

    return res.status(201).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create ticket" });
  }
}

export async function addAttachments(req: Request, res: Response) {
  try {
    const ticketId = toSafeNumber(req.params.id);
    const requesterId = attachmentOwnerId(req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (!ticketId || !requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    if (files.length === 0) {
      return res.status(400).json({ error: "At least one valid attachment is required." });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true, _count: { select: { attachments: { where: { deletedAt: null } } } } },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: you can only modify your own tickets." });
    }

    if (ticket._count.attachments + files.length > 5) {
      for (const file of files) fs.rmSync(file.path, { force: true });
      return res.status(400).json({ error: "A ticket may have at most 5 active attachments." });
    }

    const attachments = await prisma.$transaction(
      files.map((file) =>
        prisma.attachment.create({
          data: {
            ticketId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            url: file.path,
          },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            deletedAt: true,
          },
        }),
      ),
    );

    return res.status(201).json({ attachments });
  } catch (error) {
    return res.status(500).json({ error: "Failed to upload attachments" });
  }
}

export async function getAttachments(req: Request, res: Response) {
  try {
    const ticketId = toSafeNumber(req.params.id);
    const requesterId = attachmentOwnerId(req);

    if (!ticketId || !requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: you can only access your own tickets." });
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, deletedAt: true },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({ attachments });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load attachments" });
  }
}

export async function downloadAttachment(req: Request, res: Response) {
  try {
    const fileId = toSafeNumber(req.params.fileId);
    const requesterId = attachmentOwnerId(req);

    if (!fileId || !requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: fileId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: you can only access your own attachments." });
    }
    if (attachment.deletedAt) {
      return res.status(403).json({ error: "Attachment is no longer available." });
    }
    if (!attachment.url || !fs.existsSync(attachment.url)) {
      return res.status(404).json({ error: "Attachment file not found" });
    }

    return res.download(attachment.url, attachment.fileName);
  } catch (error) {
    return res.status(500).json({ error: "Failed to download attachment" });
  }
}

export async function removeAttachment(req: Request, res: Response) {
  try {
    const fileId = toSafeNumber(req.params.fileId);
    const requesterId = attachmentOwnerId(req);

    if (!fileId || !requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: fileId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: you can only modify your own attachments." });
    }

    const removedAttachment = await prisma.attachment.update({
      where: { id: fileId },
      data: { deletedAt: attachment.deletedAt ?? new Date() },
      select: { id: true, fileName: true, deletedAt: true },
    });

    return res.status(200).json({ attachment: removedAttachment });
  } catch (error) {
    return res.status(500).json({ error: "Failed to remove attachment" });
  }
}
