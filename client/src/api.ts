import { UserRole } from "./roles";

export {
  USER_ROLE_DISPLAY,
  USER_ROLE_VALUES,
  UserRole,
  formatRoleDisplay,
  isAdministratorRole,
  isStaffRole,
  normalizeUserRole,
} from "./roles";

// Use an explicit backend URL to avoid connection issues from the dev client
const API_URL = "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`Health check failed: ${healthRes.status}`);
  }

  // optionally try to fetch categories; if it fails, return online with empty categories
  let categories: Category[] = [];
  try {
    const catRes = await fetch(`${API_URL}/api/categories`);
    if (catRes.ok) {
      categories = await catRes.json();
    }
  } catch {
    // ignore category errors for the simple health check
  }

  return { online: true, categories };
}

export async function fetchActiveRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) {
    throw new Error(`Failed to load active requesters: ${res.status}`);
  }

  return (await res.json()) as Requester[];
}

// ---------------------------------------------------------------------------
// Lab 3 (Issue 2) — session authentication client.
// The session lives in an httpOnly cookie set by the API; every request below
// uses credentials: "include" so the cookie is sent (same-origin through the
// Vite /api proxy). No password, hash, or token is ever kept in JS storage.
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole | string;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
}

export class AuthError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;
  conflict?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    conflict?: unknown,
  ) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.conflict = conflict;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseFieldErrors(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const fields: Record<string, string> = {};
  for (const [key, message] of Object.entries(record)) {
    if (typeof message === "string" && message.trim()) fields[key] = message;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

type ParsedApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
  conflict?: unknown;
};

// Parse the standard backend envelope safely. The fallbacks also tolerate
// legacy/unexpected shapes such as `{ message }` or `{ fieldErrors }` without
// throwing, so the UI can always show a safe message.
function parseApiError(body: unknown, status: number): ParsedApiError {
  const root = asRecord(body);
  const nested = asRecord(root?.error);

  const code =
    (typeof nested?.code === "string" && nested.code) ||
    (typeof root?.code === "string" && root.code) ||
    (status === 401 ? "UNAUTHENTICATED" : "INTERNAL_ERROR");

  const message =
    (typeof nested?.message === "string" && nested.message) ||
    (typeof root?.message === "string" && root.message) ||
    "Something went wrong. Please try again.";

  const fields =
    parseFieldErrors(nested?.fields) ??
    parseFieldErrors(nested?.fieldErrors) ??
    parseFieldErrors(root?.fieldErrors) ??
    parseFieldErrors(root?.fields);

  return {
    code,
    message,
    fields,
    conflict: nested?.conflict ?? root?.conflict,
  };
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "include", ...init });
  } catch {
    throw new AuthError(0, "NETWORK_ERROR", "Unable to reach the server. Please try again.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AuthError(response.status, "NETWORK_ERROR", "Unable to reach the server. Please try again.");
  }

  const envelope = asRecord(body);
  if (!response.ok || !envelope || envelope.success !== true) {
    const error = parseApiError(body, response.status);
    throw new AuthError(response.status, error.code, error.message, error.fields, error.conflict);
  }

  return envelope.data as T;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await authRequest<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await authRequest<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authRequest<{ user: AuthUser }>("/api/auth/me");
  return data.user;
}

export async function changePassword(newPassword: string, confirmPassword: string): Promise<void> {
  await authRequest<{ user: { id: number } }>("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword, confirmPassword }),
  });
}

// ---------------------------------------------------------------------------
// Lab 3 (Issue 3) — IT Staff Ticket Queue client.
// ---------------------------------------------------------------------------

export interface QueueOwner {
  id: number;
  name: string;
}

export interface QueueItem {
  id: number;
  ticketNumber: string;
  title: string;
  category: string | null;
  requestedPriority: string;
  itPriority: string | null;
  status: string;
  owner: QueueOwner | null;
  requester: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface QueuePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QueueParams {
  search?: string;
  status?: string;
  priority?: string;
  itPriority?: string;
  requestedPriority?: string;
  owner?: string;
  categoryId?: string;
  department?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function fetchStaffQueue(params: QueueParams): Promise<{ items: QueueItem[]; pagination: QueuePagination }> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.itPriority) query.set("itPriority", params.itPriority);
  if (params.requestedPriority) query.set("requestedPriority", params.requestedPriority);
  if (params.owner) query.set("owner", params.owner);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.department?.trim()) query.set("department", params.department.trim());
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));

  return authRequest<{ items: QueueItem[]; pagination: QueuePagination }>(`/api/staff/tickets?${query.toString()}`);
}

