# Engineering Contract: Test Plan

## 1. Purpose

This test plan verifies that the Ticket system satisfies the business rules and acceptance criteria defined in the specification. The tests are intentionally traceable to specific acceptance criteria and cover unit, API, UI, and end-to-end scenarios.

## 2. Traceability Matrix

| Test ID | Layer | Scenario | Acceptance Criteria |
|---|---|---|---|
| U-01 | Unit | Validate required title and description | AC-02 |
| U-02 | Unit | Reject invalid category | AC-03 |
| U-03 | Unit | Enforce max 5 attachments | AC-04 |
| U-04 | Unit | Enforce 5MB upload limit | AC-05 |
| A-01 | API | Create valid ticket returns 201 | AC-01 |
| A-02 | API | Search/filter My Tickets | AC-07 |
| A-03 | API | Sort and paginate results | AC-08 |
| A-04 | API | Ownership violation returns 403 | AC-09 |
| A-05 | API | Soft delete attachment | AC-06 |
| UI-01 | UI | Loading state shown while fetching | AC-11 |
| UI-02 | UI | Empty state for zero tickets | AC-10 |
| UI-03 | UI | Safe error state on API failure | AC-12 |
| UI-04 | UI | Read-only and editable states | BR-02, FR-05 |
| E-01 | E2E | Create a valid ticket flow | AC-01, AC-02 |
| E-02 | E2E | Ownership prevention | AC-09 |
| E-03 | E2E | Attachment validation flow | AC-04, AC-05 |
| E-04 | E2E | Empty state and retry flow | AC-10, AC-12 |

## 3. Unit Tests

### U-01: Required field validation
- Input: ticket with blank title or blank description
- Expected: validation error is raised and form is blocked
- Trace: AC-02

### U-02: Invalid category rejection
- Input: categoryId that does not exist
- Expected: invalid category error returned
- Trace: AC-03

### U-03: Attachment count validation
- Input: 6 attachments attached to a ticket
- Expected: validation fails with message indicating max 5 files
- Trace: AC-04

### U-04: File size validation
- Input: file size larger than 5MB
- Expected: upload rejected and user sees a size-limit error
- Trace: AC-05

### U-05: Soft delete state mapping
- Input: attachment marked as removed
- Expected: attachment excluded from active list but retained in audit metadata
- Trace: AC-06

## 4. API Tests

### A-01: Create ticket returns HTTP 201
- Request: valid authenticated ticket creation request
- Expected: HTTP 201 and ticket object returned
- Trace: AC-01

### A-02: My Tickets list supports search and filter
- Request: `GET /api/tickets?search=filter&categoryId=2&status=Open`
- Expected: only matching tickets returned
- Trace: AC-07

### A-03: My Tickets list supports sort and pagination
- Request: `GET /api/tickets?sort=createdAt:desc&page=2&limit=10`
- Expected: results sorted correctly and paginated subset returned
- Trace: AC-08

### A-04: Ownership check on ticket detail
- Request: unauthenticated or unauthorized user fetches another requester’s ticket
- Expected: HTTP 403 Forbidden and no data returned
- Trace: AC-09

### A-05: Soft attachment removal
- Request: DELETE attachment endpoint
- Expected: attachment status becomes `removed` and is hidden from active results
- Trace: AC-06

### A-06: Invalid input states
- Request: missing fields, bad category, oversized attachment
- Expected: HTTP 400 with descriptive validation error payload
- Trace: AC-02, AC-03, AC-04, AC-05

## 5. UI Tests

### UI-01: Loading indicator on fetch
- Given the My Tickets page is fetching results
- Then a spinner or equivalent loading state is displayed
- Trace: AC-11

### UI-02: Empty state when no tickets exist
- Given the requester has no tickets
- Then the page displays an empty-state message with a CTA
- Trace: AC-10

### UI-03: Safe API-failure state
- Given the API returns an error response
- Then the UI shows a friendly, non-technical message, and the form or list remains usable
- Trace: AC-12

### UI-04: Read-only vs editable fields
- Given a user views a ticket they do not own
- Then fields that should be protected are read-only or hidden
- Trace: BR-02, FR-05

### UI-05: Busy submit button behavior
- Given the user submits a ticket or attachment
- Then the submit button is disabled and a busy indicator is shown until completion
- Trace: AC-01, AC-11

## 6. End-to-End Tests

### E-01: Happy path ticket creation
- Log in as a Development Requester
- Open the new ticket form
- Enter valid title, description, and category
- Submit the form
- Expected: ticket is created and success state is shown
- Trace: AC-01

### E-02: Ownership prevention flow
- Log in as Requester A
- Attempt to view or edit Requester B’s ticket via direct URL or API call
- Expected: forbidden state or restricted view is shown
- Trace: AC-09

### E-03: Attachment validation flow
- Create a new ticket
- Attempt to upload 6 files or a 6MB file
- Expected: validation error shown and no ticket is created with invalid attachments
- Trace: AC-04, AC-05

### E-04: Empty state and recovery flow
- Start with no tickets
- Open the My Tickets page
- Confirm empty-state message is displayed
- Then trigger a retry after an API failure
- Expected: the UI recovers gracefully
- Trace: AC-10, AC-12

## 7. Test Execution Notes

- Unit tests should run fast and validate isolated business rules.
- API tests should verify status codes, payload shape, and ownership enforcement.
- UI tests should confirm state transitions and visual safety for error/loading/empty cases.
- E2E tests should validate the end-user flow across actual UI interaction and browser behavior.

## 8. Definition of Done

The Ticket system is considered ready for acceptance when:
- all happy-path tests pass,
- all invalid-input tests pass,
- ownership checks prevent unauthorized access,
- loading and empty states are verified,
- attachment size and count constraints are enforced,
- all acceptance criteria are traceably covered by automated or manual tests.
