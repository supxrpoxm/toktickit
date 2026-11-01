import React, { useEffect, useState } from "react";
import {
  AuthError,
  fetchStaffComments,
  fetchStaffNotes,
  fetchStaffTicket,
  fetchStaffUsers,
  postStaffComment,
  postStaffNote,
  updateItPriority,
  updateTicketOwner,
  updateTicketStatus,
  type StaffTicketDetail as StaffTicket,
  type StaffUser,
  type TicketEntry,
} from "./api";

// ---------------------------------------------------------------------------
// Lab 3 (Issue 4) — IT Staff Ticket Detail workflow.
//
// Grouped read-only ticket context + editable operational controls (owner,
// IT Priority, status with confirmations) + visually distinct Public
// Comments vs. Internal Notes threads. Zen Green tokens (#006B3C primary,
// #0B7A46 secondary, #EAF6EF pale, #F5F7F6 page) match the Lab 2 system.
// ---------------------------------------------------------------------------

type DetailState = "loading" | "ready" | "not-found" | "forbidden" | "failed";
type ThreadState = "loading" | "ready" | "failed";

const TICKET_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
];

const PRIORITIES = ["Low", "Medium", "High"];

// Destructive targets require an explicit confirmation modal (BR-17).
const CONFIRM_STATUSES = ["Cancelled", "Closed", "Reopened"];

const CONFIRM_COPY: Record<string, string> = {
  Cancelled: "Cancelling closes this ticket without a resolution. The requester will see the Cancelled status.",
  Closed: "Closing marks this ticket as resolved and complete. The requester will see the Closed status.",
  Reopened: "Reopening returns this ticket to active work for the requester and IT staff.",
};

const statusBadgeClass: Record<string, string> = {
  New: "bg-secondary-subtle text-secondary-emphasis border",
  Open: "bg-success-subtle text-success-emphasis",
  "In Progress": "bg-warning-subtle text-warning-emphasis",
  "Waiting for Requester": "bg-warning-subtle text-warning-emphasis border",
  Resolved: "bg-info-subtle text-info-emphasis",
  Closed: "bg-secondary-subtle text-secondary-emphasis",
  Reopened: "bg-primary-subtle text-primary-emphasis",
  Cancelled: "bg-danger-subtle text-danger-emphasis",
};

const priorityBadgeClass: Record<string, string> = {
  High: "bg-danger-subtle text-danger-emphasis",
  Medium: "bg-warning-subtle text-warning-emphasis",
  Low: "bg-success-subtle text-success-emphasis",
};

