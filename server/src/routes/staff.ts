import { Router, type Request, type Response } from "express";
import { roleToLabel } from "../auth.js";
import { passwordChangeGate, requireAuth, requireStaff } from "../middleware/auth.js";
import { getPrisma } from "../prisma.js";
import {
  allowedTransitions,
  checkEntryBody,
  internalError,
  isQualifiedOwner,
  isValidTransition,
  isWorkflowStatus,
  notFoundError,
  toEntryItem,
  toSafeInt,
  validationError,
  WORKFLOW_PRIORITIES,
  WORKFLOW_STATUSES,
} from "../workflow.js";

// ---------------------------------------------------------------------------
// Lab 3 (Issue 3) — IT Staff Ticket Queue.
//
// Guards (in order): requireAuth (401) -> passwordChangeGate (403
// PASSWORD_CHANGE_REQUIRED) -> requireStaff (403 FORBIDDEN, no payload).
// Only IT Staff and Administrator sessions reach the handlers.
// ---------------------------------------------------------------------------

const router = Router();
router.use(requireAuth, passwordChangeGate, requireStaff);

const STATUSES = WORKFLOW_STATUSES;

const PRIORITIES = WORKFLOW_PRIORITIES;

const SORTS = [
  "updatedAt:desc",
  "updatedAt:asc",
  "createdAt:desc",
  "createdAt:asc",
  "itPriority:desc",
  "title:asc",
] as const;
type SortKey = (typeof SORTS)[number];
const DEFAULT_SORT: SortKey = "updatedAt:desc";

// Display number: TT-0101 for id 101 (matches docs/lab-03/api-spec.md §5.1).
export function ticketNumber(id: number): string {
  return `TT-${String(id).padStart(4, "0")}`;
}

function parseTicketIdSearch(search: string): number | null {
  const normalized = search.replace(/^tt-?/i, "").replace(/^0+/, "");
  if (!/^\d+$/.test(search.replace(/^tt-?/i, ""))) return null;
  const id = Number(normalized === "" ? search.replace(/^tt-?/i, "") : normalized);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function queueWhere(query: Request["query"], sessionUserId: number): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  // Search: ticket number (numeric id, TT- prefix tolerated) or keyword in
  // summary/title + description.
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 200) : "";
  if (search) {
    const id = parseTicketIdSearch(search);
    and.push({
      OR: [
        ...(id !== null ? [{ id }] : []),
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  // Filters — unknown values fall back to unfiltered (never 500).
  const status = typeof query.status === "string" ? query.status : "all";
  if ((STATUSES as readonly string[]).includes(status)) {
    and.push({ status });
  }

  const itPriority = typeof query.itPriority === "string" ? query.itPriority : "all";
  if ((PRIORITIES as readonly string[]).includes(itPriority)) {
    and.push({ itPriority });
  }

  const requestedPriority = typeof query.requestedPriority === "string" ? query.requestedPriority : "all";
  if ((PRIORITIES as readonly string[]).includes(requestedPriority)) {
    and.push({ priority: requestedPriority });
  }

  const owner = typeof query.owner === "string" ? query.owner : "all";
  if (owner === "unassigned") {
    and.push({ ownerId: null });
  } else if (owner === "me") {
    and.push({ ownerId: sessionUserId });
  } else {
    const ownerId = toSafeInt(owner);
    if (ownerId !== null && ownerId > 0) and.push({ ownerId });
  }

  const categoryId = toSafeInt(query.categoryId);
  if (categoryId !== null && categoryId > 0) and.push({ categoryId });

  return and.length > 0 ? { AND: and } : {};
}

function queueOrderBy(sort: unknown): Record<string, string>[] {
  const key: SortKey = (SORTS as readonly string[]).includes(sort as string)
    ? (sort as SortKey)
    : DEFAULT_SORT;
  const [field, dir] = key.split(":") as [string, "asc" | "desc"];
  // Deterministic secondary sort so pagination is stable (BR-22).
  return [{ [field]: dir }, { id: "asc" }];
}

const queueSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  itPriority: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} as const;

function toQueueItem(ticket: {
  id: number;
  title: string;
  status: string;
  priority: string;
  itPriority: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: number; name: string } | null;
  requester: { id: number; name: string };
  category: { id: number; name: string };
}) {
  return {
    id: ticket.id,
    ticketNumber: ticketNumber(ticket.id),
    title: ticket.title,
    category: ticket.category.name,
    requestedPriority: ticket.priority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    owner: ticket.owner,
    requester: ticket.requester,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

// GET /api/staff/tickets — shared queue with search, filters, sort,
// pagination. Invalid query values fall back to defaults (BR-22).
router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, toSafeInt(req.query.page) ?? 1);
    const limit = Math.min(50, Math.max(1, toSafeInt(req.query.limit) ?? 10));
    const skip = (page - 1) * limit;

    const where = queueWhere(req.query, req.authUser!.id);
    const orderBy = queueOrderBy(req.query.sort);

    const prisma = getPrisma();
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({ where, orderBy, skip, take: limit, select: queueSelect }),
      prisma.ticket.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: tickets.map(toQueueItem),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
});

