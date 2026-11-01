import { useCallback, useEffect, useState } from "react";
import {
  AuthError,
  createManagedUser,
  fetchManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
  type ManagedUser,
} from "./api";

// ---------------------------------------------------------------------------
// Lab 3 (Issue 5) — Minimalist Administrator User Management.
//
// Single screen: user list (Name, Email, Role, Status, Edit) with name/email
// search + one optional role filter, create/edit dialog, and a set-password
// action that forces a change at next login. Zen Green tokens (#006B3C
// primary, #0B7A46 secondary, #EAF6EF pale, #F5F7F6 page) match the Lab 2
// system. Users are deactivated, never deleted (BR-11).
// ---------------------------------------------------------------------------

type ScreenState = "loading" | "ready" | "forbidden";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; user: ManagedUser }
  | { mode: "password"; user: ManagedUser };

const ROLE_OPTIONS = ["Requester", "IT Staff", "Administrator"] as const;

function roleBadgeStyle(role: string): React.CSSProperties {
  if (role === "Administrator") return { backgroundColor: "#006B3C", color: "#fff" };
  if (role === "IT Staff") return { backgroundColor: "#0B7A46", color: "#fff" };
  return { backgroundColor: "#EAF6EF", color: "#006B3C", border: "1px solid #006B3C" };
}

