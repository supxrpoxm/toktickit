# Lab 4 API Specification

## 1. Base URL, Format, and Conventions

- Base path: `/api`. All paths below are relative to it.
- Request/response format: JSON (`Content-Type: application/json`).
- Success envelope:

  ```json
  { "success": true, "data": {} }
  ```

- Error envelope (stable across all endpoints; messages are safe for display):

  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Summary is required.",
      "fields": { "summary": "Summary is required." }
    }
  }
  ```

- `fields` appears only for field-level validation failures. `message` never
  contains stack traces, SQL, database names, password hashes, tokens, Internal
  Note content, or another Requester's private data.
- Pagination envelope for list endpoints:

  ```json
  {
    "success": true,
    "data": {
      "items": [],
      "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
    }
  }
  ```

- Conflict responses use the same envelope with an additional `conflict` object.
  It contains only data the caller is already authorized to read:

  ```json
  {
    "success": false,
    "error": {
      "code": "STALE_UPDATE",
      "message": "This action was updated by someone else. Review the latest version and try again.",
      "conflict": {
        "expectedVersion": 2,
        "currentVersion": 3,
        "current": { "...action item...": true }
      }
    }
  }
  ```

## 2. Authentication and Authorization

- Authentication uses the existing Lab 3 httpOnly session cookie
  (`toktickit.session`). The client sends credentials; no password or token is
  stored in JavaScript storage.
- Every endpoint below first checks authentication (`401 UNAUTHENTICATED`), then
  the must-change-password gate (`403 PASSWORD_CHANGE_REQUIRED`), then role and
  ownership authorization (`403 FORBIDDEN`).
- Authorization is server-side. Hiding a control in the UI is feedback only.
- The authorization matrix from `specification.md` §5.5 is normative:

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
  | Read/write Internal Notes | ❌ | ✅ | ✅ |
  | Manage users | ❌ | ❌ | ✅ |

- An Administrator retains the staff-area access implemented in Lab 3. Lab 4
  does not introduce new Administrator-only ticket powers.

## 3. Actions Taken Resource

### 3.1 Action item shape

```json
{
  "id": 501,
  "ticketId": 101,
  "ticketNumber": "TT-0101",
  "summary": "Reset the VPN gateway",
  "details": "Restarted the gateway and verified authentication from two clients.",
  "status": "In Progress",
  "performedBy": {
    "id": 7,
    "name": "Sam Staff",
    "role": "IT Staff"
  },
  "dueAt": "2026-11-02T09:00:00.000Z",
  "completedAt": null,
  "version": 2,
  "createdAt": "2026-10-30T08:00:00.000Z",
  "updatedAt": "2026-10-30T09:15:00.000Z"
}
```

Rules:

- `status` is one of `Open`, `In Progress`, `Completed`, `Cancelled`.
- `performedBy.role` is the display label (`IT Staff` or `Administrator`).
- `completedAt` is set only for `Completed`; it is `null` for the other statuses.
- `version` starts at `1` and increments on every successful mutation.
- `ticketNumber` is the existing display number (`TT-####`).

### 3.2 Action status model

| Status | Meaning | Terminal |
|---|---|---|
| `Open` | Recorded, not started | No |
| `In Progress` | Work underway | No |
| `Completed` | Work finished | Yes |
| `Cancelled` | Work intentionally abandoned; record retained | Yes |

Permitted transitions:

| From → To | Permitted |
|---|---|
| `Open → In Progress`, `Open → Completed`, `Open → Cancelled` | Yes |
| `In Progress → Completed`, `In Progress → Cancelled` | Yes |
| Any terminal status → any other status | No |
| Same status with no other change | Yes, idempotent; no version increment |

A new action always starts as `Open`. There is no reopen transition; create a
follow-up action instead.

### 3.3 GET `/api/staff/tickets/:id/actions` — List Actions Taken (staff)

Auth: IT Staff or Administrator.

Query parameters:

| Param | Values | Default |
|---|---|---|
| `status` | `Open\|In Progress\|Completed\|Cancelled\|all` | `all` |
| `sort` | `createdAt:desc\|createdAt:asc\|updatedAt:desc\|updatedAt:asc` | `createdAt:desc` |
| `page` | ≥ 1 | `1` |
| `limit` | 1–50 | `20` |

Invalid values fall back to defaults; they never produce `500`. Ordering is
deterministic with a secondary `id:asc` sort.

