# Lab 4 Sprint Engineering Specification

**Sprint 4 — Actions Taken, Progress Dashboards, and Resolution Integrity**

Status: Implementation contract for Sprint 4. This document extends the Lab 3
contract; all Lab 3 behavior remains in force unless explicitly changed here.

## 1. Sprint Goal

Deliver requester-visible progress tracking through **Actions Taken**, provide
role-scoped **IT Staff** and **Requester Dashboards**, enforce the resolution
rule deferred from Lab 3 (a ticket cannot be marked **Resolved** while Actions
Taken are incomplete), and make concurrent action edits safe through optimistic
concurrency and explicit conflict handling — without regressing authentication,
authorization, the ticket queue, ownership, priority, status workflow, comments,
notes, attachments, or Administrator user management.

## 2. Stakeholder Request Interpretation

IT Staff need one operational place to understand their workload and record what
was actually done on a ticket. The **Ticket Owner remains the coordinator** of
the ticket, but the service desk works as a team: **any qualified IT Staff member
may take and record an action** on a ticket, not only the owner. Actions Taken
must therefore be first-class records with an auditable performer, a lifecycle,
and a clear relationship to exactly one ticket.

Requesters need a dashboard that answers three questions without opening every
ticket: *What is happening with my tickets? What has IT done recently? Where do
they need something from me?* Actions Taken should be visible to the owning
Requester as a progress trail, while Internal Notes remain staff-only.

The stakeholder also wants resolution integrity: a ticket must not be marked
Resolved while work remains incomplete. When two IT Staff members edit the same
Action Taken, the system must not silently overwrite one person's work; the
second editor must see a clear conflict, the current version, and a safe retry
path. The Zen Green design language from Labs 2–3 must be reused, not replaced,
and every screen and API must enforce role and ownership on the server.

## 3. Scope

### 3.1 Included

- **Actions Taken data model:** a first-class `ActionTaken` record belonging to
  exactly one Ticket, with summary, optional details, lifecycle status, performer,
  optional due date, completion timestamp, timestamps, and an optimistic-locking
  version.
- **Actions Taken API:** create, list, and update actions; no hard delete.
  Requesters can read actions on their own tickets; only IT Staff and
  Administrators can create or update actions, subject to coordination rules.
- **Action lifecycle:** `Open`, `In Progress`, `Completed`, `Cancelled` with a
  defined transition matrix. Terminal actions are immutable and retained for
  audit.
- **Resolution gate:** `PATCH /api/staff/tickets/:id/status` rejects a transition
  to `Resolved` while the ticket has any `Open` or `In Progress` action, returning
  the blocking actions. Completing or cancelling all actions allows resolution.
- **IT Staff Dashboard:** role-scoped workload summary, my work, unassigned
  triage, attention list, and recent Actions Taken, with loading, empty, partial
  failure, forbidden, and safe-failure states.
- **Requester Dashboard:** role-scoped summary of the Requester's own tickets,
  recent tickets, latest visible Actions Taken, and items waiting on the
  Requester.
- **Conflict and stale-update handling:** version-checked action updates, `409`
  conflict responses with the current action, preserved client input, and no
  partial writes.
- **UI:** Actions Taken area on the IT Staff Ticket Detail page and a read-only
  Actions Taken timeline on the Requester Ticket Detail page; dashboard
  navigation and role-appropriate landing pages; Zen Green badges and responsive
  layouts.
- **Security:** server-side role, ownership, and performer enforcement; safe
  errors; no cross-Requester or Internal Note leakage.
- **Regression:** all Lab 3 authentication, authorization, queue, ticket
  operations, comments/notes, attachments, and Administrator features continue
  to work.
- **Data/seed increments:** seed Actions Taken across all statuses, due dates,
  performers, and ticket states; seed data remains local-development only.

### 3.2 Explicitly Excluded

The following are out of scope for Lab 4 and must not be implemented:

- Real-time updates (WebSockets/SSE), push notifications, email, SMS, or any
  notification delivery service.
- SLA calculation, escalation automation, on-call schedules, or time tracking /
  billing.
- Action templates, recurring actions, checklists, subtasks, or action
  attachments.
- Deleting Actions Taken, editing terminal actions, or reopening a Completed or
  Cancelled action. A follow-up action must be created instead.
- Assigning an action to multiple performers or splitting an action across users.
- Comments or threads attached to individual Actions Taken (ticket-level Public
  Comments and Internal Notes remain the discussion channels).
