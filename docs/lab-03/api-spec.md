# Lab 3 API Specification

## 1. Base URL, Format, and Conventions

- Base path: `/api`. All paths below are relative to it.
- Request/response format: JSON (`Content-Type: application/json`), except multipart
  attachment upload which keeps its Lab 2 contract unchanged.
- Success envelope:
  ```json
  { "success": true, "data": {} }
  ```
- Error envelope (stable across all endpoints; messages are safe for display):
  ```json
  {
    "success": false,
    "error": { "code": "VALIDATION_ERROR", "message": "Title is required.", "fields": { "title": "Title is required." } }
  }
  ```
- `fields` appears only for field-level validation failures. `message` never contains
  stack traces, SQL, password hashes, tokens, or other users' private data.
- Pagination envelope for list endpoints:
  ```json
  { "success": true, "data": { "items": [], "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } } }
  ```

## 2. Authentication and Session

- Mechanism: server-issued session carried in an `httpOnly` cookie
  (`toktickit.session`; `SameSite=Lax`; `Secure` in production; 8-hour expiry with
  sliding renewal; destroyed on logout). The client never stores passwords or tokens in
  `localStorage`. CSRF: state-changing operations use POST/PATCH/DELETE only (never GET);
  `SameSite=Lax` is the baseline mitigation.
- Password storage: salted hash (bcrypt, cost ≥ 10). Plaintext passwords are accepted
  only inbound on login / change-password / set-password and are never persisted,
  logged, or returned.
- Every protected endpoint first checks authentication (`401` if missing/expired
  session), then the must-change-password gate (`403 PASSWORD_CHANGE_REQUIRED` for all
  normal APIs while the flag is set, except `GET /api/auth/me` and
  `POST /api/auth/change-password`), then role/ownership authorization (`403`).
- Authentication secrets (session secret, hash cost, seed passwords beyond documented
  local-only values) live in `server/.env` and are never committed.

### 2.1 POST `/api/auth/login` — Login

Auth: none. Rate-limiting recommended (e.g. 10 attempts/minute/IP) but not mandated.

Request:
```json
{ "email": "alice@company.com", "password": "Password123!" }
```
- `email`: required, trimmed, lowercased for lookup. `password`: required (empty
  rejected as validation, not as credential check).

Success `200`:
```json
{
  "success": true,
  "data": {
    "user": { "id": 3, "name": "Alice Johnson", "email": "alice@company.com", "role": "Requester", "isActive": true, "mustChangePassword": false }
  }
}
```
- If `mustChangePassword` is `true`, the client must route to Change Password; the
  session cookie is still set but normal APIs return `403 PASSWORD_CHANGE_REQUIRED`.
- The `user` object never contains `passwordHash`.

Errors:
- `400 VALIDATION_ERROR` — missing/blank email or password.
- `401 INVALID_CREDENTIALS` — unknown email or wrong password (identical message for
  both: `"Invalid email or password."`). Trace: AC-02.
- `403 ACCOUNT_INACTIVE` — account exists but `isActive = false`. Message:
  `"This account is inactive. Please contact an administrator."` No session is created.
  Trace: AC-03.

### 2.2 POST `/api/auth/logout` — Logout

Auth: session if present (idempotent: succeeds even with no/expired session).

Success `200`: `{ "success": true, "data": { "loggedOut": true } }` plus cleared
`toktickit.session` cookie. Afterwards `GET /api/auth/me` and all protected endpoints
return `401`. Trace: AC-06.

### 2.3 GET `/api/auth/me` — Current authenticated user

Auth: session required. Exempt from the must-change-password gate (so the client can
learn it must redirect).

Success `200`: same safe `user` shape as login.
Errors: `401 UNAUTHENTICATED` when no/expired session.

### 2.4 POST `/api/auth/change-password` — Mandatory + voluntary password change

Auth: session required (a freshly logged-in initial-password session qualifies).

Request:
```json
{ "newPassword": "Newpass123", "confirmPassword": "Newpass123" }
```
Rules: `newPassword` 8–128 chars, at least one letter and one number;
`confirmPassword` must match exactly; new password must differ from the current one
(checked via hash compare where feasible). Leading/trailing spaces are significant
(passwords are not trimmed).

Success `200`:
```json
{ "success": true, "data": { "user": { "id": 3, "mustChangePassword": false } } }
```
- Clears `mustChangePassword`, re-issues/refreshes the session, and lets the client
  enter the role-appropriate app.