Success `200`:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 501,
        "ticketId": 101,
        "ticketNumber": "TT-0101",
        "summary": "Reset the VPN gateway",
        "details": "Restarted the gateway and verified authentication from two clients.",
        "status": "In Progress",
        "performedBy": { "id": 7, "name": "Sam Staff", "role": "IT Staff" },
        "dueAt": "2026-11-02T09:00:00.000Z",
        "completedAt": null,
        "version": 2,
        "createdAt": "2026-10-30T08:00:00.000Z",
        "updatedAt": "2026-10-30T09:15:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```

Errors: `401`, `403`, `404` when the ticket does not exist. Trace: AC-03.

### 3.4 POST `/api/staff/tickets/:id/actions` — Create Action Taken

Auth: IT Staff or Administrator. Any qualified staff member may create an action
on an actionable ticket, regardless of ownership (BR-02).

Request:

```json
{
  "summary": "Reset the VPN gateway",
  "details": "Restarted the gateway and verified authentication from two clients.",
  "dueAt": "2026-11-02T09:00:00.000Z"
}
```

Validation:

| Field | Rule |
|---|---|
| `summary` | Required; trimmed; 1–200 characters |
| `details` | Optional; trimmed; 0–2000 characters |
| `dueAt` | Optional; valid ISO-8601 date-time; `null` allowed |

- The server sets `status = "Open"`, `version = 1`, `performedById` from the
  session, and all timestamps.
- Client-supplied `status`, `performedBy`, `performedById`, `ticketId`,
  `version`, `createdAt`, `updatedAt`, or `completedAt` values are ignored.
- The ticket must be in `New`, `Open`, `In Progress`, `Waiting for Requester`, or
  `Reopened`. Otherwise return `409 TICKET_NOT_ACTIONABLE`.

Success `201`:

```json
{
  "success": true,
  "data": {
    "id": 501,
    "ticketId": 101,
    "ticketNumber": "TT-0101",
    "summary": "Reset the VPN gateway",
    "details": "Restarted the gateway and verified authentication from two clients.",
    "status": "Open",
    "performedBy": { "id": 7, "name": "Sam Staff", "role": "IT Staff" },
    "dueAt": "2026-11-02T09:00:00.000Z",
    "completedAt": null,
    "version": 1,
    "createdAt": "2026-10-30T08:00:00.000Z",
    "updatedAt": "2026-10-30T08:00:00.000Z"
  }
}
```

Errors:

- `400 VALIDATION_ERROR` with `fields`.
- `401 UNAUTHENTICATED`.
- `403 FORBIDDEN` for Requesters.
- `404 NOT_FOUND` for a missing ticket.
- `409 TICKET_NOT_ACTIONABLE` for a resolved/closed/cancelled ticket.
- `500 INTERNAL_ERROR` safe fallback.

Trace: AC-01, AC-02, AC-09.

### 3.5 PATCH `/api/staff/tickets/:id/actions/:actionId` — Update Action Taken

Auth: IT Staff or Administrator. The caller must be one of:

- the action's `performedBy` user,
- the current Ticket Owner,
- an Administrator.

Other IT Staff receive `403 FORBIDDEN` with no action payload.

Request (at least one mutable field plus `version`):

```json
{
  "version": 2,
  "summary": "Reset the VPN gateway and verify MFA",
  "details": "Gateway reset; MFA verification completed with two clients.",
  "dueAt": "2026-11-02T12:00:00.000Z",
  "status": "Completed"
}
```

Rules:

- `version` is required and must be an integer ≥ 1.
- `summary`, `details`, and `dueAt` follow the create rules.
- `status` must be one of the four action statuses and must be a permitted
  transition from the current status (BR-03). A request that changes nothing
  (same status and identical fields) is an idempotent no-op and does not
  increment `version`; changing any field still increments it.
- Terminal actions cannot be modified; return `409 ACTION_CONFLICT` with the
  current action.
- The action must belong to the ticket in the path. Otherwise return `404
  NOT_FOUND` without disclosing the action.
- The ticket must be actionable; otherwise return `409 TICKET_NOT_ACTIONABLE`.
- On success, `version` increments, `updatedAt` changes, and `completedAt` is
  set when the status becomes `Completed`.

Success `200`: the updated action item (same shape as §3.1).

Errors:

