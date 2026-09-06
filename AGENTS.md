# AGENTS.md

## Project Overview

TokTickIT — IT Service Desk app (CPE 334 course project). Two independent packages: `client/` and `server/`. No monorepo workspace or shared tooling.

## Commands

Run all commands from the respective package directory (`client/` or `server/`), not root.

```bash
# Server
cd server
npm install
npm run dev              # tsx watch src/index.ts (port 3000)
npm run test             # vitest run
npm run build            # tsc
npm run prisma:migrate   # prisma migrate dev
npm run prisma:seed      # tsx prisma/seed.ts

# Client
cd client
npm install
npm run dev              # vite dev server (port 5173)
npm run test             # vitest run (excludes e2e/)
npm run build            # tsc && vite build

# E2E tests (Playwright, from client/)
npx playwright test      # expects dev server running at 127.0.0.1:5173
```

There are no standalone lint or typecheck scripts. Use `npm run build` in each package to verify types (`tsc`).

## Architecture

- **Server** (`server/src/`): Express + ESM. Entry: `index.ts` → `app.ts`. Routes in `routes/`, controllers in `controllers/`.
- **Client** (`client/src/`): React 18 + Vite. Entry: `main.tsx` → `App.tsx`. Components are flat in `src/`.
- **ORM**: Prisma with lazy singleton via `getPrisma()` in `server/src/prisma.ts`. Call it inside route handlers, not at module top level.
- **DB**: PostgreSQL. Schema at `server/prisma/schema.prisma`. Migrations in `server/prisma/migrations/`. Seed script at `server/prisma/seed.ts`.
- **Client proxy**: Vite proxies `/api` to `http://localhost:3000` (configured in `client/vite.config.ts`).
- **File uploads**: Multer stores files in `server/uploads/`. Allowed: JPG, PNG, WEBP, PDF up to 5MB, max 5 files per ticket.

## Key Conventions

- Server is ESM (`"type": "module"`). All server imports must use `.js` extensions (e.g., `./prisma.js`).
- Server tests use Supertest with the exported `app` from `app.ts` (no port needed).
- Client unit tests use Vitest with jsdom + React Testing Library. Setup file: `client/tests/setup.ts`.
- Client e2e tests are in `client/tests/e2e/` and excluded from unit test runs.
- Tests are organized by lab: `tests/lab-01/`, `tests/lab-02/`, etc.
- Prisma client is generated into `server/node_modules/.prisma/client`. After schema changes, run `prisma generate` or `prisma migrate dev`.
- The client `src/api.ts` hardcodes `http://localhost:3000` — it does not read the `VITE_API_URL` env var from `client/.env.example`.
- App boots into a requester gate (`Select Requester`): no global auth. The chosen `requesterId` lives in `App` state and is passed via props to `MyTickets`, `TicketDetail`, and `CreateTicketForm`. Switching requester in the navbar resets the view to My Tickets.

## Database Setup

```bash
cp server/.env.example server/.env   # edit DATABASE_URL to match your PostgreSQL
cd server
npm install
npx prisma migrate dev --name <name>  # or: npm run prisma:migrate
npm run prisma:seed
```

The seed script upserts 4 categories, 6 related systems, and 5 requesters (4 active, 1 inactive).

## Tests

- **Server unit/integration**: `server/tests/lab-01/health.test.ts`, `categories.test.ts`; `server/tests/lab-02/tickets.test.ts`
- **Client unit**: `client/tests/lab-01/App.test.tsx`; `client/tests/lab-02/components.test.tsx`
- **Client e2e**: `client/tests/e2e/issue-08-ticket-creation.spec.ts` (Playwright, Chromium only)

Backend tests require a running PostgreSQL database with migrated schema. Frontend unit tests do not require a backend.

## Gotchas

- The root `package.json` only has `bootstrap` as a dependency — it's not a workspace root. Install deps in `client/` and `server/` separately.
- Server `uploads/` directory is created at runtime by multer config. It's gitignored but may exist locally.
- `.env` files are gitignored. Copy from `.env.example` files before running.