function roleBadgeStyle(role: string): React.CSSProperties {
  if (role === "Administrator") return { backgroundColor: "#006B3C", color: "#fff" };
  if (role === "IT Staff") return { backgroundColor: "#0B7A46", color: "#fff" };
  return { backgroundColor: "#EAF6EF", color: "#006B3C", border: "1px solid #006B3C" };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatFileSize(sizeBytes?: number | null) {
  if (!sizeBytes) return "Size unavailable";
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fieldMessage(error: AuthError): string {
  if (error.fields) {
    const first = Object.values(error.fields)[0];
    if (first) return error.message.includes(first) ? error.message : `${error.message} ${first}`;
  }
  return error.message;
}

type StaffTicketDetailProps = {
  ticketId: number;
  onBack: () => void;
};

export default function StaffTicketDetail({ ticketId, onBack }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [retryKey, setRetryKey] = useState(0);

  // Operational controls.
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [usersFailed, setUsersFailed] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState("");
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [priorityDraft, setPriorityDraft] = useState("");
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityError, setPriorityError] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // Discussion threads (newest-last; API returns createdAt ascending).
  const [comments, setComments] = useState<TicketEntry[]>([]);
  const [commentsState, setCommentsState] = useState<ThreadState>("loading");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [notes, setNotes] = useState<TicketEntry[]>([]);
  const [notesState, setNotesState] = useState<ThreadState>("loading");
  const [noteDraft, setNoteDraft] = useState("");
  const [notePosting, setNotePosting] = useState(false);
  const [noteError, setNoteError] = useState("");

  // Attachments (Lab 2 continuity: active list + download).
  const [attachmentError, setAttachmentError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setState("loading");
      setTicket(null);
      setCommentsState("loading");
      setNotesState("loading");
      setUsersFailed(false);
      setOwnerError("");
      setPriorityError("");
      setStatusError("");
      setCommentError("");
      setNoteError("");
      try {
        const detail = await fetchStaffTicket(ticketId);
        if (cancelled) return;
        setTicket(detail);
        setOwnerDraft(detail.owner ? String(detail.owner.id) : "");
        setPriorityDraft(detail.itPriority ?? detail.requestedPriority);
        setStatusDraft(detail.status);
        setState("ready");

        // Threads and owner candidates load independently; one failure
        // must not blank the ticket context.
        fetchStaffComments(ticketId).then(
          (result) => {
            if (!cancelled) {
              setComments(result.items);
              setCommentsState("ready");
            }
          },
          () => {
            if (!cancelled) setCommentsState("failed");
          },
        );
        fetchStaffNotes(ticketId).then(
          (result) => {
            if (!cancelled) {
              setNotes(result.items);
              setNotesState("ready");
            }
          },
          () => {
            if (!cancelled) setNotesState("failed");
          },
        );
        fetchStaffUsers().then(
          (users) => {
            if (!cancelled) setStaffUsers(users);
          },
          () => {
            if (!cancelled) setUsersFailed(true);
          },
        );
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AuthError && error.status === 404) setState("not-found");
        else if (error instanceof AuthError && (error.code === "FORBIDDEN" || error.status === 403)) setState("forbidden");
        else setState("failed");
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [ticketId, retryKey]);

  function flashToast(message: string) {
    setToast(message);
  }

  async function handleClaim() {
    if (!ticket || ownerSaving) return;
    setOwnerSaving(true);
    setOwnerError("");
    try {
      const result = await updateTicketOwner(ticket.id, { claim: true });
      setTicket({ ...ticket, owner: result.owner });
      setOwnerDraft(result.owner ? String(result.owner.id) : "");
      flashToast("Ticket claimed. You are now the owner.");
    } catch (error) {
      setOwnerError(error instanceof AuthError ? fieldMessage(error) : "Unable to claim this ticket right now.");
    } finally {
      setOwnerSaving(false);
    }
  }

  async function handleSaveOwner() {
    if (!ticket || ownerSaving) return;
    setOwnerSaving(true);
    setOwnerError("");
    try {
      const result = await updateTicketOwner(ticket.id, {
        ownerId: ownerDraft === "" ? null : Number(ownerDraft),
      });
      setTicket({ ...ticket, owner: result.owner });
      flashToast(result.owner ? `Owner updated to ${result.owner.name}.` : "Ticket is now unassigned.");
    } catch (error) {
      setOwnerError(error instanceof AuthError ? fieldMessage(error) : "Unable to save the owner right now.");
    } finally {
      setOwnerSaving(false);
    }
  }

  async function handleSavePriority() {
    if (!ticket || prioritySaving) return;
    setPrioritySaving(true);
    setPriorityError("");
    try {
      const result = await updateItPriority(ticket.id, priorityDraft);
      setTicket({ ...ticket, itPriority: result.itPriority });
      flashToast(`IT Priority set to ${result.itPriority}.`);
    } catch (error) {
      setPriorityError(error instanceof AuthError ? fieldMessage(error) : "Unable to save IT Priority right now.");
    } finally {
      setPrioritySaving(false);
    }
  }

  function handleStatusSaveClick() {
    if (!ticket || statusSaving) return;
    setStatusError("");
    if (statusDraft !== ticket.status && CONFIRM_STATUSES.includes(statusDraft)) {
      setPendingStatus(statusDraft);
      return;
    }
    void saveStatus(statusDraft);
  }

  async function saveStatus(next: string) {
    if (!ticket) return;
    setPendingStatus(null);
    setStatusSaving(true);
    setStatusError("");
    try {
      const result = await updateTicketStatus(ticket.id, next);
      setTicket({ ...ticket, status: result.status, updatedAt: result.updatedAt ?? ticket.updatedAt });
      flashToast(`Status changed to ${result.status}.`);
    } catch (error) {
      setStatusError(error instanceof AuthError ? fieldMessage(error) : "Unable to save the status right now.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handlePostComment() {
    if (!ticket || commentPosting) return;
    setCommentPosting(true);
    setCommentError("");
    try {
      const created = await postStaffComment(ticket.id, commentDraft);
      setComments((current) => [...current, created]);
      setCommentDraft("");
      setTicket((current) => (current ? { ...current, commentsCount: current.commentsCount + 1 } : current));
      flashToast("Public reply posted.");
    } catch (error) {
      setCommentError(error instanceof AuthError ? fieldMessage(error) : "Unable to post this reply right now.");
    } finally {
      setCommentPosting(false);
    }
  }

  async function handlePostNote() {
    if (!ticket || notePosting) return;
    setNotePosting(true);
    setNoteError("");
    try {
      const created = await postStaffNote(ticket.id, noteDraft);
      setNotes((current) => [...current, created]);
      setNoteDraft("");
      setTicket((current) => (current ? { ...current, notesCount: current.notesCount + 1 } : current));
      flashToast("Internal note added.");
    } catch (error) {
      setNoteError(error instanceof AuthError ? fieldMessage(error) : "Unable to add this note right now.");
    } finally {
      setNotePosting(false);
    }
  }

  async function handleAttachmentDownload(attachmentId: number, fileName: string) {
    setAttachmentError("");
    setDownloadingId(attachmentId);
    try {
      const response = await fetch(`/api/attachments/${attachmentId}/download`, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setAttachmentError("Unable to download this attachment.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (state === "loading") {
    return (
      <main className="py-4" aria-busy="true">
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border" role="status" style={{ color: "#006B3C" }}>
              <span className="visually-hidden">Loading ticket...</span>
            </div>
            <p className="text-muted mt-3 mb-0">Loading ticket details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (state === "not-found") {
    return (
      <main className="py-4">
        <div className="alert alert-warning shadow-sm text-break" role="alert">
          <h1 className="h5 mb-2">Ticket Not Found</h1>
          <p className="mb-2">We couldn&apos;t find that ticket.</p>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}>
            &larr; Back to My Queue
          </button>
        </div>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="py-4">
        <div className="alert alert-warning shadow-sm text-break" role="alert">
          <h1 className="h5 mb-2">You don&apos;t have access to this ticket.</h1>
          <p className="mb-2">This area is available to IT Staff and Administrators.</p>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}>
            &larr; Back to My Queue
          </button>
        </div>
      </main>
    );
  }

  if (state === "failed" || !ticket) {
    return (
      <main className="py-4">
        <div className="alert alert-danger shadow-sm d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
          <span className="text-break">Unable to load this ticket right now.</span>
          <button type="button" className="btn btn-sm btn-outline-danger ms-sm-auto flex-shrink-0" onClick={() => setRetryKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="py-2 py-md-3">
      {toast && (
        <div className="alert alert-success shadow-sm" role="status">
          <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />
          {toast}
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom p-3 p-md-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <button type="button" className="btn btn-link p-0 mb-2 text-decoration-underline" style={{ color: "#006B3C" }} onClick={onBack}>
                &larr; Back to My Queue
              </button>
              <p className="fw-semibold text-uppercase small mb-2 text-break" style={{ color: "#006B3C" }}>
                Ticket {ticket.ticketNumber}
              </p>
              <h1 className="h3 mb-0 text-break">{ticket.title}</h1>
            </div>
            <span className={`badge ${statusBadgeClass[ticket.status] ?? "text-bg-secondary"}`}>
              {ticket.status}
            </span>
          </div>
          {ticket.requesterResolved && (
            <p className="mb-0 mt-3">
              <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border">
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                Requester says resolved
              </span>
            </p>
          )}
        </div>

        <div className="card-body p-3 p-md-4">
          {/* Read-only ticket context */}
          <section aria-labelledby="staff-context-heading">
            <h2 id="staff-context-heading" className="h5 mb-3">Ticket details</h2>
            <div className="row g-4">
              <div className="col-md-4">
                <label className="form-label text-muted small mb-1">Requested Priority</label>
                <p className="mb-0">
                  <span className={`badge rounded-pill ${priorityBadgeClass[ticket.requestedPriority] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
                    {ticket.requestedPriority}
                  </span>
                </p>
              </div>
              <div className="col-md-4">
                <label className="form-label text-muted small mb-1">IT Priority</label>
                <p className="mb-0">
                  <span className={`badge rounded-pill ${priorityBadgeClass[ticket.itPriority ?? ""] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
                    {ticket.itPriority ?? "—"}
                  </span>
                </p>
              </div>
              <div className="col-md-4">
                <label className="form-label text-muted small mb-1">Ticket Owner</label>
                <p className="mb-0">{ticket.owner ? ticket.owner.name : <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis">Unassigned</span>}</p>
              </div>
              <div className="col-12">
                <label className="form-label text-muted small mb-1">Description</label>
                <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</p>
              </div>
              <div className="col-md-6">
                <label className="form-label text-muted small mb-1">Requester</label>
                <p className="mb-0">{ticket.requester.name}</p>
              </div>
              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Category</label>
                <p className="mb-0">{ticket.category?.name ?? "—"}</p>
              </div>
              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Related System</label>
                <p className="mb-0">{ticket.relatedSystem?.name ?? "—"}</p>
              </div>
              <div className="col-md-6">
                <label className="form-label text-muted small mb-1">Created</label>
                <p className="mb-0">{formatDateTime(ticket.createdAt)}</p>
              </div>
              <div className="col-md-6">
                <label className="form-label text-muted small mb-1">Last Updated</label>
                <p className="mb-0">{formatDateTime(ticket.updatedAt)}</p>
              </div>
            </div>
          </section>

          <hr className="my-4" />

          {/* Operational controls */}
          <section aria-labelledby="staff-operations-heading" className="rounded-3 p-3 p-md-4" style={{ backgroundColor: "#F5F7F6" }}>
            <h2 id="staff-operations-heading" className="h5 mb-3">Ticket operations</h2>
            <div className="row g-4">
              <div className="col-12 col-md-4">
                <label htmlFor="staff-owner-select" className="form-label fw-semibold small">Ticket owner</label>
                {!ticket.owner && (
                  <button
                    type="button"
                    className="btn btn-zen-primary w-100 mb-2"
                    onClick={handleClaim}
                    disabled={ownerSaving}
                  >
                    {ownerSaving ? "Claiming..." : "Claim this ticket"}
                  </button>
                )}
                <div className="d-flex gap-2">
                  <select
                    id="staff-owner-select"
                    className="form-select"
                    value={ownerDraft}
                    onChange={(e) => setOwnerDraft(e.target.value)}
                    disabled={ownerSaving || staffUsers.length === 0}
                    aria-describedby={ownerError ? "staff-owner-error" : undefined}
                  >
                    <option value="">Unassigned</option>
                    {staffUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-zen-secondary flex-shrink-0" onClick={handleSaveOwner} disabled={ownerSaving || staffUsers.length === 0}>
                    {ownerSaving ? "Saving..." : "Save owner"}
                  </button>
                </div>
                {usersFailed && (
                  <p className="text-muted small mt-2 mb-0">
                    Staff list unavailable — claim still works.
                    <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => setRetryKey((k) => k + 1)}>
                      Retry
                    </button>
                  </p>
                )}
                {ownerError && (
                  <p id="staff-owner-error" className="zen-error-text mb-0" role="alert">{ownerError}</p>
                )}
              </div>

              <div className="col-12 col-md-4">
                <label htmlFor="staff-priority-select" className="form-label fw-semibold small">IT Priority</label>
                <div className="d-flex gap-2">
                  <select
                    id="staff-priority-select"
                    className="form-select"
                    value={priorityDraft}
                    onChange={(e) => setPriorityDraft(e.target.value)}
                    disabled={prioritySaving}
                    aria-describedby={priorityError ? "staff-priority-error" : undefined}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-zen-secondary flex-shrink-0" onClick={handleSavePriority} disabled={prioritySaving}>
                    {prioritySaving ? "Saving..." : "Save priority"}
                  </button>
                </div>
                <p className="text-muted small mt-2 mb-0">Requested Priority ({ticket.requestedPriority}) never changes.</p>
                {priorityError && (
                  <p id="staff-priority-error" className="zen-error-text mb-0" role="alert">{priorityError}</p>
                )}
              </div>

              <div className="col-12 col-md-4">
                <label htmlFor="staff-status-select" className="form-label fw-semibold small">Status</label>
                <div className="d-flex gap-2">
                  <select
                    id="staff-status-select"
                    className="form-select"
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    disabled={statusSaving}
                    aria-describedby={statusError ? "staff-status-error" : undefined}
                  >
                    {TICKET_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-zen-secondary flex-shrink-0" onClick={handleStatusSaveClick} disabled={statusSaving}>
                    {statusSaving ? "Saving..." : "Save status"}
                  </button>
                </div>
                {statusError && (
                  <p id="staff-status-error" className="zen-error-text mb-0" role="alert">{statusError}</p>
                )}
              </div>
            </div>
          </section>

          <hr className="my-4" />

          {/* Public comments — visible to requester + staff */}
          <section aria-labelledby="staff-comments-heading" className="card thread-public mb-4" style={{ borderColor: "#0B7A46" }}>
            <div className="card-body p-3 p-md-4">
              <h2 id="staff-comments-heading" className="h5 mb-1">
                <i className="bi bi-chat-left-text me-2" style={{ color: "#006B3C" }} aria-hidden="true" />
                Public comments
              </h2>
              <p className="text-muted small mb-3">Visible to the requester, IT staff, and administrators.</p>
              {commentsState === "loading" && (
                <p className="text-muted mb-0" role="status">Loading public comments...</p>
              )}
              {commentsState === "failed" && (
                <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
                  <span>Unable to load public comments right now.</span>
                  <button type="button" className="btn btn-sm btn-outline-danger ms-sm-auto" onClick={() => setRetryKey((k) => k + 1)}>
                    Try again
                  </button>
                </div>
              )}
              {commentsState === "ready" && comments.length === 0 && (
                <p className="text-muted mb-3">No public comments yet.</p>
              )}
              {commentsState === "ready" && comments.length > 0 && (
                <ul className="list-unstyled mb-3 d-flex flex-column gap-3">
                  {comments.map((entry) => (
                    <li key={entry.id} className="border rounded-3 p-3 bg-white">
                      <p className="small mb-1">
                        <span className="fw-semibold">{entry.author.name}</span>{" "}
                        <span className="badge rounded-pill ms-1" style={roleBadgeStyle(entry.author.role)}>
                          {entry.author.role}
                        </span>{" "}
                        <span className="text-muted">· {formatDateTime(entry.createdAt)}</span>
                      </p>
                      <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{entry.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <label htmlFor="staff-public-composer" className="form-label fw-semibold small">Reply publicly</label>
                <textarea
                  id="staff-public-composer"
                  className="form-control"
                  rows={3}
                  maxLength={2000}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  disabled={commentPosting}
                  placeholder="Write an update the requester can see…"
                  aria-describedby={commentError ? "staff-public-error" : undefined}
                />
                {commentError && (
                  <p id="staff-public-error" className="zen-error-text mb-0" role="alert">{commentError}</p>
                )}
                <button
                  type="button"
                  className="btn btn-outline-success mt-2"
                  onClick={handlePostComment}
                  disabled={commentPosting || commentDraft.trim().length === 0}
                >
                  {commentPosting ? "Posting..." : "Post public reply"}
                </button>
              </div>
            </div>
          </section>

          {/* Internal notes — staff only, visually unmistakable */}
          <section aria-labelledby="staff-notes-heading" className="card thread-internal mb-4" style={{ borderColor: "#334155", borderWidth: 2 }}>
            <div className="px-3 py-2 d-flex align-items-center gap-2" style={{ backgroundColor: "#334155", color: "#fff" }}>
              <i className="bi bi-lock-fill" aria-hidden="true" />
              <h2 id="staff-notes-heading" className="h6 mb-0">Internal notes</h2>
              <span className="small ms-auto">Only staff see this</span>
            </div>
            <div className="card-body p-3 p-md-4" style={{ backgroundColor: "#f1f5f9" }}>
              <p className="small mb-3" style={{ color: "#334155" }}>
                <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
                Private to IT staff and administrators. Never post requester-visible content here — use Public comments above.
              </p>
              {notesState === "loading" && (
                <p className="text-muted mb-0" role="status">Loading internal notes...</p>
              )}
              {notesState === "failed" && (
                <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
                  <span>Unable to load internal notes right now.</span>
                  <button type="button" className="btn btn-sm btn-outline-danger ms-sm-auto" onClick={() => setRetryKey((k) => k + 1)}>
                    Try again
                  </button>
                </div>
              )}
              {notesState === "ready" && notes.length === 0 && (
                <p className="text-muted mb-3">No internal notes yet.</p>
              )}
              {notesState === "ready" && notes.length > 0 && (
                <ul className="list-unstyled mb-3 d-flex flex-column gap-3">
                  {notes.map((entry) => (
                    <li key={entry.id} className="border rounded-3 p-3 bg-white" style={{ borderColor: "#94a3b8" }}>
                      <p className="small mb-1">
                        <span className="fw-semibold">{entry.author.name}</span>{" "}
                        <span className="badge rounded-pill ms-1" style={roleBadgeStyle(entry.author.role)}>
                          {entry.author.role}
                        </span>{" "}
                        <span className="text-muted">· {formatDateTime(entry.createdAt)}</span>
                      </p>
                      <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{entry.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <label htmlFor="staff-internal-composer" className="form-label fw-semibold small">
                  <i className="bi bi-lock-fill me-1" aria-hidden="true" />
                  Add a private note
                </label>
                <textarea
                  id="staff-internal-composer"
                  className="form-control"
                  rows={3}
                  maxLength={2000}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  disabled={notePosting}
                  placeholder="Staff-only note…"
                  aria-describedby={noteError ? "staff-internal-error" : undefined}
                />
                {noteError && (
                  <p id="staff-internal-error" className="zen-error-text mb-0" role="alert">{noteError}</p>
                )}
                <button
                  type="button"
                  className="btn mt-2"
                  style={{ backgroundColor: "#334155", borderColor: "#334155", color: "#fff" }}
                  onClick={handlePostNote}
                  disabled={notePosting || noteDraft.trim().length === 0}
                >
                  <i className="bi bi-lock-fill me-1" aria-hidden="true" />
                  {notePosting ? "Adding..." : "Add internal note"}
                </button>
              </div>
            </div>
          </section>

          <section aria-labelledby="staff-attachments-heading">
            <h2 id="staff-attachments-heading" className="h5 mb-3">Attachments</h2>
            {attachmentError && (
              <div className="alert alert-danger" role="alert">{attachmentError}</div>
            )}
            {ticket.attachments.length === 0 ? (
              <p className="text-muted mb-0">No attachments for this ticket.</p>
            ) : (
              <ul className="list-group">
                {ticket.attachments.map((attachment) => (
                  <li key={attachment.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div className="d-flex flex-column" style={{ minWidth: 0, flex: "1 1 200px" }}>
                      <span className="fw-semibold text-break">{attachment.fileName}</span>
                      <span className="small text-muted">{attachment.mimeType ?? "Type unavailable"} · {formatFileSize(attachment.sizeBytes)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success flex-shrink-0"
                      onClick={() => handleAttachmentDownload(attachment.id, attachment.fileName)}
                      disabled={downloadingId === attachment.id}
                    >
                      <i className="bi bi-download me-1" aria-hidden="true" />
                      {downloadingId === attachment.id ? "Downloading..." : "Download"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Destructive-transition confirmation */}
      {pendingStatus && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1050 }} role="dialog" aria-modal="true" aria-labelledby="status-confirm-heading">
          <div className="card shadow border-0 w-100" style={{ maxWidth: 480 }}>
            <div className="card-body p-4">
              <h2 id="status-confirm-heading" className="h5 mb-2">Change status to {pendingStatus}?</h2>
              <div className="alert alert-warning text-break" role="alert">
                {CONFIRM_COPY[pendingStatus] ?? "This status change cannot be undone automatically."}
              </div>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPendingStatus(null)} disabled={statusSaving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-zen-primary" onClick={() => void saveStatus(pendingStatus)} disabled={statusSaving}>
                  {statusSaving ? "Saving..." : "Confirm change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
