import { Router } from "express";
import { getRequesterDashboard } from "../controllers/dashboardController.js";
import {
  passwordChangeGate,
  requireAuth,
  requireRequester,
} from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Lab 4 (Issue 5) — Requester self-service dashboard.
//
// Guards mirror the staff boundary: authentication (401), password change
// (403 PASSWORD_CHANGE_REQUIRED), then the requester role (403 FORBIDDEN).
// Every query inside the handler is scoped to req.authUser.id.
// ---------------------------------------------------------------------------

const router = Router();
router.use(requireAuth, passwordChangeGate, requireRequester);

router.get("/dashboard", getRequesterDashboard);

export default router;
