import cookieParser from "cookie-parser";
import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { attachSession } from "./middleware/auth.js";
import authRouter from "./routes/auth.js";
import staffRouter from "./routes/staff.js";
import ticketsRouter from "./routes/tickets.js";
import adminRouter from "./routes/admin.js";
import { downloadAttachment, removeAttachment } from "./controllers/ticketsController.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.
void getPrisma;

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({ origin: true, credentials: true })); // allow CORS incl. session cookies
app.use(express.json());
app.use(cookieParser());
// Attach the session user (if any) before route handlers. Ticket handlers
// treat the session identity as authoritative and only fall back to the
// legacy Lab 2 requesterId when no session exists (see ticketsController).
app.use(attachSession);
app.use("/api/auth", authRouter);
app.use("/api/staff", staffRouter);
app.use("/api/tickets", ticketsRouter);
// Lab 3 (Issue 5) — minimalist user management. The canonical contract is
// /api/admin/users (docs/lab-03/api-spec.md §7); the same router also serves
// the /api/users aliases (PUT edit, reset-password) requested by stakeholders.
app.use("/api/admin/users", adminRouter);
app.use("/api/users", adminRouter);
app.get("/api/attachments/:fileId/download", downloadAttachment);
app.delete("/api/attachments/:fileId", removeAttachment);

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  // Issue 2: return API health information required by tests.
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// Implementation:
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.json(categories);
  } catch (e) {
    // Do not leak internal error details
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// ---------------------------------------------------------------------------
// Lab 3 (Issue 2) — Active requesters, now served from the User model.
// GET /api/requesters
//   -> fetch active Users with role REQUESTER via getPrisma().user.findMany
//   -> return { id, name, email } in a predictable sort order
// Kept for Lab 2 client compatibility; the authenticated app shell no longer
// uses it (identity comes from GET /api/auth/me).
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.user.findMany({
      where: { isActive: true, role: "REQUESTER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    res.json(requesters);
  } catch (error) {
    res.status(500).json({ error: "Failed to load active requesters" });
  }
});
// ---------------------------------------------------------------------------

export default app;
