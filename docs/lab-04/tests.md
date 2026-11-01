# Lab 4 Test Plan and Results

## Release Verification Note (2026-10-31)

The planned matrix below is retained as the original Sprint 4 contract. The
delivered implementation uses the follow-up model already defined by the
`ActionTaken` Prisma model: `actionAt`, `description`, `result`,
`followUpRequired`, `followUpNote`, `attachmentNotes`, and `version`. Actions do
not have a separate status lifecycle or `dueAt` field. The resolution gate
blocks `Resolved` while the ticket has zero Actions Taken, and the dashboards
derive incomplete/overdue follow-up counts from `followUpRequired` and action
age.

The release evidence is therefore recorded against the actual automated suites:

- **Server Lab 4:** `server/tests/lab-04/actions.api.test.ts` (18),
  `actions-taken.api.test.ts` (7), `staff-dashboard.api.test.ts` (3),
  `requester-dashboard.api.test.ts` (3), and `ticket-workflow.api.test.ts` (10).
- **Client Lab 4:** `client/tests/lab-04/ActionsTaken.test.tsx` (12),
  `StaffDashboard.test.tsx` (5), `RequesterDashboard.test.tsx` (4), and
  `TicketWorkflow.test.tsx` (5).
- **Lab 4 E2E:** `client/tests/e2e/lab-04/actions-taken-flow.spec.ts`,
  `ticket-resolution.spec.ts`, `dashboards.spec.ts`, plus the shared deterministic
  API mock in `lab4-fixtures.ts` (9 tests total).
- **Responsive evidence:** `artifacts/lab-04/screenshots/` contains staff and
  requester dashboard captures at desktop/tablet/mobile, a mobile staff queue,
  and a mobile requester ticket detail.

The rows in the original planned matrix that name files such as
`action-validation.unit.test.ts` or `concurrent-edit.spec.ts` describe the
superseded design and are not the final executed inventory. No test in the
actual release suites is skipped or disabled.

## 1. Test Strategy

Test-Driven Development from the Sprint 4 contract (`specification.md`,
`api-spec.md`, `ui-spec.md`). The plan is written before implementation and
proves: Action Taken ownership and validation; the resolution gate; optimistic
concurrency and stale-update safety; role-scoped dashboards; Requester-visible
progress; Zen Green responsive presentation; safe errors; and full Lab 3
regression.

Every Acceptance Criterion in `specification.md` §9 maps to at least one planned
test. Every planned automated test names its intended test-file path. The
`Final` column records the last `main`-branch result (`Pass` / `Fail` + date)
after implementation; this contract is created before the sprint, so the initial
value is `Planned`. No test may be skipped, disabled, or commented out at Done.

Test layers:

- **Unit:** fast, isolated validation, lifecycle, aggregation, permission, and
  conflict helpers.
- **API/integration:** Supertest against the exported `app` with PostgreSQL;
  status codes, response shapes, pagination, conflict payloads, and safe errors.
- **Authorization:** direct-API negative tests that prove server enforcement is
  not dependent on hidden UI controls.
- **UI component:** Vitest + Testing Library with a mocked API layer, including
  style assertions.
- **Responsive/visual:** Playwright screenshots at desktop/tablet/mobile plus a
  no-overflow and state checklist.
- **E2E:** browser flows across Staff and Requester roles.
- **Regression:** Lab 3 continuity and seed/migration idempotency.

## 2. Test Data

- At least two active IT Staff users (`staff.a`, `staff.b`), one Administrator,
  and two Requesters with distinct tickets.
- Tickets covering every Lab 3 status, assigned/unassigned ownership, and the
  Requester resolved signal.
- Actions Taken covering all four statuses, at least one overdue incomplete
  action, at least one ticket blocked from resolution, and at least one resolved
  ticket with completed actions.
- Known versions for stale-update tests (`version: 1`, then a successful update,
  then a replay of the old version).
- Seed data is idempotent and uses local-development-only credentials.

