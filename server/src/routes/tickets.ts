import { Router, type ErrorRequestHandler } from "express";
import multer from "multer";
import {
  addAttachments,
  attachmentUpload,
  createPublicComment,
  createTicket,
  getAttachments,
  getPublicComments,
  getTicketById,
  getTickets,
  signalResolved,
} from "../controllers/ticketsController.js";
import { passwordChangeGate, requireAuth } from "../middleware/auth.js";

const router = Router();

const handleUploadError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof multer.MulterError || error instanceof Error) {
    return res.status(400).json({ error: "Invalid attachment: JPG, PNG, WEBP, or PDF files up to 5MB are allowed." });
  }
  return next(error);
};

router.post("/", createTicket);
router.post("/:id/attachments", attachmentUpload.array("files", 5), handleUploadError, addAttachments);
router.get("/:id/attachments", getAttachments);
// Lab 3 (Issue 4) — authenticated discussion endpoints. Unlike the legacy
// Lab 2 routes above (transitional header fallback), these require a session:
// requireAuth (401) -> passwordChangeGate (403 PASSWORD_CHANGE_REQUIRED).
// Ownership is enforced inside the handlers (own ticket for Requesters).
router.get("/:id/comments", requireAuth, passwordChangeGate, getPublicComments);
router.post("/:id/comments", requireAuth, passwordChangeGate, createPublicComment);
router.post("/:id/resolved-signal", requireAuth, passwordChangeGate, signalResolved);
router.get("/:id", getTicketById);
router.get("/", getTickets);

export default router;
