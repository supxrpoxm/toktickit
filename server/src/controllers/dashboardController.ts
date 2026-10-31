import type { Request, Response } from "express";
import { roleToLabel } from "../auth.js";
import { getPrisma } from "../prisma.js";
import { internalError, toSafeInt } from "../workflow.js";

// ---------------------------------------------------------------------------
// Lab 4 (Issue 5) — role-scoped dashboard read models.
//
// Both endpoints are pull/refetch views: they aggregate the current database
// state on every request and return `generatedAt` so clients can show
// freshness. Lists are bounded, deterministically ordered (secondary id sort),
// and invalid query values fall back to documented defaults instead of 500.
//
// The existing ActionTaken model records outstanding work with
// `followUpRequired`; incomplete actions are therefore the rows that still
// require follow-up, and a follow-up older than one business day is overdue.
// This keeps the dashboard useful without introducing a second action model.
// ---------------------------------------------------------------------------

export const ACTIVE_TICKET_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Reopened",
] as const;

const OPEN_TICKET_STATUSES = ["New", "Open", "Reopened"] as const;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const OVERDUE_AFTER_MS = 24 * 60 * 60 * 1000;

function dashboardLimit(value: unknown): number {
  const parsed = toSafeInt(value);
  if (parsed === null) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

// `window` affects recentActions only. Invalid values fall back to 7d.
function recentActionsSince(value: unknown): Date | null {
  const window =
    value === "all" || value === "30d" || value === "7d" ? value : "7d";
  if (window === "all") return null;
  const days = window === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function ticketNumber(id: number): string {
  return `TT-${String(id).padStart(4, "0")}`;
}

const dashboardTicketSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  itPriority: true,
  requesterResolved: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  actionsTaken: {
    where: { followUpRequired: true },
    select: { id: true, actionAt: true, followUpRequired: true },
    orderBy: { actionAt: "asc" as const },
    take: 50,
  },
} as const;

type DashboardTicket = {
  id: number;
  title: string;
  status: string;
  priority: string;
  itPriority: string | null;
  requesterResolved?: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: number; name: string } | null;
  requester: { id: number; name: string };
  category?: { id: number; name: string } | null;
  relatedSystem?: { id: number; name: string } | null;
  actionsTaken?: { id: number; actionAt: Date; followUpRequired: boolean }[];
};

function incompleteActions(ticket: DashboardTicket) {
  return ticket.actionsTaken ?? [];
}

function overdueActionCount(ticket: DashboardTicket, cutoff: Date) {
  return incompleteActions(ticket).filter(
    (action) => new Date(action.actionAt).getTime() < cutoff.getTime(),
  ).length;
}

function toStaffTicketItem(
  ticket: DashboardTicket,
  cutoff: Date,
  attentionReasons?: string[],
) {
  const actions = incompleteActions(ticket);
  return {
    id: ticket.id,
    ticketNumber: ticketNumber(ticket.id),
    title: ticket.title,
    status: ticket.status,
    requestedPriority: ticket.priority,
    itPriority: ticket.itPriority,
    owner: ticket.owner ?? null,
    requester: ticket.requester,
    requesterResolved: ticket.requesterResolved ?? false,
    category: ticket.category?.name ?? null,
    relatedSystem: ticket.relatedSystem?.name ?? null,
    incompleteActionCount: actions.length,
    overdueActionCount: overdueActionCount(ticket, cutoff),
    ...(attentionReasons ? { attentionReasons } : {}),
    updatedAt: ticket.updatedAt,
  };
}

const dashboardActionSelect = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  performedBy: { select: { id: true, name: true, role: true } },
  ticket: { select: { id: true, title: true } },
} as const;

type DashboardAction = {
  id: number;
  ticketId: number;
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  performedBy: { id: number; name: string; role: string };
  ticket: { id: number; title: string };
};

function toDashboardAction(action: DashboardAction) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    ticketNumber: ticketNumber(action.ticketId),
    ticketTitle: action.ticket.title,
    // Contract aliases derived from the existing ActionTaken fields.
    summary: action.description,
    details: action.result,
    status: action.followUpRequired ? "Open" : "Completed",
    performedBy: {
      id: action.performedBy.id,
      name: action.performedBy.name,
      role: roleToLabel(action.performedBy.role),
    },
    dueAt: null,
    completedAt: action.followUpRequired ? null : action.updatedAt,
    updatedAt: action.updatedAt,
    // Legacy fields kept so existing Actions Taken screens can reuse items.
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    version: action.version,
  };
}

function toRequesterTicketItem(ticket: DashboardTicket) {
  return {
    id: ticket.id,
    ticketNumber: ticketNumber(ticket.id),
    title: ticket.title,
    status: ticket.status,
    requestedPriority: ticket.priority,
    itPriority: ticket.itPriority,
    owner: ticket.owner ?? null,
    category: ticket.category?.name ?? null,
    relatedSystem: ticket.relatedSystem?.name ?? null,
    updatedAt: ticket.updatedAt,
  };
}

