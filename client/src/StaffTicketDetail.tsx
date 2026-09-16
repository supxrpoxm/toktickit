import React, { useEffect, useState } from "react";
import { AuthError, fetchStaffTicket, type StaffTicketDetail as StaffTicket } from "./api";

type DetailState = "loading" | "ready" | "not-found" | "forbidden" | "failed";

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

type StaffTicketDetailProps = {
  ticketId: number;
  onBack: () => void;
};

// Read-only staff ticket context for Issue 3. Ownership, IT Priority, and
// status controls arrive with the Ticket Detail workflow in the next issue.
export default function StaffTicketDetail({ ticketId, onBack }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadTicket() {
      setState("loading");
      setTicket(null);
      try {
        const result = await fetchStaffTicket(ticketId);
        if (!cancelled) {
          setTicket(result);
          setState("ready");
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AuthError && error.status === 404) setState("not-found");
        else if (error instanceof AuthError && (error.code === "FORBIDDEN" || error.status === 403)) setState("forbidden");
        else setState("failed");
      }
    }

    loadTicket();
    return () => {
      cancelled = true;
    };
  }, [ticketId, retryKey]);

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
        </div>

        <div className="card-body p-3 p-md-4">
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

          <hr className="my-4" />

          <section aria-labelledby="staff-attachments-heading">
            <h2 id="staff-attachments-heading" className="h5 mb-3">Attachments</h2>
            {ticket.attachments.length === 0 ? (
              <p className="text-muted mb-0">No attachments for this ticket.</p>
            ) : (
              <ul className="list-group">
                {ticket.attachments.map((attachment) => (
                  <li key={attachment.id} className="list-group-item d-flex flex-column">
                    <span className="fw-semibold text-break">{attachment.fileName}</span>
                    <span className="small text-muted">{attachment.mimeType ?? "Type unavailable"} · {formatFileSize(attachment.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-muted small mt-4 mb-0">
            Ticket actions (claim, IT priority, status changes, comments) arrive with the staff workflow in the next update.
          </p>
        </div>
      </div>
    </main>
  );
}
