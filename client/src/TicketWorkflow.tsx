import { useRef, useState } from "react";
import { AuthError, signalProblemResolved, updateTicketStatus } from "./api";
import { isStaffRole } from "./roles";
import { allowedTransitions, isTerminalStatus, requiresConfirmation } from "./workflow";

// ---------------------------------------------------------------------------
// Lab 4 (Issue 4) — Ticket Workflow and Resolution Gate.
//
// IT Staff / Administrators see only the transitions permitted from the
// ticket's current status. Requesters never receive formal transition
// controls; they can only submit an advisory "issue appears resolved" note,
// which never changes the authoritative ticket status.
// ---------------------------------------------------------------------------

type WorkflowUser = { id?: number; name?: string; role: string };

export type TicketTransitionResult = {
  id?: number;
  status: string;
  updatedAt?: string;
};

export type RequesterAdvisoryResult = {
  id?: number;
  requesterResolved: boolean;
  requesterResolvedAt: string | null;
};

type TicketWorkflowProps = {
  ticketId: number;
  status: string;
  updatedAt?: string;
  currentUser: WorkflowUser;
  requesterResolved?: boolean;
  onTransitioned?: (result: TicketTransitionResult) => void | Promise<void>;
  onAdvisorySubmitted?: (result: RequesterAdvisoryResult) => void;
  onRefreshRequested?: () => void;
};

const CONFIRM_COPY: Record<string, string> = {
  Cancelled: "Cancelling closes this ticket without a resolution. The requester will see the Cancelled status.",
  Closed: "Closing marks this ticket as complete. The requester will see the Closed status.",
  Reopened: "Reopening returns this ticket to active work. This cannot be undone automatically.",
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthError) return error.message || fallback;
  return fallback;
}