- Replacing or duplicating Public Comments / Internal Notes.
- Advanced analytics, charts, trends, forecasting, exports, or KPI history.
- Cross-organization, multi-tenant, department, or customer administration.
- Production deployment, cloud infrastructure, background jobs, or caching
  infrastructure.
- Changes to authentication, password policy, role definitions, or Administrator
  user-management scope.
- Editing a ticket's Requester, category, related system, or immutable Requested
  Priority.

## 4. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | The system shall allow an active IT Staff or Administrator user to create an Action Taken on an actionable Ticket they can access, recording the performer from the authenticated session. |
| FR-02 | The system shall list Actions Taken for a Ticket with status filtering, deterministic ordering, and pagination. |
| FR-03 | The system shall allow an authorized user to update an Action Taken's summary, details, due date, and lifecycle status using optimistic concurrency. |
| FR-04 | The system shall enforce the action lifecycle (`Open`, `In Progress`, `Completed`, `Cancelled`) and keep terminal actions immutable. |
| FR-05 | The system shall prevent a Ticket from transitioning to `Resolved` while it has any `Open` or `In Progress` Action Taken, and shall identify the blocking actions. |
| FR-06 | The system shall provide an IT Staff Dashboard with workload counts, my work, unassigned tickets, attention items, and recent Actions Taken. |
| FR-07 | The system shall provide a Requester Dashboard with the authenticated Requester's own ticket summary, recent tickets, latest visible Actions Taken, and items waiting on the Requester. |
| FR-08 | The system shall scope both dashboards to the authenticated identity and role; no cross-Requester data shall be returned. |
| FR-09 | The system shall detect stale Action Taken updates, reject them without writing, and return the current action so the client can reconcile. |
| FR-10 | The system shall validate all Action Taken and dashboard inputs and return safe, field-level errors without stack traces, SQL, secrets, or protected content. |
| FR-11 | The system shall present an Actions Taken area on the IT Staff Ticket Detail page with create, update, complete, cancel, conflict, and resolution-gate feedback. |
| FR-12 | The system shall present a read-only Actions Taken timeline on the Requester Ticket Detail page for the Requester's own ticket. |
| FR-13 | The system shall present both dashboards and the Actions Taken area using the Zen Green design system with responsive desktop, tablet, and mobile layouts and accessible interaction. |
| FR-14 | The system shall preserve all Lab 3 behavior and data, including authentication, role navigation, queue queries, ownership, priority, status transitions, comments, notes, attachments, and Administrator user management. |

## 5. Business Rules

### 5.1 Actions Taken

- **BR-01 — Action Taken belongs to exactly one Ticket.** Every Action Taken
  has exactly one non-null `ticketId`. An action cannot be moved to another
  ticket, cannot exist without a ticket, and cannot be shared across tickets.
  Requests that reference an action under a different ticket path return `404`
  without disclosing the action. Deleting a ticket is not part of the product;
  if ticket deletion is ever introduced, actions must be retained or cascaded
  according to an explicit future decision.

- **BR-02 — Ticket Owner coordinates but IT Staff can take action.** The single
  primary Ticket Owner remains the coordinator for ownership, IT Priority, and
  status. Any active IT Staff or Administrator may create an Action Taken on an
  actionable ticket, regardless of whether they own it. The performer is always
  the authenticated session user and cannot be spoofed. The performer may update
  their own non-terminal action; the current Ticket Owner may update or cancel
  any non-terminal action on the ticket they own; an Administrator may update or
  cancel any non-terminal action. Other IT Staff may read but not modify the
  action. This supports team collaboration without erasing coordination.

- **BR-03 — Action lifecycle.** Actions use exactly four statuses:

  | From → To | Permitted |
  |---|---|
  | Open → In Progress, Completed, Cancelled | Yes |
  | In Progress → Completed, Cancelled | Yes |
  | Completed → any status | No (terminal) |
  | Cancelled → any status | No (terminal) |
  | Same status with no other change | Idempotent success, no version increment |

  Illegal transitions return `422 INVALID_ACTION_TRANSITION` with the allowed
  targets. A new action is created with status `Open`. A Completed action sets
  `completedAt`; a Cancelled action preserves the record and does not set
  `completedAt`.

