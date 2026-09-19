import { Router, type Request, type Response } from "express";
import {
  hashPassword,
  labelToRole,
  normalizeEmail,
  toSafeUser,
  type RoleValue,
} from "../auth.js";
import { passwordChangeGate, requireAdmin, requireAuth } from "../middleware/auth.js";
import { getPrisma } from "../prisma.js";

// ---------------------------------------------------------------------------
// Lab 3 (Issue 5) — Minimalist Administrator User Management.
//
// Canonical paths (docs/lab-03/api-spec.md §7): /api/admin/users ...
// Aliases requested by stakeholders: /api/users ..., PUT /:id (edit),
// POST /:id/reset-password (new initial password). Both families are served
// by mounting this router twice in app.ts; PATCH <-> PUT and
// set-password <-> reset-password share handlers.
//
// Guards (in order): requireAuth (401) -> passwordChangeGate (403
// PASSWORD_CHANGE_REQUIRED) -> requireAdmin (403 FORBIDDEN, no payload).
// Only Administrator sessions reach the handlers. Requester and IT Staff
// receive 403 with no user data (AC-29).
// ---------------------------------------------------------------------------

const router = Router();
router.use(requireAuth, passwordChangeGate, requireAdmin);

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SafeUserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  requiresPasswordChange: boolean;
};

function safeUser(user: SafeUserRow) {
  return toSafeUser(user);
}

function validationError(message: string, fields?: Record<string, string>) {
  return {
    success: false as const,
    error: { code: "VALIDATION_ERROR", message, fields },
  };
}

function notFoundError() {
  return {
    success: false as const,
    error: { code: "NOT_FOUND", message: "We couldn't find that user." },
  };
}

function internalError() {
  return {
    success: false as const,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  };
}

function toSafeInt(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function checkName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length === 0) {
    return "Name is required.";
  }
  if (name.trim().length > 100) {
    return "Name must be at most 100 characters.";
  }
  return null;
}

function checkEmail(email: unknown): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return "Email is required.";
  if (normalized.length > 254 || !EMAIL_SHAPE.test(normalized)) {
    return "Email must be a valid email address.";
  }
  return null;
}

// Initial passwords only need length at creation/reset time: the account is
// forced through the Change Password flow (with full complexity rules) at
// next login (api-spec.md §7.2, BR-14). Passwords are never trimmed.
function checkInitialPassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return "Initial password is required.";
  }
  if (value.length < 8) {
    return "Initial password must be at least 8 characters.";
  }
  if (value.length > 128) {
    return "Initial password must be at most 128 characters.";
  }
  return null;
}

function checkRole(value: unknown): { role?: RoleValue; error?: string } {
  const role = labelToRole(value);
  if (!role) {
    return { error: "Role must be one of Requester, IT Staff, or Administrator." };
  }
  return { role };
}

// GET / — user list with name/email search + one optional role filter.
// No pagination by design (§4.5 exclusion); ordered name:asc, id:asc.
// Never includes passwordHash (AC-21, AC-22).
router.get("/", async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 200) : "";
    const roleFilter = labelToRole(req.query.role);

    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        requiresPasswordChange: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return res.status(200).json({
      success: true,
      data: { items: users.map((user) => safeUser(user as SafeUserRow)) },
    });
  } catch {
    return res.status(500).json(internalError());
  }
});

// POST / — create a user with an initial password that forces a change at
// next login (AC-23, BR-14). Duplicate email -> 409 (AC-24, BR-09).
router.post("/", async (req: Request, res: Response) => {
  try {
    const fields: Record<string, string> = {};

    const nameError = checkName(req.body?.name);
    if (nameError) fields.name = nameError;

    const emailError = checkEmail(req.body?.email);
    if (emailError) fields.email = emailError;

    const { role, error: roleError } = checkRole(req.body?.role);
    if (roleError) fields.role = roleError;

    let isActive = true;
    if (req.body?.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        fields.isActive = "Activation state must be true or false.";
      } else {
        isActive = req.body.isActive;
      }
    }

    const passwordError = checkInitialPassword(req.body?.initialPassword);
    if (passwordError) fields.initialPassword = passwordError;

    if (Object.keys(fields).length > 0) {
      return res.status(400).json(validationError("Please fix the highlighted fields.", fields));
    }

    const email = normalizeEmail(req.body.email);
    const prisma = getPrisma();

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_EMAIL",
          message: "An account with this email already exists.",
          fields: { email: "An account with this email already exists." },
        },
      });
    }

    const created = await prisma.user.create({
      data: {
        name: (req.body.name as string).trim(),
        email,
        role: role as RoleValue,
        isActive,
        passwordHash: await hashPassword(req.body.initialPassword as string),
        requiresPasswordChange: true,
      },
    });

    return res.status(201).json({ success: true, data: { user: safeUser(created as SafeUserRow) } });
  } catch {
    return res.status(500).json(internalError());
  }
});

