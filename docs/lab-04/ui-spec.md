# Lab 4 UI Specification (Zen Green Dashboards and Actions Taken)

## 1. Design Direction (Lab 2–3 Reuse — Normative)

Lab 4 reuses the existing Zen Green system without introducing a second visual
language. All tokens, form conventions, card patterns, badge rules, validation
placement, responsive breakpoints, and accessibility expectations from
`docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md` remain in force. This
document adds dashboard composition, Actions Taken presentation, and conflict /
resolution-gate feedback.

### 1.1 Color tokens

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | App header, primary buttons, KPI emphasis, active navigation |
| Secondary green | `#0B7A46` | Links, focus accents, active tabs, in-progress emphasis |
| Pale green | `#EAF6EF` | Selected rows, success surfaces, KPI card tint, completed actions |
| Page background | `#F5F7F6` | App canvas |
| Surface / cards | White with subtle border and restrained shadow | Dashboards, action cards, detail panels |
| Text | Dark charcoal-green (not pure black) | Body copy and headings |
| Read-only field | Soft gray-green / warm ivory shading | Ticket context, completed/cancelled actions |
| Editable field | White with a clear neutral border | Action composer, inline edit controls |
| Error | Dark red text + border; message directly below the field | Validation and safe failure |
| Warning | Amber callout/badge | Overdue actions, stale conflicts, resolution gate |
| Success | Green confirmation with icon + text | Action saved, completed, cancelled |
| Disabled | Muted gray with reduced contrast | Busy controls, non-actionable tickets |

### 1.2 Action status badges

Action status must always be communicated with text and, where practical, an
icon — never color alone.

| Status | Visual treatment | Meaning |
|---|---|---|
| `Open` | Amber outline pill | Recorded, not started |
| `In Progress` | Secondary green pill | Work underway |
| `Completed` | Pale green pill with check icon | Work finished |
| `Cancelled` | Muted gray/red outline pill | Work intentionally abandoned; record retained |
| Overdue | Red text + warning icon beside the due date | `dueAt` is in the past and status is `Open`/`In Progress` |

The existing ticket status, priority, role, and account-status badges keep their
Lab 3 treatment. Action badges are visually distinct from ticket status badges so
a user cannot confuse an action's progress with the ticket's formal status.

### 1.3 Typography, spacing, and controls

- Labels sit above controls; required fields show a red `*` plus a message when
  invalid.
- One consistent input height; action details use a vertically resizable
  textarea where layout-safe.
- Primary actions are filled green; secondary actions are green-outline;
  destructive/cancel actions use a neutral or red-outline treatment and always
  require confirmation.
- Buttons carry visible text. Icon-only controls have an accessible label and a
  tooltip.
- Focus indicators are always visible. Error messages are associated with their
  fields via `aria-describedby`.
- Every save/create/complete/cancel action shows a busy state and disables
  double submission while in flight.

## 2. Responsive Rules

| Breakpoint | Dashboard behavior | Actions Taken behavior |
|---|---|---|
| Desktop `≥ 992px` | Four-column KPI grid; two-column main panels; tables for My Work and Unassigned | Action timeline in the main detail column; composer expands inline; status controls in the operational sidebar |
| Tablet `768–991px` | Two-column KPI grid; main panels stack where needed; low-value table columns collapse first | Action cards full width; composer full width; edit controls remain visible |
| Mobile `< 768px` | Single column; KPI cards full width; tables become cards; no horizontal page scrolling | Action cards stack; status/date/action controls wrap without clipping; touch targets ≥ 44px |

Additional rules:

- Dashboard KPI cards remain scannable without truncating labels or values.
- Tables collapse Category/Requester/Updated before switching to card layout;
  the ticket number, summary, status, priority, and Open action remain visible.
- Action summaries may wrap to two lines on cards; full text is available in the
  expanded card or detail view.
- No clipped badge text, overlapping validation messages, hidden primary
  actions, or horizontal overflow at any width.