- **BR-04 — Resolution gate.** A Ticket may transition to `Resolved` only when
  it has zero Actions Taken in `Open` or `In Progress`. Completed and Cancelled
  actions do not block resolution. A blocked attempt returns `409
  ACTIONS_INCOMPLETE` with a `blockingActions` list and leaves the ticket status
  unchanged. This rule supersedes Lab 3 BR-18 and applies to IT Staff and
  Administrators. The existing Lab 3 transition matrix still governs every other
  transition, including `Resolved → Closed`.

- **BR-05 — Server-derived performer and timestamps.** `performedBy` is the
  authenticated IT Staff/Administrator session user. `createdAt`, `updatedAt`,
  and `completedAt` are generated by the backend. Client-supplied performer,
  author, timestamp, or version-authority fields are ignored or rejected.
  Requesters cannot be performers.

- **BR-06 — No deletion; terminal actions are immutable.** Actions Taken are
  audit records. There is no `DELETE` endpoint. A mistaken action is cancelled,
  not removed. Completed and Cancelled actions cannot be edited; any further work
  is recorded as a new action. This preserves the progress trail for Requesters
  and staff.

- **BR-07 — Actionability.** Actions may be created or updated only when the
  ticket status is `New`, `Open`, `In Progress`, `Waiting for Requester`, or
  `Reopened`. Tickets in `Resolved`, `Closed`, or `Cancelled` are read-only for
  Actions Taken. Creating or updating an action on a non-actionable ticket
  returns `409 TICKET_NOT_ACTIONABLE`. Reopening a ticket makes Actions Taken
  actionable again.

- **BR-08 — Requester visibility.** The owning Requester may read the Actions
  Taken timeline for their own ticket, including summary, details, status,
  performer name/role, due date, completion time, and timestamps. Actions Taken
  are a progress communication channel; Internal Notes remain the staff-only
  channel. Requesters cannot create, update, complete, cancel, or delete actions.
  A Requester reading another Requester's actions receives `403` (existing) or
  `404` (missing) without action data.

### 5.2 Concurrency, conflicts, and failure safety

- **BR-09 — Optimistic concurrency for actions.** Every Action Taken carries an
  integer `version`, starting at `1` and incremented on every successful
  mutation. `PATCH` requests must include the `version` the client last read.
  If the stored version differs, the server performs no write and returns `409
  STALE_UPDATE` with `expectedVersion`, `currentVersion`, and the current action
  (only if the caller is authorized to read it).

- **BR-10 — Conflict outcomes are explicit.** The contract distinguishes:
  stale version (`409 STALE_UPDATE`), terminal action (`409 ACTION_CONFLICT`),
  non-actionable ticket (`409 TICKET_NOT_ACTIONABLE`), incomplete resolution
  (`409 ACTIONS_INCOMPLETE`), and illegal lifecycle transition (`422
  INVALID_ACTION_TRANSITION`). The client must show a specific, safe message and
  must not silently retry a destructive write.

- **BR-11 — Ticket status conflict boundary.** Actions Taken use version-based
  optimistic concurrency. Ticket status changes continue to use the Lab 3
  transition matrix plus the new resolution gate; a legal ticket status change
  from a stale screen is not version-rejected in Lab 4. Destructive status
  changes keep their existing confirmation requirement. This boundary is
  recorded so tests do not claim ticket-level optimistic locking that the
  contract does not provide.

- **BR-12 — Safe errors.** All failures return the stable error envelope with a
  generic, display-safe message. Responses must never contain stack traces, SQL,
  database names, password hashes, session tokens, Internal Note content, or
  another Requester's data. Conflict payloads may include only the action or
  ticket data the caller is already authorized to read.

### 5.3 Dashboards

- **BR-13 — Definition of active tickets.** For dashboard counts and lists, an
  *active* ticket is one whose status is `New`, `Open`, `In Progress`, `Waiting
  for Requester`, or `Reopened`. `Resolved`, `Closed`, and `Cancelled` are
  terminal/inactive for workload purposes unless a count explicitly names them.

- **BR-14 — IT Staff Dashboard scope.** The staff dashboard is a shared
  operational view. Summary counts cover the shared queue; `myWork` is scoped to
  tickets owned by the session user. `unassigned` covers active unassigned
  tickets. `attention` covers active tickets with the Requester resolved signal,
  `Waiting for Requester`, or overdue incomplete actions. `recentActions` covers
  actions on tickets visible to staff. Administrators retain the existing Lab 3
  staff-area access; this sprint does not grant new ticket powers to them.

