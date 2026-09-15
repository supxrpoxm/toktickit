# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Replace the temporary Lab 2 Development Requester selector with real email/password
authentication and server-enforced role-based authorization, deliver the first operational
IT Staff Ticket Queue and Ticket Detail workflow (ownership, IT Priority, status workflow,
Public Comments, Internal Notes), deliver a minimalist Administrator User Management screen,
and preserve all Lab 2 Requester ticket and attachment behavior under the authenticated
identity without data loss.

## 2. Stakeholder Request Interpretation

The stakeholder wants the prototype selector removed and replaced by secure login with
three roles (Requester, IT Staff, Administrator). Requesters keep the Lab 2 ticket
experience but are now identified by their login. IT Staff get a shared queue to find work
and a detail screen to own, prioritize, advance, and discuss tickets. Requesters can join
the discussion via Public Comments and signal that a problem looks resolved, but only
IT Staff formally resolve or close. Administrators get one intentionally simple screen to
manage accounts (list, search, create, edit, activate/deactivate, issue an initial password
that forces a change at next login). Every screen and API must enforce role and ownership
on the server; hiding buttons is feedback, not security. The Zen Green design language
from Lab 2 must be reused, not replaced.

## 3. Scope

### 3.1 Included

- Authentication: login with email + password, logout, current-user retrieval, mandatory
  first-login (initial-password) change, session handling suitable for the Express + Vite
  course stack.
- Authorization: server-side role checks for Requester, IT Staff, Administrator on every
  protected API and screen; role-specific navigation; forbidden responses that do not leak
  protected data.
- Migration: evolve Lab 2 `Requester` records into a real `User` model, keep existing
  Tickets, Attachments, Categories, and Related Systems valid, remove the Development
  Requester selector and its client-side state (`toktickit.requesterId`).
- Requester regression: create ticket, My Tickets (search, filter, sort, pagination),
  ticket detail, attachment upload/download/soft-removal, ownership protection — all now
  driven by the authenticated identity.
- IT Staff Ticket Queue: shared list with search, filters, sorting, pagination, ownership
  and badge information, open-detail action, loading/empty/no-results/forbidden/failure
  states, responsive table-to-card behavior.
- IT Staff Ticket Detail: claim/assign/reassign owner, set IT Priority, permitted status
  transitions with confirmations, Public Comments, Internal Notes, existing attachment
  continuity, Requester "problem appears resolved" indication, role-specific editability.
- Public Comments and Internal Notes: append-only create + retrieve, author and timestamp
  from backend, validation, safe rendering, visibility separation.
- Minimalist Administrator User Management: user list (Name, Email, Role, Status, Edit),
  search by name or email, optional single role filter, create user with one role and an
  initial password, edit name/email/role/activation, set a new initial password, duplicate
  email and safety-rule enforcement, responsive Zen Green presentation.
- Data, API, UI, test, and seed increments described in Sections 7–10 and in
  `api-spec.md`, `ui-spec.md`, `tests.md`.

### 3.2 Explicitly Excluded

Per Lab 3 §4.2, the following are out of scope and must not be implemented:

- Email invitations, password-reset email, multi-factor authentication, social login,
  single sign-on; email delivery of initial passwords or reset links.