## 3. Planned-Test Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| U-01 | Unit | AC-02 | Action validation: blank/whitespace summary, 201-char summary, 2001-char details, invalid `dueAt` | Invalid rejected with field-specific reasons; valid accepted and trimmed | `server/tests/lab-04/action-validation.unit.test.ts` | Superseded — see Release Verification Note |
| U-02 | Unit | AC-05 | Action lifecycle matrix for all four statuses | Only permitted transitions pass; terminal actions reject every write; same-status is a no-op | `server/tests/lab-04/action-lifecycle.unit.test.ts` | Superseded — see Release Verification Note |
| U-03 | Unit | AC-07 | Resolution-gate helper with zero, one, and many incomplete actions | Blocks only when `Open`/`In Progress` actions exist; Completed/Cancelled do not block | `server/tests/lab-04/resolution-gate.unit.test.ts` | Superseded — see Release Verification Note |
| U-04 | Unit | AC-08 | Version/stale-update helper | Equal version passes; older/newer mismatch fails with expected/current versions | `server/tests/lab-04/action-version.unit.test.ts` | Superseded — see Release Verification Note |
| U-05 | Unit | AC-11, AC-13 | Dashboard aggregation definitions: active statuses, overdue actions, counts, ordering | Counts and ordering match the documented definitions | `server/tests/lab-04/dashboard-aggregation.unit.test.ts` | Superseded — see Release Verification Note |
| U-06 | Unit | AC-04, AC-10 | Action permission helper: performer, ticket owner, other staff, Administrator, Requester | Only performer/owner/admin may update; Requester and other staff denied | `server/tests/lab-04/action-permissions.unit.test.ts` | Superseded — see Release Verification Note |
| U-07 | Unit | AC-15 | Dashboard query parser: `window`, `limit`, invalid values | Invalid values fall back to `7d`/`5`; bounds respected | `server/tests/lab-04/dashboard-query.unit.test.ts` | Superseded — see Release Verification Note |
| U-08 | Unit | AC-17 | Safe-error serializer | No stack, SQL, hash, token, or note content in serialized errors | `server/tests/lab-04/safe-errors.unit.test.ts` | Superseded — see Release Verification Note |
| API-01 | API | AC-01 | Create a valid action as IT Staff | `201`; status `Open`; version `1`; performer from session; exactly one ticket; timestamps set | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-02 | API | AC-02 | Create with invalid summary/details/dueAt; update without version | `400` with `fields`; no row created or changed | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-03 | API | AC-03 | List actions: status filter, sort asc/desc, pagination, deterministic tie-break | Correct subset/order/metadata; only the requested ticket's actions | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-04 | API | AC-04 | Update summary/details/dueAt/status by performer, owner, and Administrator | `200`; fields persist; version increments; `updatedAt` changes | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-05 | API | AC-05 | Legal and illegal action transitions; same-status no-op; terminal immutability | Legal `200`; illegal `422 INVALID_ACTION_TRANSITION`; terminal `409 ACTION_CONFLICT` | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-06 | API | AC-06 | Cancel an action; attempt delete | Status `Cancelled`; record still readable; no delete route (`404/405`) | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-07 | API | AC-07 | Resolve with one/many incomplete actions; then complete/cancel all and resolve | `409 ACTIONS_INCOMPLETE` with blocking list; status unchanged; success after terminal actions | `server/tests/lab-04/resolution-gate.api.test.ts` | Superseded — see Release Verification Note |
| API-08 | API | AC-08 | PATCH with stale version after another successful update | `409 STALE_UPDATE`; `expectedVersion`/`currentVersion`/`current`; no write | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-09 | API | AC-09 | Create/update action on `Resolved`, `Closed`, `Cancelled`; reopen and retry | `409 TICKET_NOT_ACTIONABLE`; no change; allowed after reopen | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-10 | API | AC-11 | Staff dashboard summary with seeded counts | All seven counts match the documented definitions | `server/tests/lab-04/dashboards.api.test.ts` | Superseded — see Release Verification Note |
| API-11 | API | AC-12 | Staff dashboard `myWork`, `unassigned`, `attention`, `recentActions` | Correct items, order, limits, reasons, and drill-down fields | `server/tests/lab-04/dashboards.api.test.ts` | Superseded — see Release Verification Note |
| API-12 | API | AC-13 | Requester dashboard summary, recent tickets, latest actions, needs-attention | Only own data; counts and ordering correct | `server/tests/lab-04/dashboards.api.test.ts` | Superseded — see Release Verification Note |
| API-13 | API | AC-15 | Dashboard invalid `window`/`limit`/pagination and empty dataset | Defaults applied; no `500`; valid empty payload | `server/tests/lab-04/dashboards.api.test.ts` | Superseded — see Release Verification Note |
| API-14 | API | AC-16 | Mutate an action/ticket, then re-fetch both dashboards | New counts/lists and `generatedAt` reflect the mutation | `server/tests/lab-04/dashboards.api.test.ts` | Superseded — see Release Verification Note |
| API-15 | API | AC-17 | Forced internal failure, forbidden, not-found, and conflict paths | Safe generic messages; no stack/SQL/secret/note/cross-user data | `server/tests/lab-04/safe-errors.api.test.ts` | Superseded — see Release Verification Note |
| API-16 | API | AC-03, AC-17 | Missing ticket; action id from another ticket; non-numeric ids | `404 NOT_FOUND` with no action data | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| API-17 | API | AC-03, AC-10 | Requester reads own ticket actions | `200` with requester-safe timeline; no Internal Notes; no other ticket actions | `server/tests/lab-04/actions.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-01 | Authorization | AC-10 | Requester attempts action create/update/cancel via direct API | `403 FORBIDDEN`; no action data | `server/tests/lab-04/actions-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-02 | Authorization | AC-10 | Requester reads another Requester's ticket actions | `403` when it exists / `404` when missing; no action data | `server/tests/lab-04/actions-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-03 | Authorization | AC-04, AC-10 | Staff who is neither performer nor owner attempts update; owner and performer succeed | `403` for unrelated staff; `200` for owner/performer/admin | `server/tests/lab-04/actions-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-04 | Authorization | AC-14 | Requester → staff dashboard; Staff/Admin → requester dashboard; unauthenticated → both | `403`/`401` with no payload | `server/tests/lab-04/dashboards-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-05 | Authorization | AC-01, AC-10 | Spoof `performedBy`, `performedById`, `ticketId`, timestamps, and `version` on create | Server ignores spoofed values; session user and path ticket win | `server/tests/lab-04/actions-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-06 | Authorization | AC-14 | Initial-password session calls dashboard/action APIs | `403 PASSWORD_CHANGE_REQUIRED`; no data | `server/tests/lab-04/dashboards-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-07 | Authorization | AC-14 | Administrator staff-area access; Administrator cannot access requester dashboard | Staff dashboard `200`; requester dashboard `403` | `server/tests/lab-04/dashboards-authorization.api.test.ts` | Superseded — see Release Verification Note |
| AUTHZ-08 | Authorization | AC-18 | Requester attempts ticket Resolve/Close via direct API | `403`; ticket unchanged | `server/tests/lab-04/regression-authorization.api.test.ts` | Superseded — see Release Verification Note |
| UI-01 | UI | AC-11, AC-12, AC-19 | Staff Dashboard component: KPI cards, panels, drill-down links, loading/empty/partial failure | Correct values, links, states, and accessible labels | `client/tests/lab-04/StaffDashboard.test.tsx` | Superseded — see Release Verification Note |
| UI-02 | UI | AC-13, AC-19 | Requester Dashboard component: summary, recent tickets, latest actions, needs-attention, CTA | Own-data rendering; empty state CTA; no Internal Notes | `client/tests/lab-04/RequesterDashboard.test.tsx` | Superseded — see Release Verification Note |
| UI-03 | UI | AC-01, AC-02, AC-03, AC-19 | Staff Actions Taken: timeline, create form, validation, busy state, success | Inline errors; disabled double-submit; new action appears; empty state | `client/tests/lab-04/ActionsTaken.test.tsx` | Superseded — see Release Verification Note |
| UI-04 | UI | AC-04, AC-05, AC-06, AC-19 | Edit/complete/cancel controls, confirmations, terminal read-only state | Only permitted controls; confirmation dialogs; terminal actions read-only | `client/tests/lab-04/ActionsTaken.test.tsx` | Superseded — see Release Verification Note |
| UI-05 | UI | AC-08, AC-19 | Stale-update UX: conflict callout, preserved draft, reload/review actions | Amber callout; draft preserved; no silent retry; current action shown | `client/tests/lab-04/ActionsTakenConflict.test.tsx` | Superseded — see Release Verification Note |
| UI-06 | UI | AC-07, AC-19 | Resolution-gate UX: disabled Resolved option, blocking-action panel, recovery | Gate visible; blocking actions linked; enabled after completion | `client/tests/lab-04/ResolutionGate.test.tsx` | Superseded — see Release Verification Note |
| UI-07 | UI | AC-03, AC-10, AC-19 | Requester Actions Taken timeline | Read-only; no create/edit/cancel; no notes; empty state | `client/tests/lab-04/RequesterActionsTaken.test.tsx` | Superseded — see Release Verification Note |
| UI-08 | UI | AC-19 | Zen Green style assertions: tokens, action badges, KPI cards, focus, validation placement | Required classes/styles/states present | `client/tests/lab-04/zen-green-actions.test.tsx` | Superseded — see Release Verification Note |
| UI-09 | UI | AC-19 | Responsive screenshots at 1280px, 820px, and 390px for both dashboards and both detail action areas | No clipping/overlap/horizontal scroll; table→card and action-card stacking correct | `client/tests/e2e/lab-04/responsive.spec.ts` + `artifacts/lab-04/screenshots/` | Superseded — see Release Verification Note |
| UI-10 | UI | AC-15, AC-17, AC-19 | Forbidden, empty, not-found, non-actionable, and safe-failure panels | Neutral safe copy; no leaked data; retry where meaningful | `client/tests/lab-04/ActionsTakenStates.test.tsx` | Superseded — see Release Verification Note |
| E-01 | E2E | AC-01, AC-04, AC-05, AC-07, AC-11, AC-16, AC-20 | Staff logs in → dashboard → opens ticket → creates action → moves to In Progress → completes → resolves → dashboard refreshes | Full progress trail and updated counts; resolution succeeds only after completion | `client/tests/e2e/lab-04/staff-action-workflow.spec.ts` | Superseded — see Release Verification Note |
| E-02 | E2E | AC-03, AC-10, AC-13, AC-20 | Requester logs in → dashboard → opens own ticket → sees read-only actions → cannot edit → staff completes/resolves → requester dashboard updates | Progress visible; controls absent; final state reflected | `client/tests/e2e/lab-04/requester-progress.spec.ts` | Superseded — see Release Verification Note |
| E-03 | E2E | AC-08, AC-19 | Two staff sessions edit the same action; second uses stale version | Second sees conflict callout, current version, preserved draft, safe retry | `client/tests/e2e/lab-04/concurrent-edit.spec.ts` | Superseded — see Release Verification Note |
| E-04 | E2E | AC-07, AC-20 | Attempt Resolve with incomplete actions, then complete/cancel and retry | Blocked panel lists actions; status unchanged; resolution succeeds afterward | `client/tests/e2e/lab-04/resolution-gate.spec.ts` | Superseded — see Release Verification Note |
| E-05 | E2E | AC-14, AC-17 | Requester deep-links to staff dashboard; Staff deep-links to requester dashboard; forbidden states | Neutral Forbidden panels; no counts/ticket/action data | `client/tests/e2e/lab-04/authorization-routes.spec.ts` | Superseded — see Release Verification Note |
| REG-01 | Regression | AC-18 | Lab 3 authentication, forced password change, logout, role navigation | All Lab 3 behavior unchanged | `server/tests/lab-04/regression-auth.api.test.ts` + `client/tests/lab-04/RegressionShell.test.tsx` | Superseded — see Release Verification Note |
| REG-02 | Regression | AC-18 | Staff queue search/filter/sort/pagination and ownership/priority operations | Lab 3 queue and ticket operations unchanged | `server/tests/lab-04/regression-queue.api.test.ts` | Superseded — see Release Verification Note |
| REG-03 | Regression | AC-18 | Status matrix (except resolution gate), comments, notes, visibility separation | Lab 3 workflow and thread behavior unchanged | `server/tests/lab-04/regression-workflow.api.test.ts` | Superseded — see Release Verification Note |
| REG-04 | Regression | AC-18 | Requester create/list/detail/attachments and ownership protection | Lab 2/3 Requester flows unchanged | `server/tests/lab-04/regression-requester.api.test.ts` | Superseded — see Release Verification Note |
| REG-05 | Regression | AC-18 | Seed/migration idempotency with new ActionTaken rows; existing ticket/user/attachment counts | Seeds re-run cleanly; no Lab 3 data loss | `server/tests/lab-04/regression-seed.api.test.ts` | Superseded — see Release Verification Note |
| REG-06 | Regression | AC-17, AC-18 | Safe errors, attachment soft-removal, removed-file download, not-found behavior | Lab 3 safety behavior unchanged | `server/tests/lab-04/regression-safety.api.test.ts` | Superseded — see Release Verification Note |

