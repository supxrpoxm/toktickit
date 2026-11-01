import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AuthError,
  createActionTaken,
  fetchActionsTaken,
  updateActionTaken,
  type ActionTakenItem,
} from "./api";
import { UserRole, formatRoleDisplay, isStaffRole, normalizeUserRole } from "./roles";

// ---------------------------------------------------------------------------
// Lab 4 (Issue 3) — Actions Taken UI.
//
// Requesters see a read-only, newest-first timeline for their own ticket.
// IT Staff / Administrators see the same timeline plus the primary
// "Add Action Taken" action and per-card Edit controls. The form is an inline
// expander so it stays usable on mobile and preserves input on API failures.
// ---------------------------------------------------------------------------

type ActionsTakenProps = {
  ticketId: number;
  currentUser: { id: number; name: string; role: string };
};

type LoadState = "loading" | "ready" | "failed";

const FOLLOW_UP_REQUIRED_MESSAGE = "Follow-up note is required when follow-up is required.";
const MAX_DESCRIPTION = 5000;
const MAX_RESULT = 5000;
const MAX_NOTE = 2000;

type StaleConflict = {
  expectedVersion?: number;
  currentVersion?: number;
  current?: ActionTakenItem;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asActionTakenItem(value: unknown): ActionTakenItem | null {
  const record = asRecord(value);
  const performedBy = asRecord(record?.performedBy);
  if (
    !record ||
    typeof record.id !== "number" ||
    typeof record.version !== "number" ||
    typeof record.actionAt !== "string" ||
    typeof record.description !== "string" ||
    typeof record.result !== "string" ||
    !performedBy ||
    typeof performedBy.id !== "number" ||
    typeof performedBy.name !== "string" ||
    typeof performedBy.role !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    ticketId: typeof record.ticketId === "number" ? record.ticketId : 0,
    ticketNumber: typeof record.ticketNumber === "string" ? record.ticketNumber : "",
    actionAt: record.actionAt,
    description: record.description,
    result: record.result,
    performedBy: { id: performedBy.id, name: performedBy.name, role: performedBy.role },
    followUpRequired: record.followUpRequired === true,
    followUpNote: typeof record.followUpNote === "string" ? record.followUpNote : null,
    attachmentNotes: typeof record.attachmentNotes === "string" ? record.attachmentNotes : null,
    version: record.version,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

function staleConflictFrom(error: AuthError): StaleConflict {
  const conflict = asRecord(error.conflict);
  return {
    expectedVersion:
      typeof conflict?.expectedVersion === "number" ? conflict.expectedVersion : undefined,
    currentVersion:
      typeof conflict?.currentVersion === "number" ? conflict.currentVersion : undefined,
    current: asActionTakenItem(conflict?.current) ?? undefined,
  };
}

function actionTimestamp(action: ActionTakenItem): number {
  const value = new Date(action.actionAt).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sortActions(items: ActionTakenItem[]): ActionTakenItem[] {
  return [...items].sort((a, b) => actionTimestamp(b) - actionTimestamp(a) || b.id - a.id);
}

function mergeAction(items: ActionTakenItem[], saved: ActionTakenItem): ActionTakenItem[] {
  return sortActions([saved, ...items.filter((item) => item.id !== saved.id)]);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function performerBadgeClass(role: string): string {
  const normalized = normalizeUserRole(role);
  if (normalized === UserRole.ADMINISTRATOR) return "bg-success text-white";
  if (normalized === UserRole.IT_STAFF) return "bg-success-subtle text-success-emphasis border";
  return "bg-secondary-subtle text-secondary-emphasis border";
}

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof AuthError) return error.message;
  return fallback;
}

export default function ActionsTaken({ ticketId, currentUser }: ActionsTakenProps) {
  const canManage = isStaffRole(currentUser.role);
  const currentRoleDisplay = formatRoleDisplay(currentUser.role);

  const [actions, setActions] = useState<ActionTakenItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [refreshWarning, setRefreshWarning] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionTakenItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftDirty, setDraftDirty] = useState(false);
  const [staleConflict, setStaleConflict] = useState<StaleConflict | null>(null);
  const [reloadingLatest, setReloadingLatest] = useState(false);

  const [actionAt, setActionAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNote, setFollowUpNote] = useState("");
  const [attachmentNotes, setAttachmentNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setLoadError("");

    fetchActionsTaken(ticketId, canManage ? "staff" : "requester").then(
      (data) => {
        if (cancelled) return;
        setActions(sortActions(data.items ?? []));
        setLoadState("ready");
        setRefreshWarning("");
      },
      (error) => {
        if (cancelled) return;
        setLoadState("failed");
        setLoadError(messageFor(error, "Unable to load Actions Taken right now."));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [ticketId, canManage, retryKey]);

  function resetForm() {
    setEditingAction(null);
    setActionAt(toDateTimeLocalValue(new Date()));
    setDescription("");
    setResult("");
    setFollowUpRequired(false);
    setFollowUpNote("");
    setAttachmentNotes("");
    setFormError("");
    setFieldErrors({});
    setDraftDirty(false);
    setStaleConflict(null);
  }

  function populateForm(action: ActionTakenItem) {
    setEditingAction(action);
    setActionAt(toDateTimeLocalValue(new Date(action.actionAt)));
    setDescription(action.description);
    setResult(action.result);
    setFollowUpRequired(action.followUpRequired);
    setFollowUpNote(action.followUpNote ?? "");
    setAttachmentNotes(action.attachmentNotes ?? "");
    setFormError("");
    setFieldErrors({});
    setDraftDirty(false);
  }

  function confirmDiscardDraft(): boolean {
    if (!draftDirty) return true;
    if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
    return window.confirm("Discard your unsaved changes to this Action Taken?");
  }

  function openCreate() {
    if (!canManage) return;
    if (!confirmDiscardDraft()) return;
    resetForm();
    setSuccessMessage("");
    setFormOpen(true);
  }

  function openEdit(action: ActionTakenItem) {
    if (!canManage) return;
    if (!confirmDiscardDraft()) return;
    populateForm(action);
    setSuccessMessage("");
    setFormOpen(true);
  }

  function closeForm() {
    if (submittingRef.current || !confirmDiscardDraft()) return;
    setFormOpen(false);
    resetForm();
  }

  function validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!actionAt) {
      errors.actionAt = "Action date/time is required.";
    } else if (Number.isNaN(new Date(actionAt).getTime())) {
      errors.actionAt = "Action date/time must be a valid date.";
    }

    if (!description.trim()) {
      errors.description = "Action description is required.";
    } else if (description.trim().length > MAX_DESCRIPTION) {
      errors.description = `Action description must be at most ${MAX_DESCRIPTION} characters.`;
    }

    if (!result.trim()) {
      errors.result = "Result is required.";
    } else if (result.trim().length > MAX_RESULT) {
      errors.result = `Result must be at most ${MAX_RESULT} characters.`;
    }

    if (followUpRequired && !followUpNote.trim()) {
      errors.followUpNote = FOLLOW_UP_REQUIRED_MESSAGE;
    } else if (followUpNote.trim().length > MAX_NOTE) {
      errors.followUpNote = `Follow-up note must be at most ${MAX_NOTE} characters.`;
    }

    if (attachmentNotes.trim().length > MAX_NOTE) {
      errors.attachmentNotes = `Attachment notes must be at most ${MAX_NOTE} characters.`;
    }

    return errors;
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleFollowUpToggle(event: ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    setDraftDirty(true);
    setFollowUpRequired(checked);
    if (!checked) {
      clearFieldError("followUpNote");
    } else if (!followUpNote.trim()) {
      setFieldErrors((current) => ({ ...current, followUpNote: FOLLOW_UP_REQUIRED_MESSAGE }));
    }
  }

  async function refreshActions(): Promise<ActionTakenItem[] | null> {
    try {
      const data = await fetchActionsTaken(ticketId, canManage ? "staff" : "requester");
      const next = sortActions(data.items ?? []);
      setActions(next);
      setRefreshWarning("");
      return next;
    } catch (error) {
      setRefreshWarning(
        messageFor(
          error,
          "The action was saved, but the timeline could not refresh. Your saved action is still shown.",
        ),
      );
      return null;
    }
  }

  async function reloadLatestVersion() {
    if (!editingAction || reloadingLatest) return;
    setReloadingLatest(true);

    let latest = staleConflict?.current;
    if (!latest) {
      const items = await refreshActions();
      latest = items?.find((item) => item.id === editingAction.id);
    }

    if (!latest) {
      setFormError(
        "We couldn't load the latest version of this action. Your draft is still here; try again.",
      );
      setReloadingLatest(false);
      return;
    }

    setActions((current) => mergeAction(current, latest!));
    populateForm(latest);
    setStaleConflict(null);
    setReloadingLatest(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || submittingRef.current) return;

    const errors = validateForm();
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);

    const payload = {
      actionAt: new Date(actionAt).toISOString(),
      description: description.trim(),
      result: result.trim(),
      followUpRequired,
      followUpNote: followUpNote.trim() || null,
      attachmentNotes: attachmentNotes.trim() || null,
    };

    try {
      // The version is the optimistic-concurrency token. It is the version
      // last read from the server and must accompany every update.
      const saved = editingAction
        ? await updateActionTaken(ticketId, editingAction.id, {
            version: editingAction.version,
            ...payload,
          })
        : await createActionTaken(ticketId, payload);

      setActions((current) => mergeAction(current, saved));
      setSuccessMessage(editingAction ? "Action Taken updated." : "Action Taken added.");
      setFormOpen(false);
      resetForm();

      // The mutation response is authoritative for this action. The follow-up
      // refresh replaces the local timeline with the server's ordering; if it
      // fails we keep the saved action visible and show a retryable warning.
      await refreshActions();
    } catch (error) {
      if (error instanceof AuthError && error.status === 409 && error.code === "STALE_UPDATE") {
        const conflict = staleConflictFrom(error);
        setStaleConflict(conflict);
        setFormError("");
        if (conflict.current) {
          setActions((current) => mergeAction(current, conflict.current!));
        }
        return;
      }

      setFormError(
        messageFor(error, "Unable to save this Action Taken right now. Please try again."),
      );
      if (error instanceof AuthError && error.fields) {
        setFieldErrors(error.fields);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="actions-taken-heading" className="mt-4">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-start gap-2 mb-3">
        <div style={{ minWidth: 0 }}>
          <h2 id="actions-taken-heading" className="h5 mb-1">
            <i className="bi bi-clipboard-check me-2" style={{ color: "#006B3C" }} aria-hidden="true" />
            Actions Taken
          </h2>
          <p className="text-muted small mb-0">
            {canManage
              ? "Record what was done, the outcome, and any follow-up needed."
              : "A read-only timeline of the work IT staff has recorded for this ticket."}
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-zen-primary flex-shrink-0" onClick={openCreate}>
            <i className="bi bi-plus-circle me-1" aria-hidden="true" />
            Add Action Taken
          </button>
        )}
      </div>

      {successMessage && (
        <div className="alert alert-success shadow-sm" role="status" aria-live="polite">
          <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {refreshWarning && (
        <div
          className="alert alert-warning shadow-sm d-flex flex-column flex-sm-row align-items-sm-center gap-2"
          role="status"
        >
          <span className="text-break">{refreshWarning}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-success ms-sm-auto flex-shrink-0"
            onClick={() => void refreshActions()}
          >
            Retry refresh
          </button>
        </div>
      )}

      {formOpen && canManage && (
        <form
          className="card border-0 shadow-sm mb-4"
          style={{ borderTop: "3px solid #006B3C" }}
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting}
        >
          <div className="card-body p-3 p-md-4">
            <h3 className="h5 mb-3">{editingAction ? "Edit Action Taken" : "Add Action Taken"}</h3>

            {staleConflict && (
              <div className="alert alert-warning" role="alert" aria-live="assertive">
                <p className="fw-semibold mb-1">This action was updated by another user.</p>
                <p className="small mb-2">
                  Your draft has been kept. Review the latest version before saving so you do not
                  overwrite someone else&apos;s work.
                </p>
                {staleConflict.current && (
                  <div className="small border rounded-3 bg-white p-2 mb-2">
                    <p className="mb-1">
                      <span className="fw-semibold">Current action:</span>{" "}
                      {staleConflict.current.description}
                    </p>
                    <p className="mb-1">
                      <span className="fw-semibold">Current result:</span>{" "}
                      {staleConflict.current.result}
                    </p>
                    <p className="mb-0 text-muted">
                      Version {staleConflict.currentVersion ?? staleConflict.current.version} ·
                      Updated {formatDateTime(staleConflict.current.updatedAt)}
                    </p>
                  </div>
                )}
                <div className="d-flex flex-column flex-sm-row gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-zen-primary"
                    onClick={() => void reloadLatestVersion()}
                    disabled={reloadingLatest || submitting}
                  >
                    {reloadingLatest ? "Reloading..." : "Reload latest"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setStaleConflict(null)}
                    disabled={reloadingLatest || submitting}
                  >
                    Keep my draft
                  </button>
                </div>
              </div>
            )}

            {formError && (
              <div className="alert alert-danger" role="alert">
                {formError}
              </div>
            )}

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label htmlFor="action-at" className="form-label fw-semibold small">
                  Action Date/Time <span className="text-danger" aria-hidden="true">*</span>
                  <span className="visually-hidden"> (required)</span>
                </label>
                <input
                  id="action-at"
                  type="datetime-local"
                  className={`form-control ${fieldErrors.actionAt ? "is-invalid" : ""}`}
                  value={actionAt}
                  onChange={(event) => {
                    setDraftDirty(true);
                    setActionAt(event.target.value);
                    clearFieldError("actionAt");
                  }}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.actionAt)}
                  aria-describedby={fieldErrors.actionAt ? "action-at-error" : undefined}
                  required
                />
                {fieldErrors.actionAt && (
                  <p id="action-at-error" className="zen-error-text mb-0" role="alert">
                    {fieldErrors.actionAt}
                  </p>
                )}
              </div>

              <div className="col-12 col-md-6">
                <label htmlFor="action-performed-by" className="form-label fw-semibold small">
                  Performed By
                </label>
                <input
                  id="action-performed-by"
                  type="text"
                  className="form-control"
                  value={`${currentUser.name} · ${currentRoleDisplay}`}
                  readOnly
                  disabled
                  aria-readonly="true"
                />
                <p className="form-text mb-0">User #{currentUser.id} · filled automatically from your session.</p>
              </div>

              <div className="col-12">
                <label htmlFor="action-description" className="form-label fw-semibold small">
                  Action Description <span className="text-danger" aria-hidden="true">*</span>
                  <span className="visually-hidden"> (required)</span>
                </label>
                <textarea
                  id="action-description"
                  className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
                  rows={3}
                  maxLength={MAX_DESCRIPTION}
                  value={description}
                  onChange={(event) => {
                    setDraftDirty(true);
                    setDescription(event.target.value);
                    clearFieldError("description");
                  }}
                  disabled={submitting}
                  placeholder="What did you do?"
                  aria-invalid={Boolean(fieldErrors.description)}
                  aria-describedby={fieldErrors.description ? "action-description-error" : undefined}
                  required
                />
                {fieldErrors.description && (
                  <p id="action-description-error" className="zen-error-text mb-0" role="alert">
                    {fieldErrors.description}
                  </p>
                )}
              </div>

              <div className="col-12">
                <label htmlFor="action-result" className="form-label fw-semibold small">
                  Result <span className="text-danger" aria-hidden="true">*</span>
                  <span className="visually-hidden"> (required)</span>
                </label>
                <textarea
                  id="action-result"
                  className={`form-control ${fieldErrors.result ? "is-invalid" : ""}`}
                  rows={3}
                  maxLength={MAX_RESULT}
                  value={result}
                  onChange={(event) => {
                    setDraftDirty(true);
                    setResult(event.target.value);
                    clearFieldError("result");
                  }}
                  disabled={submitting}
                  placeholder="What was the outcome?"
                  aria-invalid={Boolean(fieldErrors.result)}
                  aria-describedby={fieldErrors.result ? "action-result-error" : undefined}
                  required
                />
                {fieldErrors.result && (
                  <p id="action-result-error" className="zen-error-text mb-0" role="alert">
                    {fieldErrors.result}
                  </p>
                )}
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    id="action-followup-required"
                    type="checkbox"
                    className="form-check-input"
                    checked={followUpRequired}
                    onChange={handleFollowUpToggle}
                    disabled={submitting}
                  />
                  <label htmlFor="action-followup-required" className="form-check-label fw-semibold small">
                    Follow-up required?
                  </label>
                </div>
              </div>

              <div className="col-12">
                <label htmlFor="action-followup-note" className="form-label fw-semibold small">
                  Follow-up Note
                  {followUpRequired && (
                    <>
                      <span className="text-danger" aria-hidden="true"> *</span>
                      <span className="visually-hidden"> (required)</span>
                    </>
                  )}
                </label>
                <textarea
                  id="action-followup-note"
                  className={`form-control ${fieldErrors.followUpNote ? "is-invalid" : ""}`}
                  rows={2}
                  maxLength={MAX_NOTE}
                  value={followUpNote}
                  onChange={(event) => {
                    setDraftDirty(true);
                    setFollowUpNote(event.target.value);
                    if (event.target.value.trim()) clearFieldError("followUpNote");
                  }}
                  onBlur={() => {
                    if (followUpRequired && !followUpNote.trim()) {
                      setFieldErrors((current) => ({
                        ...current,
                        followUpNote: FOLLOW_UP_REQUIRED_MESSAGE,
                      }));
                    }
                  }}
                  disabled={submitting}
                  placeholder={
                    followUpRequired
                      ? "Required — describe the next step or check."
                      : "Optional — keep any note you enter."
                  }
                  aria-invalid={Boolean(fieldErrors.followUpNote)}
                  aria-describedby={fieldErrors.followUpNote ? "action-followup-note-error" : undefined}
                  required={followUpRequired}
                />
                {fieldErrors.followUpNote && (
                  <p id="action-followup-note-error" className="zen-error-text mb-0" role="alert">
                    {fieldErrors.followUpNote}
                  </p>
                )}
              </div>

              <div className="col-12">
                <label htmlFor="action-attachment-notes" className="form-label fw-semibold small">
                  Attachment Notes
                </label>
                <textarea
                  id="action-attachment-notes"
                  className={`form-control ${fieldErrors.attachmentNotes ? "is-invalid" : ""}`}
                  rows={2}
                  maxLength={MAX_NOTE}
                  value={attachmentNotes}
                  onChange={(event) => {
                    setDraftDirty(true);
                    setAttachmentNotes(event.target.value);
                    clearFieldError("attachmentNotes");
                  }}
                  disabled={submitting}
                  placeholder="Optional — reference files or images to look for."
                  aria-invalid={Boolean(fieldErrors.attachmentNotes)}
                  aria-describedby={fieldErrors.attachmentNotes ? "action-attachment-notes-error" : undefined}
                />
                {fieldErrors.attachmentNotes && (
                  <p id="action-attachment-notes-error" className="zen-error-text mb-0" role="alert">
                    {fieldErrors.attachmentNotes}
                  </p>
                )}
              </div>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 mt-3">
              <button type="submit" className="btn btn-zen-primary" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingAction
                    ? "Save changes"
                    : "Save Action"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeForm}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loadState === "loading" && (
        <div className="card border-0 shadow-sm" role="status" aria-live="polite">
          <div className="card-body p-3 p-md-4">
            <div className="d-flex align-items-center gap-2 text-muted">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              Loading Actions Taken...
            </div>
            <span className="placeholder-glow d-block mt-3" aria-hidden="true">
              <span className="placeholder col-8" />
              <span className="placeholder col-11" />
              <span className="placeholder col-6" />
            </span>
          </div>
        </div>
      )}

      {loadState === "failed" && (
        <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
          <span className="text-break">{loadError || "Unable to load Actions Taken right now."}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-sm-auto flex-shrink-0"
            onClick={() => setRetryKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && actions.length === 0 && (
        <div className="border border-2 border-dashed rounded-3 bg-white text-center p-4">
          <i className="bi bi-clipboard-x fs-3 text-muted" aria-hidden="true" />
          <p className="text-muted mb-0 mt-2">No Actions Taken yet.</p>
          {canManage && <p className="text-muted small mb-0">Add the first action when work begins.</p>}
        </div>
      )}

      {actions.length > 0 && (
        <div className="d-flex flex-column gap-3">
          {actions.map((action) => (
            <article key={action.id} className="card border-0 shadow-sm">
              <div className="card-body p-3 p-md-4">
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-start gap-2">
                  <div style={{ minWidth: 0 }}>
                    <p className="small text-muted mb-1">
                      <i className="bi bi-calendar3 me-1" aria-hidden="true" />
                      {formatDateTime(action.actionAt)}
                    </p>
                    <p className="mb-0 small d-flex flex-wrap align-items-center gap-2">
                      <span className="fw-semibold">{action.performedBy.name}</span>
                      <span className={`badge rounded-pill ${performerBadgeClass(action.performedBy.role)}`}>
                        {formatRoleDisplay(action.performedBy.role)}
                      </span>
                      <span className="text-muted">User #{action.performedBy.id}</span>
                    </p>
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span
                      className={`badge rounded-pill ${
                        action.followUpRequired
                          ? "bg-warning-subtle text-warning-emphasis border"
                          : "bg-success-subtle text-success-emphasis"
                      }`}
                    >
                      {action.followUpRequired ? "Follow-up required" : "No follow-up"}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => openEdit(action)}
                        aria-label={`Edit Action Taken from ${formatDateTime(action.actionAt)}`}
                      >
                        <i className="bi bi-pencil-square me-1" aria-hidden="true" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="h6 mb-1">Action</h3>
                  <p className="mb-3 text-break" style={{ whiteSpace: "pre-wrap" }}>
                    {action.description}
                  </p>

                  <h3 className="h6 mb-1">Result</h3>
                  <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                    {action.result}
                  </p>

                  {action.followUpNote && (
                    <div
                      className={`alert mt-3 mb-0 ${action.followUpRequired ? "alert-warning" : "alert-light border"}`}
                      role="note"
                    >
                      <p className="fw-semibold small mb-1">
                        <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                        Follow-up note
                        {!action.followUpRequired && (
                          <span className="text-muted fw-normal"> (optional)</span>
                        )}
                      </p>
                      <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                        {action.followUpNote}
                      </p>
                    </div>
                  )}

                  {action.attachmentNotes && (
                    <p className="small text-muted mt-3 mb-0 text-break">
                      <i className="bi bi-paperclip me-1" aria-hidden="true" />
                      <span className="fw-semibold">Attachment notes:</span> {action.attachmentNotes}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