- Self-registration and Requester-created accounts.
- Actions Taken by IT Staff (including any "block resolution while Actions Taken are
  incomplete" rule — deferred to Lab 4).
- Formal SLA calculation, escalation rules, notification services.
- Dashboards and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, customer administration; department,
  organization, profile-photo, or other extended profile management.
- Production-grade deployment or cloud infrastructure changes.
- Multiple roles per user; user deletion; bulk user operations; user import/export;
  account-history screens; role history or account audit history.
- Account unlocking, administrator approval workflows, advanced identity management.
- Advanced user-list features: mandatory pagination, multi-column sorting, multiple
  simultaneous filters (the Lab 3 list requires only search + one optional role filter).

## 4. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | The system shall authenticate a user with email address and password and establish an authenticated session. |
| FR-02 | The system shall force a user whose account has an initial password (`mustChangePassword = true`) to set a new valid password before entering the normal application. |
| FR-03 | The system shall provide logout that destroys authenticated access and a current-user endpoint/screen state that reflects the logged-in identity and role. |
| FR-04 | The system shall show only role-permitted navigation and actions, and shall enforce every protected operation on the backend regardless of UI state. |
| FR-05 | The system shall preserve all Lab 2 Requester functions (create, My Tickets with search/filter/sort/pagination, detail, attachment upload/download/soft-removal) using the authenticated Requester identity, with the Development Requester selector and Change Requester action removed. |
| FR-06 | The system shall provide an IT Staff Ticket Queue with search, suitable filters, sorting, pagination, ownership/status/priority display, and an open-detail action. |
| FR-07 | The system shall allow permitted roles to claim (self-assign), assign, or reassign the single primary Ticket Owner to an active IT Staff or Administrator user, or leave the ticket unassigned. |
| FR-08 | The system shall support Requested Priority (Requester-supplied, immutable) and IT Priority (initially copied from Requested Priority, editable only by IT Staff/Administrator). |
| FR-09 | The system shall enforce the permitted status-transition matrix (New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled) by role, with validation and required confirmations for destructive transitions. |
| FR-10 | The system shall allow Requester, IT Staff, and Administrator to create and read Public Comments on tickets they are authorized to access. |
| FR-11 | The system shall allow only IT Staff and Administrator to create and read Internal Notes; Requesters must be rejected without note content being exposed. |
| FR-12 | The system shall allow the owning Requester to indicate "problem appears resolved" without changing the formal ticket status; only IT Staff may set Resolved or Closed. |
| FR-13 | The system shall provide an Administrator user list showing Name, Email, Role, Status, and Edit action, with search by name or email and one optional role filter. |
| FR-14 | The system shall allow an Administrator to create a user with name, email, one permitted role, activation state, and an initial password that forces a change at next login. |
| FR-15 | The system shall allow an Administrator to edit a user's name, email, role, and activation state, and to set a new initial password, subject to duplicate-email and Administrator safety rules. |
| FR-16 | The system shall migrate Lab 2 Development Requester records into the real User model, re-link existing ticket ownership, issue initial passwords, and remove selector state without data loss. |

## 5. Business Rules

### 5.1 Authentication, passwords, and sessions

- **BR-01 — Valid active credentials only.** Only a user with `isActive = true` and a
  correct email/password pair may authenticate. Unknown emails and wrong passwords
  produce the same safe generic error (AC-02) so attackers cannot enumerate accounts.
- **BR-02 — Mandatory password change gate.** A user with `mustChangePassword = true`
  (initial password) cannot enter any normal application screen or call normal
  application APIs until a new valid password is saved. Login succeeds at the credential
  step but the server and client force a redirect to the Change Password screen (AC-04).
- **BR-03 — Authenticated identity wins.** The backend derives ownership and permission
  from the authenticated session, never from a client-supplied `requesterId`, `userId`,
  or `ownerId`. Spoofed identity fields are ignored (AC-07).
- **BR-04 — Comment visibility separation.** Public Comments are visible to Requester,
  IT Staff, and Administrator (on tickets they may access). Internal Notes are visible
  only to IT Staff and Administrator. A Requester requesting Internal Notes receives a
  forbidden response with no note content (AC-09, AC-18).
- **BR-05 — Requester cannot formally resolve.** A Requester may set the
  `requesterResolved` indication flag but cannot set status to Resolved or Closed.
  Formal resolution/closure is an IT Staff (or explicitly permitted Administrator)
  operation (AC-16, AC-20).
- **BR-06 — Password handling.** Passwords are never stored in plaintext; they are stored
  as a salted hash (bcrypt or an approved equivalent). New passwords must satisfy the
  documented rules (minimum 8 characters, at least one letter and one number;
  maximum 128 characters; confirmation must match). The initial password is checked
  against the hash, not compared as plaintext, and the plaintext initial password is
  never returned by any API after creation (AC-05).
- **BR-07 — Safe login errors and inactive accounts.** Invalid credentials return HTTP
  401 with a generic message. Inactive accounts return a clear "account inactive, contact
  administrator" message without revealing whether the password was correct and without
  establishing a session (AC-03).
- **BR-08 — Logout and post-logout blocking.** Logout destroys the server session/token
  and clears the client credential (cookie + in-memory user). After logout, protected
  screens redirect to Login and protected APIs return 401, including for direct-URL
  access (AC-06).
- **BR-09 — Duplicate email prevention.** Email addresses are unique case-insensitively.
  Create and update operations that would duplicate an existing email are rejected with
  HTTP 409 and a field-level message (AC-24).
- **BR-10 — One role per user.** Each user has exactly one of `Requester`, `IT Staff`,
  `Administrator`. Any other or multiple role value is rejected with HTTP 400 (AC-25).
- **BR-11 — Deactivation, not deletion.** Users are never deleted. Removal is
  deactivation (`isActive = false`). Deactivated users cannot log in, cannot be assigned
  as ticket owners, and are hidden from Requester flows (AC-23–AC-28).
- **BR-12 — No self-deactivation.** An Administrator cannot deactivate their own account.
  The request is rejected with HTTP 400/403 and a clear message (AC-27).
- **BR-13 — Last active Administrator protection.** The system must always retain at
  least one active Administrator. Deactivating or demoting the last active Administrator
  is rejected (AC-28).
- **BR-14 — New initial password forces change.** Creating a user or setting a new
  initial password sets `mustChangePassword = true`. The affected user must complete
  the Change Password flow at next login before normal access (AC-23, AC-26).

### 5.2 Ticket ownership, priority, and status

- **BR-15 — Single owner, qualified assignee.** Each ticket has zero or one primary
  Ticket Owner. The owner, when set, must be an active user with role IT Staff or
  Administrator (per the approved authorization matrix). Assignment to Requesters,
  inactive users, or unknown users is rejected. A ticket may start unassigned (AC-13).
- **BR-16 — Priority separation.** `requestedPriority` is set by the Requester at
  creation and is immutable afterwards. `itPriority` is initialized as a copy of
  `requestedPriority` at creation and may later be changed only by IT Staff or
  Administrator (AC-14).
- **BR-17 — Status-transition matrix.** Only the transitions below are permitted, and
  only by the listed roles. All other transitions are rejected with HTTP 400/422.
  Destructive transitions require explicit UI confirmation:

  | From → To | Permitted roles | Confirmation |
  |---|---|---|
  | New → Open, Cancelled | IT Staff, Administrator | Cancelled requires confirmation |
  | Open → In Progress, Waiting for Requester, Cancelled | IT Staff, Administrator | Cancelled requires confirmation |
  | In Progress → Waiting for Requester, Resolved, Cancelled | IT Staff, Administrator | Cancelled requires confirmation |
  | Waiting for Requester → In Progress, Resolved, Cancelled | IT Staff, Administrator | Cancelled requires confirmation |
  | Resolved → Closed, Reopened | IT Staff, Administrator | Closed requires confirmation |
  | Closed → Reopened | IT Staff, Administrator | Reopened requires confirmation + reason optional |
  | Cancelled → Reopened | IT Staff, Administrator | Reopened requires confirmation |
  | Any → New (backwards reset) | — (forbidden) | — |

  Requesters have no status-write permission in Lab 3. Initial status for a newly
  created ticket is `New` (this supersedes the Lab 2 `Open` default for new tickets;
  migrated Lab 2 tickets keep their stored statuses). (AC-15, AC-16).
- **BR-18 — No Actions-Taken gate in Lab 3.** Because Actions Taken are excluded from
  Lab 3, resolution must not be blocked by an incomplete-Actions-Taken rule. That rule
  is deferred to Lab 4 (AC-15).

### 5.3 Comments, notes, and Requester signal

- **BR-19 — Append-only communication.** Public Comments and Internal Notes support
  create and retrieve only. Edit and delete endpoints are excluded in Lab 3. Each entry
  records `authorId` and `createdAt` from the backend (client values ignored). Empty or
  whitespace-only content is rejected (400). Length is limited to 2000 characters with
  justification (readable discussion without unbounded rows). Content is rendered as
  plain text (HTML escaped) to prevent script injection (AC-17–AC-19).
- **BR-20 — Resolved indication is a flag.** The Requester's "problem appears resolved"
  action sets `requesterResolved = true` (plus timestamp) and does not change `status`.
  It is visible to IT Staff as a signal. Only IT Staff may then set Resolved/Closed
  (AC-20).

### 5.4 Ownership protection, queries, failures, regression

- **BR-21 — Lab 2 ownership preserved.** All Lab 2 Ticket and Attachment endpoints keep
  their ownership checks, now keyed to the authenticated Requester identity. A Requester
  requesting another Requester's ticket or attachment receives 403/404-safe handling
  with no data disclosure (AC-07, AC-10).
- **BR-22 — Queue query safety.** Unknown or out-of-range queue parameters never cause
  HTTP 500; they fall back to documented defaults. Search/filter is applied before
  pagination. Sort is deterministic (secondary sort by `id asc`). Pagination metadata
  (`page`, `limit`, `total`, `totalPages`) is always returned (AC-12).
- **BR-23 — Failure safety.** All APIs return safe, generic messages for unexpected
  errors without stack traces, SQL details, or secrets. The UI preserves user-entered
  form content on failure and offers retry where meaningful. Lab 2 attachment rules
  (JPG/JPEG, PNG, WEBP, PDF; 5 MB per file; max 5 active per ticket; soft removal;
  removed files not downloadable) remain in force (AC-10, AC-30).
- **BR-24 — Regression and selector removal.** Existing Categories, Related Systems,
  Tickets, and Attachments remain valid after migration. The Development Requester
  selector screen, Change Requester action, and `toktickit.requesterId` localStorage
  state are removed; any stale value is ignored (AC-10, AC-30).
- **BR-25 — Session and secret hygiene.** Authentication uses an httpOnly session cookie
  (SameSite=Lax; Secure in production; 8-hour expiry; server-side invalidation on
  logout). No password, hash, or token secret is exposed to client code or committed to
  the repository; seeded credentials are local-development only (AC-01, AC-06, AC-30).

### 5.5 Authorization matrix (normative)

Backend enforcement is mandatory. Frontend hiding is feedback only.

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Login, logout, get current user, change own password | ✅ | ✅ | ✅ |
| Create ticket; list/view own tickets; manage own attachments | ✅ (own only) | ❌ (see Staff row) | ❌ (see Admin note) |
| IT Staff Ticket Queue list; open any ticket detail (Staff view) | ❌ | ✅ | ➖ (only if matrix explicitly permits; default ❌) |
| Claim/assign/reassign owner; set IT Priority; permitted status changes | ❌ | ✅ | ➖ (default ❌ unless explicitly permitted) |
| Create/read Public Comments (on accessible tickets) | ✅ | ✅ | ✅ (on accessible tickets) |
| Create/read Internal Notes | ❌ (403, no content) | ✅ | ✅ |
| Requester "problem appears resolved" flag | ✅ (own tickets) | ❌ (reads flag) | ❌ |
| Admin user list/search/filter; create/edit/activate/set-password | ❌ (403) | ❌ (403) | ✅ |
| Deactivate self; remove last active Administrator | ❌ | ❌ | ❌ (always rejected) |

Note: per Lab 3 §4.3, Administrator and IT Staff duties stay conceptually separate.
The default contract does **not** grant Administrators IT Staff ticket powers. If a team
explicitly extends the matrix to permit it, that decision must be recorded in
Section 11 and covered by tests.

## 6. UI Specification Summary

Lab 3 reuses the Lab 2 Zen Green system (tokens, form conventions, cards, badges,
buttons, validation placement, responsive rules, accessibility expectations) and adds
role-aware shell behavior plus four new/changed screen areas. Full detail is in
`ui-spec.md`.

- **Application shell:** replaces the Development Requester display with the
  authenticated user's name + role badge; role-specific navigation (Requester: My
  Tickets, Create Ticket; IT Staff: Ticket Queue; Administrator: User Management);
  unauthorized destinations are never presented; Logout plus Change-Password action;
  visible focus states; desktop/tablet/mobile layouts per Lab 2 breakpoints
  (≥992 / 768–991 / <768).
