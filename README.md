# TokTickIT — IT Service Desk Application

CPE 334 Introduction to Software Engineering in the Age of AI Agents.
Semester 1/2026.

TokTickIT is a role-based IT service desk. Requesters create and track tickets;
IT Staff triage, update, and resolve them; Administrators manage users. Lab 4
adds Actions Taken, the resolution gate, and role-scoped dashboards.

## Tech Stack

- **Client:** React 18, TypeScript, Vite, Bootstrap 5, Zen Green design, Vitest,
  Testing Library, Playwright.
- **Server:** Node.js, Express, TypeScript (ESM), PostgreSQL, Prisma, Vitest,
  Supertest.
- **Auth:** HTTP-only session cookie, bcrypt password hashes, forced first-login
  password change.

The repository contains two independent packages. There is no workspace root,
so install and run commands separately in `client/` and `server/`.

## Repository Structure

```text
toktickit/
├── client/
│   ├── src/                    React screens, roles, API client, Zen styles
│   ├── tests/
│   │   ├── lab-01/             early app tests
│   │   ├── lab-02/             requester flow tests
│   │   ├── lab-03/             auth, queue, detail, admin tests
│   │   ├── lab-04/             actions, workflow, dashboard component tests
│   │   └── e2e/                Playwright specs and deterministic fixtures
│   ├── playwright.config.ts
│   └── vite.config.ts
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/                    Express app, routes, controllers, middleware
│   └── tests/                  Lab 1–4 API and regression suites
├── docs/
│   ├── lab-01/ ... lab-03/
│   └── lab-04/                 specification, API/UI specs, tests, review, AI use
├── artifacts/
│   └── lab-04/screenshots/     responsive evidence
├── AGENTS.md
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- PostgreSQL 14 or newer
- npm

## Setup

### 1. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Configure the server

Copy `server/.env.example` to `server/.env` and set a PostgreSQL connection
string and a session secret:

```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
PORT=3000
SESSION_SECRET="change-me-to-a-long-random-string-min-16-chars"
```

Create the database before running migrations.

### 3. Migrate and seed

```bash
cd server
npx prisma migrate dev
npm run prisma:seed
```

The seed is idempotent. It creates users, categories, related systems, and
sample tickets.

### 4. Run the application

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

- Client: http://127.0.0.1:5173
- API: http://localhost:3000
- Vite proxies `/api` requests to the backend.

## Local Test Accounts

All seeded accounts use the initial password `Password123!` unless a previous
password change was completed.

| Role | Email | Password change at login |
| --- | --- | --- |
| Administrator | admin@company.com | Not required |
| IT Staff | staff1@company.com | Not required |
| Requester | alice@company.com | Not required |
| IT Staff | staff2@company.com | Required |
| Requester | brandon@company.com | Required |

Other seeded users follow the same rule. Accounts with `isActive = false`
cannot sign in. These credentials are for local development only.

## Main Flows

- **Requester:** dashboard, create ticket, my tickets, ticket detail, public
  comments, advisory resolution signal, read-only Actions Taken timeline.
- **IT Staff:** dashboard, shared queue with search/filter/sort/pagination,
  ticket ownership and IT Priority, status workflow, public comments, internal
  notes, Actions Taken create/edit, resolution gate.
- **Administrator:** user management plus staff-area access.

The resolution gate blocks changing a ticket to `Resolved` until at least one
Action Taken is recorded. A requester's "Indicate Issue is Resolved" signal is
advisory and never changes the authoritative ticket status.

## Commands

Run commands from the indicated package.

### Server

```bash
cd server
npm run dev              # tsx watch src/index.ts
npm run test             # vitest run; requires PostgreSQL
npm run build            # tsc
npm run start            # run compiled dist/index.js
npm run prisma:migrate   # prisma migrate dev
npm run prisma:seed      # tsx prisma/seed.ts
```

### Client

```bash
cd client
npm run dev              # Vite dev server on port 5173
npm run test             # Vitest, excludes e2e/
npm run build            # tsc && vite build
```

### End-to-end

```bash
cd client
npx playwright test tests/e2e/lab-04
npx playwright test
```

The Lab 4 specs mock `/api/**` with shared in-memory fixtures, so they do not
depend on randomized seed rows. Playwright starts or reuses the Vite dev server
at `127.0.0.1:5173`. The responsive test writes screenshots to
`artifacts/lab-04/screenshots/`.

## Verified Results (2026-10-31)

| Check | Command | Result |
| --- | --- | --- |
| Server tests | `npm run test` in `server/` | 13 files, 131 tests passing |
| Client tests | `npm run test` in `client/` | 11 files, 99 tests passing |
| Lab 4 E2E | `npx playwright test tests/e2e/lab-04` | 9 tests passing |
| Full E2E regression | `npx playwright test` in `client/` | 64 tests passing |
| Server build | `npm run build` in `server/` | Passing |
| Client build | `npm run build` in `client/` | Passing |

See `docs/lab-04/tests.md` for the test inventory and traceability notes.

## Documentation

- `docs/lab-04/specification.md` — requirements, business rules, acceptance
  criteria.
- `docs/lab-04/api-spec.md` — API contract.
- `docs/lab-04/ui-spec.md` — UI and responsive rules.
- `docs/lab-04/tests.md` — test plan and final results.
- `docs/lab-04/reviewer.md` — peer-review evidence.
- `docs/lab-04/ai-use.md` — AI prompts, verification, and reflection.

## Notes and Limitations

- Dashboard data is fetched on demand; there is no real-time push.
- Action Taken records use a follow-up model (`followUpRequired`,
  `followUpNote`); there is no separate action-status lifecycle.
- Lab 4 E2E tests use browser-level API mocks. Server behavior is covered by the
  Supertest integration suites.
- `.env` files are gitignored. Never commit real credentials or session secrets.
