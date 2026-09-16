import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME, verifySession } from "../auth.js";
import { getPrisma } from "../prisma.js";

// Authenticated session identity attached to the request.
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string; // Prisma Role value: REQUESTER | IT_STAFF | ADMINISTRATOR
  isActive: boolean;
  requiresPasswordChange: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser | null;
    }
  }
}

// Soft session attachment: loads the session user when a valid
// `toktickit.session` cookie is present, otherwise leaves req.authUser null.
// Route handlers decide identity: session wins, legacy client-supplied
// requesterId is the fallback (Lab 2 compatibility) and is IGNORED whenever
// a session exists (BR-03 / AC-07).
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  req.authUser = null;
  try {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE_NAME];
    if (!token) return next();
    const payload = verifySession(token);
    if (!payload) return next();
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return next();
    req.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: String(user.role),
      isActive: user.isActive,
      requiresPasswordChange: user.requiresPasswordChange,
    };
    return next();
  } catch {
    req.authUser = null;
    return next();
  }
}

// Strict gate for NEW endpoints that must not work without login.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
    });
  }
  return next();
}

// Role gate for staff-only endpoints (Lab 3, Issue 3). Only active
// IT Staff and Administrator sessions pass; every other authenticated role
// gets 403 FORBIDDEN with NO protected payload (BR-04 style separation).
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const role = req.authUser?.role;
  if (role === "IT_STAFF" || role === "ADMINISTRATOR") {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: { code: "FORBIDDEN", message: "You don't have access to this area." },
  });
}
// Mandatory password-change gate (BR-02): a session whose account still has
// an initial password may only call GET /api/auth/me and
// POST /api/auth/change-password. All other session-authenticated APIs
// return 403 PASSWORD_CHANGE_REQUIRED.
export function passwordChangeGate(req: Request, res: Response, next: NextFunction) {
  if (req.authUser?.requiresPasswordChange) {
    return res.status(403).json({
      success: false,
      error: {
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Please change your password to continue.",
      },
    });
  }
  return next();
}