// GET /api/staff/tickets/:id — full ticket context for the staff detail
// screen: classification, both priorities, status, owner, requester,
// timestamps, the Requester resolved-signal flag, active attachments, plus
// comment/note COUNTS (thread bodies have dedicated endpoints so note
// content is never bundled where it does not belong). 404 only when the id
// truly does not exist.
router.get("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
      });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        itPriority: true,
        requesterResolved: true,
        requesterResolvedAt: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          where: { deletedAt: null },
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { publicComments: true, internalNotes: true } },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
      });
    }

    const counts = (ticket as { _count?: { publicComments?: number; internalNotes?: number } })._count;
    return res.status(200).json({
      success: true,
      data: {
        id: ticket.id,
        ticketNumber: ticketNumber(ticket.id),
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        requestedPriority: ticket.priority,
        itPriority: ticket.itPriority,
        owner: ticket.owner,
        requester: ticket.requester,
        category: ticket.category,
        relatedSystem: ticket.relatedSystem,
        attachments: ticket.attachments,
        requesterResolved: (ticket as { requesterResolved?: boolean }).requesterResolved ?? false,
        requesterResolvedAt: (ticket as { requesterResolvedAt?: Date | string | null }).requesterResolvedAt ?? null,
        commentsCount: counts?.publicComments ?? 0,
        notesCount: counts?.internalNotes ?? 0,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
});

// GET /api/staff/users — assignable owner candidates: active IT Staff and
// Administrator users (BR-15). Powers the detail-screen owner select so
// staff never have to guess numeric ids.
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, name: true, role: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({
      success: true,
      data: {
        items: users.map((user) => ({ id: user.id, name: user.name, role: roleToLabel(user.role) })),
      },
    });
  } catch {
    return res.status(500).json(internalError());
  }
});

// PATCH /api/staff/tickets/:id/owner — claim / assign / reassign / unassign
// the single primary Ticket Owner (BR-15, AC-13).
// Body: exactly one of { claim: true } | { ownerId: number } | { ownerId: null }.
router.patch("/tickets/:id/owner", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());

    const hasClaim = req.body?.claim === true;
    const hasOwnerId = req.body !== null && typeof req.body === "object" && "ownerId" in req.body;
    if ((hasClaim && hasOwnerId) || (!hasClaim && !hasOwnerId)) {
      return res.status(400).json(
        validationError("Provide exactly one of claim or ownerId.", {
          owner: "Provide exactly one of claim or ownerId.",
        }),
      );
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return res.status(404).json(notFoundError());

    // Unassign: permitted roles only (router gate already enforced).
    if (hasOwnerId && (req.body.ownerId === null || req.body.ownerId === undefined)) {
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { ownerId: null },
        select: { id: true, owner: { select: { id: true, name: true } } },
      });
      return res.status(200).json({ success: true, data: { id: updated.id, owner: updated.owner } });
    }

    // Resolve the candidate: claim assigns the session user.
    const candidateId = hasClaim ? req.authUser!.id : toSafeInt(req.body.ownerId);
    if (candidateId === null || candidateId <= 0) {
      return res.status(400).json(
        validationError("A valid owner is required.", { ownerId: "Select a valid staff member." }),
      );
    }

    const candidate = await prisma.user.findUnique({ where: { id: candidateId } });
    if (!candidate || !isQualifiedOwner(candidate)) {
      return res.status(422).json({
        success: false,
        error: {
          code: "INVALID_ASSIGNEE",
          message: "Tickets can only be assigned to an active IT Staff or Administrator user.",
          fields: { ownerId: "Tickets can only be assigned to an active IT Staff or Administrator user." },
        },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { ownerId: candidate.id },
      select: { id: true, owner: { select: { id: true, name: true } } },
    });
    return res.status(200).json({ success: true, data: { id: updated.id, owner: updated.owner } });
  } catch {
    return res.status(500).json(internalError());
  }
});

// PATCH /api/staff/tickets/:id/priority — set the staff-owned IT Priority
// (BR-16, AC-14). requestedPriority is read-only: a sent value is ignored
// and never changes (contract fixed in api-spec.md §5.4).
router.patch("/tickets/:id/priority", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());

    const itPriority = req.body?.itPriority;
    if (!(PRIORITIES as readonly string[]).includes(itPriority)) {
      return res.status(400).json(
        validationError("A valid IT priority is required.", {
          itPriority: "IT Priority must be one of Low, Medium, or High.",
        }),
      );
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return res.status(404).json(notFoundError());

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { itPriority },
      select: { id: true, priority: true, itPriority: true },
    });
    return res.status(200).json({
      success: true,
      data: { id: updated.id, requestedPriority: updated.priority, itPriority: updated.itPriority },
    });
  } catch {
    return res.status(500).json(internalError());
  }
});