- **Login + Change Password:** email/password form with validation, busy state, safe
  failure feedback; inactive-account message; forced Change Password screen with rules,
  confirmation, success continuation; post-logout direct-access blocking.
- **Requester screens (regression):** Lab 2 layouts preserved; selector removed; Ticket
  Detail adds Public Comments thread + "Problem appears resolved" action; Internal Notes
  are never rendered for Requesters.
- **IT Staff Ticket Queue:** search, status/priority/ownership/category filters, sorting,
  pagination, Ticket Number/Summary/Category/priorities/status/owner/updated columns
  (justified subset, no mega-grid), open-detail action, loading/empty/no-results/
  forbidden/failure states, responsive table→card switch.
- **IT Staff Ticket Detail:** grouped read-only ticket context + editable operational
  fields (owner, IT Priority, status with confirmations), visually distinct Public vs
  Internal threads, attachment continuity, validation + safe failure feedback.
- **Administrator User Management:** single screen with user list (Name, Email, Role,
  Status, Edit), name/email search, optional single role filter, create/edit dialogs,
  initial-password handling, duplicate/safety-rule messages, forbidden + failure states.
- **Feedback coverage:** every screen defines initial, loading/saving, validation,
  success, empty/no-results, forbidden, not-found, conflict, and safe-failure states with
  tests (see `tests.md` and `ui-spec.md` §6).

