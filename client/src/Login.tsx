import React, { useState } from "react";
import { AuthError, login, type AuthUser } from "./api";

type LoginProps = {
  onSuccess: (user: AuthUser) => void;
  signedOutNotice?: boolean;
};

function isEmailShape(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function Login({ onSuccess, signedOutNotice = false }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [banner, setBanner] = useState<{ kind: "error" | "inactive" | "network"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    const nextErrors: typeof fieldErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isEmailShape(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    setFieldErrors(nextErrors);
    setBanner(null);

    if (Object.keys(nextErrors).length > 0) return;

    setIsBusy(true);
    try {
      const user = await login(email.trim(), password);
      onSuccess(user);
    } catch (error) {
      // Values are preserved on failure so the user can retry.
      if (error instanceof AuthError) {
        if (error.code === "ACCOUNT_INACTIVE") {
          setBanner({ kind: "inactive", text: error.message });
        } else if (error.code === "VALIDATION_ERROR" && error.fields) {
          setFieldErrors({ email: error.fields.email, password: error.fields.password });
          if (!error.fields.email && !error.fields.password) {
            setBanner({ kind: "error", text: error.message });
          }
        } else if (error.code === "NETWORK_ERROR") {
          setBanner({ kind: "network", text: error.message });
        } else {
          // INVALID_CREDENTIALS and every other failure share one safe,
          // generic message — never a hint about whether the email exists.
          setBanner({ kind: "error", text: "Invalid email or password." });
        }
      } else {
        setBanner({ kind: "network", text: "Unable to reach the server. Please try again." });
      }
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center px-3" style={{ backgroundColor: "#F5F7F6", minHeight: "100vh" }}>
      <div className="card border-0 shadow-sm rounded-4" style={{ maxWidth: 480, width: "100%" }}>
        <div className="card-header text-white p-3" style={{ backgroundColor: "#006B3C" }}>
          <h1 className="h4 mb-0">TokTickIT</h1>
        </div>

        <div className="card-body bg-white p-4">
          <h2 className="h5 mb-1">Sign in</h2>
          <p className="text-muted small mb-3">Sign in to the IT service desk.</p>

          {signedOutNotice && (
            <div className="alert alert-success mb-3" role="status">
              You have been signed out.
            </div>
          )}

          {banner && (
            <div
              className={`alert mb-3 ${banner.kind === "inactive" ? "alert-warning" : "alert-danger"}`}
              role={banner.kind === "inactive" ? "note" : "alert"}
            >
              {banner.text}
              {banner.kind === "network" && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger ms-2"
                  onClick={() => setBanner(null)}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="login-email" className="form-label">
                Email <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                className="form-control"
                placeholder="you@company.com"
                value={email}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (event.target.value.trim()) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
              />
              {fieldErrors.email && (
                <div id="login-email-error" className="zen-error-text">{fieldErrors.email}</div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="login-password" className="form-label">
                Password <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <div className="input-group">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="form-control"
                  placeholder="Your password"
                  value={password}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (event.target.value) setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
                </button>
              </div>
              {fieldErrors.password && (
                <div id="login-password-error" className="zen-error-text">{fieldErrors.password}</div>
              )}
            </div>

            <div className="d-grid">
              <button
                type="submit"
                disabled={isBusy}
                className="btn btn-zen-primary px-4 py-2 fw-bold"
                aria-busy={isBusy}
              >
                {isBusy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