function dialogTitle(dialog: DialogState): string {
  if (dialog.mode === "create") return "New user";
  if (dialog.mode === "password") return "Set new password";
  return "Edit user";
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<ScreenState>("loading");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [toast, setToast] = useState("");
  const [listError, setListError] = useState("");

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("Requester");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialogNotice, setDialogNotice] = useState("");

  const hasActiveFilters = search.trim().length > 0 || roleFilter.length > 0;

  const loadUsers = useCallback(async () => {
    // The toolbar stays mounted across refetches so typing never loses
    // focus; only the list area switches between skeleton and content.
    // Failures render as a banner with retry (filters preserved), never as
    // a full-screen replacement.
    setListError("");
    try {
      const items = await fetchManagedUsers({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
      });
      setUsers(items);
      if (!search.trim() && !roleFilter) {
        setTotal(items.length);
      }
      setState("ready");
    } catch (error) {
      if (error instanceof AuthError && (error.code === "FORBIDDEN" || error.status === 403)) {
        setState("forbidden");
      } else {
        setState("ready");
        setListError(error instanceof AuthError ? error.message : "Unable to load users right now.");
      }
    }
  }, [search, roleFilter, retryKey]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function openDialog(next: DialogState) {
    setFieldErrors({});
    setDialogNotice("");
    setPassword("");
    if (next.mode === "create") {
      setName("");
      setEmail("");
      setRole("Requester");
      setIsActive(true);
    } else {
      setName(next.user.name);
      setEmail(next.user.email);
      setRole(next.user.role);
      setIsActive(next.user.isActive);
    }
    setDialog(next);
  }

  function closeDialog() {
    if (saving) return;
    setDialog(null);
    setFieldErrors({});
    setDialogNotice("");
  }

  function applyApiError(error: unknown) {
    if (error instanceof AuthError && error.code === "ADMIN_SAFETY_RULE") {
      setDialogNotice(error.message);
      return;
    }
    if (error instanceof AuthError && error.fields && Object.keys(error.fields).length > 0) {
      setFieldErrors(error.fields);
      return;
    }
    setDialogNotice(error instanceof AuthError ? error.message : "Something went wrong. Please try again.");
  }

  async function handleCreate() {
    setSaving(true);
    setFieldErrors({});
    setDialogNotice("");
    try {
      const created = await createManagedUser({ name, email, role, isActive, initialPassword: password });
      setToast(`User created — ${created.name} will be asked to choose a new password at next sign-in.`);
      setDialog(null);
      await loadUsers();
    } catch (error) {
      applyApiError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(user: ManagedUser) {
    setSaving(true);
    setFieldErrors({});
    setDialogNotice("");
    try {
      const updated = await updateManagedUser(user.id, { name, email, role, isActive });
      setToast(`User updated — ${updated.name}.`);
      setDialog(null);
      await loadUsers();
    } catch (error) {
      applyApiError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPassword(user: ManagedUser) {
    setSaving(true);
    setFieldErrors({});
    setDialogNotice("");
    try {
      await resetManagedUserPassword(user.id, password);
      setToast(`${user.name} will be asked to choose a new password at next sign-in.`);
      setDialog(null);
      await loadUsers();
    } catch (error) {
      applyApiError(error);
    } finally {
      setSaving(false);
    }
  }

  function handleDialogSubmit() {
    if (!dialog || saving) return;
    if (dialog.mode === "create") void handleCreate();
    else if (dialog.mode === "edit") void handleEdit(dialog.user);
    else void handleSetPassword(dialog.user);
  }

  if (state === "forbidden") {
    return (
      <main className="py-4">
        <div className="alert alert-warning shadow-sm text-break" role="alert">
          <h1 className="h5 mb-2">You don&apos;t have access to user management.</h1>
          <p className="mb-0">This area is available to Administrators.</p>
        </div>
      </main>
    );
  }

  const dialogHeading = dialog ? dialogTitle(dialog) : "";

  return (
    <main className="py-2 py-md-3" aria-busy={state === "loading"}>
      {toast && (
        <div className="alert alert-success shadow-sm text-break" role="status">
          <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />
          {toast}
        </div>
      )}

      {listError && (
        <div
          className="alert alert-danger shadow-sm d-flex flex-column flex-sm-row align-items-sm-center gap-2"
          role="alert"
        >
          <span className="text-break">{listError}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-sm-auto flex-shrink-0"
            onClick={() => {
              if (users.length === 0) setState("loading");
              setRetryKey((k) => k + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h1 className="h3 mb-1">User Management</h1>
              <p className="text-muted small mb-0" role="status">
                {hasActiveFilters ? `${users.length} of ${total} shown` : `${users.length} user${users.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <button type="button" className="btn btn-zen-primary" onClick={() => openDialog({ mode: "create" })}>
              <i className="bi bi-plus-circle me-1" aria-hidden="true" />
              New user
            </button>
          </div>

          <div className="d-flex flex-column flex-md-row gap-2 mb-3">
            <div className="input-group w-100">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search" aria-hidden="true" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by name or email"
                aria-label="Search users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="visually-hidden" htmlFor="user-role-filter">
              Filter by role
            </label>
            <select
              id="user-role-filter"
              className="form-select"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-outline-secondary text-nowrap"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("");
                }}
              >
                Clear
              </button>
            )}
          </div>

          {state === "loading" ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" style={{ color: "#006B3C" }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mt-3 mb-0">Loading users...</p>
            </div>
          ) : (
            <>
              {users.length === 0 && !hasActiveFilters && (
                <div className="text-center py-5 text-muted">
                  <h2 className="h5 mb-2">No users yet</h2>
                  <p className="mb-3">Create the first account to get started.</p>
                  <button type="button" className="btn btn-zen-primary" onClick={() => openDialog({ mode: "create" })}>
                    New user
                  </button>
                </div>
              )}

              {users.length === 0 && hasActiveFilters && (
                <div className="text-center py-5 text-muted">
                  <h2 className="h5 mb-2">No matching users</h2>
                  <p className="mb-3">Try adjusting your search or filter.</p>
                  <button
                    type="button"
                    className="btn btn-zen-secondary"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("");
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}

          {users.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="table-responsive d-none d-md-block">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Edit user</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="fw-semibold text-break">{user.name}</td>
                        <td className="text-break">{user.email}</td>
                        <td>
                          <span className="badge rounded-pill" style={roleBadgeStyle(user.role)}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          {user.isActive ? (
                            <span className="badge rounded-pill bg-success-subtle text-success-emphasis">Active</span>
                          ) : (
                            <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis">Inactive</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success text-nowrap"
                            onClick={() => openDialog({ mode: "edit", user })}
                            aria-label={`Edit ${user.name}`}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet cards */}
              <div className="d-md-none">
                {users.map((user) => (
                  <article key={user.id} className="card mb-3 border shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <span className="fw-semibold text-break">{user.name}</span>
                        <span className="badge rounded-pill" style={roleBadgeStyle(user.role)}>
                          {user.role}
                        </span>
                      </div>
                      <dl className="row small mb-2">
                        <dt className="col-4 text-muted">Email</dt>
                        <dd className="col-8 mb-1 text-break">{user.email}</dd>
                        <dt className="col-4 text-muted">Status</dt>
                        <dd className="col-8 mb-1">
                          {user.isActive ? (
                            <span className="badge rounded-pill bg-success-subtle text-success-emphasis">Active</span>
                          ) : (
                            <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis">Inactive</span>
                          )}
                        </dd>
                      </dl>
                      <button
                        type="button"
                        className="btn btn-outline-success w-100"
                        onClick={() => openDialog({ mode: "edit", user })}
                        aria-label={`Edit ${user.name}`}
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>

      {/* Create / edit / set-password dialog */}
      {dialog && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-dialog-heading"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeDialog();
          }}
        >
          <div className="card shadow border-0 w-100" style={{ maxWidth: 520 }}>
            <div className="card-body p-4">
              <h2 id="user-dialog-heading" className="h5 mb-3">
                {dialogHeading}
                {dialog.mode !== "create" && (
                  <span className="d-block small fw-normal text-muted mt-1 text-break">{dialog.user.email}</span>
                )}
              </h2>

              {dialogNotice && (
                <div className="alert alert-warning text-break" role="alert">
                  {dialogNotice}
                </div>
              )}

              {dialog.mode === "password" ? (
                <>
                  <p className="small text-muted">
                    {dialog.user.name} will be asked to choose a new password at next sign-in.
                  </p>
                  <div className="mb-3">
                    <label htmlFor="user-dialog-password" className="form-label fw-semibold small">
                      New initial password <span className="text-danger" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="user-dialog-password"
                      type="password"
                      autoComplete="new-password"
                      className={`form-control ${fieldErrors.initialPassword ? "is-invalid" : ""}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={saving}
                      aria-describedby={fieldErrors.initialPassword ? "user-dialog-password-error" : undefined}
                      autoFocus
                    />
                    {fieldErrors.initialPassword && (
                      <p id="user-dialog-password-error" className="zen-error-text mb-0" role="alert">
                        {fieldErrors.initialPassword}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <label htmlFor="user-dialog-name" className="form-label fw-semibold small">
                      Name <span className="text-danger" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="user-dialog-name"
                      type="text"
                      className={`form-control ${fieldErrors.name ? "is-invalid" : ""}`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={saving}
                      aria-describedby={fieldErrors.name ? "user-dialog-name-error" : undefined}
                      autoFocus
                    />
                    {fieldErrors.name && (
                      <p id="user-dialog-name-error" className="zen-error-text mb-0" role="alert">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="user-dialog-email" className="form-label fw-semibold small">
                      Email <span className="text-danger" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="user-dialog-email"
                      type="email"
                      autoComplete="off"
                      className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={saving}
                      aria-describedby={fieldErrors.email ? "user-dialog-email-error" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="user-dialog-email-error" className="zen-error-text mb-0" role="alert">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="user-dialog-role" className="form-label fw-semibold small">
                      Role <span className="text-danger" aria-hidden="true">*</span>
                    </label>
                    <select
                      id="user-dialog-role"
                      className={`form-select ${fieldErrors.role ? "is-invalid" : ""}`}
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={saving}
                      aria-describedby={fieldErrors.role ? "user-dialog-role-error" : undefined}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.role && (
                      <p id="user-dialog-role-error" className="zen-error-text mb-0" role="alert">
                        {fieldErrors.role}
                      </p>
                    )}
                  </div>

                  <div className="form-check form-switch mb-3">
                    <input
                      id="user-dialog-active"
                      type="checkbox"
                      className="form-check-input"
                      role="switch"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={saving}
                    />
                    <label htmlFor="user-dialog-active" className="form-check-label fw-semibold small">
                      Active
                    </label>
                    <p className="small text-muted mb-0">Inactive users cannot sign in. Users are never deleted.</p>
                  </div>

                  {dialog.mode === "create" && (
                    <div className="mb-3">
                      <label htmlFor="user-dialog-password" className="form-label fw-semibold small">
                        Initial password <span className="text-danger" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="user-dialog-password"
                        type="password"
                        autoComplete="new-password"
                        className={`form-control ${fieldErrors.initialPassword ? "is-invalid" : ""}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={saving}
                        aria-describedby={fieldErrors.initialPassword ? "user-dialog-password-error" : undefined}
                      />
                      {fieldErrors.initialPassword && (
                        <p id="user-dialog-password-error" className="zen-error-text mb-0" role="alert">
                          {fieldErrors.initialPassword}
                        </p>
                      )}
                      <p className="small text-muted mt-1 mb-0">
                        They&apos;ll be asked to choose a new password at next sign-in.
                      </p>
                    </div>
                  )}

                  {dialog.mode === "edit" && (
                    <div className="mb-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => openDialog({ mode: "password", user: dialog.user })}
                        disabled={saving}
                      >
                        Set new password
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={closeDialog} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  onClick={handleDialogSubmit}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : dialog.mode === "create"
                      ? "Create user"
                      : dialog.mode === "password"
                        ? "Set password"
                        : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