export interface StaffTicketAttachment {
  id: number;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

export interface StaffTicketDetail {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  requestedPriority: string;
  itPriority: string | null;
  owner: QueueOwner | null;
  requester: { id: number; name: string };
  category: { id: number; name: string } | null;
  relatedSystem: { id: number; name: string } | null;
  attachments: StaffTicketAttachment[];
  requesterResolved: boolean;
  requesterResolvedAt: string | null;
  commentsCount: number;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchStaffTicket(id: number): Promise<StaffTicketDetail> {
  const data = await authRequest<StaffTicketDetail>(`/api/staff/tickets/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Lab 3 (Issue 4) — IT Staff ticket operations: ownership, IT Priority,
// status workflow, Public Comments, Internal Notes.
// ---------------------------------------------------------------------------

export interface StaffUser {
  id: number;
  name: string;
  role: string;
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  const data = await authRequest<{ items: StaffUser[] }>("/api/staff/users");
  return data.items;
}

export type OwnerUpdateBody = { claim: true } | { ownerId: number | null };

export async function updateTicketOwner(id: number, body: OwnerUpdateBody): Promise<{ id: number; owner: QueueOwner | null }> {
  return authRequest<{ id: number; owner: QueueOwner | null }>(`/api/staff/tickets/${id}/owner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateItPriority(id: number, itPriority: string): Promise<{ id: number; requestedPriority: string; itPriority: string }> {
  return authRequest(`/api/staff/tickets/${id}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itPriority }),
  });
}

export async function updateTicketStatus(
  id: number,
  status: string,
  updatedAt?: string,
): Promise<{ id: number; status: string; updatedAt: string }> {
  return authRequest(`/api/staff/tickets/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedAt ? { status, updatedAt } : { status }),
  });
}

export interface TicketEntry {
  id: number;
  ticketId: number;
  author: { id: number; name: string; role: string };
  body: string;
  createdAt: string;
}

export interface EntryList {
  items: TicketEntry[];
  pagination: QueuePagination;
}

export async function fetchStaffComments(id: number): Promise<EntryList> {
  return authRequest<EntryList>(`/api/staff/tickets/${id}/comments?limit=50`);
}

export async function postStaffComment(id: number, body: string): Promise<TicketEntry> {
  return authRequest<TicketEntry>(`/api/staff/tickets/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function fetchStaffNotes(id: number): Promise<EntryList> {
  return authRequest<EntryList>(`/api/staff/tickets/${id}/notes?limit=50`);
}

export async function postStaffNote(id: number, body: string): Promise<TicketEntry> {
  return authRequest<TicketEntry>(`/api/staff/tickets/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

// ---------------------------------------------------------------------------
// Lab 3 (Issue 4) — Requester discussion: public thread + resolved signal.
// Internal Notes are never fetched or rendered for Requesters.
// ---------------------------------------------------------------------------

export async function fetchTicketComments(id: number): Promise<EntryList> {
  return authRequest<EntryList>(`/api/tickets/${id}/comments?limit=50`);
}

export async function postTicketComment(id: number, body: string): Promise<TicketEntry> {
  return authRequest<TicketEntry>(`/api/tickets/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function signalProblemResolved(
  id: number,
  note?: string,
): Promise<{ id: number; requesterResolved: boolean; requesterResolvedAt: string | null }> {
  return authRequest(`/api/tickets/${id}/resolved-signal`, {
    method: "POST",
    headers: note !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: note !== undefined ? JSON.stringify({ note }) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Lab 4 (Issue 3) — Actions Taken timeline.
// Requesters read their own ticket's timeline through /api/tickets/:id/actions;
// IT Staff / Administrators use the staff endpoint for read + write.
// ---------------------------------------------------------------------------

export interface ActionTakenItem {
  id: number;
  ticketId: number;
  ticketNumber: string;
  actionAt: string;
  description: string;
  result: string;
  performedBy: { id: number; name: string; role: string };
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionTakenList {
  items: ActionTakenItem[];
  pagination: QueuePagination;
}

export interface ActionTakenInput {
  actionAt: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

export type ActionTakenUpdateInput = Partial<ActionTakenInput> & { version: number };

export async function fetchActionsTaken(
  ticketId: number,
  scope: "staff" | "requester",
): Promise<ActionTakenList> {
  const base =
    scope === "staff"
      ? `/api/staff/tickets/${ticketId}/actions`
      : `/api/tickets/${ticketId}/actions`;
  return authRequest<ActionTakenList>(`${base}?limit=50&sort=newest`);
}

export async function createActionTaken(
  ticketId: number,
  body: ActionTakenInput,
): Promise<ActionTakenItem> {
  return authRequest<ActionTakenItem>(`/api/staff/tickets/${ticketId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateActionTaken(
  ticketId: number,
  actionId: number,
  body: ActionTakenUpdateInput,
): Promise<ActionTakenItem> {
  return authRequest<ActionTakenItem>(`/api/staff/tickets/${ticketId}/actions/${actionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Lab 4 (Issue 5) — role-scoped dashboards. Both endpoints are pull/refetch
// read models; `generatedAt` lets the header show data freshness.
// ---------------------------------------------------------------------------

export type DashboardWindow = "7d" | "30d" | "all";

export interface DashboardTicketItem {
  id: number;
  ticketNumber: string;
  title: string;
  status: string;
  requestedPriority: string;
  itPriority: string | null;
  owner: QueueOwner | null;
  requester?: { id: number; name: string };
  requesterResolved?: boolean;
  category: string | null;
  relatedSystem?: string | null;
  incompleteActionCount?: number;
  overdueActionCount?: number;
  attentionReasons?: string[];
  updatedAt: string;
}

export interface DashboardActionItem {
  id: number;
  ticketId: number;
  ticketNumber: string;
  ticketTitle: string;
  summary: string;
  details: string;
  status: string;
  performedBy: { id: number; name: string; role: string };
  dueAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  description?: string;
  result?: string;
  followUpRequired?: boolean;
}

export interface StaffDashboardSummary {
  myOpenTickets: number;
  unassignedTickets: number;
  inProgressTickets: number;
  waitingForRequester: number;
  requesterResolvedTickets: number;
  incompleteActions: number;
  overdueActions: number;
}

export interface StaffDashboardData {
  summary: StaffDashboardSummary;
  myWork: DashboardTicketItem[];
  unassigned: DashboardTicketItem[];
  attention: DashboardTicketItem[];
  recentActions: DashboardActionItem[];
  generatedAt: string;
}

export interface RequesterDashboardSummary {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  waitingForRequester: number;
  resolvedTickets: number;
  closedTickets: number;
  cancelledTickets: number;
}

export interface RequesterDashboardData {
  summary: RequesterDashboardSummary;
  recentTickets: DashboardTicketItem[];
  latestActions: DashboardActionItem[];
  needsAttention: DashboardTicketItem[];
  generatedAt: string;
}

export async function fetchStaffDashboard(
  params: { window?: DashboardWindow; limit?: number } = {},
): Promise<StaffDashboardData> {
  const query = new URLSearchParams();
  if (params.window) query.set("window", params.window);
  query.set("limit", String(params.limit ?? 5));
  return authRequest<StaffDashboardData>(`/api/staff/dashboard?${query.toString()}`);
}

export async function fetchRequesterDashboard(
  params: { limit?: number } = {},
): Promise<RequesterDashboardData> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 5));
  return authRequest<RequesterDashboardData>(`/api/requester/dashboard?${query.toString()}`);
}

export async function fetchCategories(): Promise<Category[]> {
  let response: Response;
  try {
    response = await fetch("/api/categories", { credentials: "include" });
  } catch {
    throw new AuthError(0, "NETWORK_ERROR", "Unable to reach the server. Please try again.");
  }
  if (!response.ok) {
    throw new AuthError(response.status, response.status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR", "Unable to load categories.");
  }
  return (await response.json()) as Category[];
}

// ---------------------------------------------------------------------------
// Lab 3 (Issue 5) — minimalist Administrator User Management client.
// Canonical paths are /api/admin/users; /api/users aliases serve the same
// contract. No password, hash, or token is ever kept in JS storage.
// ---------------------------------------------------------------------------

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole | string;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
}

export interface CreateUserBody {
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  initialPassword: string;
}

export interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export interface UserListParams {
  search?: string;
  role?: string;
}

export async function fetchManagedUsers(params: UserListParams = {}): Promise<ManagedUser[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.role) query.set("role", params.role);
  const suffix = query.toString();
  const data = await authRequest<{ items: ManagedUser[] }>(
    `/api/admin/users${suffix ? `?${suffix}` : ""}`,
  );
  return data.items;
}

export async function createManagedUser(body: CreateUserBody): Promise<ManagedUser> {
  const data = await authRequest<{ user: ManagedUser }>("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.user;
}

export async function updateManagedUser(id: number, body: UpdateUserBody): Promise<ManagedUser> {
  const data = await authRequest<{ user: ManagedUser }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.user;
}

export async function resetManagedUserPassword(id: number, initialPassword: string): Promise<void> {
  await authRequest(`/api/admin/users/${id}/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initialPassword }),
  });
}