Errors: `400 VALIDATION_ERROR` (with `fields.newPassword` / `fields.confirmPassword`),
`401 UNAUTHENTICATED`. Trace: AC-04, AC-05.

## 3. Authorization and Safe-Error Rules (apply to every endpoint below)

| Situation | Status | Code | Body behavior |
|---|---|---|---|
| No/expired session | `401` | `UNAUTHENTICATED` | Generic message; no data |
| Must-change-password session calling a normal API | `403` | `PASSWORD_CHANGE_REQUIRED` | Message directs to Change Password; no data |
| Authenticated but role lacks permission | `403` | `FORBIDDEN` | Generic message; **no protected payload** (e.g. Requester → notes returns 403 with no notes) |
| Ownership violation (another Requester's ticket/attachment) | `403` | `FORBIDDEN` | No ticket/attachment data disclosed |
| Truly missing resource (own scope) | `404` | `NOT_FOUND` | Generic message |
| Invalid input | `400` | `VALIDATION_ERROR` | Field-level `fields` map where applicable |
| Illegal status transition / stale write | `422` | `INVALID_TRANSITION` / `CONFLICT` | Allowed transitions listed in message |
| Duplicate email | `409` | `DUPLICATE_EMAIL` | Field-level message on `email` |
| Last-admin / self-deactivation violation | `400` or `403` | `ADMIN_SAFETY_RULE` | Clear rule message; nothing mutated |
| Unexpected server error | `500` | `INTERNAL_ERROR` | Generic `"Something went wrong. Please try again."` only |

Ownership-safe retrieval: `GET` on a ticket the caller may not access returns `403`
when the id exists but is forbidden, `404` only when it does not exist — and in neither
case is ticket content returned. List endpoints silently scope to permitted rows rather
than erroring.

## 4. Requester Regression APIs (authenticated Lab 2 continuity)

All Lab 2 contracts (shapes, validation, 5-file/5 MB/soft-removal, search/filter/sort/
pagination semantics) are preserved. The only breaking change is identity: the
`requesterId` query/body parameter, where it ever existed, is **ignored**; the session
identity is authoritative (AC-07, AC-10).

- `GET /api/categories` → active categories `[{ id, name }]` (auth required in Lab 3).
- `GET /api/related-systems` → active systems `[{ id, name }]` (auth required).
- `POST /api/tickets` — body `{ title, description, categoryId, relatedSystemId?, requestedPriority?, attachments? }`.
  New tickets start with `status: "New"`, `itPriority = requestedPriority`,
  `ownerId = null`, `requesterResolved = false`. Validation unchanged from Lab 2 plus
  immutable-priority rule. Success `201`.
- `GET /api/tickets?search=&categoryId=&status=&sort=&page=&limit=` — returns **only**
  the authenticated Requester's tickets. Same query semantics as Lab 2; invalid values
  fall back to defaults (`sort=updatedAt:desc`, `page=1`, `limit=10`, max `limit=50`).
- `GET /api/tickets/:id` — own ticket only; otherwise `403` (exists) / `404` (missing).
- Attachments — `POST /api/tickets/:id/attachments`, `GET /api/tickets/:id/attachments`,
  `GET /api/attachments/:fileId/download`, `DELETE /api/attachments/:fileId`
  (soft removal). Owner-only; removed files return `404 ATTACHMENT_REMOVED` on download.
- `POST /api/tickets/:id/resolved-signal` — Requester-only, own ticket. Sets
  `requesterResolved = true` + timestamp. Idempotent. Success `200` with
  `{ id, requesterResolved, requesterResolvedAt }`. Formal status is untouched (AC-20).

## 5. IT Staff Operations

All endpoints in §5 require role IT Staff or Administrator **only where the approved
matrix permits** (default: IT Staff; Administrator ticket powers are deny-by-default —
see specification §5.5). Requesters receive `403` with no data.

### 5.1 GET `/api/staff/tickets` — Ticket Queue

Query parameters:

| Param | Values | Default |
|---|---|---|
| `search` | keyword in ticket number, summary/title, description | `""` (no-op) |
| `status` | one of the 8 statuses; `all` disables | `all` |
| `itPriority` | `Low\|Medium\|High`; `all` disables | `all` |
| `requestedPriority` | `Low\|Medium\|High`; `all` disables | `all` |
| `owner` | `unassigned`, `me`, numeric user id, or `all` | `all` |
| `categoryId` | numeric id or `all` | `all` |
| `sort` | `updatedAt:desc\|updatedAt:asc\|createdAt:desc\|createdAt:asc\|itPriority:desc\|title:asc` | `updatedAt:desc` (secondary `id:asc`) |
| `page` | ≥ 1 | `1` |
| `limit` | 1–50 | `10` |

Invalid values fall back to defaults; never `500` (BR-22). `owner=me` resolves from the
session. Example: `GET /api/staff/tickets?search=vpn&status=Open&owner=unassigned&sort=updatedAt:desc&page=1&limit=10`.

Success `200` returns queue items with the justified display subset:
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 101, "ticketNumber": "TT-0101", "title": "Cannot login to VPN", "category": "Network", "requestedPriority": "High", "itPriority": "High", "status": "Open", "owner": { "id": 7, "name": "Sam Staff" }, "requester": { "id": 3, "name": "Alice Johnson" }, "requesterResolved": false, "createdAt": "...", "updatedAt": "..." }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 37, "totalPages": 4 }
  }
}
```
(`ticketNumber` is the Lab 2 official number where implemented, otherwise the numeric
`id` formatted per the Lab 2 convention.) Trace: AC-11, AC-12.

### 5.2 GET `/api/staff/tickets/:id` — Staff ticket detail

Success `200` returns the full ticket: classification, both priorities, status, owner,
requester, timestamps, `requesterResolved` flag, attachments metadata (active only for
download), plus `commentsCount`/`notesCount` (not the thread bodies — threads have
dedicated endpoints). `403` for Requesters/out-of-matrix roles; `404` if missing.
Trace: AC-08, AC-10.

### 5.3 PATCH `/api/staff/tickets/:id/owner` — Claim / assign / reassign

Request: exactly one of:
```json
{ "ownerId": 7 }
{ "ownerId": null }
{ "claim": true }
```
- `claim: true` assigns the session user (must be qualified Staff/Admin).
- `ownerId` must reference an **active** IT Staff or Administrator user; Requesters,
  inactive, or unknown ids → `400/422`.
- `ownerId: null` unassigns (permitted roles only; record the change).

Success `200`: `{ "success": true, "data": { "id": 101, "owner": { "id": 7, "name": "Sam Staff" } } }`. Trace: AC-13.

### 5.4 PATCH `/api/staff/tickets/:id/priority` — Set IT Priority

Request: `{ "itPriority": "High" }` (must be `Low|Medium|High`).
- `requestedPriority` is read-only; any attempt to write it here is ignored (or 400 if
  sent as `requestedPriority` — contract fixes: ignored with a warning-free success on
  the IT field, to avoid brittle clients; tests assert `requestedPriority` never changes).
- Requesters → `403`.

Success `200`: `{ "success": true, "data": { "id": 101, "requestedPriority": "Medium", "itPriority": "High" } }`. Trace: AC-14.

### 5.5 PATCH `/api/staff/tickets/:id/status` — Permitted status change

Request: `{ "status": "In Progress" }` (must be one of the 8 statuses).
- The server validates against the transition matrix (specification BR-17) from the
  ticket's current status; illegal transitions → `422 INVALID_TRANSITION` with the
  allowed list; unknown status → `400`.
- Requesters → `403` (including Resolved/Closed attempts — AC-16).

Success `200`: `{ "success": true, "data": { "id": 101, "status": "In Progress", "updatedAt": "..." } }`. Trace: AC-15, AC-16.

## 6. Public Comments and Internal Notes

### 6.1 Public Comments

- `GET /api/staff/tickets/:id/comments` (Staff/Admin) and
  `GET /api/tickets/:id/comments` (owning Requester + Staff/Admin-by-ticket-access).
  Query: `?page=&limit=` (defaults 1/20, max 50), ordered `createdAt:asc`.
- `POST` to the same paths with `{ "body": "..." }` (1–2000 chars after trim;
  whitespace-only → `400`). Author and timestamp come from the session/backend.
- Item shape:
  ```json
  { "id": 12, "ticketId": 101, "author": { "id": 3, "name": "Alice Johnson", "role": "Requester" }, "body": "Still failing after restart.", "createdAt": "..." }
  ```
- Requester access is limited to their own tickets (otherwise `403`). No edit/delete
  endpoints exist in Lab 3. Trace: AC-17, AC-19.

### 6.2 Internal Notes (role-restricted)

- `GET /api/staff/tickets/:id/notes` and `POST /api/staff/tickets/:id/notes` —
  IT Staff and in-matrix Administrators only.
- Same body rules and item shape as comments (with `role` of author).
- Requester (or any out-of-matrix caller) → `403 FORBIDDEN` with **no note array,
  count, or content** in the response. The existence of notes is not disclosed.
  Trace: AC-09, AC-18, AC-19.

## 7. Administrator User Management

All endpoints in §7 require role Administrator. Requester and IT Staff receive `403`
with no user payload (AC-29).

### 7.1 GET `/api/admin/users` — User list

Query: `?search=&role=` where `search` matches name or email (case-insensitive,
substring) and `role` is `Requester|IT Staff|Administrator` (absent or invalid →
unfiltered, per minimalist contract; invalid role never errors the list).
No pagination required in Lab 3 (return all matches, ordered `name:asc, id:asc`).
Minimalist response exposes only list-safe fields:
```json
{ "success": true, "data": { "items": [ { "id": 3, "name": "Alice Johnson", "email": "alice@company.com", "role": "Requester", "isActive": true } ] } }
```
Never includes `passwordHash`. Trace: AC-21, AC-22.

### 7.2 POST `/api/admin/users` — Create user

Request:
```json
{ "name": "New Staff", "email": "staff4@company.com", "role": "IT Staff", "isActive": true, "initialPassword": "Password123!" }
```
- `name`: required, 1–100 chars (trimmed, non-blank). `email`: required, valid shape,
  unique case-insensitively. `role`: required, exactly one of the 3 values.
  `isActive`: optional, default `true`. `initialPassword`: required, 8–128 chars
  (complexity recommended but only length enforced at creation since the user must
  change it; confirmation is a UI concern).
- Creates the user with a hash of `initialPassword` and `mustChangePassword = true`.

Success `201` returns the safe user object + `mustChangePassword: true`. The plaintext
password is never echoed back.
Errors: `400` validation (incl. invalid role), `409 DUPLICATE_EMAIL`. Trace: AC-23, AC-24.

### 7.3 PATCH `/api/admin/users/:id` — Edit name, email, role, activation

Request (any subset): `{ "name": "...", "email": "...", "role": "IT Staff", "isActive": false }`.
Same field rules as creation. Safety rules enforced in order:
1. Self-deactivation (`isActive: false` on the session user) → rejected (AC-27).
2. Demoting/deactivating the last active Administrator → `400/409 ADMIN_SAFETY_RULE` (AC-28).
3. Duplicate email → `409 DUPLICATE_EMAIL` (AC-24).

Success `200` returns the safe updated user. Unknown id → `404`.

### 7.4 POST `/api/admin/users/:id/set-password` — New initial password

Request: `{ "initialPassword": "Newpass123" }` (8–128 chars).
Sets the hash and flips `mustChangePassword = true`. The plaintext is never returned.
Success `200`: `{ "success": true, "data": { "id": 5, "mustChangePassword": true } }`.
Trace: AC-26. Self-targeting is allowed (an admin may rotate their own password this
way, but it still forces a change at next login — the safety rule only blocks
self-*deactivation*, not self-password-change).

## 8. Status Codes Used

`200` retrieval/update/logout/me, `201` ticket/user/comment/note creation,
`400` validation / admin safety, `401` unauthenticated / bad credentials,
`403` forbidden / inactive-session gate / password-change gate,
`404` missing (or removed attachment), `409` duplicate email / last-admin conflict,
`422` illegal status transition, `500` safe generic fallback.

## 9. Acceptance Mapping

- AC-01 → §2.1; AC-02 → §2.1; AC-03 → §2.1; AC-04 → §2.1/§2.4 + gate in §2;
  AC-05 → §2.4; AC-06 → §2.2/§2.3; AC-07 → §4 gate; AC-08 → §3 + §5/§7;
  AC-09 → §6.2; AC-10 → §4; AC-11/AC-12 → §5.1; AC-13 → §5.3; AC-14 → §5.4;
  AC-15/AC-16 → §5.5; AC-17 → §6.1; AC-18 → §6.2; AC-19 → §6;
  AC-20 → §4 resolved-signal; AC-21/AC-22 → §7.1; AC-23 → §7.2; AC-24 → §7.2/§7.3;
  AC-25 → §7.3; AC-26 → §7.4; AC-27/AC-28 → §7.3; AC-29 → §7 gate; AC-30 → §3 + §4/§5.
