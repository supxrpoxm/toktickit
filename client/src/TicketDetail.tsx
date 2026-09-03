import { useEffect, useState } from "react";

type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed" | string;

type TicketAttachment = {
  id: number;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  deletedAt?: string | null;
};

type TicketDetailData = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
  category?: { name: string } | null;
  relatedSystem?: { name: string } | null;
  attachments?: TicketAttachment[];
};

type DetailState = "loading" | "success" | "error" | "not-found";

const statusBadgeClass: Record<string, string> = {
  Open: "text-bg-success",
  "In Progress": "text-bg-warning",
  Resolved: "text-bg-info",
  Closed: "text-bg-secondary",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(sizeBytes?: number | null) {
  if (!sizeBytes) return "Size unavailable";
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

type TicketDetailProps = {
  ticketId: number;
  onBack: () => void;
};

export default function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [state, setState] = useState<DetailState>("loading");

  useEffect(() => {
    const abortController = new AbortController();

    async function loadTicket() {
      setState("loading");
      setTicket(null);

      try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
          headers: {
            "x-requester-id": "1",
          },
          signal: abortController.signal,
        });

        if (response.status === 404 || response.status === 403) {
          setState("not-found");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load ticket");
        }

        const result = (await response.json()) as TicketDetailData;
        setTicket(result);
        setState("success");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setState("error");
      }
    }

    loadTicket();

    return () => abortController.abort();
  }, [ticketId]);

  if (state === "loading") {
    return (
      <main className="container py-5" aria-busy="true">
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-success" role="status">
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
      <main className="container py-5">
        <div className="alert alert-warning shadow-sm" role="alert">
          <h1 className="h5 mb-2">Ticket Not Found</h1>
          <p className="mb-0">This ticket does not exist or is not available to you.</p>
        </div>
      </main>
    );
  }

  if (state === "error" || !ticket) {
    return (
      <main className="container py-5">
        <div className="alert alert-danger shadow-sm" role="alert">
          Unable to load this ticket right now. Please try again later.
        </div>
      </main>
    );
  }

  const activeAttachments = (ticket.attachments ?? []).filter(
    (attachment) => !attachment.deletedAt,
  );

  return (
    <main className="container py-4 py-md-5">
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <button type="button" className="btn btn-link p-0 mb-2 text-success" onClick={onBack}>
                &larr; Back to My Tickets
              </button>
              <p className="text-success fw-semibold text-uppercase small mb-2">
                Ticket #{ticket.id}
              </p>
              <h1 className="h3 mb-0">{ticket.title}</h1>
            </div>
            <span className={`badge ${statusBadgeClass[ticket.status] ?? "text-bg-secondary"}`}>
              {ticket.status}
            </span>
          </div>
        </div>

        <div className="card-body p-4">
          <section aria-labelledby="ticket-information-heading">
            <h2 id="ticket-information-heading" className="h5 mb-4">
              Ticket Information
            </h2>

            <div className="row g-4">
              <div className="col-md-6">
                <label className="form-label text-muted small mb-1">Title</label>
                <p className="mb-0 fw-semibold">{ticket.title}</p>
              </div>

              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Status</label>
                <p className="mb-0">{ticket.status}</p>
              </div>

              <div className="col-md-3">
                <label className="form-label text-muted small mb-1">Date</label>
                <p className="mb-0">{formatDate(ticket.createdAt)}</p>
              </div>

              <div className="col-12">
                <label className="form-label text-muted small mb-1">Description</label>
                <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                  {ticket.description}
                </p>
              </div>

              {ticket.category && (
                <div className="col-md-6">
                  <label className="form-label text-muted small mb-1">Category</label>
                  <p className="mb-0">{ticket.category.name}</p>
                </div>
              )}

              {ticket.relatedSystem && (
                <div className="col-md-6">
                  <label className="form-label text-muted small mb-1">Related System</label>
                  <p className="mb-0">{ticket.relatedSystem.name}</p>
                </div>
              )}
            </div>
          </section>

          <hr className="my-4" />

          <section
            aria-labelledby="attachments-heading"
            className="border rounded-3 bg-light p-3 p-md-4"
          >
            <h2 id="attachments-heading" className="h5 mb-3 text-dark">
              <i className="bi bi-paperclip me-2 text-success" aria-hidden="true" />
              Attachments
            </h2>

            {activeAttachments.length === 0 ? (
              <div className="border border-2 border-dashed rounded-3 bg-white text-center p-4">
                <i className="bi bi-paperclip fs-3 text-muted" aria-hidden="true" />
                <p className="text-muted mb-0 mt-2">No attachments for this ticket.</p>
              </div>
            ) : (
              <div className="list-group">
                {activeAttachments.map((attachment) => (
                  <div
                    className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                    key={attachment.id}
                  >
                    <span className="fw-semibold text-break">
                      <i className="bi bi-file-earmark me-2 text-success" aria-hidden="true" />
                      {attachment.fileName}
                    </span>
                    <span className="text-muted small">{formatFileSize(attachment.sizeBytes)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
