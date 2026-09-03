import { ErrorRequestHandler, Router } from "express";
import multer from "multer";
import {
  addAttachments,
  attachmentUpload,
  createTicket,
  getAttachments,
  getTicketById,
  getTickets,
} from "../controllers/ticketsController.js";

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
router.get("/:id", getTicketById);
router.get("/", getTickets);

export default router;