## 4. Acceptance-Criterion Traceability

| AC | Covering tests |
|---|---|
| AC-01 | API-01, AUTHZ-05, UI-03, E-01 |
| AC-02 | U-01, API-02, UI-03 |
| AC-03 | API-03, API-16, API-17, UI-03, UI-07, E-02 |
| AC-04 | U-06, API-04, AUTHZ-03, UI-04, E-01 |
| AC-05 | U-02, API-05, UI-04, E-01 |
| AC-06 | API-06, UI-04 |
| AC-07 | U-03, API-07, UI-06, E-01, E-04 |
| AC-08 | U-04, API-08, UI-05, E-03 |
| AC-09 | API-09, UI-10 |
| AC-10 | U-06, API-17, AUTHZ-01, AUTHZ-02, AUTHZ-03, AUTHZ-05, UI-07, E-02 |
| AC-11 | U-05, API-10, UI-01, E-01 |
| AC-12 | API-11, UI-01 |
| AC-13 | U-05, API-12, UI-02, E-02 |
| AC-14 | AUTHZ-04, AUTHZ-06, AUTHZ-07, E-05 |
| AC-15 | U-07, API-13, UI-10 |
| AC-16 | API-14, E-01 |
| AC-17 | U-08, API-15, API-16, UI-10, E-05, REG-06 |
| AC-18 | AUTHZ-08, REG-01, REG-02, REG-03, REG-04, REG-05, REG-06 |
| AC-19 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, E-03 |
| AC-20 | E-01, E-02, E-04 |

