import { Router } from "express";
import { createTicket, getTicketById, getTickets } from "../controllers/ticketsController.js";

const router = Router();

router.post("/", createTicket);
router.get("/:id", getTicketById);
router.get("/", getTickets);

export default router;