## 3. Navigation and Role Landings

- **IT Staff:** `Dashboard` (`/staff/dashboard`), `Ticket Queue` (`/staff/queue`).
  Landing page after login/password change: Dashboard.
- **Requester:** `Dashboard` (`/dashboard`), `My Tickets` (`/` or `/tickets`),
  `Create Ticket` (`/tickets/new`). Landing page: Dashboard.
- **Administrator:** `Staff Dashboard`, `Ticket Queue`, `User Management`.
  Landing page: User Management remains the administrative home; Staff Dashboard
  is available because Administrators retain the existing Lab 3 staff-area access.
- The current user's name and role badge remain in the header, with `Change
  Password` and `Logout`.
- Active navigation uses an underline plus `aria-current="page"`.
- Unauthorized destinations are not rendered. Deep links to a forbidden route
  show the Forbidden panel, not a broken shell.

## 4. IT Staff Dashboard (`/staff/dashboard`)

### 4.1 Purpose

Give IT Staff a single operational view of what needs attention, what they own,
what is unassigned, and what actions were recently recorded — without turning the
dashboard into an analytics product.

### 4.2 Screen structure

```
┌ Header: IT Staff Dashboard ─────────────── Updated 10:42 · Refresh ┐
│ KPI: My open │ Unassigned │ In progress │ Waiting for requester    │
│ KPI: Requester resolved │ Incomplete actions │ Overdue actions     │
├ My Work (table/cards) ───────────────┬ Needs Attention ────────────┤
│ Ticket · Summary · Priority · Status │ Reason chips + ticket links │
│ Incomplete actions · Updated · Open  │                             │
├ Unassigned Triage ───────────────────┼ Recent Actions ─────────────┤
│ Ticket · Summary · Priority · Age    │ Action · Ticket · Performer │
│ Open                                 │ Status · Updated            │
└──────────────────────────────────────┴─────────────────────────────┘
```

**Header**

- Title “IT Staff Dashboard” and a short subtitle (“Your service desk at a
  glance”).
- `Last updated` timestamp from the dashboard response's `generatedAt`.
- `Refresh` button with busy state; preserves the current view.
- Optional `Recent actions window` select (`Last 7 days`, `Last 30 days`, `All
  time`), default Last 7 days.

**KPI cards (seven)**

1. **My open tickets** — active tickets owned by the session user.
2. **Unassigned** — active tickets with no owner.
3. **In progress** — all active tickets in `In Progress`.
4. **Waiting for requester** — all active tickets in `Waiting for Requester`.
5. **Requester says resolved** — active tickets with the resolved signal.
6. **Incomplete actions** — `Open`/`In Progress` actions on active tickets.
7. **Overdue actions** — incomplete actions whose `dueAt` is in the past.

Each KPI card is a link to the queue with the corresponding filter applied
(for example, `owner=me`, `owner=unassigned`, `status=In Progress`). Cards show
the number prominently and a one-line label; they are keyboard-focusable and
have an accessible label such as “My open tickets: 4. Open filtered queue.”

**My Work panel**

- Active tickets owned by the session user.
- Desktop columns: Ticket Number, Summary (two-line truncation), IT Priority,
  Status, Incomplete Actions, Updated, Open.
- Mobile card: ticket number + summary, status/priority badges, incomplete-action
  count, updated date, full-width Open button.
- Ordered by IT Priority (High first), then most recently updated.
- Empty state: “No tickets assigned to you right now” with a link to the
  unassigned queue.

**Needs Attention panel**

- Active tickets requiring staff action, with a reason chip:
  - `Requester says resolved`
  - `Waiting for requester`
  - `Overdue action`
- Each row links to the Staff Ticket Detail and, where relevant, to the Actions
  Taken section.
- Ordered by urgency: requester-resolved first, then overdue actions, then
  waiting-for-requester, then oldest update.
- Empty state: “Nothing needs attention right now.”

**Unassigned Triage panel**

- Active unassigned tickets, newest/updated first.
- Shows ticket number, summary, requested/IT priority, age, and Open.
- Empty state: “No unassigned tickets.”

**Recent Actions panel**

- Actions on tickets visible to staff, newest first, limited by the selected
  window and the dashboard list bound.
- Shows action summary, ticket number/title, performer, action status badge,
  due/overdue marker, and updated time.
- Links to the ticket detail's Actions Taken area.
- Empty state: “No actions recorded in this period.”

### 4.3 Interactions and states

- `Refresh` re-fetches the dashboard; KPI counts and lists update together.
- KPI cards and ticket rows navigate without losing the dashboard context where
  the router supports back navigation.
- **Loading:** skeleton KPI cards and panel placeholders; no layout jump.
- **Ready:** all panels render.
- **Empty:** valid zero-count dashboard with friendly panel copy; no error.
- **Partial failure:** one panel may show a safe inline error + Retry while the
  other panels remain usable. The whole page must not blank out.
- **Forbidden:** neutral “You don't have access to this area” panel; no counts or
  ticket data.
- **Failed:** safe banner + Retry; last-known data may remain visible but must be
  labeled as potentially stale.

## 5. Requester Dashboard (`/dashboard`)

### 5.1 Purpose

Answer the Requester's questions at a glance: what is happening with my tickets,
what has IT done recently, and where do they need something from me?

### 5.2 Screen structure

```
┌ Welcome, Alice ─────────────────────────── New Ticket ┐
│ KPI: Total │ Open │ In progress │ Waiting for you     │
│ KPI: Resolved │ Closed                               │
├ Recent Tickets ───────────────────────┬ Needs Your Attention ┤
│ Ticket · Summary · Status · Updated   │ Waiting-for-requester │
│ Open                                  │ tickets + Open        │
├ Latest Actions Taken ─────────────────┴───────────────────────┤
│ Status · Summary · Ticket · Performer · When                 │
└──────────────────────────────────────────────────────────────┘
```

**Header**

- “Welcome, {name}” and a short subtitle.
- Primary `New Ticket` button.
- `Last updated` timestamp and `Refresh`.

**Summary cards**

- Total tickets, Open, In Progress, Waiting for You, Resolved, Closed.
- “Open” means `New`, `Open`, or `Reopened`; In Progress and Waiting are counted
  separately. Cancelled tickets are not shown as a headline card but remain
  visible in My Tickets.
- Cards link to My Tickets with the matching status filter.

**Recent Tickets panel**

- The Requester's own tickets, most recently updated first, up to five.
- Ticket number, summary, status badge, IT Priority (read-only), last updated,
  Open.
- Empty state: “You haven't created a ticket yet” with a `Create your first
  ticket` call to action.

**Needs Your Attention panel**

- The Requester's own tickets in `Waiting for Requester`, oldest first.
- Explains why: “IT is waiting for information from you.”
- Links to the ticket detail where the Requester can reply via Public Comments.
- Empty state: “Nothing is waiting on you.”

**Latest Actions Taken panel**

- Read-only progress trail across the Requester's own tickets, newest first, up
  to five.
- Each entry shows action status badge, summary, ticket number/title, performer
  name + role, and updated/completed time.
- No create, edit, complete, cancel, or delete controls.
- No Internal Notes are fetched or rendered anywhere on this screen.
- Empty state: “No actions have been recorded yet.”

### 5.3 States

- Loading skeletons for cards and panels.
- Empty dashboard with a prominent Create Ticket call to action.
- Partial failure: one panel can fail safely without hiding the others.
- Forbidden: only possible for an out-of-role direct URL; show the neutral
  Forbidden panel with no ticket data.
- Safe failure: generic message + Retry; no stack trace or internal detail.

## 6. Actions Taken — IT Staff Ticket Detail (`/staff/tickets/:id`)

### 6.1 Placement

The Actions Taken area is a distinct card in the main detail column, below the
read-only ticket context and adjacent to the Public Comments / Internal Notes
cards. It is visually separate from both discussion threads and is never
confused with Internal Notes.

Header:

- Title `Actions Taken`.
- Count, for example `3 actions · 1 incomplete`.
- Primary `Log action` button (disabled with an explanation when the ticket is
  not actionable).

### 6.2 Action timeline

- Ordered newest first (`createdAt` descending).
- Each action card contains:
  - Status badge (`Open`, `In Progress`, `Completed`, `Cancelled`).
  - Summary (prominent, wraps safely).
  - Optional details, rendered as plain text.
  - Performer name + role badge.
  - Due date with an `Overdue` warning marker when applicable.
  - Created/updated timestamps; completion time for Completed actions.
  - `Edit`, `Complete`, and `Cancel` controls when permitted.
- Terminal actions show a muted read-only treatment and no edit controls.
- Actions the current user cannot modify still render with a short explanation
  (“Only the performer, ticket owner, or an administrator can change this
  action.”) rather than hidden, broken controls.
- Empty state: “No actions recorded yet” plus the `Log action` action when
  permitted.

### 6.3 Create action form

Fields:

- `Summary` (required, 1–200 characters, inline counter where useful).
- `Details` (optional, up to 2000 characters, plain-text textarea).
- `Due date` (optional date-time input; must be a valid date).

Behavior:

- Submit button `Log action` is disabled while the request is in flight and
  shows “Saving…”.
- Inline validation appears below the affected field; the form summary is never
  the only error signal.
- On success: the new action appears at the top of the timeline with an
  `aria-live` confirmation; the form clears; the dashboard will reflect the
  change on its next fetch.
- On safe failure: the form values are preserved and a Retry action is offered.
- The performer is not editable; it is shown as “Recorded by you”.

### 6.4 Edit, complete, and cancel

- `Edit` opens an inline editor or modal for summary, details, and due date.
  The save request includes the action's current `version`.
- `Complete` opens a confirmation dialog (“Mark this action as completed?”) with
  a confirm and cancel action. Completed actions set the completion time and
  become read-only.
- `Cancel` opens a confirmation dialog explaining that the record is retained
  and visible to the Requester. Cancelled actions become read-only.
- Success shows a green toast and updates the card in place.
- Terminal actions never show save/complete/cancel controls.

### 6.5 Conflict / stale update UX

When the API returns `409 STALE_UPDATE`:

- Show an amber callout above the action editor:
  “This action was updated by someone else. Review the latest version before
  saving.”
- Preserve the user's draft input.
- Show the current action summary/status/updated time returned by the server.
- Offer `Reload latest` (replaces the editor with the server state) and
  `Review my changes` (keeps the draft visible for manual reconciliation).
- Do not silently overwrite, auto-merge, or retry the write.
- The callout is announced via `aria-live="assertive"` because the user's write
  did not apply.

### 6.6 Resolution gate UX

- The ticket status control shows a persistent amber helper when incomplete
  actions exist: “Resolve is unavailable until all actions are completed or
  cancelled.”
- The `Resolved` option is disabled in the status select while incomplete
  actions exist.
- If a direct attempt still produces `409 ACTIONS_INCOMPLETE`, render an amber
  panel listing the blocking actions with links/anchors to each action card.
- After the last incomplete action is completed or cancelled, the status control
  refreshes and `Resolved` becomes available without a page reload.
- The gate must never hide the ticket context or prevent other legal status
  transitions.

### 6.7 Non-actionable ticket UX

- For `Resolved`, `Closed`, or `Cancelled` tickets, the `Log action` button is
  disabled or replaced by a read-only notice: “Actions are read-only while this
  ticket is {status}. Reopen the ticket to record more work.”
- Existing actions remain visible and readable.
- Reopening the ticket restores create/edit controls.

### 6.8 States

| State | Presentation |
|---|---|
| Loading | Skeleton action cards; composer disabled |
| Empty | Friendly empty message + Log action when permitted |
| Ready | Timeline + composer |
| Saving | Busy button, disabled form, no duplicate submit |
| Validation | Inline field errors; focus moves to the first invalid field |
| Conflict | Amber stale-update callout with current version |
| Non-actionable | Read-only notice; no create/edit controls |
| Forbidden | Neutral panel; no action data |
| Failed | Safe banner + Retry; existing timeline remains if available |

## 7. Actions Taken — Requester Ticket Detail (`/tickets/:id`)

- A read-only `Actions Taken` card in the Requester detail page, below the
  ticket context and near the Public Comments thread.
- Timeline ordered newest first.
- Each entry shows status badge, summary, optional details, performer name +
  role, due date/overdue marker, and timestamps.
- No create, edit, complete, cancel, or delete controls.
- A short helper explains: “These are the actions IT has recorded for your
  ticket.”
- Empty state: “No actions have been recorded yet.”
- Internal Notes are never fetched or rendered on Requester screens.
- If the Requester navigates directly to a staff action endpoint, the Forbidden
  panel is shown with no action data.

## 8. Cross-Screen Feedback States

| State | What the user sees |
|---|---|
| Loading | Skeletons/spinners in place; dependent controls disabled |
| Validation | Dark-red message under the field + red border; first invalid field focused |
| Success | Green toast/banner with icon + text; updated data in place |
| Empty | Friendly “nothing yet” copy with the relevant call to action |
| No-results | “No matches” copy + Clear filters, never a blank panel |
| Forbidden (403) | Neutral “You don't have access” panel; no IDs or protected data |
| Not-found (404) | Neutral “We couldn't find that” panel + safe back action |
| Conflict (409) | Amber callout naming the rule; draft preserved; no silent retry |
| Non-actionable (409) | Explanation of the ticket status and how to proceed (reopen) |
| Safe failure (500/network) | Generic message + Retry; input/filters preserved |

## 9. Accessibility and Visual Checklist

- **Keyboard:** every dashboard link, KPI card, action control, composer, modal,
  and pagination control is reachable and operable; modals trap focus and return
  focus to the trigger.
- **Screen reader:** labelled form fields, `aria-describedby` for errors,
  `aria-live` for action save/complete/cancel/conflict announcements, table
  captions or labelled lists, and badge text that conveys meaning without color.
- **Focus:** visible focus rings on all interactive elements, including KPI
  cards and timeline action controls.
- **Contrast:** green-on-white, red/amber messaging, and muted read-only text
  meet the Lab 2 contrast bar.
- **Non-color indicators:** status badges include text and, where useful, icons;
  overdue actions include a warning icon and “Overdue” text.
- **Touch:** mobile targets are at least 44px; controls do not overlap; no
  horizontal page scrolling.
- **Motion:** no required animation; respect reduced-motion preferences for
  spinners/toasts where practical.
- **Content:** plain-text rendering for summaries and details; no HTML
  injection; long words/URLs wrap without breaking layout.

## 10. Acceptance Mapping

| Acceptance Criterion | UI coverage |
|---|---|
| AC-01, AC-02 | §6.3 create form and validation |
| AC-03 | §6.2 timeline, §7 Requester timeline |
| AC-04, AC-05, AC-06 | §6.4 edit/complete/cancel |
| AC-07 | §6.6 resolution gate |
| AC-08 | §6.5 conflict/stale update |
| AC-09 | §6.7 non-actionable ticket |
| AC-10 | §7 Requester read-only timeline |
| AC-11, AC-12 | §4 IT Staff Dashboard |
| AC-13 | §5 Requester Dashboard |
| AC-14 | §3 navigation + Forbidden states |
| AC-15 | §4.3 / §5.3 empty and partial-failure states |
| AC-16 | §4.3 / §5.3 refresh and freshness |
| AC-17 | §8 safe feedback states |
| AC-18 | Existing Lab 2–3 screens retain their specifications |
| AC-19 | §2 responsive rules, §9 accessibility checklist |
| AC-20 | §4–§7 combined workflow |
