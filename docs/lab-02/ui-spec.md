# Engineering Contract: UI Specification

## 1. Design Direction

The ticket experience must follow a Zen Green visual system using the primary brand color `#006B3C`.

### Core Colors
- Primary brand: `#006B3C`
- Primary hover / emphasis: darker green variant derived from the same family
- Neutral background: off-white or light gray surfaces
- Text: dark neutral gray for readability
- Success: green accent for confirmation states
- Warning / error: red accent for validation and failure messaging
- Disabled state: muted gray with reduced contrast

### Layout Principles
- Use clear separation between form controls, ticket list, and detail panels.
- Keep the primary action visible and consistent across screens.
- Use whitespace to reduce visual clutter and improve scanning.
- Show validation messages inline near the relevant field.

## 2. Responsive Breakpoints

The application must support the following breakpoints:

- Desktop: `>= 992px`
- Tablet: `768px - 991px`
- Mobile: `< 768px`

### Responsive Behavior
- Desktop: multi-column layouts may be used where beneficial; ticket details may show metadata side-by-side with content.
- Tablet: stacked or simplified layouts while preserving form usability and action visibility.
- Mobile: single-column layout with full-width controls, reduced spacing, and touch-friendly action targets.

## 3. Required UI States

### 3.1 Loading State
When data is being fetched or submitted, the interface must show a visible loading state.

Required behaviors:
- display a spinner, skeleton, or equivalent loading indicator
- disable actions that depend on the in-flight request
- prevent duplicate submissions while pending

### 3.2 Empty State
When the user has no tickets yet, the UI shall show a clear empty-state message.

Required behaviors:
- show a friendly message such as "No tickets yet"
- provide a clear call to action to create a new ticket
- avoid blank sections or broken spacing

### 3.3 Safe API-Failure State
When the API fails, the UI must gracefully degrade without exposing internals.

Required behaviors:
- show a non-technical user-friendly message
- preserve user-entered form content where possible
- offer a retry option or a safe fallback action
- do not display raw stack traces, internal server messages, or schema details

### 3.4 Read-Only vs Editable State
The UI must distinguish between fields that are read-only and fields that are editable.

Required behaviors:
- read-only fields must be visually muted and clearly non-editable
- editable fields must have visible labels and clear focus states
- ownership-related metadata such as created date, owner, and ticket status may be read-only unless the user is allowed to change them

### 3.5 Busy / Disabled Submit Buttons
Submit and upload actions must reflect pending states.

Required behaviors:
- show a busy indicator while requests are in progress
- disable submit buttons during submission
- prevent multiple repeated clicks
- re-enable after the request completes or fails

## 4. Form and Interaction Constraints

### Ticket Creation Form
- Title and description are required
- Category must be selected from a valid list
- File upload area must allow up to 5 files
- Upload validation must show inline errors for size and count breaches
- Submit button must remain disabled until required fields are valid or while a request is in progress

### Ticket List View
- Search field must be visible and easy to use
- Category and status filters must be obvious and accessible
- Sorting control must be consistent and clear
- Pagination must allow navigation without leaving the page

### Ticket Detail View
- Show ownership metadata and ticket details in a readable layout
- Distinguish between active and removed attachments
- Show attachment actions with clear confirmation for soft removal
- Apply read-only styling to protected fields when the user does not own the ticket

## 5. Accessibility and Usability Constraints

- All interactive controls must have visible focus states
- Form elements must use clear labels and accessible names
- Error messages must be associated with the affected fields
- Buttons and actions must have sufficient target size for touch devices
- State changes must be communicated with text, icons, or semantic indicators

## 6. Acceptance Mapping

The UI must support the acceptance criteria defined in the specification, including:
- AC-01 creation success state
- AC-02 required field validation
- AC-04 attachment count validation
- AC-05 attachment size validation
- AC-07 search and filter behavior
- AC-08 sort and pagination behavior
- AC-10 empty state
- AC-11 loading state
- AC-12 safe failure state