- **BR-15 — Requester Dashboard scope.** The Requester dashboard is scoped to
  the authenticated Requester's own tickets and the Actions Taken on those
  tickets. It must never include another Requester's tickets, actions, comments,
  notes, or aggregates. `needsAttention` lists the Requester's own tickets in
  `Waiting for Requester`, oldest first.

- **BR-16 — Dashboard query safety and bounded output.** Unknown or out-of-range
  `window`, `limit`, `status`, or pagination values fall back to documented
  defaults and never cause `500`. Dashboard lists are bounded (no unbounded
  result sets). Ordering is deterministic with a secondary `id` sort. An empty
  dataset returns a valid empty payload, not an error.

- **BR-17 — Dashboard freshness.** Dashboards are read models fetched on demand.
  After an action or ticket mutation, the next dashboard request must reflect the
  change; no client-side cache may serve a stale count as authoritative. The
  response includes `generatedAt` so the UI can display freshness.

### 5.4 Validation, authorization, and regression

- **BR-18 — Action validation.** `summary` is required, trimmed, 1–200
  characters. `details` is optional, trimmed, 0–2000 characters. `dueAt` is
  optional and must be a valid ISO-8601 date-time when present. `status` on
  update must be one of the four action statuses. `version` is a required
  integer ≥ 1 on update. Invalid input returns `400 VALIDATION_ERROR` with
  field-level messages and creates or changes nothing.

- **BR-19 — Authorization is server-side.** Hiding buttons is feedback, not
  security. Every dashboard, action, and resolution operation is authorized on
  the backend using the authenticated session and role. Direct API calls from an
  unauthorized role must fail with `403` and no protected payload.

- **BR-20 — Lab 3 regression.** Authentication, forced password change, role
  navigation, queue search/filter/sort/pagination, ownership claim/assign,
  IT Priority, the status matrix, Public Comments, Internal Notes, attachments,
  Administrator user management, and safe errors must behave as specified in the
  Lab 3 contract. The only intentional behavioral change is the new resolution
  gate in BR-04.

### 5.5 Authorization matrix (normative)

Backend enforcement is mandatory. Frontend hiding is feedback only.

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| View Requester Dashboard (own data) | ✅ | ❌ | ❌ |
| View IT Staff Dashboard | ❌ | ✅ | ✅ (existing staff-area access) |
| Read Actions Taken on own ticket | ✅ (own only) | ✅ | ✅ |
| Read Actions Taken on any ticket | ❌ | ✅ | ✅ |
| Create Action Taken | ❌ | ✅ (any actionable ticket) | ✅ |
| Update/cancel own Action Taken | ❌ | ✅ (performer) | ✅ |
| Update/cancel any action on owned ticket | ❌ | ✅ (current Ticket Owner) | ✅ |
| Update/cancel actions on tickets not owned | ❌ | ❌ (unless performer) | ✅ |
| Resolve a ticket | ❌ | ✅ (gate applies) | ✅ (gate applies) |
| Change owner, IT Priority, or status | ❌ | ✅ (Lab 3 matrix) | ✅ (Lab 3 behavior) |
| Read/write Internal Notes | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

## 6. Data Changes

### 6.1 New `ActionTaken` model

```prisma
enum ActionStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model ActionTaken {
  id            Int          @id @default(autoincrement())
  ticketId      Int
  summary       String       // 1–200 chars after trim
  details       String?      // 0–2000 chars after trim
  status        ActionStatus @default(OPEN)
  performedById Int
  dueAt         DateTime?
  completedAt   DateTime?
  version       Int          @default(1)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  ticket        Ticket       @relation(fields: [ticketId], references: [id], onDelete: Restrict)
  performedBy   User         @relation(fields: [performedById], references: [id])

  @@index([ticketId, createdAt])
  @@index([ticketId, status])
  @@index([performedById, status])
  @@index([dueAt, status])
}
```

- `User` gains `actionsTaken ActionTaken[]`.
- `Ticket` gains `actionsTaken ActionTaken[]`.
- No `deletedAt` column and no delete endpoint: cancellation is the audit-safe
  alternative (BR-06).
- API labels map to database values: `OPEN → Open`, `IN_PROGRESS → In Progress`,
  `COMPLETED → Completed`, `CANCELLED → Cancelled`.
