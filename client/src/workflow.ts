// ---------------------------------------------------------------------------
// Lab 4 (Issue 4) — Ticket workflow rules shared by the UI.
//
// This mirrors the backend transition matrix. The backend remains the
// authority; the client only uses these rules to show the transitions a user
// is allowed to request.
// ---------------------------------------------------------------------------

export const TICKET_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

const TRANSITIONS: Record<string, readonly string[]> = {
  New: ["Open", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened"],
  Closed: [],
  Cancelled: [],
  Reopened: ["In Progress", "Resolved", "Cancelled"],
};

export function allowedTransitions(from: string): string[] {
  return [...(TRANSITIONS[from] ?? [])];
}

export function isTerminalStatus(status: string): boolean {
  return allowedTransitions(status).length === 0;
}

export function requiresConfirmation(status: string): boolean {
  return status === "Cancelled" || status === "Closed" || status === "Reopened";
}
