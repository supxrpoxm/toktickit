# Engineering Contract: API Specification

## 1. Base URL

All endpoints are relative to the service base URL.

- Base path: `/api`
- Response format: JSON for successful and error responses
- Authentication: required for protected ticket and attachment routes

## 2. Shared Response Pattern

### Success Response
```json
{
  "success": true,
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required."
  }
}
```

## 3. Endpoint: Create Ticket

### POST `/api/tickets`
Creates a new ticket for the authenticated Development Requester.

#### Request
```json
{
  "title": "Need support for category filtering",
  "description": "Please add the ability to filter tickets by category in the dashboard.",
  "categoryId": 2,
  "attachments": [
    {
      "name": "screenshot.png",
      "contentType": "image/png",
      "size": 1048576
    }
  ]
}
```

#### Validation Rules
- `title`: required, non-empty string
- `description`: required, non-empty string
- `categoryId`: required and must exist in the category list
- `attachments`: optional, max 5 files total
- Each attachment: max size 5MB

#### Success Response
- Status: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 101,
    "title": "Need support for category filtering",
    "description": "Please add the ability to filter tickets by category in the dashboard.",
    "categoryId": 2,
    "status": "Open",
    "ownerId": 42,
    "createdAt": "2026-09-02T12:00:00Z",
    "attachments": []
  }
}
```

#### Error Responses
- `400 Bad Request` for invalid payloads
- `401 Unauthorized` for unauthenticated access
- `404 Not Found` if category is invalid

## 4. Endpoint: My Tickets List

### GET `/api/tickets`
Returns the tickets owned by the authenticated requester.

#### Query Parameters
- `search` (optional): keyword search in title or description
- `categoryId` (optional): category filter
- `status` (optional): filter by ticket status
- `sort` (optional): `createdAt:desc`, `createdAt:asc`, `title:asc`, `title:desc`
- `page` (optional, default `1`): page number
- `limit` (optional, default `10`): items per page

#### Example
`GET /api/tickets?search=filter&categoryId=2&status=Open&sort=createdAt:desc&page=1&limit=10`

#### Success Response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "title": "Need support for category filtering",
        "description": "Please add the ability to filter tickets by category in the dashboard.",
        "categoryId": 2,
        "status": "Open",
        "createdAt": "2026-09-02T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 23,
      "totalPages": 3
    }
  }
}
```

#### Constraints
- Only tickets owned by the authenticated requester are returned.
- Search and filter operations must be applied before pagination.
- Sort order must be deterministic.

## 5. Endpoint: Ticket Detail

### GET `/api/tickets/:id`
Returns the detail for a specific ticket.

#### Ownership Check
- If the ticket does not belong to the authenticated requester, the API must reject the request.
- The system must not reveal the ticket payload to unauthorized users.

#### Success Response
```json
{
  "success": true,
  "data": {
    "id": 101,
    "title": "Need support for category filtering",
    "description": "Please add the ability to filter tickets by category in the dashboard.",
    "categoryId": 2,
    "status": "Open",
    "ownerId": 42,
    "createdAt": "2026-09-02T12:00:00Z",
    "updatedAt": "2026-09-02T12:15:00Z",
    "attachments": [
      {
        "id": 500,
        "fileName": "screenshot.png",
        "size": 1048576,
        "status": "active"
      }
    ]
  }
}
```

#### Error Responses
- `401 Unauthorized` if the user is not authenticated
- `403 Forbidden` if the ticket is not owned by the authenticated user
- `404 Not Found` if the ticket does not exist

## 6. Attachment Lifecycle

### Upload Attachment
#### POST `/api/tickets/:id/attachments`
Adds one or more attachments to a ticket.

#### Validation Rules
- max 5 files total per ticket
- each file max 5MB
- only valid attachment types allowed by the system policy
- only the ticket owner may add attachments

#### Success Response
```json
{
  "success": true,
  "data": {
    "attachments": [
      {
        "id": 500,
        "fileName": "screenshot.png",
        "size": 1048576,
        "status": "active"
      }
    ]
  }
}
```

#### Error Responses
- `400 Bad Request` if file validation fails
- `403 Forbidden` if the requester is not the owner

### Remove Attachment (Soft Delete)
#### DELETE `/api/tickets/:id/attachments/:attachmentId`
Marks an attachment as removed without deleting the underlying record permanently.

#### Success Response
```json
{
  "success": true,
  "data": {
    "id": 500,
    "status": "removed"
  }
}
```

#### Behavioral Rule
- The attachment must no longer appear in the active attachment list.
- The attachment remains stored for audit or recovery purposes if required by policy.

## 7. Security and Error Handling

- Use authenticated session or bearer token validation
- Return `403 Forbidden` rather than exposing private data for ownership violations
- Return `400` with clear validation details for malformed inputs
- Return safe, generic user-facing messages for failure states

## 8. Acceptance Mapping

The API described above must satisfy the acceptance criteria in the specification, including:
- AC-01: ticket creation response `201 Created`
- AC-04: attachment count validation
- AC-05: attachment size validation
- AC-06: soft removal behavior
- AC-07: My Tickets search and filter capability
- AC-08: sort and pagination behavior
- AC-09: ownership enforcement
