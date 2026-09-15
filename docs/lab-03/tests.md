# Lab 3 Test Plan and Results

## 1. Test Strategy

Test-Driven Development from the Sprint 3 contract (`specification.md`, `api-spec.md`,
`ui-spec.md`). The plan is written before implementation and proves: secure
authentication and forced password change; server-side (not UI-only) authorization and
ownership; Requester regression under the authenticated identity; queue query behavior;
ownership, IT Priority, and status-workflow rules; Public vs. Internal separation;
minimalist admin features including safety rules; migration without data loss; safe
errors; and responsive Zen Green presentation. Every Acceptance Criterion maps to at
least one planned test; every planned automated test names its actual test-file path.
`Final` records the last main-branch result (`Pass` / `Fail` + date); no test may be
skipped, disabled, or commented out at Done.

Test layers: **Unit** (fast, isolated rules), **API/integration** (status codes, shapes,
authz, ownership via Supertest against `app` + PostgreSQL), **UI component** (Vitest +
Testing Library, incl. style assertions), **Responsive/visual** (Playwright screenshots
at desktop/tablet/mobile + checklist), **Security/authorization** (direct-API negative
tests), **Migration/regression** (Lab 2 continuity), **E2E** (browser flows).

## 2. Planned-Test Table

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| U-01 | Unit | AC-05 | Password-rule validator (length, letter+number, confirm match, differ-from-current) | Weak/mismatched rejected; valid accepted | `server/tests/lab-03/password-rules.unit.test.ts` | Pass |
| U-02 | Unit | AC-17–AC-19 | Comment/note body validator (blank, whitespace-only, >2000 chars, HTML-escaping helper) | Invalid rejected; escaping neutralizes tags | `server/tests/lab-03/comment-validation.unit.test.ts` | Pass |
| U-03 | Unit | AC-15 | Status-transition matrix helper (all 8 states × roles) | Only matrix transitions allowed | `server/tests/lab-03/status-matrix.unit.test.ts` | Pass |
| U-04 | Unit | AC-24 | Email normalization + duplicate detection helper (case-insensitive) | `Admin@X` collides with `admin@x` | `server/tests/lab-03/email-normalize.unit.test.ts` | Pass |
| API-01 | API | AC-01 | Valid login (each role) | `200` + safe user + role, session cookie set, no hash | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-02 | Invalid login (unknown email; wrong password) | Both `401` with identical generic message, no session | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | AC-03 | Inactive-account login | Clear inactive message, no session | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | API | AC-04, AC-05 | Initial-password gate + change flow (weak → reject; valid → clear flag + enter app) | Normal APIs `403 PASSWORD_CHANGE_REQUIRED` until valid change | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | AC-06 | Logout + post-logout blocking (`/me`, queue, direct ticket URL) | Session destroyed; subsequent calls `401` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | API | AC-07, AC-10 | Identity spoofing: authenticated Requester sends another `requesterId` on create/list/detail | Server ignores spoof; own data only | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-07 | API | AC-08, AC-29 | Direct-API role rejection (Requester→queue/notes/admin; Staff→admin; unauthenticated→everything) | `401`/`403` with no protected payload | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-08 | API | AC-09, AC-18 | Requester requests Internal Notes (list + create + direct id) | `403`, no note content/count leaked | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-09 | API | AC-11, AC-12 | Queue search + filters + sort + pagination + invalid-param defaults | Correct subset/order/metadata; no `500` on bad params | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-10 | API | AC-13 | Claim/assign/reassign/unassign incl. invalid assignee (Requester, inactive, unknown) | Valid `200`; invalid `400/422` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-11 | API | AC-14 | IT Priority update (Staff ok; Requester `403`; `requestedPriority` immutable) | See expected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-12 | API | AC-15, AC-16 | Legal vs. illegal status transitions; Requester Resolve/Close attempt | Legal `200`; illegal `422` with allowed list; Requester `403` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-13 | API | AC-17 | Public Comment create/list per role (Requester-own, Staff, Admin) + validation | Saved with backend author/time; visible to all three; bad input `400` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-14 | API | AC-18 | Internal Note create/list (Staff/Admin ok) | Saved + visible to Staff/Admin only | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-15 | API | AC-19 | Edit/delete comment/note attempted (no such route) | `404/405`; history intact | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-16 | API | AC-20 | Requester resolved-signal (own ticket ok; other's `403`; idempotent) | Flag set, status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-17 | API | AC-21, AC-22 | Admin list + name/email search + single role filter | Correct subset, safe fields only | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-18 | API | AC-23, AC-24 | Admin create user (valid → `201` + forced-change flag; duplicate → `409`; bad role → `400`) | See expected | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-19 | API | AC-25 | Admin edit name/email/role/activation | Valid persists; bad role `400` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-20 | API | AC-26 | Admin set new initial password → next-login forced change | Flag set; login then gated (API-04 flow) | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-21 | API | AC-27, AC-28 | Self-deactivation + last-admin deactivation/demotion | Rejected; account/role unchanged | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| MIG-01 | API | AC-30 | Migration preserves Lab 2 tickets/ownership/attachments (counts + spot-check payloads) | All rows present, owners correct | `server/tests/lab-03/migration.api.test.ts` | Pass |
| MIG-02 | API | AC-10, AC-30 | Requester regression suite (create, own-list query, own-detail, attachment lifecycle, cross-owner `403`) | Lab 2 behavior intact under session identity | `server/tests/lab-03/requester-regression.api.test.ts` | Pass |
| MIG-03 | API | AC-30 | Safe-error audit (forced 500 path, forbidden, not-found) | Generic messages; no stack/SQL/hash/token/note leak | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| UI-01 | UI | AC-01–AC-03 | Login component: validation, busy state, safe vs. inactive messages | Inline errors; button disabled while pending; values preserved | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | AC-04, AC-05 | ChangePassword component: forced vs. voluntary modes, rule checklist, mismatch, success continuation | See expected | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-03 | UI | AC-11, AC-12 | StaffTicketQueue component: search/filter/sort/pagination/empty/no-results/forbidden/failure, badge rendering | Correct states + URL query sync | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-04 | UI | AC-13–AC-16, AC-20 | StaffTicketDetail component: owner/priority/status controls, confirmations, public-vs-internal distinction, resolved chip | Only permitted fields editable; destructive gated | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-05 | UI | AC-21–AC-28 | UserManagement component: search/role-filter/create/edit/set-password dialogs, duplicate + safety-rule messages | Field-level + callout errors; no password echo | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-06 | UI | AC-08, AC-10 | Shell role navigation (destinations per role; forbidden route panel; post-logout redirect) | No unauthorized links; deep-link blocked | `client/tests/lab-03/AppShell.test.tsx` | Pass |
| UI-07 | UI style | AC-30 | Zen Green style assertions (tokens `#006B3C/#0B7A46/#EAF6EF/#F5F7F6`, badges, read-only vs. editable, focus, validation placement) | Required classes/states present | `client/tests/lab-03/zen-green-style.test.tsx` | Pass |
| R-01 | Responsive | AC-30 | Queue/Detail/UserManagement/Login at desktop/tablet/mobile screenshots + no-overflow checklist | No clipping/overlap/h-scroll; table→card correct | `client/tests/e2e/lab-03/responsive.spec.ts` + `artifacts/lab-03/screenshots/` | Pass |
| E-01 | E2E | AC-01–AC-06 | Full auth flow: valid/invalid/inactive login, forced change, logout + direct-access block | App entry only after valid change; logout blocks | `client/tests/e2e/lab-03/authentication.spec.ts` | Pass |
| E-02 | E2E | AC-11–AC-20 | Staff ticket flow: queue search/filter/sort/page → open → claim → priority → status → public + internal → requester-signal → resolve/close | End-to-end state correct; Requester sees public only | `client/tests/e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E-03 | E2E | AC-21–AC-29 | Admin flow: search/filter → create → duplicate rejected → edit → set password → forced change at next login → self/last-admin blocked → non-admin forbidden | All safety rules observed in browser | `client/tests/e2e/lab-03/user-administration.spec.ts` | Pass |

## 3. Acceptance-Criterion Traceability

| AC | Covering tests |
|---|---|
| AC-01 | API-01, UI-01, E-01 |
| AC-02 | API-02, UI-01, E-01 |
| AC-03 | API-03, UI-01, E-01 |
| AC-04 | API-04, UI-02, E-01 |
| AC-05 | U-01, API-04, UI-02, E-01 |
| AC-06 | API-05, UI-06, E-01 |
| AC-07 | API-06, MIG-02, E-02 |
| AC-08 | API-07, UI-06, E-01, E-03 |
| AC-09 | API-08, E-02 |
| AC-10 | API-06, MIG-02, UI-06, E-02 |
| AC-11 | API-09, UI-03, E-02 |
| AC-12 | API-09, UI-03, R-01, E-02 |
| AC-13 | API-10, UI-04, E-02 |
| AC-14 | API-11, UI-04, E-02 |
| AC-15 | U-03, API-12, UI-04, E-02 |
| AC-16 | API-12, UI-04, E-02 |
| AC-17 | U-02, API-13, UI-04, E-02 |
| AC-18 | U-02, API-08, API-14, UI-04, E-02 |
| AC-19 | U-02, API-15, E-02 |
| AC-20 | API-16, UI-04, E-02 |
| AC-21 | API-17, UI-05, E-03 |
| AC-22 | API-17, UI-05, E-03 |
| AC-23 | API-18, UI-05, E-03 |
| AC-24 | U-04, API-18, UI-05, E-03 |
| AC-25 | API-19, UI-05, E-03 |
| AC-26 | API-20, UI-05, E-03 |
| AC-27 | API-21, UI-05, E-03 |
| AC-28 | API-21, UI-05, E-03 |
| AC-29 | API-07, UI-05, UI-06, E-03 |
| AC-30 | U-01–U-04, MIG-01–MIG-03, UI-07, R-01, E-01–E-03 |

Every AC has at least one API-level proof plus UI and/or E2E proof where user-visible.

## 4. Test Details (key scenarios)

### 4.1 Unit

- **U-01:** passwords `short`, `nonumber`, `mismatch`, `>128 chars`, `same-as-current` →
  rejected with named reasons; `Valid1234` + match → accepted.
- **U-02:** `""`, `"   "`, 2001-char body → rejected; `<script>` body stored/escaped so
  render output contains no executable tag.
- **U-03:** matrix fixture asserts every allowed pair passes and every other pair
  (including `Any → New` and Requester writes) fails.
- **U-04:** `ALICE@company.com` vs `alice@company.com` detected as duplicate;
  surrounding whitespace trimmed before comparison.

### 4.2 API / integration

- Auth suite seeds one active user per role (known password), one initial-password user,
  one inactive user. Asserts cookie set/cleared, safe `user` shape (no `passwordHash`),
  identical 401 messages, inactive messaging, gate `403 PASSWORD_CHANGE_REQUIRED`, and
  idempotent logout.
- Authorization suite drives every matrix cell by direct API call (no UI): cross-owner
  ticket/attachment access, spoofed `requesterId`, Requester→queue/notes/admin,
  Staff→admin, unauthenticated→protected, and the safe-error audit (forced exception →
  generic `500`; forbidden/not-found carry no leaked content).
- Queue suite seeds tickets spanning statuses/priorities/owners/categories and asserts
  search, each filter, combined filters, each sort key, pagination math, and fallback
  defaults for `status=Bogus`, `page=0`, `limit=999`.
- Ticket-detail suite walks claim → assign → invalid-assignee → priority → each legal
  transition → illegal transition (`422` + allowed list) → Requester Resolve attempt
  (`403`) → resolved-signal (flag without status change).
- Comments/notes suite asserts visibility per role, backend author/time (spoofed values
  ignored), validation, and absence of edit/delete routes.
- Admin suite asserts search/filter, `201` create with forced flag, `409` duplicate
  (including case variant), edit paths, set-password → forced-change round-trip,
  self-deactivation and last-admin rejections (state unchanged), and non-admin `403`s.
- Migration suite runs seed twice (idempotency), compares pre/post row counts and
  ownership joins, and verifies selector-era params are inert.

### 4.3 UI component

- Testing Library + user-event against mocked API layer: validation placement under
  fields, busy/disabled buttons, preserved input on failure, badge text, read-only vs.
  editable styling, public-vs-internal card distinction (separate headings, lock affordance
  on internal), dialog error callouts, and forbidden/failure panels.
- Style suite (UI-07) asserts the Zen Green tokens, badge classes, and focus visibility
  required by `ui-spec.md` so visual regressions fail fast without screenshots.

### 4.4 Responsive and visual

- Playwright captures Login, Change Password, Queue, Staff Detail, User Management (and
  Requester regression screens) at 1280px, 820px, and 390px into
  `artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.
- Checklist per capture: tokens/badges correct; editable vs. read-only distinct;
  validation adjacent to fields; button hierarchy + busy states; no clipping, overlap,
  horizontal overflow, or unreadable names; filters/pagination/threads usable; public vs.
  internal unmistakable at every width.

### 4.5 E2E

- **E-01 (authentication):** invalid → generic error; inactive → inactive notice;
  initial-password user → forced change (weak rejected, valid continues to role landing);
  logout → protected URLs redirect to login.
- **E-02 (staff flow):** staff searches/filters/sorts/pages the queue, opens a ticket,
  claims it, sets IT Priority, advances status (with confirmation), posts a public reply
  and an internal note; requesting the same ticket as its Requester shows the public
  thread + resolved-signal but no notes; signal appears as the Staff chip; Staff then
  resolves/closes.
- **E-03 (admin flow):** admin searches/filters, creates a user, hits duplicate-email,
  edits, sets a new initial password, logs in as that user to prove forced change,
  attempts self-deactivation and last-admin removal (both blocked), and proves
  Requester/Staff get forbidden screens on `/admin/users` and the admin APIs.

## 5. Test Commands

```bash
# Server (from server/)
npm run test            # vitest run — all lab-03 API/unit suites (needs PostgreSQL + migrated schema)

# Client unit/UI (from client/)
npm run test            # vitest run (excludes e2e/) — lab-03 component + style suites

# E2E (from client/, dev server at 127.0.0.1:5173 + API at localhost:3000)
npx playwright test     # lab-03 e2e specs + responsive screenshots
```

## 6. Final Results

Recorded after the release PR on `main` (all suites green, zero skips):

| Suite | Command | Result |
|---|---|---|
| Server unit + API (`server/tests/lab-03/`) | `npm run test` (in `server/`) | Pass |
| Client unit + UI (`client/tests/lab-03/`) | `npm run test` (in `client/`) | Pass |
| E2E + responsive (`client/tests/e2e/lab-03/`) | `npx playwright test` | Pass |

`Final` in §2 is updated to `Pass` only from these runs — never from feature-branch runs.

## 7. Known Limitations / Deferred Tests

- Rate-limit and account-lockout behavior for repeated failed logins is a hardening
  follow-up; tests assert only the safe generic error, not throttling thresholds.
- Session-expiry timing (8-hour) is verified by unit/contract inspection, not by a
  wall-clock E2E wait.
- The admin list has no server pagination by design (§4.5 exclusion); scale testing
  beyond comfortable single-page rendering is deferred to the sprint that introduces it.
- Load, SLA, notification, and analytics paths are excluded from Lab 3 and have no tests here.
