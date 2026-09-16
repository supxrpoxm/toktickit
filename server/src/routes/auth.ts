import { Router, type Request, type Response } from "express";
import {
  checkNewPassword,
  hashPassword,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSession,
  toSafeUser,
  verifyPassword,
} from "../auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPrisma } from "../prisma.js";

const router = Router();

const INVALID_CREDENTIALS = "Invalid email or password.";
const INACTIVE_MESSAGE = "This account is inactive. Please contact an administrator.";

// POST /api/auth/login — { email, password }.
// Unknown emails and wrong passwords return the IDENTICAL 401 message so
// attackers cannot enumerate accounts (BR-01). Inactive accounts get a clear
// 403 without a session (BR-07). Never returns passwordHash.
router.post("/login", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const fields: Record<string, string> = {};
    if (!email) fields.email = "Email is required.";
    if (!password) fields.password = "Password is required.";
    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Email and password are required.", fields },
      });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    // Same generic message for unknown email vs. wrong password.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: { code: "ACCOUNT_INACTIVE", message: INACTIVE_MESSAGE },
      });
    }

    res.cookie(SESSION_COOKIE_NAME, signSession(user.id), sessionCookieOptions());
    return res.status(200).json({ success: true, data: { user: toSafeUser(user) } });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
});

// POST /api/auth/logout — idempotent: succeeds even with no/expired session.
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  return res.status(200).json({ success: true, data: { loggedOut: true } });
});

// GET /api/auth/me — current user. Exempt from the password-change gate so
// the client can learn it must redirect to Change Password.
router.get("/me", requireAuth, (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    void prisma;
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          requiresPasswordChange: user.requiresPasswordChange,
          mustChangePassword: user.requiresPasswordChange,
        },
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
});

// POST /api/auth/change-password — mandatory first-login change + voluntary
// change share this endpoint. Requires a session (a fresh initial-password
// session qualifies). Rules: 8-128 chars, letter + number, confirmation
// match, must differ from the current password.
router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
      });
    }

    const { newPassword, confirmPassword } = req.body ?? {};
    const fields: Record<string, string> = {};

    const check = checkNewPassword(newPassword);
    if (!check.ok) fields.newPassword = (check as { reason: string }).reason;
    if (typeof confirmPassword !== "string" || confirmPassword.length === 0) {
      fields.confirmPassword = "Please confirm your new password.";
    } else if (newPassword !== confirmPassword) {
      fields.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Please fix the highlighted fields.", fields },
      });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user || !user.isActive) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
      });
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please fix the highlighted fields.",
          fields: { newPassword: "New password must be different from the current password." },
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), requiresPasswordChange: false },
    });

    res.cookie(SESSION_COOKIE_NAME, signSession(updated.id), sessionCookieOptions());
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: updated.id,
          requiresPasswordChange: updated.requiresPasswordChange,
          mustChangePassword: updated.requiresPasswordChange,
        },
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  }
});

export default router;
