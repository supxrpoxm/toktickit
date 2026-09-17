import { useEffect, useRef, useState } from "react";

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
  priority?: string | null;
  itPriority?: string | null;
  owner?: { id?: number; name?: string | null } | null;
  requesterResolved?: boolean;
  requesterResolvedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  category?: { name: string } | null;
  relatedSystem?: { name: string } | null;
  requester?: { id?: number; name?: string | null } | null;
  attachments?: TicketAttachment[];
};

type PublicComment = {
  id: number;
  ticketId: number;
  author: { id: number; name: string; role: string };
  body: string;
  createdAt: string;
};

type CommentsState = "loading" | "ready" | "failed";

type DetailState = "loading" | "success" | "error" | "not-found" | "forbidden";

const allowedAttachmentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const allowedAttachmentExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const maxAttachmentSize = 5 * 1024 * 1024;

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
  requesterId: number;
  requesterName?: string;
  onBack: () => void;
};

export default function TicketDetail({ ticketId, requesterId, requesterName = '', onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [isUploading, setIsUploading] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<number | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lab 3 (Issue 4) — public discussion + resolved signal. Internal Notes
  // are never fetched or rendered for Requesters.
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [commentsState, setCommentsState] = useState<CommentsState>("loading");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [signalSaving, setSignalSaving] = useState(false);
  const [signalError, setSignalError] = useState("");
  const [signalConfirmOpen, setSignalConfirmOpen] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadTicket() {
      setState("loading");
      setTicket(null);

      try {
        // Lab 3 (Issue 2): identity comes from the session cookie.
        const response = await fetch(`/api/tickets/${ticketId}`, {
          credentials: "include",
          signal: abortController.signal,
        });

        if (response.status === 403) {
          setState("forbidden");
          return;
        }

        if (response.status === 404) {
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
  }, [ticketId, requesterId]);

  // Load the public thread once the ticket is visible to this requester.
  useEffect(() => {
    if (state !== "success" || !ticket) return;
    const abortController = new AbortController();

    async function loadComments() {
      setCommentsState("loading");
      setCommentError("");
      try {
        const response = await fetch(`/api/tickets/${ticketId}/comments?limit=50`, {
          credentials: "include",
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error("Unable to load comments");
        const result = (await response.json()) as { success: boolean; data: { items: PublicComment[] } };
        setComments(result.data.items ?? []);
        setCommentsState("ready");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setCommentsState("failed");
      }
    }

    loadComments();
    return () => abortController.abort();
  }, [ticketId, state, ticket?.id]);

  async function handleAttachmentUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setAttachmentError("");

    if (!files.length || !ticket) return;

    const activeAttachmentCount = (ticket.attachments ?? []).filter(
      (attachment) => !attachment.deletedAt,
    ).length;

    if (activeAttachmentCount + files.length > 5) {
      setAttachmentError("A ticket may have at most 5 active attachments.");
      event.target.value = "";
      return;
    }

    const invalidFile = files.find((file) => {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      return !allowedAttachmentTypes.includes(file.type) || !allowedAttachmentExtensions.includes(extension) || file.size > maxAttachmentSize;
    });

    if (invalidFile) {
      setAttachmentError("Only JPG, PNG, WEBP, and PDF files up to 5MB each are allowed.");
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    setIsUploading(true);

    try {
      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const refreshedResponse = await fetch(`/api/tickets/${ticketId}`, {
        credentials: "include",
      });

      if (!refreshedResponse.ok) throw new Error("Refresh failed");

      setTicket((await refreshedResponse.json()) as TicketDetailData);
    } catch (error) {
      setAttachmentError("Unable to upload attachments right now.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleAttachmentDownload(attachment: TicketAttachment) {
    setAttachmentError("");

    try {
      const response = await fetch(`/api/attachments/${attachment.id}/download`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setAttachmentError("Unable to download this attachment.");
    }
  }

  async function handleAttachmentRemove(attachmentId: number) {
    setAttachmentError("");
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Remove this attachment? It will be hidden from the ticket but retained for audit.",
      );
      if (!confirmed) return;
    }
    setRemovingAttachmentId(attachmentId);

    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Removal failed");

      setTicket((currentTicket) =>
        currentTicket
          ? {
            ...currentTicket,
            attachments: (currentTicket.attachments ?? []).map((attachment) =>
              attachment.id === attachmentId
                ? { ...attachment, deletedAt: new Date().toISOString() }
                : attachment,
            ),
          }
          : currentTicket,
      );
    } catch (error) {
      setAttachmentError("Unable to remove this attachment right now.");
    } finally {
      setRemovingAttachmentId(null);
    }
  }

  async function handlePostComment() {
    if (!ticket || commentPosting || commentDraft.trim().length === 0) return;
    setCommentPosting(true);
    setCommentError("");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentDraft }),
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as {
          error?: { fields?: { body?: string }; message?: string };
        } | null;
        throw new Error(problem?.error?.fields?.body ?? problem?.error?.message ?? "Unable to post this reply right now.");
      }
      const result = (await response.json()) as { success: boolean; data: PublicComment };
      setComments((current) => [...current, result.data]);
      setCommentDraft("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Unable to post this reply right now.");
    } finally {
      setCommentPosting(false);
    }
  }

  async function handleSignalResolved() {
    if (!ticket || signalSaving) return;
    setSignalSaving(true);
    setSignalError("");
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolved-signal`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to send this signal right now.");
      const result = (await response.json()) as {
        success: boolean;
        data: { requesterResolved: boolean; requesterResolvedAt: string | null };
      };
      setTicket((current) =>
        current
          ? { ...current, requesterResolved: result.data.requesterResolved, requesterResolvedAt: result.data.requesterResolvedAt }
          : current,
      );
      setSignalConfirmOpen(false);
    } catch (error) {
      setSignalError("Unable to send this signal right now. Please try again.");
    } finally {
      setSignalSaving(false);
    }
  }

  if (state === "loading") {
    return (
      <main className="py-4 ticket-detail-wrap" aria-busy="true">
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border" role="status" style={{ color: '#006B3C' }}>
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
      <main className="py-4 ticket-detail-wrap">
        <div className="alert alert-warning shadow-sm text-break" role="alert">
          <h1 className="h5 mb-2">Ticket Not Found</h1>
          <p className="mb-2">This ticket does not exist or is not available to you.</p>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}>
            &larr; Back to My Tickets
          </button>
        </div>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="py-4 ticket-detail-wrap">
        <div className="alert alert-danger shadow-sm text-break" role="alert">
          <h1 className="h5 mb-2">Unauthorized Access</h1>
          <p className="mb-3">You do not have permission to view this ticket.</p>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onBack}>
            &larr; Back to My Tickets
          </button>
        </div>
      </main>
    );
  }

  if (state === "error" || !ticket) {
    return (
      <main className="py-4 ticket-detail-wrap">
        <div className="alert alert-danger shadow-sm d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
          <span className="text-break">Unable to load this ticket right now. Please try again later.</span>
        </div>
      </main>
    );
  }

  const attachments = ticket.attachments ?? [];

  return (
    <main className="py-2 py-md-3 ticket-detail-wrap">
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom p-3 p-md-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div className="min-w-0" style={{ minWidth: 0, flex: '1 1 220px' }}>
              <button type="button" className="btn btn-link p-0 mb-2 zen-text-primary text-decoration-underline" style={{ color: '#006B3C' }} onClick={onBack}>
                &larr; Back to My Tickets
              </button>
              <p className="fw-semibold text-uppercase small mb-2 text-break" style={{ color: '#006B3C' }}>
                Ticket #{ticket.id}
              </p>
              <h1 className="h3 mb-0 text-break">{ticket.title}</h1>
            </div>
            <span className={`badge ${statusBadgeClass[ticket.status] ?? "text-bg-secondary"}`}>
              {ticket.status}
            </span>
          </div>
        </div>

        <div className="card-body p-3 p-md-4">
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

              <div className="col-12 col-md-6">
                <label htmlFor="ticket-requester-name" className="form-label text-muted small mb-1">Requester</label>
                <input
                  id="ticket-requester-name"
                  type="text"
                  className="form-control zen-readonly"
                  value={ticket.requester?.name || requesterName || `Requester #${requesterId}`}
                  style={{ backgroundColor: '#EAF6EF' }}
                  disabled
                  readOnly
                  aria-readonly="true"
                />
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

              <div className="col-12 col-md-6">
                <label htmlFor="ticket-owner-name" className="form-label text-muted small mb-1">Ticket Owner</label>
                <input
                  id="ticket-owner-name"
                  type="text"
                  className="form-control zen-readonly"
                  value={ticket.owner?.name ?? "Unassigned"}
                  style={{ backgroundColor: '#EAF6EF' }}
                  disabled
                  readOnly
                  aria-readonly="true"
                  title="Set by IT staff"
                />
              </div>

              <div className="col-12 col-md-6">
                <label htmlFor="ticket-it-priority" className="form-label text-muted small mb-1">IT Priority</label>
                <input
                  id="ticket-it-priority"
                  type="text"
                  className="form-control zen-readonly"
                  value={ticket.itPriority ?? "—"}
                  style={{ backgroundColor: '#EAF6EF' }}
                  disabled
                  readOnly
                  aria-readonly="true"
                  title="Set by IT staff"
                />
              </div>
            </div>
          </section>

          {/* Requester resolved signal (flag only — Requesters cannot formally close tickets). */}
          <section aria-labelledby="resolved-signal-heading" className="border rounded-3 p-3 p-md-4 mt-4" style={{ backgroundColor: '#EAF6EF', borderColor: '#0B7A46' }}>
            <h2 id="resolved-signal-heading" className="h6 mb-2">Resolution</h2>
            {ticket.requesterResolved ? (
              <p className="mb-0">
                <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border">
                  <i className="bi bi-info-circle me-1" aria-hidden="true" />
                  You indicated this problem appears resolved
                </span>
                <span className="d-block small text-muted mt-2">
                  IT staff will review and formally resolve or close the ticket.
                </span>
              </p>
            ) : (
              <>
                <p className="small text-muted mb-2">
                  If the problem looks fixed, let IT staff know. This does not close the ticket — only IT staff can resolve or close it.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-zen-secondary"
                  onClick={() => setSignalConfirmOpen(true)}
                  disabled={signalSaving}
                >
                  {signalSaving ? "Sending..." : "Problem appears resolved"}
                </button>
                {signalError && (
                  <div className="alert alert-danger mt-2 mb-0" role="alert">{signalError}</div>
                )}
              </>
            )}
          </section>

          {signalConfirmOpen && !ticket.requesterResolved && (
            <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1050 }} role="dialog" aria-modal="true" aria-labelledby="signal-confirm-heading">
              <div className="card shadow border-0 w-100" style={{ maxWidth: 480 }}>
                <div className="card-body p-4">
                  <h2 id="signal-confirm-heading" className="h5 mb-2">Signal that the problem appears resolved?</h2>
                  <p className="text-muted small mb-0">
                    IT staff will see your signal and decide whether to resolve or close the ticket. The ticket stays open until they act.
                  </p>
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setSignalConfirmOpen(false)} disabled={signalSaving}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-zen-primary" onClick={handleSignalResolved} disabled={signalSaving}>
                      {signalSaving ? "Sending..." : "Confirm"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <hr className="my-4" />

          <section
            aria-labelledby="attachments-heading"
            className="border rounded-3 bg-light p-3 p-md-4"
          >
            <h2 id="attachments-heading" className="h5 mb-3 text-dark">
              <i className="bi bi-paperclip me-2 text-success" aria-hidden="true" />
              Attachments
            </h2>

            <div className="mb-3">
              <label htmlFor="ticket-attachments" className="form-label small text-muted">
                Add files (JPG, PNG, WEBP, or PDF; maximum 5MB each)
              </label>
              <input
                ref={fileInputRef}
                id="ticket-attachments"
                type="file"
                className="form-control"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                multiple
                disabled={isUploading || attachments.filter((attachment) => !attachment.deletedAt).length >= 5}
                onChange={handleAttachmentUpload}
              />
              {attachmentError && (
                <div className="alert alert-danger mt-2 mb-0" role="alert">
                  {attachmentError}
                </div>
              )}
              {isUploading && (
                <div className="text-success small mt-2" role="status">
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Uploading attachments...
                </div>
              )}
            </div>

            {attachments.length === 0 ? (
              <div className="border border-2 border-dashed rounded-3 bg-white text-center p-4">
                <i className="bi bi-paperclip fs-3 text-muted" aria-hidden="true" />
                <p className="text-muted mb-0 mt-2">No attachments for this ticket.</p>
              </div>
            ) : (
              <div className="list-group">
                {attachments.map((attachment) => (
                  <div
                    className={`list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 ${attachment.deletedAt ? "bg-body-secondary text-muted" : ""}`}
                    key={attachment.id}
                  >
                    <div className="d-flex flex-column min-w-0" style={{ minWidth: 0, flex: '1 1 200px' }}>
                      <span className={`fw-semibold text-break ${attachment.deletedAt ? "text-decoration-line-through" : ""}`}>
                        <i className={`bi ${attachment.deletedAt ? "bi-file-earmark-x" : "bi-file-earmark"} me-2 ${attachment.deletedAt ? "text-secondary" : ""}`} style={attachment.deletedAt ? undefined : { color: '#006B3C' }} aria-hidden="true" />
                        {attachment.fileName}
                      </span>
                      <span className="small text-muted text-break">
                        {attachment.mimeType ?? "Type unavailable"} · {formatFileSize(attachment.sizeBytes)}
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap ticket-attachment-actions">
                      {attachment.deletedAt ? (
                        <span className="badge text-bg-secondary">Deleted</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleAttachmentDownload(attachment)}
                          >
                            <i className="bi bi-download me-1" aria-hidden="true" />
                            Download
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleAttachmentRemove(attachment.id)}
                            disabled={removingAttachmentId === attachment.id}
                          >
                            {removingAttachmentId === attachment.id ? "Removing..." : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Public discussion with IT staff. Internal Notes are never shown here. */}
          <section
            aria-labelledby="requester-comments-heading"
            className="border rounded-3 bg-light p-3 p-md-4 mt-4"
          >
            <h2 id="requester-comments-heading" className="h5 mb-1 text-dark">
              <i className="bi bi-chat-left-text me-2 text-success" aria-hidden="true" />
              Public comments
            </h2>
            <p className="text-muted small mb-3">Visible to you and IT staff.</p>

            {commentsState === "loading" && (
              <p className="text-muted mb-0" role="status">Loading public comments...</p>
            )}
            {commentsState === "failed" && (
              <div className="alert alert-danger" role="alert">
                Unable to load public comments right now.
              </div>
            )}
            {commentsState === "ready" && comments.length === 0 && (
              <p className="text-muted mb-3">No public comments yet.</p>
            )}
            {commentsState === "ready" && comments.length > 0 && (
              <ul className="list-unstyled mb-3 d-flex flex-column gap-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="border rounded-3 p-3 bg-white">
                    <p className="small mb-1">
                      <span className="fw-semibold">{comment.author.name}</span>{" "}
                      <span className="badge rounded-pill bg-success-subtle text-success-emphasis ms-1">
                        {comment.author.role}
                      </span>{" "}
                      <span className="text-muted">· {formatDate(comment.createdAt)}</span>
                    </p>
                    <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label htmlFor="requester-comment-composer" className="form-label small text-muted">
                Reply to IT staff (up to 2000 characters)
              </label>
              <textarea
                id="requester-comment-composer"
                className="form-control"
                rows={3}
                maxLength={2000}
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                disabled={commentPosting}
              />
              {commentError && (
                <div className="alert alert-danger mt-2 mb-0" role="alert">{commentError}</div>
              )}
              <button
                type="button"
                className="btn btn-outline-success mt-2"
                onClick={handlePostComment}
                disabled={commentPosting || commentDraft.trim().length === 0}
              >
                {commentPosting ? "Posting..." : "Post reply"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