// GET /api/staff/dashboard — shared operational dashboard for IT Staff and
// Administrators. Router-level guards enforce authentication, the password
// gate, and the staff role before this handler runs.
export async function getStaffDashboard(req: Request, res: Response) {
  try {
    const limit = dashboardLimit(req.query.limit);
    const since = recentActionsSince(req.query.window);
    const now = new Date();
    const overdueCutoff = new Date(now.getTime() - OVERDUE_AFTER_MS);
    const sessionUserId = req.authUser!.id;

    const active = { status: { in: [...ACTIVE_TICKET_STATUSES] } };
    const incompleteWhere = {
      followUpRequired: true,
      ticket: { status: { in: [...ACTIVE_TICKET_STATUSES] } },
    };

    const prisma = getPrisma();

    const [
      myOpenTickets,
      unassignedTickets,
      inProgressTickets,
      waitingForRequester,
      requesterResolvedTickets,
      incompleteActions,
      overdueActions,
      myWork,
      unassigned,
      attention,
      recentActions,
    ] = await Promise.all([
      prisma.ticket.count({ where: { ...active, ownerId: sessionUserId } }),
      prisma.ticket.count({ where: { ...active, ownerId: null } }),
      prisma.ticket.count({ where: { ...active, status: "In Progress" } }),
      prisma.ticket.count({ where: { ...active, status: "Waiting for Requester" } }),
      prisma.ticket.count({ where: { ...active, requesterResolved: true } }),
      prisma.actionTaken.count({ where: incompleteWhere }),
      prisma.actionTaken.count({
        where: { ...incompleteWhere, actionAt: { lt: overdueCutoff } },
      }),
      prisma.ticket.findMany({
        where: { ...active, ownerId: sessionUserId },
        orderBy: [{ itPriority: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
        take: limit,
        select: dashboardTicketSelect,
      }),
      prisma.ticket.findMany({
        where: { ...active, ownerId: null },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit,
        select: dashboardTicketSelect,
      }),
      prisma.ticket.findMany({
        where: {
          AND: [
            active,
            {
              OR: [
                { requesterResolved: true },
                { status: "Waiting for Requester" },
                {
                  actionsTaken: {
                    some: { followUpRequired: true, actionAt: { lt: overdueCutoff } },
                  },
                },
              ],
            },
          ],
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: 50,
        select: dashboardTicketSelect,
      }),
      prisma.actionTaken.findMany({
        where: since ? { updatedAt: { gte: since } } : {},
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit,
        select: dashboardActionSelect,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          myOpenTickets,
          unassignedTickets,
          inProgressTickets,
          waitingForRequester,
          requesterResolvedTickets,
          incompleteActions,
          overdueActions,
        },
        myWork: (myWork as DashboardTicket[]).map((ticket) =>
          toStaffTicketItem(ticket, overdueCutoff),
        ),
        unassigned: (unassigned as DashboardTicket[]).map((ticket) =>
          toStaffTicketItem(ticket, overdueCutoff),
        ),
        attention: (attention as DashboardTicket[])
          .map((ticket) => {
            const reasons: string[] = [];
            if (ticket.requesterResolved) reasons.push("Requester says resolved");
            if (overdueActionCount(ticket, overdueCutoff) > 0) reasons.push("Overdue action");
            if (ticket.status === "Waiting for Requester") reasons.push("Waiting for requester");
            const rank = ticket.requesterResolved
              ? 0
              : overdueActionCount(ticket, overdueCutoff) > 0
                ? 1
                : 2;
            return { ticket, reasons, rank };
          })
          .sort(
            (a, b) =>
              a.rank - b.rank ||
              a.ticket.updatedAt.getTime() - b.ticket.updatedAt.getTime() ||
              a.ticket.id - b.ticket.id,
          )
          .slice(0, limit)
          .map(({ ticket, reasons }) =>
            toStaffTicketItem(ticket, overdueCutoff, reasons),
          ),
        recentActions: (recentActions as DashboardAction[]).map(toDashboardAction),
        generatedAt: now.toISOString(),
      },
    });
  } catch {
    return res.status(500).json(internalError());
  }
}

// GET /api/requester/dashboard — strictly self-scoped Requester dashboard.
export async function getRequesterDashboard(req: Request, res: Response) {
  try {
    const limit = dashboardLimit(req.query.limit);
    const requesterId = req.authUser!.id;
    const own = { requesterId };
    const prisma = getPrisma();

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      waitingForRequester,
      resolvedTickets,
      closedTickets,
      cancelledTickets,
      recentTickets,
      latestActions,
      needsAttention,
    ] = await Promise.all([
      prisma.ticket.count({ where: own }),
      prisma.ticket.count({
        where: { ...own, status: { in: [...OPEN_TICKET_STATUSES] } },
      }),
      prisma.ticket.count({ where: { ...own, status: "In Progress" } }),
      prisma.ticket.count({ where: { ...own, status: "Waiting for Requester" } }),
      prisma.ticket.count({ where: { ...own, status: "Resolved" } }),
      prisma.ticket.count({ where: { ...own, status: "Closed" } }),
      prisma.ticket.count({ where: { ...own, status: "Cancelled" } }),
      prisma.ticket.findMany({
        where: own,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit,
        select: dashboardTicketSelect,
      }),
      prisma.actionTaken.findMany({
        where: { ticket: { requesterId } },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit,
        select: dashboardActionSelect,
      }),
      prisma.ticket.findMany({
        where: { ...own, status: "Waiting for Requester" },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: limit,
        select: dashboardTicketSelect,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTickets,
          openTickets,
          inProgressTickets,
          waitingForRequester,
          resolvedTickets,
          closedTickets,
          cancelledTickets,
        },
        recentTickets: (recentTickets as DashboardTicket[]).map(toRequesterTicketItem),
        latestActions: (latestActions as DashboardAction[]).map(toDashboardAction),
        needsAttention: (needsAttention as DashboardTicket[]).map(toRequesterTicketItem),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return res.status(500).json(internalError());
  }
}