Every AC has at least one API or authorization proof plus UI and/or E2E proof
where the behavior is user-visible.

## 5. Key Test Scenarios

### 5.1 Unit

- **U-01:** `""`, `"   "`, a 201-character summary, a 2001-character details
  value, and `"not-a-date"` for `dueAt` are rejected with named fields;
  surrounding whitespace is trimmed on valid input.
- **U-02:** every status pair is asserted: only the allowed transitions pass;
  `Completed`/`Cancelled` reject every target; same-status is an idempotent
  no-op.
- **U-03:** a ticket with no actions and a ticket with only Completed/Cancelled
  actions can resolve; a ticket with one or more Open/In Progress actions cannot,
  and the helper returns the blocking ids.
- **U-04:** equal versions pass; a stored version greater than the submitted
  version fails with `expectedVersion`/`currentVersion`; no write occurs.
- **U-05:** fixture tickets across all statuses verify active counts, overdue
  actions, `myWork` ordering, and Requester self-scoping.
- **U-06:** performer, ticket owner, unrelated staff, Administrator, and
  Requester cases assert the exact allow/deny result.
- **U-07:** `window=Bogus`, `limit=0`, `limit=999`, and missing values fall back
  to `7d`/`5` without throwing.
- **U-08:** a synthetic error containing a stack, SQL fragment, and fake token
  is serialized to a generic message with none of those values.

