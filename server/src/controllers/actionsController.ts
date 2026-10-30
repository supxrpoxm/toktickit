import type { Request, Response } from "express";
import { roleToLabel } from "../auth.js";
import { getPrisma } from "../prisma.js";
import {
  internalError,
  notFoundError,
  toSafeInt,
  validationError,
} from "../workflow.js";

// ---------------------------------------------------------------------------
// Lab 4 (Issue 2) — Actions Taken foundation.
//
// Only IT Staff and Administrators reach this controller because the staff
// router applies requireAuth -> passwordChangeGate -> requireStaff before
// these handlers. Requesters are rejected with 403 and no action payload.
//
// Updates use optimistic concurrency: the client sends the `version` it last
// read, the server updates only when that version still matches, and a stale
// write receives 409 STALE_UPDATE with the current action for safe recovery.
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_RESULT_LENGTH = 5000;
const MAX_NOTE_LENGTH = 2000;

const actionSelect = {
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
} as const;

type ActionWithPerformer = {
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
};

function ticketNumber(ticketId: number): string {
  return `TT-${String(ticketId).padStart(4, "0")}`;
}

function toActionItem(action: ActionWithPerformer) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    ticketNumber: ticketNumber(action.ticketId),
    actionAt: action.actionAt,
    description: action.description,
    result: action.result,
    performedBy: {
      id: action.performedBy.id,
      name: action.performedBy.name,
      role: roleToLabel(action.performedBy.role),
    },
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    version: action.version,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  };
}

function parseActionAt(value: unknown): { ok: true; value: Date } | { ok: false } {
  if (typeof value !== "string" && !(value instanceof Date)) return { ok: false };
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, value: date };
}

