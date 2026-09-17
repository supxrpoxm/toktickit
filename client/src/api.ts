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

export type UserRole = "Requester" | "IT Staff" | "Administrator";

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

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type AuthEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fields?: Record<string, string> } };

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "include", ...init });
  } catch {
    throw new AuthError(0, "NETWORK_ERROR", "Unable to reach the server. Please try again.");
  }

  let body: AuthEnvelope<T>;
  try {
    body = (await response.json()) as AuthEnvelope<T>;
  } catch {
    throw new AuthError(response.status, "NETWORK_ERROR", "Unable to reach the server. Please try again.");
  }

  if (!response.ok || !body.success) {
    const fallback: { code: string; message: string; fields?: Record<string, string> } = {
      code: response.status === 401 ? "UNAUTHENTICATED" : "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    };
    const error =
      !body.success && typeof body.error === "object" && body.error !== null
        ? (body.error as { code: string; message: string; fields?: Record<string, string> })
        : fallback;
    throw new AuthError(response.status, error.code, error.message, error.fields);
  }

  return (body as { success: true; data: T }).data;
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
  itPriority?: string;
  requestedPriority?: string;
  owner?: string;
  categoryId?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function fetchStaffQueue(params: QueueParams): Promise<{ items: QueueItem[]; pagination: QueuePagination }> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.itPriority) query.set("itPriority", params.itPriority);
  if (params.requestedPriority) query.set("requestedPriority", params.requestedPriority);
  if (params.owner) query.set("owner", params.owner);
  if (params.categoryId) query.set("categoryId", params.categoryId);
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

export async function updateTicketStatus(id: number, status: string): Promise<{ id: number; status: string; updatedAt: string }> {
  return authRequest(`/api/staff/tickets/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
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

export async function signalProblemResolved(id: number): Promise<{ id: number; requesterResolved: boolean; requesterResolvedAt: string | null }> {
  return authRequest(`/api/tickets/${id}/resolved-signal`, { method: "POST" });
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