- `400 VALIDATION_ERROR` (including missing/invalid `version`).
- `403 FORBIDDEN`.
- `404 NOT_FOUND`.
- `409 STALE_UPDATE` when `version` does not match.
- `409 ACTION_CONFLICT` when the action is terminal.
- `409 TICKET_NOT_ACTIONABLE`.
- `422 INVALID_ACTION_TRANSITION` with the allowed targets.
- `500 INTERNAL_ERROR`.

Trace: AC-04, AC-05, AC-06, AC-08, AC-09.

### 3.6 GET `/api/tickets/:id/actions` — Requester read of Actions Taken

Auth: Requester (own ticket), IT Staff, or Administrator. This is the
Requester-facing read path; staff should use §3.3 for staff context.

Query parameters: `status`, `sort`, `page`, `limit` with the same defaults as
§3.3.

Success `200`: same item/pagination shape as §3.3.

Rules:

- A Requester may read actions only for a ticket they own. Another Requester's
  ticket returns `403 FORBIDDEN` when it exists and `404 NOT_FOUND` when it does
  not; neither response contains action data.
- Requesters cannot create or update actions; those attempts return `403`.
- Actions Taken are visible to the owning Requester. Internal Notes remain
  staff-only and are never bundled into this response.

Trace: AC-03, AC-10.

## 4. Dashboards

### 4.1 GET `/api/staff/dashboard` — IT Staff Dashboard

Auth: IT Staff or Administrator. Requesters receive `403 FORBIDDEN` with no
dashboard data.

Query parameters:

| Param | Values | Default |
|---|---|---|
| `window` | `7d\|30d\|all` | `7d` (affects `recentActions` only) |
| `limit` | 1–10 | `5` (maximum items per list panel) |

Invalid values fall back to defaults; never `500`. All lists are bounded.

Success `200`:

```json
{
  "success": true,
  "data": {
    "summary": {
      "myOpenTickets": 4,
      "unassignedTickets": 6,
      "inProgressTickets": 3,
      "waitingForRequester": 2,
      "requesterResolvedTickets": 1,
      "incompleteActions": 5,
      "overdueActions": 2
    },
    "myWork": [
      {
        "id": 101,
        "ticketNumber": "TT-0101",
        "title": "Cannot login to VPN",
        "status": "In Progress",
        "requestedPriority": "High",
        "itPriority": "High",
        "owner": { "id": 7, "name": "Sam Staff" },
        "requester": { "id": 3, "name": "Alice Johnson" },
        "requesterResolved": false,
        "incompleteActionCount": 2,
        "overdueActionCount": 1,
        "updatedAt": "2026-10-30T09:15:00.000Z"
      }
    ],
    "unassigned": [
      {
        "id": 102,
        "ticketNumber": "TT-0102",
        "title": "Printer offline in Lab 3",
        "status": "New",
        "requestedPriority": "Medium",
        "itPriority": "Medium",
        "owner": null,
        "requester": { "id": 4, "name": "Brandon Lee" },
        "requesterResolved": false,
        "incompleteActionCount": 0,
        "overdueActionCount": 0,
        "updatedAt": "2026-10-30T08:30:00.000Z"
      }
    ],
    "attention": [
      {
        "id": 103,
        "ticketNumber": "TT-0103",
        "title": "Email quota warning",
        "status": "Waiting for Requester",
        "requestedPriority": "Low",
        "itPriority": "Medium",
        "owner": { "id": 7, "name": "Sam Staff" },
        "requester": { "id": 5, "name": "Carmen Diaz" },
        "requesterResolved": true,
        "incompleteActionCount": 1,
        "overdueActionCount": 1,
        "attentionReasons": ["Requester says resolved", "Overdue action"],
        "updatedAt": "2026-10-29T16:40:00.000Z"
      }
    ],
    "recentActions": [
      {
        "id": 501,
        "ticketId": 101,
        "ticketNumber": "TT-0101",
        "ticketTitle": "Cannot login to VPN",
        "summary": "Reset the VPN gateway",
        "status": "In Progress",
        "performedBy": { "id": 7, "name": "Sam Staff" },
        "dueAt": "2026-11-02T09:00:00.000Z",
        "completedAt": null,
        "updatedAt": "2026-10-30T09:15:00.000Z"
      }
    ],
    "generatedAt": "2026-10-30T10:42:00.000Z"
  }
}
```

Count definitions (normative):

