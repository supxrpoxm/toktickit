import { Router, type Request, type Response } from "express";
import { passwordChangeGate, requireAuth, requireStaff } from "../middleware/auth.js";
import { getPrisma } from "../prisma.js";

// ---------------------------------------------------------------------------
// Lab 3 (Issue 3) — IT Staff Ticket Queue.
//
// Guards (in order): requireAuth (401) -> passwordChangeGate (403
// PASSWORD_CHANGE_REQUIRED) -> requireStaff (403 FORBIDDEN, no payload).
// Only IT Staff and Administrator sessions reach the handlers.
// ---------------------------------------------------------------------------

const router = Router();
router.use(requireAuth, passwordChangeGate, requireStaff);

const STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
] as const;

const PRIORITIES = ["Low", "Medium", "High"] as const;

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

function toSafeInt(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
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
// screen (read-only in Issue 3; claim/priority/status controls arrive in the
// next issue). 404 only when the id truly does not exist.
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
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
      });
    }

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

export default router;