export default function TicketWorkflow({
  ticketId,
  status,
  updatedAt,
  currentUser,
  requesterResolved = false,
  onTransitioned,
  onAdvisorySubmitted,
  onRefreshRequested,
}: TicketWorkflowProps) {
  const staff = isStaffRole(currentUser.role);

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [confirmingStatus, setConfirmingStatus] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [conflictMessage, setConflictMessage] = useState("");

  const [advisoryNote, setAdvisoryNote] = useState("");
  const [advisorySaving, setAdvisorySaving] = useState(false);
  const advisoryRef = useRef(false);
  const [advisoryMessage, setAdvisoryMessage] = useState("");
  const [advisoryError, setAdvisoryError] = useState("");

  const transitions = staff ? allowedTransitions(status) : [];
  const terminal = staff && isTerminalStatus(status);

  function requestTransition(next: string) {
    if (pendingRef.current) return;
    setSuccessMessage("");
    setErrorMessage("");
    setConflictMessage("");
    if (requiresConfirmation(next)) {
      setConfirmingStatus(next);
      return;
    }
    void applyTransition(next);
  }

  async function applyTransition(next: string) {
    if (pendingRef.current) return;
    setConfirmingStatus(null);
    pendingRef.current = true;
    setPendingStatus(next);
    setSuccessMessage("");
    setErrorMessage("");
    setConflictMessage("");

    try {
      const result = await updateTicketStatus(ticketId, next, updatedAt);
      setSuccessMessage(`Status changed to ${result.status}.`);
      await onTransitioned?.(result);
    } catch (error) {
      if (error instanceof AuthError && error.status === 409 && error.code === "STALE_UPDATE") {
        setConflictMessage(
          error.message ||
            "This ticket was updated by someone else. Refresh the latest ticket state before trying again.",
        );
      } else {
        setErrorMessage(
          toErrorMessage(error, "Unable to change the ticket status right now. Please try again."),
        );
      }
    } finally {
      pendingRef.current = false;
      setPendingStatus(null);
    }
  }

  function handleRefreshLatest() {
    setConflictMessage("");
    setErrorMessage("");
    onRefreshRequested?.();
  }

  async function handleAdvisorySubmit() {
    if (advisoryRef.current) return;
    advisoryRef.current = true;
    setAdvisorySaving(true);
    setAdvisoryMessage("");
    setAdvisoryError("");

    try {
      const result = await signalProblemResolved(ticketId, advisoryNote.trim());
      setAdvisoryMessage(
        "Thanks — IT staff have been notified. The ticket status has not changed; only IT staff can formally resolve it.",
      );
      onAdvisorySubmitted?.(result);
    } catch (error) {
      setAdvisoryError(
        toErrorMessage(error, "Unable to send this advisory note right now. Please try again."),
      );
    } finally {
      advisoryRef.current = false;
      setAdvisorySaving(false);
    }
  }

  if (!staff) {
    return (
      <section
        aria-labelledby="requester-advisory-heading"
        className="border rounded-3 p-3 p-md-4"
        style={{ backgroundColor: "#EAF6EF", borderColor: "#0B7A46" }}
      >
        <h2 id="requester-advisory-heading" className="h6 mb-2">
          Resolution
        </h2>

        {requesterResolved ? (
          <p className="mb-0">
            <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border">
              <i className="bi bi-info-circle me-1" aria-hidden="true" />
              You indicated this issue is resolved
            </span>
            <span className="d-block small text-muted mt-2">
              IT staff will review your advisory note and formally resolve or close the ticket.
            </span>
          </p>
        ) : (
          <>
            <p className="small text-muted mb-2">
              If the problem looks fixed, let IT staff know. This is advisory only and does not
              change the ticket status — only IT staff can resolve or close the ticket.
            </p>
            <label htmlFor="requester-advisory-note" className="form-label fw-semibold small">
              Advisory note (optional)
            </label>
            <textarea
              id="requester-advisory-note"
              className="form-control mb-2"
              rows={2}
              maxLength={2000}
              value={advisoryNote}
              onChange={(event) => setAdvisoryNote(event.target.value)}
              disabled={advisorySaving}
              placeholder="Anything IT staff should know?"
            />
            <button
              type="button"
              className="btn btn-sm btn-zen-secondary"
              onClick={() => void handleAdvisorySubmit()}
              disabled={advisorySaving}
            >
              {advisorySaving ? "Sending..." : "Indicate Issue is Resolved"}
            </button>
          </>
        )}

        {advisoryMessage && (
          <div className="alert alert-success mt-2 mb-0" role="status" aria-live="polite">
            {advisoryMessage}
          </div>
        )}
        {advisoryError && (
          <div className="alert alert-danger mt-2 mb-0" role="alert">
            {advisoryError}
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="ticket-workflow-heading">
      <h2 id="ticket-workflow-heading" className="form-label fw-semibold small">
        Status workflow
      </h2>
      <p className="small text-muted mb-2">
        Current status: <span className="fw-semibold">{status}</span>
      </p>

      {terminal || transitions.length === 0 ? (
        <p className="text-muted small mb-0" role="status">
          This ticket is in a terminal state ({status}). No further status changes are permitted.
        </p>
      ) : (
        <div className="d-flex flex-wrap gap-2" role="group" aria-label="Permitted status transitions">
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              className={`btn btn-sm ${
                next === "Cancelled" || next === "Closed"
                  ? "btn-outline-danger"
                  : "btn-zen-secondary"
              }`}
              onClick={() => requestTransition(next)}
              disabled={pendingStatus !== null || confirmingStatus !== null}
            >
              {pendingStatus === next ? "Saving..." : next}
            </button>
          ))}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success mt-2 mb-0" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}

      {conflictMessage && (
        <div className="alert alert-warning mt-2 mb-0" role="alert" aria-live="assertive">
          <p className="fw-semibold mb-1">A newer version of this ticket exists.</p>
          <p className="small mb-2">{conflictMessage}</p>
          <button
            type="button"
            className="btn btn-sm btn-outline-dark"
            onClick={handleRefreshLatest}
          >
            Refresh latest ticket
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger mt-2 mb-0" role="alert">
          {errorMessage}
        </div>
      )}

      {confirmingStatus && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-confirm-heading"
        >
          <div className="card shadow border-0 w-100" style={{ maxWidth: 480 }}>
            <div className="card-body p-4">
              <h2 id="status-confirm-heading" className="h5 mb-2">
                Change status to {confirmingStatus}?
              </h2>
              <div className="alert alert-warning text-break" role="alert">
                {CONFIRM_COPY[confirmingStatus] ?? "This status change cannot be undone automatically."}
              </div>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setConfirmingStatus(null)}
                  disabled={pendingStatus !== null}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  onClick={() => void applyTransition(confirmingStatus)}
                  disabled={pendingStatus !== null}
                >
                  {pendingStatus ? "Saving..." : "Confirm change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
