# Lab 3 UI Specification (Zen Green Extensions)

## 1. Design Direction (Lab 2 Reuse — Normative)

Lab 3 reuses the Lab 2 Zen Green system without inventing a second visual language.
All tokens, conventions, and accessibility expectations from `docs/lab-02/ui-spec.md`
remain in force; this document only extends them for authentication, role-aware shell,
queue, operational detail, and admin screens.

### 1.1 Color tokens

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | App header, primary buttons, strong emphasis, active nav underline |
| Secondary green | `#0B7A46` | Active tabs, focus accents, links, hover states |
| Pale green | `#EAF6EF` | Selected rows, success backgrounds, subtle section emphasis |
| Page background | `#F5F7F6` | App canvas (quiet near-white) |
| Surface / cards | White, subtle border + restrained shadow | Forms, queue, detail panels, admin list |
| Text | Dark charcoal-green (not pure black) | Body copy for comfortable reading |
| Editable field | White bg, clear neutral border | Inputs, selects, textareas |
| Read-only field | Soft gray-green / warm ivory shading, still readable | System values, foreign ticket context |
| Error | Dark red text + border; message immediately below the field | Validation and failure |
| Warning | Amber callout/badge; never ordinary decoration | Destructive confirmations, inactive accounts |
| Success | Green confirmation; never color alone (icon + text) | Creation, save, password change |
| Disabled | Muted gray, reduced contrast, non-activatable | Busy/unauthorized actions |

### 1.2 Typography, spacing, controls

- Labels above controls, consistent weight/spacing; required fields show a red `*`
  (asterisk never replaces the message).
- One consistent input height; Description/comment/note textareas taller and vertically
  resizable only where layout-safe.
- Buttons carry visible text (icons may support, never replace); every icon-only control
  has an accessible label + tooltip.
- Focus indicators always visible for keyboard users; error messages associated with
  their fields via `aria-describedby`; state changes use text + icon, never color alone.
- Submit/claim/save actions show a busy state and are disabled while in flight;
  double-submit is prevented.

### 1.3 Badges (extended for Lab 3)

- **Current Status** (8 values): distinct pill per status; `New` (neutral outline),
  `Open` (blue-gray), `In Progress` (secondary green), `Waiting for Requester` (amber),
  `Resolved` (pale green + check), `Closed` (muted gray), `Reopened` (teal outline),
  `Cancelled` (red outline). Text label always present.
- **Requested Priority / IT Priority**: `Low` (gray), `Medium` (amber-outline),
  `High` (red-solid accent) — identical scale for both so divergence is scannable.
  When they differ, both pills render side by side (`Req: Medium → IT: High`).
- **Role**: `Requester` (neutral), `IT Staff` (secondary green), `Administrator`
  (primary green solid). Shown next to the user name in the shell and in comment/note
  author lines.
- **Account Status** (admin list): `Active` (green), `Inactive` (gray).
- **Resolved signal**: `Requester says resolved` amber-info chip on the Staff detail —
  informational only, never mistaken for the `Resolved` status pill.

## 2. Responsive Rules (Unchanged Breakpoints)

- Desktop `≥ 992px`: multi-column layouts, centered content with sensible max-width;
  queue renders as a table; detail uses two-column (context + operational sidebar).
- Tablet `768–991px`: two-column where practical; Summary/Description and thread
  composers keep full usable width; queue table collapses low-value columns first
  (Category → Requested Priority → Created Date) before switching to cards.
- Mobile `< 768px`: single column, full-width controls, touch targets ≥ 44px, no
  horizontal page scrolling; queue renders as cards; detail stacks sections;
  admin list renders as cards with Edit preserved.
- All sizes: no clipped labels, overlapping messages, hidden buttons, or unreadable
  attachment/comment names; filters, pagination, and thread composers stay usable.

## 3. Application Shell (Authenticated — Replaces Selector Gate)

- Header (primary green): TokTickIT identity; role-specific nav —
  Requester: `My Tickets`, `Create Ticket`; IT Staff: `Ticket Queue`;
  Administrator: `User Management`; active-page indication (underline + `aria-current`).
- Unauthorized destinations are **not rendered** (feedback), while the backend still
  enforces them (security). A user who deep-links to a forbidden route sees the
  Forbidden state (§6), not a broken shell.
- Right side: current user name + role badge, `Change Password` action, `Logout` button.
  Logout asks no confirmation (it is non-destructive) but shows a brief signed-out
  confirmation on the Login screen.
- The Lab 2 Requester gate, Change Requester action, requester dropdown, and
  `toktickit.requesterId` state are removed. Stale stored values are ignored.