- `version` is the optimistic-locking token used by `PATCH` (BR-09).

### 6.2 Seed data

Seed Actions Taken across all four statuses, multiple tickets and performers,
at least one overdue incomplete action, at least one ticket whose only remaining
work is incomplete (for the resolution-gate demo), and at least one resolved
ticket with completed actions. Seeds remain idempotent and use local-only
credentials/data.

## 7. API Contract Summary

Authentication is the existing Lab 3 httpOnly cookie session. All endpoints below
require authentication, pass the password-change gate, and enforce the matrix in
§5.5. Full request/response shapes, conflict payloads, and status codes are in
`api-spec.md`.

| Area | Endpoints |
|---|---|
| Actions Taken (staff) | `GET /api/staff/tickets/:id/actions`, `POST /api/staff/tickets/:id/actions`, `PATCH /api/staff/tickets/:id/actions/:actionId` |
| Actions Taken (Requester read) | `GET /api/tickets/:id/actions` (own ticket only) |
| Dashboards | `GET /api/staff/dashboard`, `GET /api/requester/dashboard` |
| Resolution gate | Existing `PATCH /api/staff/tickets/:id/status` extended with `409 ACTIONS_INCOMPLETE` for `Resolved` |
| Existing Lab 3 APIs | Unchanged except the documented resolution gate |

Expected statuses: `200` retrieval/update, `201` action creation, `400`
validation, `401` unauthenticated, `403` forbidden/password gate, `404` missing
or action-not-on-ticket, `409` stale update / terminal action / non-actionable
ticket / incomplete resolution, `422` illegal action transition, `500` safe
generic error.

## 8. UI Specification Summary

Lab 4 reuses the Lab 2–3 Zen Green system (tokens, cards, badges, validation
placement, responsive breakpoints, accessibility expectations) and adds three
screen areas. Full detail is in `ui-spec.md`.

- **IT Staff Dashboard (`/staff/dashboard`):** role-scoped KPI cards (my open
  tickets, unassigned, in progress, waiting for requester, requester says
  resolved, incomplete actions, overdue actions), My Work, Needs Attention,
  Unassigned Triage, and Recent Actions, with refresh and drill-down links to
  the queue.
- **Requester Dashboard (`/dashboard`):** welcome header, own-ticket summary
  cards, recent tickets, latest visible Actions Taken, items waiting on the
  Requester, and a Create Ticket call to action.
- **Actions Taken on IT Staff Ticket Detail:** a timeline with status badges,
  performer, due/overdue indicators, create form, edit/complete/cancel controls,
  version-conflict reconciliation, and a resolution-gate callout on the status
  control.
- **Actions Taken on Requester Ticket Detail:** a read-only progress timeline;
  no create/edit/cancel controls and no Internal Notes.
- **Feedback coverage:** loading, saving, validation, success, empty, no-results,
  forbidden, not-found, conflict/stale, non-actionable, and safe-failure states
  are defined for every new screen.

## 9. Acceptance Criteria

### Actions Taken

- **AC-01 — Create Action Taken.** Given an active IT Staff or Administrator and
  an actionable ticket, when a valid action is submitted, then the action is
  created with status `Open`, `version = 1`, the session user as `performedBy`,
  server timestamps, and exactly one `ticketId`. Trace: FR-01, BR-01, BR-02,
  BR-05.
- **AC-02 — Action validation.** Given a create or update request with a blank
  or overlong summary, overlong details, invalid due date, invalid status, or
  missing version on update, when it is submitted, then the server returns `400`
  with field-level messages and no record is created or changed. Trace: FR-10,
  BR-18.
- **AC-03 — Read and list Actions Taken.** Given a ticket with actions, when an
  authorized user lists them, then only that ticket's actions are returned in a
  deterministic order with pagination metadata; status filtering works; a
  Requester sees actions only for their own ticket. Trace: FR-02, BR-01, BR-08.
- **AC-04 — Update Action Taken.** Given an `Open` or `In Progress` action, when
  its performer, the current Ticket Owner, or an Administrator updates it with
  the current version, then the change persists, `version` increments, and
  `updatedAt` changes; other staff receive `403`. Trace: FR-03, BR-02, BR-09.
- **AC-05 — Action lifecycle.** Given an action, when a permitted lifecycle
  transition is requested, then it succeeds and timestamps are correct; when an
  illegal transition or an edit to a terminal action is requested, then it is
  rejected with a specific conflict/validation response. Trace: FR-04, BR-03,
  BR-06.