// PATCH /api/staff/tickets/:id/status — permitted status change per the
// transition matrix (BR-17, AC-15). Unknown status -> 400; illegal
// transition -> 422 with the allowed list. Requesters cannot reach this
// route at all (router gate -> 403, AC-16).
router.patch("/tickets/:id/status", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());

    const next = req.body?.status;
    if (!isWorkflowStatus(next)) {
      return res.status(400).json(
        validationError("A valid status is required.", {
          status: `Status must be one of: ${WORKFLOW_STATUSES.join(", ")}.`,
        }),
      );
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!ticket) return res.status(404).json(notFoundError());

    if (ticket.status === next) {
      return res.status(200).json({
        success: true,
        data: { id: ticket.id, status: ticket.status, updatedAt: ticket.updatedAt },
      });
    }

    if (!isValidTransition(ticket.status, next)) {
      const allowed = allowedTransitions(ticket.status);
      return res.status(422).json({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message:
            allowed.length > 0
              ? `Cannot move from ${ticket.status} to ${next}. Allowed: ${allowed.join(", ")}.`
              : `Cannot move from ${ticket.status} to ${next}.`,
          fields: { status: `Allowed transitions from ${ticket.status}: ${allowed.join(", ") || "none"}.` },
        },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: next },
      select: { id: true, status: true, updatedAt: true },
    });
    return res.status(200).json({
      success: true,
      data: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt },
    });
  } catch {
    return res.status(500).json(internalError());
  }
});

// ---------------------------------------------------------------------------
// Public Comments (BR-19, AC-17) and Internal Notes (BR-04/BR-19, AC-18).
// Append-only: create + retrieve only. No edit/delete routes exist in Lab 3.
// Author and timestamp always come from the session/backend; client values
// are ignored. Requesters cannot reach /notes at all — requireStaff rejects
// them with 403 and NO note content (not even counts).
// ---------------------------------------------------------------------------

const entrySelect = {
  id: true,
  ticketId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

function entryPagination(query: Request["query"]) {
  const page = Math.max(1, toSafeInt(query.page) ?? 1);
  const limit = Math.min(50, Math.max(1, toSafeInt(query.limit) ?? 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function requireTicket(prisma: ReturnType<typeof getPrisma>, ticketId: number) {
  return prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
}

// GET /api/staff/tickets/:id/comments — public thread (Staff/Admin).
router.get("/tickets/:id/comments", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());
    const prisma = getPrisma();
    if (!(await requireTicket(prisma, ticketId))) return res.status(404).json(notFoundError());

    const { page, limit, skip } = entryPagination(req.query);
    const [entries, total] = await Promise.all([
      prisma.publicComment.findMany({
        where: { ticketId },
        select: entrySelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
      prisma.publicComment.count({ where: { ticketId } }),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        items: entries.map(toEntryItem),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch {
    return res.status(500).json(internalError());
  }
});

// POST /api/staff/tickets/:id/comments — append a public reply.
router.post("/tickets/:id/comments", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());
    const checked = checkEntryBody(req.body?.body);
    if (!checked.ok) {
      return res.status(400).json(validationError("Message content is invalid.", { body: checked.message }));
    }
    const prisma = getPrisma();
    if (!(await requireTicket(prisma, ticketId))) return res.status(404).json(notFoundError());

    const created = await prisma.publicComment.create({
      data: { ticketId, authorId: req.authUser!.id, body: checked.body },
      select: entrySelect,
    });
    return res.status(201).json({ success: true, data: toEntryItem(created) });
  } catch {
    return res.status(500).json(internalError());
  }
});

// GET /api/staff/tickets/:id/notes — internal thread (Staff/Admin ONLY).
router.get("/tickets/:id/notes", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());
    const prisma = getPrisma();
    if (!(await requireTicket(prisma, ticketId))) return res.status(404).json(notFoundError());

    const { page, limit, skip } = entryPagination(req.query);
    const [entries, total] = await Promise.all([
      prisma.internalNote.findMany({
        where: { ticketId },
        select: entrySelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
      prisma.internalNote.count({ where: { ticketId } }),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        items: entries.map(toEntryItem),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch {
    return res.status(500).json(internalError());
  }
});

// POST /api/staff/tickets/:id/notes — append an internal note.
router.post("/tickets/:id/notes", async (req: Request, res: Response) => {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());
    const checked = checkEntryBody(req.body?.body);
    if (!checked.ok) {
      return res.status(400).json(validationError("Message content is invalid.", { body: checked.message }));
    }
    const prisma = getPrisma();
    if (!(await requireTicket(prisma, ticketId))) return res.status(404).json(notFoundError());

    const created = await prisma.internalNote.create({
      data: { ticketId, authorId: req.authUser!.id, body: checked.body },
      select: entrySelect,
    });
    return res.status(201).json({ success: true, data: toEntryItem(created) });
  } catch {
    return res.status(500).json(internalError());
  }
});

export default router;