- Shell loading: skeleton header + nav while `GET /api/auth/me` resolves; shell failure:
  safe message + retry, with no partial nav rendered.

## 4. Screens

### 4.1 Login and Mandatory Password Change

**Login (`/login`)** — card centered on page background, max-width ~480px:
- TokTickIT title + one-line purpose ("Sign in to the IT service desk").
- Email field (type email, autocomplete username), password field (type password,
  autocomplete current-password, show/hide toggle with accessible label).
- Validation: inline below each field (missing/invalid email shape, missing password);
  submit disabled while in flight with busy spinner + "Signing in…".
- Failure: generic `"Invalid email or password."` banner (same for unknown/wrong);
  inactive accounts get the amber `"This account is inactive. Please contact an
  administrator."` callout; network failure gets a safe retry banner with form values
  preserved. No account-existence hints, no password-length oracle.
- Success: brief redirect; initial-password sessions redirect to Change Password.

**Change Password (`/change-password`)** — same card pattern, reachable only with a
valid session:
- Explains *why* ("Your administrator issued an initial password. Choose a new one to
  continue." vs. voluntary-change wording when the flag is clear).
- New password + confirm password fields; visible rule list (8+ chars, letter + number,
  max 128) that checks off live; mismatch message under confirm.
- Busy state on save; success shows green confirmation and continues into the
  role-appropriate landing page (Requester → My Tickets; IT Staff → Queue;
  Administrator → User Management).
- Screen modes: `forced` (no skip, no nav away except logout) vs. `voluntary`
  (cancel/back allowed). Both share validation and safe-failure behavior.

### 4.2 IT Staff Ticket Queue (`/staff/queue`)

Purpose: help Staff locate and prioritize work — dense but never a mega-grid.

- Toolbar: search input (ticket number/summary/description), filter selects for Status,
  IT Priority, Ownership (`All / Unassigned / Mine / specific member`), Category;
  sort select (Updated, Created, IT Priority, Title); `Clear filters` restores defaults.
- Desktop table columns (justified subset): Ticket Number, Summary (truncate 2 lines),
  Category, Req. Priority, IT Priority, Status (pill), Owner (name or `Unassigned` chip),
  Updated, Open action. Requester name and Created Date collapse first on narrower
  widths; full context lives in detail. Mobile: card per ticket with the same fields
  stacked + full-width Open button.
- Row selection highlights pale green; `Requester says resolved` chip renders inline
  where set.
- Open action navigates to `/staff/tickets/:id`; pagination footer (Prev/Next + page
  numbers + `total` count) preserves query state in the URL for shareability.
- Feedback: loading skeleton rows; empty (no tickets in system) vs. no-results (filters
  match nothing + Clear-filters CTA) distinguished; forbidden (out-of-matrix role);
  failure (safe banner + retry, filters preserved).

### 4.3 IT Staff Ticket Detail (`/staff/tickets/:id`)

Extends the Lab 2 detail; ticket context stays grouped and read-only except permitted
operational fields.

- Header: Ticket Number + title, status pill, both priority pills, owner line
  (`Unassigned` chip or name + `Claim` when unassigned / `Reassign` when assigned),
  Requester + timestamps (read-only shading).
- Operational panel (sidebar on desktop, stacked section on mobile):
  Owner control (Claim button or member select + Save), IT Priority select + Save,
  Status select + Save (destructive targets — Cancelled/Closed/Reopened — open a
  confirmation modal with explicit consequence text and typed/checked confirm).
- Every save shows inline busy + success toast; validation/transition errors render
  inline at the control with the allowed-transition hint from the API.
- **Public Comments vs. Internal Notes** are visually unmistakable: separate cards,
  separate headings, separate composer buttons (`Post public reply` primary-outline vs.
  `Add internal note` dark-slate with lock icon + "Only staff see this" helper).
  The Internal Notes card carries a persistent slate header stripe so private content is
  never posted publicly by accident. Threads render newest-last, author + role badge +
  timestamp per entry, plain-text bodies (no HTML). Empty threads show a muted
  "No comments yet" placeholder, not blank space.
- Attachments: Lab 2 continuity (active list + download, removed shown as metadata-only
  where the contract requires, upload where permitted, soft-remove with confirmation).
- Role behavior: out-of-matrix viewers get the Forbidden state; Requesters never reach
  this route (they use the Requester detail + public thread only).

### 4.4 Admin User Management (`/admin/users`) — Minimalist

One screen, intentionally spare (per §4.5 exclusions, no pagination/sort/bulk/import UI):

- Header + `New user` primary button; search input (name or email) + single role-filter
  select (`All roles / Requester / IT Staff / Administrator`); `Clear` restores the list.
- Desktop table: Name, Email, Role (badge), Status (Active/Inactive pill), Edit button.
  Mobile: cards with the same five facts + Edit. Counts line ("7 users" / "2 of 7 shown").
- Create/Edit dialog (modal): Name, Email, Role (single-select, exactly one), Active
  toggle, Initial-password field on create (and via a separate `Set new password`
  action on edit, which explains the forced-change consequence). Field-level errors for
  duplicate email / invalid role / blank name; safety-rule errors (self-deactivation,
  last-admin) render as dialog-level amber callouts with nothing mutated.
- Row-level feedback: saving spinner on the dialog action; success toast + list refresh;
  forbidden screen for non-admins ("You don't have access to user management.");
  failure banner + retry with dialog input preserved.
- New-password success states the consequence explicitly ("They'll be asked to choose a
  new password at next sign-in.") rather than displaying the password anywhere else.

### 4.5 Requester Regression Notes (Changed, Not New)

- My Tickets / Create / Requester Detail keep Lab 2 layouts, tokens, and feedback;
  only the identity source changes (session) and the selector disappears.
- Requester Detail adds: read-only operational context (owner name, IT Priority shown
  but disabled with tooltip "Set by IT staff"), the Public Comments thread + composer,
  and the `Problem appears resolved` button (confirm modal; success sets the
  informational chip; no status change). Internal Notes are never fetched or rendered.

## 5. Screen Modes

| Screen | Modes |
|---|---|
| Login | `initial`, `submitting`, `failed` (safe banner), `inactive-notice` |
| Change Password | `forced` (no escape except logout), `voluntary` (cancellable); each with `editing / saving / success` |
| Queue | `loading / ready / empty / no-results / forbidden / failed` + `paging` (footer busy, rows kept) |
| Staff Detail | `loading / ready / saving-field / confirming-destructive / forbidden / not-found / failed`; threads `loading / empty / ready / posting` |
| User Management | `loading / ready / empty / no-results / forbidden / failed`; dialog `creating / editing / setting-password / saving / success` |
| Requester screens | Lab 2 modes retained + `resolved-signalled` on detail |

## 6. Feedback States (What Each Looks Like)

- **Loading/saving:** spinner or skeleton in place; dependent actions disabled;
  no duplicate submits.
- **Validation:** dark-red inline message under the field + red border; form-level
  summary only as a supplement, never the sole signal.
- **Success:** green toast/banner with icon + text and the next action
  ("Ticket created — View in queue", "Password saved — Continue").
- **Empty vs. no-results:** friendly copy distinguishes "nothing exists yet" (with
  creation CTA) from "filters match nothing" (with Clear-filters CTA).
- **Forbidden (403):** neutral "You don't have access" panel — no hint whether the
  resource exists, no IDs, no note/user payload.
- **Not-found (404):** neutral "We couldn't find that" panel with a safe back action.
- **Conflict (409/422):** amber callout naming the rule (duplicate email, illegal
  transition + allowed list, last-admin) with input preserved.
- **Safe failure (500/network):** generic message + retry; form/filter/thread input
  preserved; never a stack trace, SQL fragment, hash, or token.

## 7. Accessibility and Visual Checklist

- Keyboard: all flows operable (login → change-password → queue → detail → admin);
  modals trap and return focus; sort/filter/pagination are native controls.
- Screen reader: labeled fields, `aria-describedby` errors, `aria-live` for toasts and
  thread appends, badge text (not color-only meaning).
- Contrast targets meet the Lab 2 bar for green-on-white and red/amber messaging.
- Screenshot evidence required (see `tests.md`): Login (initial/validation/busy/failure/
  inactive), Change Password (forced/validation/success), Queue + Detail + User
  Management at desktop/tablet/mobile, including empty/no-results/forbidden/failure and
  the public-vs-internal visual distinction.
- Pre-submit visual check: no clipping, overlap, horizontal overflow, inconsistent field
  styling, missing states, or ambiguous public/internal affordances at any breakpoint.

## 8. Acceptance Mapping

AC-04/AC-05 → §4.1; AC-06 → §3 + §4.1; AC-08 → §3 + §6-forbidden; AC-10 → §4.5;
AC-11/AC-12 → §4.2; AC-13–AC-16 → §4.3; AC-17/AC-18 → §4.3 threads;
AC-20 → §4.5 + §4.3 chip; AC-21–AC-29 → §4.4 + §6; AC-30 → §2 + §6 + §7.