- **AC-06 — Cancel preserves audit.** Given a non-terminal action, when an
  authorized user cancels it, then the status becomes `Cancelled`, the record
  remains readable, and no delete endpoint exists. Trace: FR-04, BR-06.
- **AC-07 — Resolution gate.** Given a ticket with at least one `Open` or `In
  Progress` action, when a permitted user attempts to set status to `Resolved`,
  then the server returns `409 ACTIONS_INCOMPLETE` with the blocking actions and
  the status is unchanged; after all actions are Completed or Cancelled, the
  same transition succeeds. Trace: FR-05, BR-04.
- **AC-08 — Stale update conflict.** Given an action last read at version `N`,
  when an update is submitted with version `N` after the action has advanced to
  version `N+1`, then the server returns `409 STALE_UPDATE` with the current
  version and action, performs no write, and the client can reconcile. Trace:
  FR-09, BR-09, BR-10.
- **AC-09 — Non-actionable ticket.** Given a ticket in `Resolved`, `Closed`, or
  `Cancelled`, when an action create or update is attempted, then the server
  returns `409 TICKET_NOT_ACTIONABLE` and no action changes; reopening the
  ticket restores actionability. Trace: FR-01, FR-03, BR-07.

### Dashboards

- **AC-10 — Requester action visibility and authorization.** Given a Requester,
  when they read Actions Taken for their own ticket, then they see the
  requester-safe timeline; when they attempt to create/update/cancel an action or
  read another Requester's actions, then the server returns `403`/`404` with no
  protected data. Trace: FR-08, FR-12, BR-08, BR-19.
- **AC-11 — IT Staff Dashboard summary.** Given the shared queue, when an IT
  Staff or Administrator opens the staff dashboard, then the summary counts use
  the documented active-ticket and action definitions and match the underlying
  data. Trace: FR-06, BR-13, BR-14.
- **AC-12 — IT Staff Dashboard lists.** Given dashboard data, when the staff
  dashboard loads, then My Work, Unassigned Triage, Needs Attention, and Recent
  Actions contain the correct bounded, deterministically ordered items with
  drill-down links. Trace: FR-06, BR-14, BR-16.
- **AC-13 — Requester Dashboard.** Given an authenticated Requester, when the
  dashboard loads, then it shows only their own ticket summary, recent tickets,
  latest visible actions, and items waiting on them. Trace: FR-07, BR-15.
- **AC-14 — Dashboard authorization.** Given each role, when a dashboard
  endpoint or route is accessed, then only the permitted role receives data;
  cross-role access returns `403` with no payload; unauthenticated access returns
  `401`. Trace: FR-08, BR-19, §5.5.
- **AC-15 — Dashboard query safety and empty state.** Given invalid `window`,
  `limit`, or pagination values, when a dashboard is requested, then documented
  defaults are applied without `500`; given no matching data, then a valid empty
  payload and a useful UI empty state are returned. Trace: FR-10, BR-16.
- **AC-16 — Dashboard freshness.** Given a dashboard was loaded, when an action
  is created, completed, or a ticket status changes, then the next dashboard
  request reflects the new counts and lists. Trace: FR-06, FR-07, BR-17.

### Cross-cutting and regression

- **AC-17 — Safe errors.** Given any validation, forbidden, not-found, conflict,
  or unexpected failure path, when the API responds, then the message is safe and
  no stack trace, SQL, secret, Internal Note, or cross-Requester data is exposed.
  Trace: FR-10, BR-12.
- **AC-18 — Lab 3 regression.** Given the Lab 3 flows, when they are exercised
  after Lab 4, then authentication, role navigation, queue queries, ownership,
  IT Priority, the status matrix (except the new resolution gate), comments,
  notes, attachments, and Administrator user management behave as before. Trace:
  FR-14, BR-20.
- **AC-19 — UI quality and accessibility.** Given any new screen, when viewed at
  desktop, tablet, and mobile widths and operated by keyboard or screen reader,
  then Zen Green tokens, action badges, validation placement, focus visibility,
  non-color status indicators, touch targets, and loading/empty/conflict/failure
  states meet `ui-spec.md`. Trace: FR-11, FR-12, FR-13, BR-19.