- **Active ticket:** status is `New`, `Open`, `In Progress`, `Waiting for
  Requester`, or `Reopened`.
- `myOpenTickets`: active tickets owned by the session user.
- `unassignedTickets`: active tickets with `ownerId = null`.
- `inProgressTickets`: all active tickets with status `In Progress`.
- `waitingForRequester`: all active tickets with status `Waiting for Requester`.
- `requesterResolvedTickets`: active tickets with `requesterResolved = true`.
- `incompleteActions`: actions in `Open` or `In Progress` on active tickets.
- `overdueActions`: incomplete actions on active tickets with `dueAt < now`.

List definitions:

- `myWork`: active tickets owned by the session user, ordered by IT Priority
  (`High` first), then `updatedAt` descending, limited by `limit`.
- `unassigned`: active unassigned tickets, ordered by `updatedAt` descending,
  limited by `limit`.
- `attention`: active tickets with the Requester resolved signal, status
  `Waiting for Requester`, or at least one overdue incomplete action. Ordered by
  requester-resolved first, then overdue, then waiting, then `updatedAt`
  ascending, limited by `limit`.
- `recentActions`: actions on staff-visible tickets within `window`, ordered by
  `updatedAt` descending, limited by `limit`.

Errors: `401`, `403`, `500` safe fallback. Trace: AC-11, AC-12, AC-14, AC-15,
AC-16.

### 4.2 GET `/api/requester/dashboard` — Requester Dashboard

Auth: Requester only. IT Staff and Administrators receive `403 FORBIDDEN` with
no data. This endpoint is strictly self-scoped.

Query parameters:

| Param | Values | Default |
|---|---|---|
| `limit` | 1–10 | `5` (maximum items per list panel) |

Invalid values fall back to defaults; never `500`.