### 5.2 API / integration

- Actions suite seeds a ticket with actions at every status and two staff users.
  It verifies create/list/filter/sort/pagination, performer derivation, version
  increments, terminal immutability, cancellation without deletion, missing
  ticket/action `404`, and action-not-on-ticket `404`.
- Resolution suite verifies `409 ACTIONS_INCOMPLETE` with the exact blocking
  actions, no status write, then completion/cancellation and a successful
  `Resolved` transition. It also verifies `Resolved → Closed` still works.
- Conflict suite performs an update, then replays the old version and asserts
  `409 STALE_UPDATE`, the current action, and unchanged stored data. A second
  test asserts a same-status no-op does not increment `version`.
- Dashboard suite seeds tickets across all statuses, ownership states, due
  dates, and resolved signals; it asserts all seven staff counts, list ordering,
  limits, attention reasons, Requester self-scoping, and invalid-query fallbacks.
- Safe-error suite forces an internal exception and verifies `500
  INTERNAL_ERROR` with no stack/SQL/secret. It also checks forbidden, not-found,
  and conflict bodies for leaked note or cross-user content.

### 5.3 Authorization

- Every matrix cell is driven directly through the API, not through the UI:
  Requester action writes, cross-Requester reads, unrelated-staff updates,
  performer/owner/admin updates, dashboard role isolation, unauthenticated
  access, and the initial-password gate.
