import React, { useState } from "react";
import { AuthError, changePassword, type AuthUser } from "./api";

type ChangePasswordProps = {
  user: AuthUser;
  mode: "forced" | "voluntary";
  onChanged: () => void;
  onCancel?: () => void;
  onLogout: () => void;
};

export default function ChangePassword({ user, mode, onChanged, onCancel, onLogout }: ChangePasswordProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [failure, setFailure] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const withinMaxLength = newPassword.length <= 128;
  const matchesConfirm = confirmPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors: typeof fieldErrors = {};
    if (!hasMinLength) nextErrors.newPassword = "Password must be at least 8 characters.";
    else if (!withinMaxLength) nextErrors.newPassword = "Password must be at most 128 characters.";
    else if (!hasLetterAndNumber) nextErrors.newPassword = "Password must contain at least one letter and one number.";
    if (!confirmPassword) nextErrors.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setFieldErrors(nextErrors);
    setFailure("");

    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      await changePassword(newPassword, confirmPassword);
      onChanged();
    } catch (error) {
      if (error instanceof AuthError && error.code === "VALIDATION_ERROR" && error.fields) {
        setFieldErrors({ newPassword: error.fields.newPassword, confirmPassword: error.fields.confirmPassword });
        if (!error.fields.newPassword && !error.fields.confirmPassword) {
          setFailure(error.message);
        }
      } else if (error instanceof AuthError && error.code === "NETWORK_ERROR") {
        setFailure(error.message);
      } else {
        setFailure("Unable to change your password right now. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function ruleRow(met: boolean, label: string) {
    return (
      <li className={`small ${met ? "text-success" : "text-muted"}`}>
        <i className={`bi ${met ? "bi-check-circle-fill" : "bi-circle"} me-1`} aria-hidden="true" />
        {label}
      </li>
    );
  }

  return (
    <div className="d-flex align-items-center justify-content-center px-3" style={{ backgroundColor: "#F5F7F6", minHeight: "100vh" }}>
      <div className="card border-0 shadow-sm rounded-4" style={{ maxWidth: 480, width: "100%" }}>
        <div className="card-header text-white p-3" style={{ backgroundColor: "#006B3C" }}>
          <h1 className="h4 mb-0">TokTickIT</h1>
        </div>

        <div className="card-body bg-white p-4">
          <h2 className="h5 mb-1">Choose a new password</h2>
          <p className="text-muted small mb-3">
            {mode === "forced"
              ? "Your administrator issued an initial password. Choose a new one to continue."
              : `Signed in as ${user.email}. Choose a new password for your account.`}
          </p>

          {failure && (
            <div className="alert alert-danger mb-3" role="alert">
              {failure}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="new-password" className="form-label">
                New password <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="form-control"
                placeholder="At least 8 characters, with a letter and a number"
                value={newPassword}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.newPassword)}
                aria-describedby="new-password-error new-password-rules"
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setFieldErrors((p) => ({ ...p, newPassword: undefined }));
                }}
              />
              {fieldErrors.newPassword && (
                <div id="new-password-error" className="zen-error-text">{fieldErrors.newPassword}</div>
              )}
              <ul id="new-password-rules" className="list-unstyled mt-2 mb-0">
                {ruleRow(hasMinLength, "At least 8 characters")}
                {ruleRow(hasLetterAndNumber, "Contains a letter and a number")}
                {ruleRow(withinMaxLength, "At most 128 characters")}
              </ul>
            </div>

            <div className="mb-3">
              <label htmlFor="confirm-password" className="form-label">
                Confirm new password <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="form-control"
                placeholder="Repeat your new password"
                value={confirmPassword}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                }}
              />
              {fieldErrors.confirmPassword && (
                <div id="confirm-password-error" className="zen-error-text">{fieldErrors.confirmPassword}</div>
              )}
              {confirmPassword.length > 0 && !matchesConfirm && !fieldErrors.confirmPassword && (
                <div className="zen-error-text">Passwords do not match.</div>
              )}
            </div>

            <div className="d-grid gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-zen-primary px-4 py-2 fw-bold"
                aria-busy={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save new password"
                )}
              </button>

              {mode === "voluntary" && onCancel && (
                <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </button>
              )}

              {mode === "forced" && (
                <button type="button" className="btn btn-link btn-sm text-muted" onClick={onLogout} disabled={isSaving}>
                  Sign out instead
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
