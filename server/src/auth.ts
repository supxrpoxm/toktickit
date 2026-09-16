import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Authentication core (Lab 3, Issue 2).
//
// - Passwords are stored only as bcrypt hashes (cost >= 10). Plaintext is
//   accepted inbound on login / change-password and is never persisted,
//   logged, or returned.
// - Sessions are signed JWTs carried in an httpOnly cookie
//   (`toktickit.session`, SameSite=Lax, Secure in production, 8-hour expiry).
//   Logout clears the cookie; afterwards protected endpoints see no session.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = "toktickit.session";
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
export const BCRYPT_COST = 10;

// Prisma enum values (database) <-> API display labels (docs/lab-03/api-spec.md).
export const ROLE_VALUES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
export type RoleValue = (typeof ROLE_VALUES)[number];

const ROLE_TO_LABEL: Record<RoleValue, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

const LABEL_TO_ROLE: Record<string, RoleValue> = {
  requester: "REQUESTER",
  "it staff": "IT_STAFF",
  it_staff: "IT_STAFF",
  itstaff: "IT_STAFF",
  administrator: "ADMINISTRATOR",
  admin: "ADMINISTRATOR",
};

export function roleToLabel(role: string): string {
  return (ROLE_TO_LABEL as Record<string, string>)[role] ?? role;
}

export function labelToRole(value: unknown): RoleValue | null {
  if (typeof value !== "string") return null;
  if ((ROLE_VALUES as readonly string[]).includes(value)) return value as RoleValue;
  return LABEL_TO_ROLE[value.trim().toLowerCase()] ?? null;
}

export function isRoleValue(value: unknown): value is RoleValue {
  return typeof value === "string" && (ROLE_VALUES as readonly string[]).includes(value);
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  // Dev/test fallback only. Production must set a long SESSION_SECRET in
  // server/.env (never committed). The fallback is deliberately logged.
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  return "toktickit-dev-only-session-secret";
}

export type SessionPayload = {
  sub: number; // user id
  v: number; // schema version marker (bump to invalidate old cookies)
};

export function signSession(userId: number): string {
  return jwt.sign({ sub: userId, v: 1 } satisfies SessionPayload, sessionSecret(), {
    expiresIn: SESSION_MAX_AGE_MS / 1000,
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, sessionSecret()) as unknown as SessionPayload;
    if (typeof payload?.sub !== "number" || payload.sub <= 0) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(plaintext: string, passwordHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plaintext, passwordHash);
  } catch {
    return false;
  }
}

// New-password rules (BR-06): 8-128 chars, at least one letter and one
// number. Passwords are NOT trimmed — leading/trailing spaces are significant.
export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function checkNewPassword(newPassword: unknown): PasswordCheck {
  if (typeof newPassword !== "string" || newPassword.length === 0) {
    return { ok: false, reason: "New password is required." };
  }
  if (newPassword.length < 8) {
    return { ok: false, reason: "Password must be at least 8 characters." };
  }
  if (newPassword.length > 128) {
    return { ok: false, reason: "Password must be at most 128 characters." };
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { ok: false, reason: "Password must contain at least one letter and one number." };
  }
  return { ok: true };
}

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Safe user object for API responses. NEVER includes passwordHash.
// `mustChangePassword` is the docs/lab-03/api-spec.md alias of
// `requiresPasswordChange` (always the same value).
export function toSafeUser(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  requiresPasswordChange: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleToLabel(user.role),
    isActive: user.isActive,
    requiresPasswordChange: user.requiresPasswordChange,
    mustChangePassword: user.requiresPasswordChange,
  };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  };
}
