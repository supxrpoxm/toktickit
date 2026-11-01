import { Request, Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../prisma.js";
import { checkEntryBody, toEntryItem } from "../workflow.js";

function toSafeNumber(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

// Lab 3 (Issue 2) — authenticated identity wins (BR-03 / AC-07).
// When a session exists, its user id is authoritative and every
// client-supplied requesterId (query/header/body) is IGNORED, so spoofed
// identity fields can never leak another user's data. Without a session the
// Lab 2 header/body flow still works (transitional legacy fallback; the full
// 401 lock-down lands with the authorization issue).
function sessionRequesterId(req: Request): number | null {
  return req.authUser ? req.authUser.id : null;
}

// Mandatory password-change gate for session callers (BR-02): while
// requiresPasswordChange is true, normal ticket APIs return
// 403 PASSWORD_CHANGE_REQUIRED. Returns true when the gate fired.
function passwordGate(req: Request, res: Response): boolean {
  if (req.authUser?.requiresPasswordChange) {
    res.status(403).json({
      success: false,
      error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Please change your password to continue." },
    });
    return true;
  }
  return false;
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
  // Session identity wins over the legacy header (AC-07).
  return sessionRequesterId(req) ?? toSafeNumber(req.headers["x-requester-id"]);
}

export async function getTickets(req: Request, res: Response) {
  try {
    const sessionId = sessionRequesterId(req);
    if (sessionId) {
      if (passwordGate(req, res)) return;
    }

    const queryRequesterId = toSafeNumber(req.query.requesterId);
    const headerRequesterId = toSafeNumber(req.headers["x-requester-id"]);
    // Session identity wins; spoofed query/header values are ignored (AC-07).
    const requesterId = sessionId ?? queryRequesterId ?? headerRequesterId;

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: requesterId is required." });
    }

    if (!sessionId) {
      if (headerRequesterId && queryRequesterId && headerRequesterId !== queryRequesterId) {
        return res.status(403).json({ error: "Forbidden: you can only access your own tickets." });
      }

      if (headerRequesterId && requesterId !== headerRequesterId) {
        return res.status(403).json({ error: "Forbidden: you can only access your own tickets." });
      }
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
    if (passwordGate(req, res)) return;
    const ticketId = toSafeNumber(req.params.id);
    const requesterId = attachmentOwnerId(req);

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
        owner: { select: { id: true, name: true } },
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
    if (passwordGate(req, res)) return;
    // Session identity wins; a spoofed body.requesterId is ignored (AC-07).
    const requesterId = sessionRequesterId(req) ?? toSafeNumber(req.body.requesterId);
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
    // Lab 3 (Issue 4): new tickets start at `New` (explicit triage step),
    // unassigned, with IT Priority copied from the Requested Priority
    // (BR-16/BR-17) and the resolved-signal flag cleared (BR-20).
    const ticket = await prisma.ticket.create({
      data: {
        requesterId,
        categoryId,
        relatedSystemId,
        title,
        description,
        priority,
        itPriority: priority,
        status: "New",
        ownerId: null,
        requesterResolved: false,
      },
    });

    return res.status(201).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create ticket" });
  }
}

export async function addAttachments(req: Request, res: Response) {
  try {
    if (passwordGate(req, res)) return;
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
    if (passwordGate(req, res)) return;
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
    if (passwordGate(req, res)) return;
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
    // Lab 3 (Issue 4): IT Staff / Administrator sessions may download any
    // ticket's active attachments (staff detail continuity). Requesters stay
    // owner-scoped. Removed files stay unavailable to every role.
    const staffSession =
      req.authUser?.role === "IT_STAFF" || req.authUser?.role === "ADMINISTRATOR";
    if (!staffSession && attachment.ticket.requesterId !== requesterId) {
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
    if (passwordGate(req, res)) return;
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

// ---------------------------------------------------------------------------
// Lab 3 (Issue 4) — Requester discussion + resolved signal.
//
// These endpoints require an authenticated session (enforced by requireAuth +
// passwordChangeGate in routes/tickets.ts). Identity always comes from the
// session (BR-03); Requesters are scoped to their own tickets while IT Staff
// / Administrator may access any ticket's public thread.
// ---------------------------------------------------------------------------

const commentSelect = {
  id: true,
  ticketId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

function commentPagination(query: Request["query"]) {
  const page = Math.max(1, toSafeNumber(query.page) ?? 1);
  const limit = Math.min(50, Math.max(1, toSafeNumber(query.limit) ?? 20));
  return { page, limit, skip: (page - 1) * limit };
}

// Own-ticket gate for Requesters; Staff/Admin pass for any ticket. Returns
// the ticket on success, otherwise sends the error response and returns null.
async function accessibleTicket(req: Request, res: Response) {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
    });
    return null;
  }
  if (passwordGate(req, res)) return null;

  const ticketId = toSafeNumber(req.params.id);
  if (!ticketId) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
    });
    return null;
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true, status: true, requesterResolved: true, requesterResolvedAt: true },
  });
  if (!ticket) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
    });
    return null;
  }

  if (authUser.role === "REQUESTER" && ticket.requesterId !== authUser.id) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "You don't have access to this area." },
    });
    return null;
  }
  return { authUser, ticket };
}