## 7. Data Changes

### 7.1 New `User` model (replaces `Requester` for identity)

```prisma
enum Role { Requester, ITStaff, Administrator }  // stored as "IT Staff" label in UI

model User {
  id                  Int       @id @default(autoincrement())
  name                String
  email               String    @unique
  passwordHash        String    // bcrypt hash; never returned by any API
  role                Role      @default(Requester)
  isActive            Boolean   @default(true)
  mustChangePassword  Boolean   @default(true)  // true for seeded/initial passwords
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  ownedTickets        Ticket[]  @relation("TicketOwner")
  submittedTickets    Ticket[]  @relation("TicketRequester")
  comments            PublicComment[]
  notes               InternalNote[]
}
```

- Email uniqueness is enforced case-insensitively (unique index on `lower(email)`;
  application-level normalization plus a 409 guard).
- Indexes: `@@index([role])`, `@@index([isActive])` for the admin list search/filter.
- The Lab 2 `Requester` table is migrated into `User` (see §7.5); no parallel identity
  tables remain after migration.

### 7.2 `Ticket` delta

- `requesterId` is re-pointed from `Requester.id` to `User.id` (role should be
  Requester for new tickets; legacy rows are mapped by email).
- New `ownerId Int?` → `User.id` (nullable; relation `TicketOwner`); `@@index([ownerId])`.
- New `itPriority Priority?` (nullable at DB level; application initializes from
  `requestedPriority` at creation; only Staff/Admin may update).
