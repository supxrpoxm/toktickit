import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import ticketsRouter from "./routes/tickets.js";
import { downloadAttachment, removeAttachment } from "./controllers/ticketsController.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.
void getPrisma;

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({ origin: true }));          // allow CORS from the dev server and browsers
app.use(express.json());
app.use("/api/tickets", ticketsRouter);
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
// Issue 3 — Active requesters only
// GET /api/requesters
//   -> fetch Requester records from PostgreSQL via getPrisma().requester.findMany
//   -> filter to isActive = true only
//   -> return { id, name, email } in a predictable sort order
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.requester.findMany({
      where: { isActive: true },
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
