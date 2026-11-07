# API reference — current development implementation

All protected routes require the `trustvault_session` cookie. Unsafe methods
require an `Origin` exactly matching `APP_ORIGIN`. Sensitive responses use
`Cache-Control: no-store`. A missing, malformed, expired or disabled session
returns 401; unexpected server errors return a generic 500. The application is
not yet production-ready and this reference does not prove deployed behavior.

| Method / path | Authorization and request | Response | Audit behavior |
|---|---|---|---|
| POST `/api/auth/login` | JSON `email`, `password`; shared peer throttle | 200 user and session cookie; generic 401 for bad credentials; 429 limit; 503 store unavailable | LOGIN or LOGIN_FAILED; rejected origins and throttled attempts are also audited |
| GET `/api/auth/me` | Authenticated | 200 current user | None |
| POST `/api/auth/logout` | Authenticated | 204, clears session cookie | LOGOUT |
| GET `/api/documents` | Authenticated; optional `name`, `owner`, `category`, `from`, `to` query strings | 200 accessible documents, max 100; invalid calendar date or reversed range 400 | Invalid dates are audited |
| POST `/api/documents` | OWNER; multipart `file` and `category`, PDF/PNG up to 4 MiB | 201 id; invalid 400, oversized 413, role 403 | DOCUMENT_UPLOAD on success; denied role, invalid file, size-limit and malformed multipart attempts are audited |
| GET `/api/documents/:id/download` | Owner or current READ/EDIT grant | 200 attachment; unauthorized/deleted 404 | DOCUMENT_DOWNLOAD; ACCESS_DENIED for valid inaccessible ID |
| PATCH `/api/documents/:id` | Owner or current EDIT; JSON `name`, `category`; file contents cannot be replaced | 204; invalid 400; unauthorized/deleted 404 | DOCUMENT_EDIT or ACCESS_DENIED for valid inaccessible ID |
| DELETE `/api/documents/:id` | Owner only; soft delete | 204; unauthorized/deleted 404 | DOCUMENT_DELETE or ACCESS_DENIED for valid inaccessible ID |
| GET `/api/documents/:id/permissions` | Owner only | 200 current named grants; unauthorized/deleted 404 | ACCESS_DENIED for valid inaccessible ID |
| PUT `/api/documents/:id/permissions` | Owner only; JSON `email`, `permission` (READ/EDIT) | 204 for grant/change; bad target/permission 400; unauthorized/deleted 404 | PERMISSION_GRANTED_OR_CHANGED or ACCESS_DENIED |
| DELETE `/api/documents/:id/permissions/:userId` | Owner only | 204 revoked; missing grant or unauthorized/deleted 404 | PERMISSION_REVOKED or ACCESS_DENIED for valid inaccessible document ID |
| GET `/api/admin/activity` | ADMIN only; no implied document-content access | 200 latest 100 events; non-admin 403 | ACCESS_DENIED for non-admin |

Unauthenticated document requests and authenticated requests with malformed
document IDs create denied events without recording credentials or raw paths.
Rejected origins, malformed or oversized JSON, throttled logins, and failed
document downloads caused by storage or integrity errors also create events.
Some invalid inputs and failed upload/storage operations still do not consistently
create events. Unauthenticated requests have no verified actor identity.
Audit writes for document and permission mutations share their database
transaction, but storage and database are distinct systems. See `THREATS.md` and
`CHECKPOINT-OPERATIONS.md` for limitations and staging requirements.

Malformed JSON returns a generic 400; a JSON body exceeding the configured limit
returns a generic 413. Parser details, stack traces and request content are not
returned in those responses. Both are audited without recording request bodies.