- `requestedPriority`: the existing `priority` column is renamed/aliased to
  `requestedPriority` (immutable after creation).
- `status` expands from free-text Lab 2 values to the 8-value Lab 3 set
  (`New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened,
  Cancelled`); existing `Open/In Progress/Resolved/Closed` rows map as-is; any legacy
  value outside the set is mapped to `Open` and logged in the migration report.
- New `requesterResolved Boolean @default(false)` + `requesterResolvedAt DateTime?`.
- New indexes: `@@index([status])`, `@@index([itPriority])`,
  `@@index([requesterId, status])`, `@@index([ownerId, status])`,
  `@@index([updatedAt])` to support queue ordering and filters.
- Justification: queue filters sort by `status`, `itPriority`, `ownerId`, and
  `updatedAt` on every page load; without composite indexes the shared queue degrades
  as ticket volume grows. Single-column indexes on `role`/`isActive` keep the
  minimalist admin list fast without the cost of full pagination infrastructure.

### 7.3 `PublicComment` and `InternalNote` (new, append-only)

```prisma
model PublicComment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  authorId  Int
  body      String   // max 2000 chars, enforced backend + frontend
  createdAt DateTime @default(now())
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])
  @@index([ticketId, createdAt])
}

model InternalNote {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  authorId  Int
  body      String   // max 2000 chars
  createdAt DateTime @default(now())
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])
  @@index([ticketId, createdAt])
}
```

No `updatedAt`, no soft-delete flag: append-only is structural, not conventional.

### 7.4 Unchanged (Lab 2 continuity)

`Category`, `RelatedSystem`, `Attachment` (including 5-file / 5 MB / soft-removal via
`deletedAt` semantics) are unchanged except for foreign-key re-pointing where they
referenced `Requester`.

### 7.5 Migration strategy

1. Create `User`, `PublicComment`, `InternalNote`; add `Ticket.ownerId`,
   `itPriority`, `requesterResolved` columns as nullable.
2. Data migration (single transaction per batch): for each Lab 2 `Requester`, create a
   `User` with the same name/email/`isActive`, role `Requester`, a seeded initial
   password hash (documented local-only credential), and `mustChangePassword = true`.
   Re-link `Ticket.requesterId` by email join. Set `Ticket.itPriority = requestedPriority`.
3. Backfill new statuses (only where needed), create Staff/Admin seed users, seed
   representative tickets/comments/notes (see §7.6).
4. Validate: row counts match, every ticket has a valid requester, no plaintext
   passwords exist, selector-era `requesterId` query params are ignored by new code.
5. Drop the `Requester` table (or retain as a read-only view for one release if the team
   needs rollback — decision recorded in Section 11).
6. Migration is covered by automated migration/regression tests (see `tests.md`
   MIG-01–MIG-04) and must be idempotent for seeds.

### 7.6 Seed decisions (idempotent upserts, local-only credentials)

