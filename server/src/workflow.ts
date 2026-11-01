import { roleToLabel } from "./auth.js";

// ---------------------------------------------------------------------------
// Lab 3 (Issue 4) — IT Staff ticket workflow shared rules.
//
// - Status-transition matrix (specification BR-17). Only the listed
//   transitions are permitted, and only by IT Staff / Administrator (enforced
//   by the staff router's requireStaff gate). Requesters have no status-write
//   permission in Lab 3.
// - Comment/note body validation (BR-19): append-only create + retrieve,
//   1-2000 chars after trim, backend author/timestamp.
// ---------------------------------------------------------------------------

export const WORKFLOW_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_PRIORITIES = ["Low", "Medium", "High"] as const;

// Permitted transitions per BR-17. Note: the spec table lists no outgoing
// transition for `Reopened`. A reopened ticket is active work again, so it
// re-enters triage the same way a `New` ticket does (Open / In Progress /
// Cancelled). This decision is recorded here and covered by tests; every
// other unlisted pair (including Any -> New) is forbidden.
const TRANSITIONS: Record<string, readonly string[]> = {
  New: ["Open", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Cancelled: ["Reopened"],
  Reopened: ["Open", "In Progress", "Cancelled"],
};

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === "string" && (WORKFLOW_STATUSES as readonly string[]).includes(value);
}

export function allowedTransitions(from: string): string[] {
  return [...(TRANSITIONS[from] ?? [])];
}

export function isValidTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

// Statuses whose UI must ask for explicit confirmation before saving
// (destructive per BR-17). The API accepts them without a confirm flag —
// confirmation is a client concern — but the set is shared so both agree.
export const CONFIRM_STATUSES: readonly string[] = ["Cancelled", "Closed", "Reopened"];

export const COMMENT_MAX_LENGTH = 2000;

export type BodyCheck = { ok: true; body: string } | { ok: false; message: string };

// Append-only entry validation (BR-19): empty/whitespace-only rejected,
// length capped at 2000 chars. Returns the trimmed body on success.
export function checkEntryBody(value: unknown): BodyCheck {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, message: "Message content is required." };
  }
  const body = value.trim();
  if (body.length > COMMENT_MAX_LENGTH) {
    return { ok: false, message: `Message must be at most ${COMMENT_MAX_LENGTH} characters.` };
  }
  return { ok: true, body };
}

export function toSafeInt(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

// Safe envelope helpers (docs/lab-03/api-spec.md §1).
export function validationError(message: string, fields?: Record<string, string>) {
  return {
    success: false as const,
    error: { code: "VALIDATION_ERROR", message, fields },
  };
}

export function forbiddenError() {
  return {
    success: false as const,
    error: { code: "FORBIDDEN", message: "You don't have access to this area." },
  };
}

export function notFoundError() {
  return {
    success: false as const,
    error: { code: "NOT_FOUND", message: "We couldn't find that ticket." },
  };
}

export function internalError() {
  return {
    success: false as const,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  };
}

// A user qualifies as a ticket owner only when active with role IT Staff or
// Administrator (BR-15). Requesters, inactive, and unknown users are rejected.
export function isQualifiedOwner(user: { role: string; isActive: boolean } | null): boolean {
  if (!user || !user.isActive) return false;
  return user.role === "IT_STAFF" || user.role === "ADMINISTRATOR";
}

export function toEntryAuthor(author: { id: number; name: string; role: string }) {
  return { id: author.id, name: author.name, role: roleToLabel(author.role) };
}

export function toEntryItem(entry: {
  id: number;
  ticketId: number;
  body: string;
  createdAt: Date;
  author: { id: number; name: string; role: string };
}) {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    author: toEntryAuthor(entry.author),
    body: entry.body,
    createdAt: entry.createdAt,
  };
}