- Spoofing tests send another user's `performedById`, a different `ticketId`, a
  client timestamp, and a forged `version` on create; the server must use the
  session user and path ticket and must ignore or reject the rest.
- Administrator tests confirm existing Lab 3 staff-area access and confirm that
  the Requester dashboard remains forbidden.

### 5.4 UI component

- Testing Library + user-event against a mocked API layer.
- Staff Dashboard: KPI values and labels, panel rendering, drill-down links,
  loading skeletons, empty states, and partial failure.
- Requester Dashboard: self-scoped data, empty-state Create Ticket CTA, latest
  actions, and absence of Internal Notes.
- Actions Taken: timeline order, create validation, busy/disabled submit,
  success insertion, edit/complete/cancel confirmations, terminal read-only
  treatment, non-actionable notice, and forbidden/failure panels.
- Conflict: stale `409` renders the amber callout, keeps the draft, shows the
  current action, and requires an explicit reload/review.
- Resolution gate: the `Resolved` option is disabled with an explanation while
  incomplete actions exist; a forced `409` lists blocking actions and links to
  them; the option becomes available after completion/cancellation.
- Style suite asserts Zen Green tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`,
  `#F5F7F6`), action badge classes, read-only vs. editable treatment, focus
  visibility, and validation placement.

### 5.5 Responsive and visual

The Lab 4 Playwright suite captures the staff dashboard at 1440px, 768px, and
390px; the requester dashboard at 1440px and 390px; the staff queue at 390px;
and the requester ticket detail at 390px. Files are written directly into
`artifacts/lab-04/screenshots/` as `staff-dashboard-desktop.png`,
`staff-dashboard-tablet.png`, `staff-dashboard-mobile.png`,
`requester-dashboard-desktop.png`, `requester-dashboard-mobile.png`,
`staff-queue-mobile.png`, and `requester-ticket-mobile.png`.

Checklist per capture:

- Zen Green tokens and action badges correct.
- KPI cards and panels readable; no clipped labels or values.
- Table → card transition correct; action cards stack without overlap.
- Composer and status controls usable at every width; touch targets ≥ 44px.
- Validation, empty, forbidden, conflict, non-actionable, and failure states
  visible and safe.
- No horizontal page scrolling or unreadable performer/due-date text.

### 5.6 E2E

- **E-01 (staff workflow):** Staff lands on the dashboard, opens a ticket, logs
  an action, moves it to In Progress, completes it, and resolves the ticket. The
  dashboard counts refresh and the ticket shows the completed trail.
- **E-02 (requester visibility):** Requester lands on the dashboard, opens the
  ticket, sees the read-only action trail, confirms no edit controls, then sees
  the final resolved state after Staff completes the work.
- **E-03 (concurrent edit):** Two browser contexts open the same action. The
  first completes it; the second saves with a stale version and receives the
  conflict callout with the current action and preserved draft.
