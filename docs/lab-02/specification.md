# Engineering Contract: Ticket System

## 1. Overview

This document defines the business rules, functional requirements, and acceptance criteria for the Ticket system used by Development Requesters. The system supports creating and tracking tickets, assigning categories, and attaching supporting files while enforcing ownership, validation, and safe upload limits.

## 2. Actors

- Development Requester: the authenticated user who creates and manages tickets.
- Category Manager / Administrator: may maintain the category list and review tickets.
- System: validates payload, enforces file limits, and records ticket state.

## 3. Business Rules

### BR-01: Authentication and Role Access
A user must be authenticated as a Development Requester before creating or viewing tickets. Anonymous users are not permitted to access ticket APIs or ticket pages.

### BR-02: Ticket Ownership
A ticket is owned by the Development Requester who created it. Only the owner or an authorized administrator may modify or delete the ticket, or change attachment state.

### BR-03: Category Requirement
Every ticket must belong to exactly one category. The category must exist in the approved category list before a ticket can be created or submitted.

### BR-04: Title and Description
A ticket must include a non-empty title and a non-empty description. The system must reject empty or whitespace-only values.

### BR-05: Attachment Limits
A ticket may include up to 5 attachment files total, with a maximum individual file size of 5MB each. Upload attempts beyond the limit must be rejected with a clear validation message.

### BR-06: Soft Removal for Attachments
Attachments that are removed are not physically deleted immediately. Instead, the attachment is marked as removed or inactive and is no longer visible to the user, while retaining an audit trail for future review.

### BR-07: Default Ticket State
When a ticket is first created, its initial status shall be "Open" unless business rules or product flow explicitly define a different default.

### BR-08: Validation Before Submission
The system must validate all required fields and constraint rules before creating or updating a ticket or attachment. Invalid input must be surfaced in a clear, user-readable format.

## 4. Functional Requirements

### FR-01: Ticket Creation
The system shall allow a Development Requester to create a ticket with the following fields:
- title
- description
- categoryId
- optional attachments

### FR-02: Category Selection
The system shall present a defined set of categories and require the requester to select one valid category when creating a ticket.

### FR-03: My Tickets Listing
The system shall display a list of tickets belonging to the authenticated requester, with support for:
- search by title/description keywords
- filtering by category and status
- sorting by newest, oldest, or a reasonable business-defined field
- pagination

### FR-04: Ticket Detail View
The system shall allow the requester to view the ticket detail page for their own ticket. The detail page must include ownership, metadata, and attachment list.

### FR-05: Ownership Enforcement
The system must prevent a user from retrieving, editing, or deleting another user's ticket. The API must reject the request with a proper authorization error when the ticket does not belong to the authenticated requester.

### FR-06: Attachment Lifecycle
The system shall allow a requester to add attachments to a ticket before submission or while editing, validate size and count limits, and soft remove attachments when they are deleted.

### FR-07: Failure Handling
The system shall display safe, user-friendly error states when the API fails, without exposing internal system details.

### FR-08: Loading and Empty States
The system shall show explicit loading indicators while data is being fetched and clear empty-state messaging when no data exists.

## 5. Acceptance Criteria

### AC-01: Ticket Creation Success
Given an authenticated Development Requester,
When they submit a valid ticket with a title, description, and valid category,
Then the system shall create the ticket and return HTTP 201 Created.

### AC-02: Required Fields Validation
Given a ticket submission with a missing title or description,
When the user submits the form,
Then the system shall reject the request and show a validation message for the missing required field(s).

### AC-03: Invalid Category Validation
Given a ticket submission with a categoryId that does not exist,
When the user submits the form,
Then the system shall reject the request and display an invalid category error.

### AC-04: Attachment Count Limit
Given a ticket submission with more than 5 attachments,
When the user includes the files,
Then the system shall reject the upload and display a message indicating the maximum is 5 files.

### AC-05: Attachment Size Limit
Given a ticket submission with an attachment larger than 5MB,
When the user uploads the file,
Then the system shall reject the file and display a message indicating the 5MB maximum size.

### AC-06: Soft Removal
Given an attachment is deleted from a ticket,
When the removal action is confirmed,
Then the attachment shall be marked as removed/inactive and no longer shown in the active attachment list, while preserving an audit record.

### AC-07: My Tickets Search and Filter
Given the authenticated requester has multiple tickets,
When they use the search, category filter, or status filter on the My Tickets page,
Then the list updates to only include matching tickets.

### AC-08: My Tickets Sort and Pagination
Given more than one ticket exists for the requester,
When they sort by a supported field and page through results,
Then the system shall return tickets in the requested order and display the correct page subset.

### AC-09: Ticket Detail Ownership Check
Given a user attempts to fetch a ticket they do not own,
When the request is made to the ticket detail endpoint,
Then the system shall reject the request with an authorization error and must not disclose the ticket data.

### AC-10: Empty State
Given the authenticated requester has no tickets,
When they open the My Tickets page,
Then the system shall display an empty-state message instead of a blank list.

### AC-11: Loading State
Given the My Tickets page or ticket detail page is fetching data,
When the request is pending,
Then the system shall show a loading indicator and disable any actions that depend on the data.

### AC-12: Safe API-Failure State
Given the API fails while fetching ticket data or submitting a ticket,
When the request cannot complete,
Then the UI shall show a safe failure state with a retry or clear error message and no leaked internal error details.

## 6. Non-Functional Constraints

- The UI must support the specified Zen Green theme and responsive breakpoints.
- The system must be accessible enough for keyboard and screen-reader use, with clear labels and visible focus states.
- The API must return stable HTTP status codes and consistent JSON error structures.
- The client must avoid revealing private information or internal stack traces in user-facing error messages.

## 7. Definitions

- Ticket: a request created by a Development Requester for work, investigation, or implementation.
- Category: a predefined classification used to group tickets.
- Attachment: a file uploaded as supporting evidence for a ticket.
- Soft removal: logical removal of an attachment from active display while preserving audit or recovery information.