// GET /api/tickets/:id/comments — public thread for the owning Requester
// (Staff/Admin by ticket access). Ordered oldest-first.
export async function getPublicComments(req: Request, res: Response) {
  try {
    const access = await accessibleTicket(req, res);
    if (!access) return;

    const { page, limit, skip } = commentPagination(req.query);
    const prisma = getPrisma();
    const [entries, total] = await Promise.all([
      prisma.publicComment.findMany({
        where: { ticketId: access.ticket.id },
        select: commentSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
      prisma.publicComment.count({ where: { ticketId: access.ticket.id } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: entries.map(toEntryItem),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
}

// POST /api/tickets/:id/comments — append a public reply. Author and time
// come from the session/backend (BR-19); empty/overlong bodies are rejected.
export async function createPublicComment(req: Request, res: Response) {
  try {
    const checked = checkEntryBody(req.body?.body);
    if (!checked.ok) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Message content is invalid.", fields: { body: checked.message } },
      });
    }

    const access = await accessibleTicket(req, res);
    if (!access) return;

    const prisma = getPrisma();
    const created = await prisma.publicComment.create({
      data: { ticketId: access.ticket.id, authorId: access.authUser.id, body: checked.body },
      select: commentSelect,
    });
    return res.status(201).json({ success: true, data: toEntryItem(created) });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
}

// POST /api/tickets/:id/resolved-signal — the owning Requester indicates the
// problem appears resolved (BR-20, AC-20). Sets the flag + timestamp only;
// the formal status is untouched (only IT Staff may Resolve/Close).
// Idempotent: a repeat call keeps the original timestamp.
export async function signalResolved(req: Request, res: Response) {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
      });
    }
    if (passwordGate(req, res)) return;

    const ticketId = toSafeNumber(req.params.id);
    if (!ticketId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
      });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true, status: true, requesterResolved: true, requesterResolvedAt: true },
    });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
      });
    }

    // Only the owning Requester may signal; Staff read the flag (matrix §5.5).
    if (authUser.role !== "REQUESTER" || ticket.requesterId !== authUser.id) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only the owning requester can signal that the problem appears resolved." },
      });
    }

    if (ticket.requesterResolved) {
      return res.status(200).json({
        success: true,
        data: { id: ticket.id, requesterResolved: true, requesterResolvedAt: ticket.requesterResolvedAt },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { requesterResolved: true, requesterResolvedAt: new Date() },
      select: { id: true, status: true, requesterResolved: true, requesterResolvedAt: true },
    });
    return res.status(200).json({
      success: true,
      data: { id: updated.id, requesterResolved: updated.requesterResolved, requesterResolvedAt: updated.requesterResolvedAt },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
}