Success `200`:

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTickets": 8,
      "openTickets": 2,
      "inProgressTickets": 1,
      "waitingForRequester": 1,
      "resolvedTickets": 2,
      "closedTickets": 1,
      "cancelledTickets": 1
    },
    "recentTickets": [
      {
        "id": 101,
        "ticketNumber": "TT-0101",
        "title": "Cannot login to VPN",
        "status": "In Progress",
        "requestedPriority": "High",
        "itPriority": "High",
        "owner": { "id": 7, "name": "Sam Staff" },
        "updatedAt": "2026-10-30T09:15:00.000Z"
      }
    ],
    "latestActions": [
      {
        "id": 501,
        "ticketId": 101,
        "ticketNumber": "TT-0101",
        "ticketTitle": "Cannot login to VPN",
        "summary": "Reset the VPN gateway",
        "status": "In Progress",
        "performedBy": { "id": 7, "name": "Sam Staff" },
        "dueAt": "2026-11-02T09:00:00.000Z",
        "completedAt": null,
        "updatedAt": "2026-10-30T09:15:00.000Z"
      }
    ],
    "needsAttention": [
      {
        "id": 103,
        "ticketNumber": "TT-0103",
        "title": "Email quota warning",
        "status": "Waiting for Requester",
        "requestedPriority": "Low",
        "itPriority": "Medium",
        "owner": { "id": 7, "name": "Sam Staff" },
        "updatedAt": "2026-10-29T16:40:00.000Z"
      }
    ],
    "generatedAt": "2026-10-30T10:42:00.000Z"
  }
}
```

Count definitions:

- `totalTickets`: all tickets submitted by the session Requester.
- `openTickets`: own tickets in `New`, `Open`, or `Reopened`.
- `inProgressTickets`: own tickets in `In Progress`.
- `waitingForRequester`: own tickets in `Waiting for Requester`.
- `resolvedTickets`: own tickets in `Resolved`.
- `closedTickets`: own tickets in `Closed`.
- `cancelledTickets`: own tickets in `Cancelled`.

List definitions:

- `recentTickets`: own tickets ordered by `updatedAt` descending, limited by
  `limit`.
- `latestActions`: actions on own tickets ordered by `updatedAt` descending,
  limited by `limit`.
- `needsAttention`: own tickets in `Waiting for Requester`, ordered by
  `updatedAt` ascending (oldest first), limited by `limit`.

Errors: `401`, `403`, `500` safe fallback. Trace: AC-13, AC-14, AC-15, AC-16.

## 5. Ticket Resolution Gate

The existing Lab 3 endpoint is extended; all other status behavior is unchanged.

### 5.1 PATCH `/api/staff/tickets/:id/status`

Auth: IT Staff or Administrator (Lab 3 matrix). Requesters remain `403`.

Request:

```json
{ "status": "Resolved" }
```

When `status` is `Resolved`, the ticket is not already `Resolved`, and the
ticket currently has at least one action in `Open` or `In Progress`, the server
returns `409 ACTIONS_INCOMPLETE` and does not change the ticket:

```json
{
  "success": false,
  "error": {
    "code": "ACTIONS_INCOMPLETE",
    "message": "Complete or cancel all Actions Taken before resolving this ticket.",
    "conflict": {
      "blockingActions": [
        {
          "id": 501,
          "summary": "Reset the VPN gateway",
          "status": "In Progress",
          "performedBy": { "id": 7, "name": "Sam Staff" },
          "dueAt": "2026-11-02T09:00:00.000Z"
        }
      ]
    }
  }
}
```

- `Completed` and `Cancelled` actions do not block resolution.
- Once all actions are terminal, the same request succeeds with the existing
  `200` status response.
- `Closed` from `Resolved` remains governed by the Lab 3 transition matrix.
- `Reopened` makes Actions Taken actionable again; the gate re-applies on the
  next resolution attempt.
- The gate does not apply to other status transitions.

Trace: AC-07, AC-09.

## 6. Conflict and Stale-Update Handling

### 6.1 Version contract

- `version` is an integer that starts at `1`.
- Every successful `PATCH` that changes data increments it by exactly one.
- The client must send the `version` it last received.
- A same-status no-op update (no field changes) returns `200` without
  incrementing `version`; changing any field still increments it.
- There is no partial write: if any validation, authorization, conflict, or
  transition check fails, the stored action is unchanged.

### 6.2 Conflict codes

| Situation | HTTP | Code | Response contents |
|---|---|---|---|
| `version` missing or invalid | `400` | `VALIDATION_ERROR` | `fields.version` |
| `version` does not match stored version | `409` | `STALE_UPDATE` | `expectedVersion`, `currentVersion`, current action |
| Action is `Completed`/`Cancelled` | `409` | `ACTION_CONFLICT` | Current action |
| Ticket is `Resolved`/`Closed`/`Cancelled` | `409` | `TICKET_NOT_ACTIONABLE` | Ticket status and safe message |
| Illegal action status transition | `422` | `INVALID_ACTION_TRANSITION` | Allowed targets in `fields.status` |
| Resolution blocked by incomplete actions | `409` | `ACTIONS_INCOMPLETE` | `blockingActions` list |

### 6.3 Stale update example

Request:

```http
PATCH /api/staff/tickets/101/actions/501
Content-Type: application/json