- **AC-20 — End-to-end progress workflow.** Given an IT Staff user and the owning
  Requester, when the Staff user logs an action, advances it, completes it,
  resolves the ticket, and the Requester views the ticket and dashboard, then the
  progress trail is visible, the resolution gate behaves correctly, and the
  Requester dashboard reflects the final state. Trace: FR-01–FR-08, BR-02,
  BR-04, BR-08.

## 10. Product Definition of Done

The AI coding agent may report completion only when all of the following hold on
the final `main` branch:

- [ ] All scope in §3.1 is implemented; nothing in §3.2 was added.
- [ ] Every AC in §9 is satisfied and linked to passing test evidence in
      `tests.md`.
- [ ] No planned test is skipped, disabled, or commented out; unit, API,
      authorization, UI, responsive, regression, and E2E suites all pass from
      documented commands.
- [ ] The backend enforces the authorization matrix (§5.5), BR-01–BR-20, and the
      resolution gate; direct-API negative tests prove hidden buttons were not
      relied upon.
- [ ] Action updates use version-based optimistic concurrency; stale writes
      return `409 STALE_UPDATE` with the current action and never partially
      mutate data.
- [ ] The resolution gate blocks `Resolved` while incomplete actions exist and
      returns the blocking actions; completing or cancelling them allows
      resolution.
- [ ] Dashboards are role-scoped, use the documented count definitions, are
      bounded and deterministic, and never leak another Requester's data.
- [ ] Actions Taken are visible read-only to the owning Requester; Internal Notes
      remain staff-only.
- [ ] All new screens conform to `api-spec.md` and `ui-spec.md`: Zen Green
      tokens, action badges, validation placement, button hierarchy, responsive
      breakpoints, feedback states, and accessibility (labels, focus, keyboard
      paths, non-color indicators).
- [ ] Safe-error behavior is verified: no stack traces, SQL, hashes, tokens, note
      content, or cross-Requester data in any failure, forbidden, not-found, or
      conflict path.
- [ ] Lab 3 regression suites pass; no Lab 3 behavior changes except the
      documented resolution gate.
- [ ] Seed data covers all action statuses, overdue and incomplete actions, and
      dashboard scenarios; seeds remain idempotent and local-only.
- [ ] README setup, seed credentials, test commands, and migration notes are
      current.
- [ ] Peer review is completed through the required staging flow with approvals
      and responses recorded in `reviewer.md`.

## 11. Assumptions and Decisions

1. **Requester visibility:** Actions Taken are a progress communication channel
   visible to the owning Requester. Internal Notes remain the staff-only channel.
   This avoids duplicating the private-note feature and gives the Requester
   Dashboard meaningful content.
2. **Action statuses:** Four statuses (`Open`, `In Progress`, `Completed`,
   `Cancelled`) are sufficient for progress tracking. Terminal actions are not
   reopened; a follow-up action is created instead. This keeps the audit trail
   append-oriented and avoids ambiguous history.
3. **Coordination model:** The Ticket Owner may update/cancel any action on the
   owned ticket, while any IT Staff member may create actions and update their
   own. Administrators may manage all actions. This implements “owner
   coordinates, staff acts” without making every action owner-only.
4. **Concurrency token:** An integer `version` is the normative optimistic-lock
   token. `ETag`/`If-Match` is not required in Lab 4. Ticket-level status changes
   remain last-write-wins within the transition matrix; only Actions Taken are
   version-conflicted (BR-11).
5. **Resolution gate scope:** The gate applies to `Resolved` only. `Closed` is
   reached from `Resolved` and therefore already implies complete actions.
   `Cancelled` does not require completing actions because the work is abandoned.
6. **Dashboard scope:** The staff dashboard is a shared operational view with
   `myWork` scoped to the session user. The Requester dashboard is strictly
   self-scoped. No cross-Requester aggregates are exposed.
7. **Administrator access:** Administrators retain the existing Lab 3 staff-area
   access and may manage Actions Taken. No new Administrator-only ticket powers
   beyond the existing Lab 3 behavior are introduced.
8. **No real-time:** Dashboards are pull/refetch read models with `generatedAt`.
   WebSockets, SSE, notifications, and background jobs are excluded.
9. **No action attachments or time tracking:** Actions are lightweight progress
   records. Attachments stay at ticket level; effort/time tracking is out of
   scope.
10. **Seed data:** Seeded actions and credentials are local-development only and
    must not contain real personal or operational data.
