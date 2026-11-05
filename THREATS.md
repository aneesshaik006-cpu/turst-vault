# Threat model — development build

TrustVault is not production-ready. No system can recall bytes already downloaded,
and requests authorized before revocation commits may remain in flight. Future
requests query current database grants. Document and permission mutations now commit with their audit events; a tested optional runtime-role grant template can restrict direct audit mutation, but production roles are not configured. Do not store confidential documents in this build.

| Threat / attack | Asset and impact | Current mitigation / test | Residual risk / disposition |
|---|---|---|---|
| BOLA / IDOR | Another user guesses an ID to download or modify a document. | Server-side current owner/grant check; HTTP isolation scenario in `test/security.integration.test.js`. | Not all routes and adversarial inputs have been tested; not accepted. |
| Revoked access | A previously granted user reuses a URL or searches. | Server reads grant for each request; HTTP scenario verifies denial after revoke. | In-flight responses and already downloaded files cannot be recalled; accepted limitation, remaining concurrency behavior unverified. |
| Privilege escalation | Viewer calls admin or permission API. | Server checks role or owner; integration scenario checks non-admin and unrelated owner. | Full role and parameter matrix incomplete; not accepted. |
| Search metadata leak | Search reveals hidden filenames, categories, dates or owners. | SQL scopes by owner/grant before filtering; integration scenario tests a hidden exact filename. | Pagination/counts and all filter combinations not fully tested; not accepted. |
| Malicious uploads / traversal / resource exhaustion | Dangerous files or malformed filenames compromise storage or consume resources. | Upload size limit, random keys, private directory, extension/MIME/signature checks. | Signature checks do not prove a file is safe; malware scanning and full negative tests absent; not accepted. |
| Session theft, fixation, CSRF, brute force | Attacker uses stolen session or induces state change. | Random session, hashed token storage, HttpOnly/SameSite cookies, Origin check, login rate limit. | Shared PostgreSQL throttling was tested across two local instances; proxy identity, abuse controls and complete integration tests remain unverified; not accepted. |
| SQL injection, metadata XSS | User-supplied input changes queries or executes script in another browser. | Parameterized SQL and text-based DOM rendering. | Full injection and browser security testing incomplete; not accepted. |
| Audit modification, deletion, truncation | Attacker changes or erases evidence. | App appends hash-linked events with serialized writers; an operator can write a checkpoint outside PostgreSQL. | A verifier checks links and hashes and accepts an independently stored checkpoint; a local test role cannot mutate historical audit rows; no protected checkpoint or production DB roles are configured. Without a trusted checkpoint, whole-chain rewrite and tail truncation can pass; not accepted. |
| Database administrator or backup compromise | An operator reads files or rewrites data and logs. | Storage is outside public web root and protected by local filesystem permissions. | Database/host admins and backups remain trusted; no encryption or external checkpoint; not accepted. |
| Deployment, secrets, CORS and cache | Misconfiguration exposes sessions or files. | Same-origin routes, no-store responses, security headers; production requires HTTPS origin. | No deployed environment or production verification; local demo credentials are not production credentials; not accepted. |

Vercel preparation adds an optional private Blob adapter. It has not been tested
against a real Blob store. The shared PostgreSQL login limiter fails closed when its store is unavailable.
It keys on the direct socket peer, which may aggregate users behind Vercel
proxies; trusted proxy configuration and availability effects remain unverified. Database connection pooling, environment configuration,
private storage isolation and the Vercel payload limit require deployed tests.

The HTTP regression scenario now also rejects missing and forged sessions,
cross-origin login, executable files, MIME/signature mismatch, empty uploads,
path traversal names and oversized uploads. A temporary-copy mutation experiment
confirmed that bypassing the authorization policy causes the unauthorized
 download assertion to fail. These checks do not replace the remaining attack
matrix or a deployed test.

The isolated open-viewer-session browser procedure in
`BROWSER-REVOCATION-TEST.md` showed that a previously rendered download link was
denied after a separate owner request revoked the grant and that refreshing the
viewer workspace removed the row. The idle page displayed preloaded metadata
until refresh; no previously downloaded file or in-flight response was recalled.
The application ignores forwarding headers; a local two-instance test verifies
that varied spoofed and malformed values do not create separate throttle buckets.
Vercel's documented proxy behavior still requires an authorized staging check.

Local test-role evidence: `test/audit-role.integration.test.js` applies
`ops/grant-runtime-privileges.sql` to a synthetic schema and temporary non-owner
roles. It checks that the runtime role can append/read but cannot update, delete,
truncate or alter audit events, and that a separate reader cannot append. A local
API process assuming the runtime role completed login and synthetic upload. These
checks do not establish production role membership or operator filesystem
separation, and a compromised runtime role can still append misleading events.

Storage access now accepts only generated UUIDv4 keys, reducing the risk of a
corrupt database key being interpreted as a filesystem path. `test/storage.test.js`
checks local storage; this does not prove private Blob access or defend against a
compromised application or host. If an audit/database insert fails after local
file creation, the API attempts cleanup; an integration test confirms cleanup
when that removal succeeds. A failed cleanup or process interruption can still
leave an orphaned file, and Blob cleanup has not been tested.

Upload denial handling now writes a `DOCUMENT_UPLOAD` denied event for invalid
files, role denials and malformed multipart input. Non-owner authorization occurs
before multipart parsing. The HTTP integration scenario tests the response and
actor/reason evidence, and checks that audit-store failure returns 500 rather
than treating a denied upload as successful. Some validation failures and storage
exceptions are not comprehensively audited.

Unauthenticated document requests now create denied events with no verified
actor; malformed document IDs are recorded without the raw input. Tokens and
request bodies are not included. A download fails closed if its audit event
cannot be written. Unauthenticated traffic can be abused to consume audit
storage and serialize database writes; edge-level abuse controls and retention
have not been implemented or verified. Rejected origins, JSON parser errors and
throttled logins are now recorded without request bodies or credentials, but
their pre-authentication events cannot establish a verified actor identity.

The local embedded database launcher now requires a separately supplied local-only
password and refuses `NODE_ENV=production`. Changing the environment setting does
not rotate an existing initialized database account. Synthetic browser fixtures
still use documented test-only credentials and must remain local and disposable.

The focused Biome lint check covers selected correctness/security rules only;
it does not replace authorization tests, full static analysis, or browser and
staging verification. See `biome.json` for the exact enabled rules.

### Reciprocal local owner isolation

The HTTP integration scenario now also creates a second owner's synthetic file
and checks that the first owner cannot download, edit, delete, enumerate its
permissions or discover it by name. This was verified against an isolated local
PostgreSQL schema. It does not establish deployed infrastructure isolation or
protect a document already downloaded by an authorized user.

### Post-revocation regression (2026-11-05)

After the revoke response confirms the database commit, the HTTP integration
test reuses the viewer's still-valid session and old URL for concurrent
downloads, metadata edits and searches. Downloads and edits are denied, search
hides the document, and denied edits do not alter its stored name. Requests
already authorized before the commit can still finish. The expanded open-edit
browser procedure is documented in `BROWSER-REVOCATION-TEST.md`; this regression
does not verify a deployed system or demonstrate every possible interleaving.