function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function checkCreateInput(body: unknown):
  | {
      ok: true;
      data: {
        actionAt?: Date;
        description: string;
        result: string;
        followUpRequired: boolean;
        followUpNote: string | null;
        attachmentNotes: string | null;
      };
    }
  | { ok: false; fields: Record<string, string> } {
  const input = (body ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const description = trimmedString(input.description);
  if (!description) {
    fields.description = "Action description is required.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fields.description = `Action description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`;
  }

  const result = trimmedString(input.result);
  if (!result) {
    fields.result = "Result is required.";
  } else if (result.length > MAX_RESULT_LENGTH) {
    fields.result = `Result must be at most ${MAX_RESULT_LENGTH} characters.`;
  }

  let followUpRequired = false;
  if (input.followUpRequired !== undefined) {
    if (typeof input.followUpRequired !== "boolean") {
      fields.followUpRequired = "Follow-up required must be true or false.";
    } else {
      followUpRequired = input.followUpRequired;
    }
  }

  if (input.followUpNote !== undefined && input.followUpNote !== null && typeof input.followUpNote !== "string") {
    fields.followUpNote = "Follow-up note must be text.";
  }
  const followUpNote = trimmedString(input.followUpNote);
  if (followUpRequired && !followUpNote && !fields.followUpNote) {
    fields.followUpNote = "Follow-up note is required when follow-up is required.";
  } else if (followUpNote.length > MAX_NOTE_LENGTH) {
    fields.followUpNote = `Follow-up note must be at most ${MAX_NOTE_LENGTH} characters.`;
  }

  if (
    input.attachmentNotes !== undefined &&
    input.attachmentNotes !== null &&
    typeof input.attachmentNotes !== "string"
  ) {
    fields.attachmentNotes = "Attachment notes must be text.";
  }
  const attachmentNotes = trimmedString(input.attachmentNotes);
  if (attachmentNotes.length > MAX_NOTE_LENGTH) {
    fields.attachmentNotes = `Attachment notes must be at most ${MAX_NOTE_LENGTH} characters.`;
  }

  let actionAt: Date | undefined;
  if (input.actionAt !== undefined) {
    const parsed = parseActionAt(input.actionAt);
    if (!parsed.ok) {
      fields.actionAt = "Action date/time must be a valid date.";
    } else {
      actionAt = parsed.value;
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return {
    ok: true,
    data: {
      actionAt,
      description,
      result,
      followUpRequired,
      followUpNote: followUpRequired ? followUpNote : null,
      attachmentNotes: attachmentNotes || null,
    },
  };
}

function checkUpdateInput(
  body: unknown,
  existing: ActionWithPerformer,
):
  | {
      ok: true;
      data: {
        actionAt?: Date;
        description?: string;
        result?: string;
        followUpRequired?: boolean;
        followUpNote?: string | null;
        attachmentNotes?: string | null;
      };
    }
  | { ok: false; fields: Record<string, string> } {
  const input = (body ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const data: {
    actionAt?: Date;
    description?: string;
    result?: string;
    followUpRequired?: boolean;
    followUpNote?: string | null;
    attachmentNotes?: string | null;
  } = {};
  let hasChange = false;

  if (input.description !== undefined) {
    hasChange = true;
    const description = trimmedString(input.description);
    if (!description) {
      fields.description = "Action description is required.";
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      fields.description = `Action description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`;
    } else {
      data.description = description;
    }
  }

  if (input.result !== undefined) {
    hasChange = true;
    const result = trimmedString(input.result);
    if (!result) {
      fields.result = "Result is required.";
    } else if (result.length > MAX_RESULT_LENGTH) {
      fields.result = `Result must be at most ${MAX_RESULT_LENGTH} characters.`;
    } else {
      data.result = result;
    }
  }

  let followUpRequired = existing.followUpRequired;
  if (input.followUpRequired !== undefined) {
    hasChange = true;
    if (typeof input.followUpRequired !== "boolean") {
      fields.followUpRequired = "Follow-up required must be true or false.";
    } else {
      followUpRequired = input.followUpRequired;
      data.followUpRequired = followUpRequired;
    }
  }

  let followUpNote = existing.followUpNote;
  if (input.followUpNote !== undefined) {
    hasChange = true;
    if (input.followUpNote !== null && typeof input.followUpNote !== "string") {
      fields.followUpNote = "Follow-up note must be text.";
    } else {
      followUpNote = trimmedString(input.followUpNote) || null;
    }
  }
  if (input.followUpRequired !== undefined || input.followUpNote !== undefined) {
    if (!followUpRequired) {
      data.followUpNote = null;
    } else if (!followUpNote) {
      fields.followUpNote = "Follow-up note is required when follow-up is required.";
    } else if (followUpNote.length > MAX_NOTE_LENGTH) {
      fields.followUpNote = `Follow-up note must be at most ${MAX_NOTE_LENGTH} characters.`;
    } else if (!fields.followUpNote) {
      data.followUpNote = followUpNote;
    }
  }

  if (input.attachmentNotes !== undefined) {
    hasChange = true;
    if (input.attachmentNotes === null) {
      data.attachmentNotes = null;
    } else if (typeof input.attachmentNotes !== "string") {
      fields.attachmentNotes = "Attachment notes must be text.";
    } else {
      const attachmentNotes = input.attachmentNotes.trim();
      if (attachmentNotes.length > MAX_NOTE_LENGTH) {
        fields.attachmentNotes = `Attachment notes must be at most ${MAX_NOTE_LENGTH} characters.`;
      } else {
        data.attachmentNotes = attachmentNotes || null;
      }
    }
  }

  if (input.actionAt !== undefined) {
    hasChange = true;
    const parsed = parseActionAt(input.actionAt);
    if (!parsed.ok) {
      fields.actionAt = "Action date/time must be a valid date.";
    } else {
      data.actionAt = parsed.value;
    }
  }

  if (!hasChange) {
    fields._form = "Provide at least one field to update.";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, data };
}

function staleUpdateError(expectedVersion: number, current: ActionWithPerformer) {
  return {
    success: false as const,
    error: {
      code: "STALE_UPDATE",
      message: "This action was updated by someone else. Review the latest version and try again.",
      conflict: {
        expectedVersion,
        currentVersion: current.version,
        current: toActionItem(current),
      },
    },
  };
}

function actionId(req: Request): number | null {
  const id = toSafeInt(req.params.actionId);
  return id !== null && id > 0 ? id : null;
}

// GET /api/staff/tickets/:id/actions — staff action timeline.
export async function listActions(req: Request, res: Response) {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return res.status(404).json(notFoundError());

    const page = Math.max(1, toSafeInt(req.query.page) ?? 1);
    const limit = Math.min(50, Math.max(1, toSafeInt(req.query.limit) ?? 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.actionTaken.findMany({
        where: { ticketId },
        select: actionSelect,
        orderBy: [{ actionAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      prisma.actionTaken.count({ where: { ticketId } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: items.map(toActionItem),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch {
    return res.status(500).json(internalError());
  }
}

// POST /api/staff/tickets/:id/actions — record an action.
export async function createAction(req: Request, res: Response) {
  try {
    const ticketId = toSafeInt(req.params.id);
    if (ticketId === null || ticketId <= 0) return res.status(404).json(notFoundError());

    const checked = checkCreateInput(req.body);
    if (!checked.ok) {
      return res.status(400).json(validationError("Action details are invalid.", checked.fields));
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return res.status(404).json(notFoundError());

    const created = await prisma.actionTaken.create({
      data: {
        ticketId,
        actionAt: checked.data.actionAt ?? new Date(),
        description: checked.data.description,
        result: checked.data.result,
        performedById: req.authUser!.id,
        followUpRequired: checked.data.followUpRequired,
        followUpNote: checked.data.followUpNote,
        attachmentNotes: checked.data.attachmentNotes,
      },
      select: actionSelect,
    });

    return res.status(201).json({ success: true, data: toActionItem(created) });
  } catch {
    return res.status(500).json(internalError());
  }
}

// PATCH /api/staff/tickets/:id/actions/:actionId — update an action.
export async function updateAction(req: Request, res: Response) {
  try {
    const ticketId = toSafeInt(req.params.id);
    const id = actionId(req);
    if (ticketId === null || ticketId <= 0 || id === null) {
      return res.status(404).json(notFoundError());
    }

    const expectedVersion = toSafeInt((req.body ?? {}).version);
    if (expectedVersion === null || expectedVersion < 1) {
      return res.status(400).json(
        validationError("A valid version is required.", {
          version: "Provide the version you last read.",
        }),
      );
    }

    const prisma = getPrisma();
    const existing = await prisma.actionTaken.findFirst({
      where: { id, ticketId },
      select: actionSelect,
    });
    if (!existing) return res.status(404).json(notFoundError());

    if (existing.version !== expectedVersion) {
      return res.status(409).json(staleUpdateError(expectedVersion, existing));
    }

    const checked = checkUpdateInput(req.body, existing);
    if (!checked.ok) {
      return res.status(400).json(validationError("Action details are invalid.", checked.fields));
    }

    const result = await prisma.actionTaken.updateMany({
      where: { id, ticketId, version: expectedVersion },
      data: {
        ...checked.data,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const current = await prisma.actionTaken.findFirst({
        where: { id, ticketId },
        select: actionSelect,
      });
      if (!current) return res.status(404).json(notFoundError());
      return res.status(409).json(staleUpdateError(expectedVersion, current));
    }

    const updated = await prisma.actionTaken.findFirst({
      where: { id, ticketId },
      select: actionSelect,
    });
    if (!updated) return res.status(404).json(notFoundError());

    return res.status(200).json({ success: true, data: toActionItem(updated) });
  } catch {
    return res.status(500).json(internalError());
  }
}