- At least 4 active Requester accounts + 1 inactive Requester (migrated from Lab 2
  identities where emails match; e.g. Alice, Brandon, Carmen, Darius active; Evelyn
  inactive).
- At least 3 active IT Staff + 1 inactive IT Staff (new, e.g. `staff1–3@company.com`
  active, `staff.off@company.com` inactive).
- At least 1 active Administrator (e.g. `admin@company.com`).
- Realistic tickets spread across Requesters, all 8 statuses, both assigned and
  unassigned ownership, mixed Requested/IT priorities.
- Example Public Comments and Internal Notes containing no sensitive data.
- All seeded accounts use documented local-only initial passwords (e.g.
  `Password123!` pattern or per-role documented values) with `mustChangePassword = true`
  except where a test needs a non-forced account; no real personal passwords in the repo.

## 8. API Contract Summary

Authentication is cookie-session based (httpOnly, SameSite=Lax); all protected routes
require it. Authorization follows the matrix in §5.5. Error shape is stable JSON with
safe messages. Full paths, shapes, validation, and status codes are in `api-spec.md`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password` (initial + voluntary) |
| Requester regression (authenticated) | `GET /api/categories`, `GET /api/related-systems`, `POST /api/tickets`, `GET /api/tickets` (own list + search/filter/sort/pagination), `GET /api/tickets/:id` (own), attachment upload/metadata/download/soft-remove (own) |
| IT Staff queue | `GET /api/staff/tickets?search=&status=&itPriority=&owner=&categoryId=&sort=&page=&limit=` |
| IT Staff ticket operations | `GET /api/staff/tickets/:id`, `PATCH /api/staff/tickets/:id/owner` (claim/assign/reassign), `PATCH /api/staff/tickets/:id/priority` (IT Priority), `PATCH /api/staff/tickets/:id/status`, `POST /api/staff/tickets/:id/resolved-signal` (Requester flag; also `POST /api/tickets/:id/resolved-signal` for Requesters) |
| Comments / notes | `GET+POST /api/staff/tickets/:id/comments` (public; Requester equivalent under `/api/tickets/:id/comments`), `GET+POST /api/staff/tickets/:id/notes` (Staff/Admin only) |
| Admin user management | `GET /api/admin/users?search=&role=`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/set-password` |

Expected statuses: `200` retrieval/update, `201` creation, `400` validation,
`401` unauthenticated (including must-change-password gate as `403 PASSWORD_CHANGE_REQUIRED`
where applicable), `403` forbidden (including Requester→notes and non-admin→admin),
`404` missing (ownership-safe: cross-owner ticket access returns 403/404 without
disclosing existence — the contract fixes 403 for ownership violations and 404 for
truly missing ids), `409` duplicate email / last-admin conflict, `500` safe generic error.

## 9. Acceptance Criteria

### Authentication and password change

- **AC-01 — Valid login.** Given an active user with valid credentials, when the user
  logs in, then the backend establishes authenticated access and returns the permitted
  safe user identity and role (no hash, no secrets). Trace: FR-01, BR-01.
- **AC-02 — Invalid credentials.** Given an unknown email or wrong password, when login
  is attempted, then the server returns HTTP 401 with the same generic message for both
  cases and establishes no session. Trace: FR-01, BR-01.
- **AC-03 — Inactive account.** Given an inactive user, when login is attempted with any
  password, then the server refuses with a clear inactive-account message and
  establishes no session. Trace: FR-01, BR-07.
- **AC-04 — Mandatory password gate.** Given a user with an initial password
  (`mustChangePassword = true`), when login succeeds, then normal application screens
  and APIs remain unavailable until a valid new password is saved; the client routes to
  Change Password. Trace: FR-02, BR-02.
- **AC-05 — Password-change validation.** Given the Change Password screen, when the
  user submits a weak, mismatched, or too-long password, then the request is rejected
  with field-level messages; when a valid matching password is submitted, then the hash
  is updated, the flag is cleared, and the user continues into the role-appropriate app.
  Trace: FR-02, BR-06.
- **AC-06 — Logout and post-logout blocking.** Given an authenticated user, when logout
  is performed, then the session is destroyed; afterwards, protected screens redirect to
  Login and protected APIs return 401, including for direct-URL access. Trace: FR-03,
  BR-08.

### Authorization and regression

- **AC-07 — Authenticated identity enforced.** Given an authenticated Requester, when the
  client supplies another `requesterId`/`userId`, then the backend ignores it and applies
  only the session identity; no other Requester's data is returned. Trace: FR-04, BR-03.
