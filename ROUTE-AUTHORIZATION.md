# Route authorization matrix

This describes the current API, not a claim that every cell is tested. Active
sessions are checked against current user state on every protected request.
Disabled, expired, missing and malformed sessions receive 401 on protected routes.
A revoked user is treated as an unrelated authenticated user for that document.
For object routes, a missing, deleted or unauthorized document normally returns
404 to avoid revealing its existence. Administrators have no implicit document
access. Frontend role checks are only presentation.

| Method / route | Owner | READ | EDIT | Unrelated / revoked | Admin without grant | Missing / expired / disabled | Evidence / gap |
|---|---|---|---|---|---|---|---|
| POST `/api/auth/login` | Valid credentials | Valid credentials | Valid credentials | Valid credentials | Valid credentials | Invalid credentials 401; disabled denied | Generic wrong/missing login and disabled behavior tested; brute-force store test. |
| GET `/api/auth/me` | 200 | 200 | 200 | 200 | 200 | 401 | Logout, disabled, expiry and forged session checked. |
| POST `/api/auth/logout` | 204 | 204 | 204 | 204 | 204 | 401 | Logout invalidation checked; every role not individually checked. |
| GET `/api/documents` | Own and granted | Granted | Granted | No hidden rows | Own/granted only | 401 | Exact hidden filename and revocation checked; all filters/pagination not exhaustive. |
| POST `/api/documents` | 201 for valid PDF/PNG | 403 if VIEWER | 403 if VIEWER | Role-based: OWNER can upload own | 403 | 401 | Malicious-file cases tested; every role not individually checked. |
| GET `/api/documents/:id/download` | 200 | 200 | 200 | 404 | 404 | 401 | Owner isolation, grant, revoke and deleted checked; real Blob not tested. |
| PATCH `/api/documents/:id` | 204 | 404 | 204 | 404 | 404 | 401 | Metadata only: name/category. Read/edit/revoke and ownerId tampering checked. |
| DELETE `/api/documents/:id` | 204 | 404 | 404 | 404 | 404 | 401 | Unrelated, READ and concurrent deletion checked; full role matrix incomplete. |
| GET `/api/documents/:id/permissions` | 200 | 404 | 404 | 404 | 404 | 401 | Unrelated owner and missing auth checked; full role matrix incomplete. |
| PUT `/api/documents/:id/permissions` | 204 valid target | 404 | 404 | 404 | 404 | 401 | Viewer/owner/admin tampering checked; grant and concurrent duplicates checked. |
| DELETE `/api/documents/:id/permissions/:userId` | 204 existing grant | 404 | 404 | 404 | 404 | 401 | Owner revoke and post-revoke read/edit checked; not every attacker checked. |
| GET `/api/admin/activity` | 403 unless ADMIN | 403 unless ADMIN | 403 unless ADMIN | 403 unless ADMIN | 200 | 401 | Viewer denial and admin success tested. |

Unsafe requests require the exact configured Origin, including login. The 404
convention and audit behavior are not comprehensive for malformed IDs or input
validation failures. This table does not establish deployed behavior.

The workspace now exposes metadata editing to OWNER and EDIT permissions. In a
synthetic browser test, OWNER and EDIT successfully changed metadata, READ did
not show an edit control, and a revoked EDIT user saw an error when submitting an
already-open form. The API integration test checks that a supplied file-content
field does not replace stored bytes. File-content replacement is not implemented.

The most recent local storage test rejects path-like or malformed storage keys,
checks a UUIDv4 local storage round trip and duplicate creation, and verifies
that an audit-insert failure during upload cleans up the synthetic local file and
metadata row when cleanup succeeds. Real Blob and cleanup failure remain untested.