async function editUser(req: Request, res: Response) {
  try {
    const userId = toSafeInt(req.params.id);
    if (userId === null || userId <= 0) return res.status(404).json(notFoundError());

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updatable = ["name", "email", "role", "isActive"].filter((key) => body[key] !== undefined);
    if (updatable.length === 0) {
      return res.status(400).json(validationError("No changes provided.", { name: "Provide at least one field to update." }));
    }

    const fields: Record<string, string> = {};
    let name: string | undefined;
    let email: string | undefined;
    let role: RoleValue | undefined;
    let isActive: boolean | undefined;

    if (body.name !== undefined) {
      const nameError = checkName(body.name);
      if (nameError) fields.name = nameError;
      else name = (body.name as string).trim();
    }
    if (body.email !== undefined) {
      const emailError = checkEmail(body.email);
      if (emailError) fields.email = emailError;
      else email = normalizeEmail(body.email);
    }
    if (body.role !== undefined) {
      const checked = checkRole(body.role);
      if (checked.error) fields.role = checked.error;
      else role = checked.role;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        fields.isActive = "Activation state must be true or false.";
      } else {
        isActive = body.isActive;
      }
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json(validationError("Please fix the highlighted fields.", fields));
    }

    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json(notFoundError());

    // Safety rule 1 (BR-12, AC-27): no self-deactivation. Checked first so
    // the message names the exact rule that blocked the request.
    if (target.id === req.authUser!.id && isActive === false) {
      return res.status(403).json({
        success: false,
        error: { code: "ADMIN_SAFETY_RULE", message: "You cannot deactivate your own account." },
      });
    }

    // Safety rule 2 (BR-13, AC-28): the system must always retain at least
    // one active Administrator. Applies to deactivation AND demotion.
    const targetIsActiveAdmin =
      (target as { role: string; isActive: boolean }).role === "ADMINISTRATOR" &&
      (target as { role: string; isActive: boolean }).isActive;
    const wouldLeaveAdminCircle =
      targetIsActiveAdmin && (isActive === false || (role !== undefined && role !== "ADMINISTRATOR"));
    if (wouldLeaveAdminCircle) {
      const remainingAdmins = await prisma.user.count({
        where: { role: "ADMINISTRATOR", isActive: true, id: { not: target.id } },
      });
      if (remainingAdmins === 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: "ADMIN_SAFETY_RULE",
            message: "The system must retain at least one active Administrator.",
          },
        });
      }
    }

    // Safety rule 3 (BR-09, AC-24): duplicate email, case-insensitive.
    if (email !== undefined && email !== String((target as { email: string }).email).toLowerCase()) {
      const clash = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (clash && (clash as { id: number }).id !== target.id) {
        return res.status(409).json({
          success: false,
          error: {
            code: "DUPLICATE_EMAIL",
            message: "An account with this email already exists.",
            fields: { email: "An account with this email already exists." },
          },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return res.status(200).json({ success: true, data: { user: safeUser(updated as SafeUserRow) } });
  } catch {
    return res.status(500).json(internalError());
  }
}

// PATCH /:id (canonical) and PUT /:id (alias) — edit name, email, role,
// activation subject to duplicate-email and Administrator safety rules
// (AC-25, AC-27, AC-28).
router.patch("/:id", editUser);
router.put("/:id", editUser);

async function setInitialPassword(req: Request, res: Response) {
  try {
    const userId = toSafeInt(req.params.id);
    if (userId === null || userId <= 0) return res.status(404).json(notFoundError());

    const passwordError = checkInitialPassword(req.body?.initialPassword);
    if (passwordError) {
      return res.status(400).json(
        validationError("Please fix the highlighted fields.", { initialPassword: passwordError }),
      );
    }

    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return res.status(404).json(notFoundError());

    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await hashPassword(req.body.initialPassword as string),
        requiresPasswordChange: true,
      },
    });

    // The plaintext password is never echoed back; the flag proves the
    // account must change it at next login (AC-26, BR-14).
    return res.status(200).json({
      success: true,
      data: { id: target.id, mustChangePassword: true, requiresPasswordChange: true },
    });
  } catch {
    return res.status(500).json(internalError());
  }
}

// POST /:id/set-password (canonical) and POST /:id/reset-password (alias) —
// issue a new initial password (AC-26). Self-targeting is allowed: it only
// forces a password change, never deactivation.
router.post("/:id/set-password", setInitialPassword);
router.post("/:id/reset-password", setInitialPassword);

export default router;