- **AC-08 — Role navigation and server rejection.** Given each role, when the app loads,
  then only permitted destinations are shown; when a forbidden endpoint is called
  directly (e.g. Requester → admin list, Requester → queue), then the server returns 403
  with no protected payload. Trace: FR-04, §5.5.
- **AC-09 — Internal Notes forbidden for Requesters.** Given a Requester account, when an
  Internal Note endpoint is requested, then the operation is rejected (403) without
  exposing note content. Trace: FR-11, BR-04.
- **AC-10 — Requester regression.** Given authenticated Requesters, when Lab 2 flows are
  exercised (create, My Tickets search/filter/sort/pagination, detail, attachments with
  5-file/5 MB/soft-removal rules), then they behave as in Lab 2 with ownership enforced;
  the selector and Change Requester action are absent. Trace: FR-05, BR-21, BR-23, BR-24.

### IT Staff queue and ticket operations

- **AC-11 — Queue search.** Given tickets with distinct summaries, when IT Staff searches
  the queue, then only matching tickets are returned. Trace: FR-06.
- **AC-12 — Queue filters, sort, pagination.** Given a populated queue, when IT Staff
  combines status/priority/ownership/category filters with sorting and pagination, then
  the correct subset in the requested order with accurate pagination metadata is
  returned; invalid query values fall back to defaults without errors. Trace: FR-06, BR-22.
- **AC-13 — Ownership claim/assign/reassign.** Given a ticket, when permitted Staff
  claims it, assigns it to another active Staff/Admin, or reassigns it, then the owner
  is updated; assignment to Requesters, inactive, or unknown users is rejected. Trace:
  FR-07, BR-15.
- **AC-14 — IT Priority update.** Given a ticket, when IT Staff/Admin sets a valid IT
  Priority, then it is saved; when a Requester attempts it, then the request is rejected;
  `requestedPriority` never changes. Trace: FR-08, BR-16.
- **AC-15 — Status transitions.** Given a ticket in any status, when a permitted
  transition is requested by Staff, then it succeeds (with confirmation for
  Cancelled/Closed/Reopened); when a forbidden transition is requested, then it is
  rejected with a clear message. Trace: FR-09, BR-17, BR-18.
- **AC-16 — Requester cannot Resolve/Close.** Given a Requester, when setting status to
  Resolved or Closed is attempted via UI or direct API, then the operation is rejected.
  Trace: FR-09, BR-05, BR-17.

### Comments, notes, resolved signal

- **AC-17 — Public Comments.** Given an accessible ticket, when any of Requester
  (owner), IT Staff, or Administrator posts valid public content, then it is saved with
  backend author/time and visible to all three roles; empty/overlong content is rejected.
  Trace: FR-10, BR-19.
- **AC-18 — Internal Notes visibility.** Given a ticket, when Staff/Admin posts or reads
  notes, then it succeeds; when a Requester attempts either, then it is rejected without
  content. Trace: FR-11, BR-04, BR-19.
- **AC-19 — Append-only.** Given existing comments/notes, when edit or delete is
  attempted, then no such endpoint exists / the operation is rejected; history is
  preserved. Trace: BR-19.
- **AC-20 — Resolved indication.** Given an owned ticket, when the Requester signals
  "problem appears resolved", then the flag (not the status) is set and visible to Staff;
  the ticket still requires Staff to Resolve/Close. Trace: FR-12, BR-20.

### Administrator user management

- **AC-21 — User list and search.** Given an Administrator, when the user list is opened
  and a name/email search is entered, then matching users are shown with Name, Email,
  Role, Status, and Edit. Trace: FR-13.
- **AC-22 — Role filter.** Given the user list, when a single role filter is applied,
  then only users with that role are shown; clearing restores the full list. Trace: FR-13.
- **AC-23 — Create user.** Given valid name/email/one role/activation/initial password,
  when an Administrator creates a user, then the account is created with
  `mustChangePassword = true` and appears in the list. Trace: FR-14, BR-10, BR-14.
- **AC-24 — Duplicate email rejected.** Given an existing email (any case), when
  creating or renaming to it, then the server returns 409 with a field-level message and
  creates/updates nothing. Trace: BR-09.
- **AC-25 — Edit user.** Given a user, when an Administrator edits name/email/role/
  activation with valid values, then the changes persist; invalid role values are
  rejected. Trace: FR-15, BR-10.