{ "version": 2, "status": "Completed" }
```

If the stored action is already at `version: 3`, response:

```json
{
  "success": false,
  "error": {
    "code": "STALE_UPDATE",
    "message": "This action was updated by someone else. Review the latest version and try again.",
    "conflict": {
      "expectedVersion": 2,
      "currentVersion": 3,
      "current": {
        "id": 501,
        "ticketId": 101,
        "ticketNumber": "TT-0101",
        "summary": "Reset the VPN gateway and verify MFA",
        "details": "Gateway reset; MFA verification completed.",
        "status": "In Progress",
        "performedBy": { "id": 7, "name": "Sam Staff", "role": "IT Staff" },
        "dueAt": "2026-11-02T12:00:00.000Z",
        "completedAt": null,
        "version": 3,
        "createdAt": "2026-10-30T08:00:00.000Z",
        "updatedAt": "2026-10-30T10:05:00.000Z"
      }
    }
  }
}
```

The client must preserve the user's draft, show the current action, and require
an explicit reload or review before retrying. Silent retries are forbidden.

### 6.4 Ticket status conflict boundary

Actions Taken use version-based optimistic concurrency. Ticket status changes
continue to use the Lab 3 transition matrix plus the resolution gate; a legal
ticket status change from a stale screen is not version-rejected in Lab 4. This
is intentional and must not be represented as ticket-level optimistic locking in
tests or documentation.

## 7. Validation Rules

| Field / parameter | Rule | Failure |
|---|---|---|
| `summary` | Required; trimmed; 1–200 chars | `400`, `fields.summary` |
| `details` | Optional; trimmed; 0–2000 chars | `400`, `fields.details` |
| `dueAt` | Optional ISO-8601 date-time or `null` | `400`, `fields.dueAt` |
| `status` (action) | `Open`, `In Progress`, `Completed`, `Cancelled` | `400` or `422` |
| `version` | Required integer ≥ 1 on update | `400`, `fields.version` |
| `page` | Integer ≥ 1; invalid falls back to `1` | Fallback, never `500` |
| `limit` | 1–50 for actions; 1–10 for dashboards; invalid falls back | Fallback, never `500` |
| `window` | `7d`, `30d`, `all`; invalid falls back to `7d` | Fallback, never `500` |
| `:id`, `:actionId` | Positive integer | `404` |
| `actionId` under `:id` | Must belong to that ticket | `404`, no action data |

All validation messages are safe for direct display.

## 8. Status Codes and Error Codes

| HTTP | Code | When |
|---|---|---|
| `200` | — | Retrieval, update, same-status no-op, dashboard |
| `201` | — | Action created |
| `400` | `VALIDATION_ERROR` | Invalid input, missing `version` |
| `401` | `UNAUTHENTICATED` | No/expired session |
| `403` | `PASSWORD_CHANGE_REQUIRED` | Initial-password session on a normal API |
| `403` | `FORBIDDEN` | Role, ownership, or action-modification violation |
| `404` | `NOT_FOUND` | Missing ticket, missing action, action not on ticket |
| `409` | `STALE_UPDATE` | Version mismatch |
| `409` | `ACTION_CONFLICT` | Terminal action update |
| `409` | `TICKET_NOT_ACTIONABLE` | Action write on resolved/closed/cancelled ticket |
| `409` | `ACTIONS_INCOMPLETE` | Resolution blocked by incomplete actions |
| `422` | `INVALID_ACTION_TRANSITION` | Illegal action status transition |
| `500` | `INTERNAL_ERROR` | Unexpected failure; generic safe message only |

Safe-error rules:

- Forbidden responses contain no action, ticket, note, or user payload.
- Not-found responses do not disclose whether a resource exists outside the
  caller's scope.
- Conflict responses include only data the caller is authorized to read.
- No response contains stack traces, SQL, hashes, tokens, or Internal Notes.

## 9. Examples

### 9.1 Create an action

```http
POST /api/staff/tickets/101/actions
Content-Type: application/json

{
  "summary": "Reset the VPN gateway",
  "details": "Restarted the gateway and verified authentication from two clients.",
  "dueAt": "2026-11-02T09:00:00.000Z"
}
```

### 9.2 Complete an action

```http
PATCH /api/staff/tickets/101/actions/501
Content-Type: application/json

{
  "version": 2,
  "status": "Completed"
}
```

### 9.3 Blocked resolution

```http
PATCH /api/staff/tickets/101/status
Content-Type: application/json

{ "status": "Resolved" }
```

Response: `409 ACTIONS_INCOMPLETE` with the `blockingActions` list shown in §5.1.

### 9.4 Staff dashboard

```http
GET /api/staff/dashboard?window=7d&limit=5
```

### 9.5 Requester dashboard

```http
GET /api/requester/dashboard?limit=5
```

## 10. Acceptance Mapping

| AC | API coverage |
|---|---|
| AC-01 | §3.4 create action |
| AC-02 | §3.4, §3.5, §7 validation |
| AC-03 | §3.3 list, §3.6 Requester read |
| AC-04 | §3.5 update authorization |
| AC-05 | §3.2 lifecycle, §3.5, §6.2 |
| AC-06 | §3.2 cancellation, §3.5 terminal rules |
| AC-07 | §5 resolution gate |
| AC-08 | §6 version contract and stale update |
| AC-09 | §3.4, §3.5 actionability |
| AC-10 | §3.6 Requester read + authorization matrix |
| AC-11 | §4.1 staff dashboard summary |
| AC-12 | §4.1 staff dashboard lists |
| AC-13 | §4.2 Requester dashboard |
| AC-14 | §2 authorization matrix + dashboard gates |
| AC-15 | §4.1, §4.2, §7 fallbacks |
| AC-16 | §4.1, §4.2 `generatedAt` and on-demand read model |
| AC-17 | §1 envelope, §8 safe errors |
| AC-18 | Existing Lab 3 endpoints unchanged except §5 |
| AC-19 | Not API-specific; see `ui-spec.md` |
| AC-20 | §3, §4, §5 combined workflow |