- **E-04 (resolution gate):** Staff attempts Resolve with an incomplete action;
  the blocking panel appears and the status is unchanged. After completing the
  action, Resolve succeeds.
- **E-05 (authorization routes):** Requester deep-links to the staff dashboard;
  Staff deep-links to the requester dashboard. Both see neutral Forbidden panels
  with no counts, tickets, or actions.

### 5.7 Regression

- **REG-01:** Lab 3 login/logout, forced password change, role navigation, and
  forbidden-route behavior.
- **REG-02:** queue search/filter/sort/pagination, claim/assign/reassign,
  IT Priority, and the existing status matrix (excluding the new gate).
- **REG-03:** Public Comments and Internal Notes visibility, append-only rules,
  and Requester forbidden access to notes.
- **REG-04:** Requester create/list/detail, attachment upload/download/soft
  removal, ownership protection, and selector removal.
- **REG-05:** seed/migration idempotency with new Action Taken rows; existing
  users, tickets, comments, notes, and attachments remain intact.
- **REG-06:** safe errors, removed-attachment `404`, and not-found behavior.

## 6. Test Commands

```bash
# Server unit + API + authorization + regression (from server/)
npm run test            # vitest run; requires PostgreSQL with migrated schema

# Client unit/UI + style (from client/)
npm run test            # vitest run; excludes e2e/

# E2E + responsive screenshots (from client/)
# Playwright starts/reuses the Vite dev server at 127.0.0.1:5173.
# Lab 4 specs mock /api/** deterministically and do not mutate the database.
npx playwright test tests/e2e/lab-04
npx playwright test
```

No standalone lint or typecheck scripts exist. Use `npm run build` in each
package to verify TypeScript, and record that result alongside the test run.

## 7. Final Results

Verified on 2026-10-31 from the working tree. All suites completed with zero
skipped or disabled tests.

| Suite | Command | Result |
|---|---|---|
| Server unit + API + authorization + regression | `npm run test` (in `server/`) | **Pass**: 13 files, 131 tests |
| Client unit/UI + style | `npm run test` (in `client/`) | **Pass**: 11 files, 99 tests |
| Lab 4 E2E + responsive evidence | `npx playwright test tests/e2e/lab-04` (in `client/`) | **Pass**: 9 tests |
| Full Playwright regression (Lab 1–4) | `npx playwright test` (in `client/`) | **Pass**: 64 tests |
| TypeScript build (server) | `npm run build` (in `server/`) | **Pass** |
| TypeScript build (client) | `npm run build` (in `client/`) | **Pass** |

Lab 4 automated coverage by layer:

| Layer | Files | Tests | Result |
|---|---|---|---|
| Server API/workflow | 5 | 41 | Pass |
| Client component/UI | 4 | 26 | Pass |
| Playwright E2E | 3 specs | 9 | Pass |

The Lab 4 E2E suite verifies staff create/edit actions, requester read-only
timelines, resolution blocked at zero actions and allowed afterward, requester
advisory-only resolution signals, staff and requester dashboard counts and
role isolation, safe dashboard failure handling, neutral not-found responses,
and desktop/tablet/mobile overflow checks. The responsive test writes the seven
current screenshots under `artifacts/lab-04/screenshots/`.

## 8. Known Limitations / Deferred Tests

- No real-time test: dashboards are pull/refetch read models. Freshness is
  tested by mutation followed by re-fetch, not by WebSocket delivery.
- No notification, email, SMS, SLA, escalation, or background-job tests; those
  features are excluded from Lab 4.
- Ticket-level status changes are not version-conflicted (BR-11). Tests assert
  the transition matrix and resolution gate, not ticket-level optimistic
  locking.
- Optimistic concurrency is covered deterministically by the `ActionsTaken`
  component stale-update test and the action API conflict tests. There is no
  E2E test that synchronizes two genuinely simultaneous browser writes.
- No load, performance, or large-dataset dashboard tests. Dashboard lists are
  bounded by contract; scale testing is deferred.
- No action attachment, time-tracking, template, or multi-performer tests;
  those features are excluded.
- Session-expiry timing remains covered by Lab 3 contract/unit inspection, not a
  wall-clock E2E wait.