- **AC-26 — New initial password.** Given a user, when an Administrator sets a new
  initial password, then the account requires a password change at next login. Trace:
  FR-15, BR-14.
- **AC-27 — Self-deactivation blocked.** Given the logged-in Administrator, when
  deactivating their own account is attempted, then it is rejected and the account stays
  active. Trace: BR-12.
- **AC-28 — Last active Administrator protected.** Given the system has one remaining
  active Administrator, when deactivating or demoting them is attempted, then it is
  rejected. Trace: BR-13.
- **AC-29 — Non-Administrator forbidden.** Given a Requester or IT Staff account, when
  any admin endpoint or the User Management screen is requested, then access is rejected
  (403 / forbidden screen) with no user data exposed. Trace: FR-04, §5.5.

### Migration, safety, presentation

- **AC-30 — Migration and safe presentation.** Given the Lab 2 dataset, when migration
  and seed run, then all Lab 2 tickets remain retrievable with correct ownership,
  seeded Staff/Admin/comment/note data exists, the selector is gone, APIs return safe
  errors without secrets, and all required screens meet loading/empty/forbidden/failure
  and responsive (desktop/tablet/mobile) expectations. Trace: FR-16, BR-22–BR-25,
  `ui-spec.md`.

## 10. Product Definition of Done

The AI coding agent may report completion only when all of the following hold on the
final `main` branch:

- [ ] All scope in §3.1 is implemented; nothing in §3.2 was added.
- [ ] Every AC in §9 is satisfied and linked to passing test evidence in `tests.md`.
- [ ] No planned test is skipped, disabled, or commented out; unit, API/integration, UI
  component, UI style, responsive, security/authorization, migration/regression, and E2E
  suites all pass from documented commands.
- [ ] Backend enforces the authorization matrix (§5.5) and BR-01–BR-25; direct-API
  authorization tests prove hidden buttons were not relied upon.
- [ ] Passwords are hashed; no plaintext password, hash, or secret is in client code,
  logs, or the repo; seeded credentials are documented as local-only.
- [ ] Migration preserves Lab 2 data (row counts, ownership, attachments) and is covered
  by automated migration tests; the Development Requester selector and its storage key
  are fully removed.
- [ ] Screens and APIs conform to `api-spec.md` and `ui-spec.md` (Zen Green tokens,
  badges, validation placement, button hierarchy, responsive breakpoints, feedback
  states, accessibility: labels, focus, keyboard paths, non-color indicators).
- [ ] Safe-error behavior verified: no stack traces, SQL, hashes, or note/user content
  leaks in any failure, forbidden, or not-found path.
- [ ] README setup, seed credentials, test commands, and rollback notes are current.
- [ ] Peer review completed through the required staging flow with approvals and
  responses recorded (course delivery evidence stays in `reviewer.md`, not here).

## 11. Assumptions and Decisions

1. **Session mechanism:** httpOnly cookie session (opaque session id or signed JWT in
   httpOnly cookie; SameSite=Lax; Secure in production; 8-hour idle expiry). Chosen over
   localStorage tokens because it keeps credentials out of JavaScript and works with the
   existing Vite `/api` proxy. CSRF risk is mitigated by SameSite + no state-changing
   GETs; a CSRF token is added only if the chosen server framework requires it.
2. **Status vocabulary:** the 8 Lab 3 statuses are stored as written (`New`, `Open`,
   `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`,
   `Cancelled`). New tickets start at `New` (not Lab 2's `Open`); this intentional
   change gives Staff an explicit triage step and is recorded here so regression tests
   assert the new default while migration tests assert legacy values are preserved.
3. **Priority vocabulary:** `Low/Medium/High` (existing Prisma enum) is retained for both
   Requested and IT Priority. An `Urgent` level was considered but rejected to avoid an
   enum migration with no stakeholder mandate.
4. **Administrator ticket powers:** default is deny (matrix §5.5). Any extension must be
   proposed, recorded here, and tested — it is not assumed.
5. **User-list scale:** no server pagination for the admin list (per exclusion); if the
   user table grows beyond comfortable single-page rendering, the follow-up is a new
   sprint, not silent Lab 3 scope creep.
6. **Comment length:** 2000 characters for both threads — long enough for real
   troubleshooting, short enough to keep queue/detail queries and mobile rendering safe.
7. **Seed credential convention:** all seeded accounts share a documented local-only
   initial password pattern (e.g. `Password123!`) with `mustChangePassword = true`,
   except one pre-changed account per role for E2E speed. This is development data only.
