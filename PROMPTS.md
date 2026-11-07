# Development history

This log records development requests, AI assistance, tests and limitations.
The dated entries describe the state at the time of each change.

## 2026-11-07 — submission demo

- Direction: Prepare a synthetic-data demo, make it accessible to reviewers, and
  allow unscanned uploads in the demo while no scanner is available.
- Work: Configured the Preview with a restricted database role, seeded five
  synthetic accounts, added an explicitly enabled Preview-only scanner bypass,
  deployed the demo, and removed Vercel Authentication at the user's request.
- Verification: The local database suite passed 21 tests before the new scanner
  configuration test was added. The new scanner tests and build checks passed;
  the deployed owner login returned 200 and a synthetic PDF upload returned 201.
- Limitations: The demo uses Vercel Blob; Neon storage cutover and independent
  audit and backup controls are incomplete. A database-owner password was
  exposed in conversation and needs rotation. Use synthetic data only.

## 2026-11-07 — final assessment follow-up

- Direction: Improve security evidence, threat thinking, functionality and
  submission documentation as far as possible before a final assessment.
- Work: Updated the threat model against current tests and deployment evidence;
  ran the staging runtime-role inventory and a synthetic deployed API workflow.
- Verification: All 23 tests passed against a disposable local database. The
  deployed workflow covered login, upload, grant, download, edit, search,
  revocation and administrator access control. The synthetic document was
  soft-deleted, and test sessions were logged out.
- Limits: These results do not establish independent checkpoint custody, a real
  malware scanner, production readiness, or the outcome of the company's tests.

## 2026-11-07 — date filter correction

- Direction: Make another pass on functionality and submission readiness.
- Finding and change: Date filters accepted impossible calendar dates and
  reversed ranges. The API now rejects both with a 400 response and retains the
  existing rejection audit behavior.
- Verification: Unit and HTTP integration cases cover leap days, invalid dates
  and reversed ranges. The full disposable-database suite passed 24 tests without
  skips; login and date filtering were checked on the new Preview deployment.
- Limit: A fresh visual browser walkthrough could not be run because the browser
  host was unavailable. The known operational security gaps remain open.

## 2026-11-01 — authentication primitives

- Request: Build TrustVault module by module, starting with authentication and security tests.
- AI recommendation and useful work: Use scrypt with per-password random salts and opaque random session tokens whose hashes can be stored.
- Incomplete or risky: These helpers do not authenticate HTTP requests, persist or expire sessions, provide CSRF protection or rate limiting, or prove database behavior. The project is not ready for use.
- Verification: Ran `npm test`; eight tests passed, including correct and incorrect passwords, unique salts, invalid input, and session token hashing.
- Change: Added `src/auth-crypto.js` and `test/auth-crypto.test.js`. No human decision beyond the request is inferred.
- Commit: Not committed.

## 2026-11-01 — access control and revocation

- Request: Complete the project and address the security and functionality scoring rubric.
- AI recommendation: Add server-side, current-state permission checks, owner-managed grants, search filtering, and HTTP security tests.
- Useful: Implemented basic grant, revoke, search, edit and delete endpoints with a test against a separate local PostgreSQL database.
- Incomplete or risky: Audit events are not transactionally coupled to mutations; no production deployment, audit verifier, full attack matrix or permission-race verification exists. A passing scenario is not proof of security.
- Verification: The expanded `npm test` run against a disposable database reported nine passing tests, zero failures and zero skips. It included unauthorized access, READ/EDIT, revocation, search isolation, ownership tampering and admin denial.
- Change: Added API routes, workspace controls and `test/security.integration.test.js`; no claim is made that a human independently reviewed the output.
- Commit: Not committed.

## 2026-11-01 — audit failure handling

- Request: Work toward the security rubric and ask for deployment information when needed.
- AI finding: Document changes could commit before an audit insert failed.
- Change: Put document/permission mutations and their success events into the same PostgreSQL transaction; applied the same pattern to login and logout.
- Verification: An integration test made audit insertion fail and confirmed the document edit rolled back. The full test run reported 9 passing, 0 failing and 0 skipped.
- Remaining risk: The runtime role is not separated from the audit owner, and there is no chain verifier or independent checkpoint. Filesystem writes are not a transactional database resource.
- Commit: Not committed.

## 2026-11-01 — security testing before deployment

- Request: Complete local tests and give a score before deployment.
- Finding: Multipart parsing could normalize a path-like filename before validation; the full security matrix and live deployment were not yet verified.
- Change: Preserve the supplied filename for validation and add HTTP negative tests for authentication, Origin and upload attacks.
- Verification: Nine tests passed locally with zero failures or skips. An isolated temporary-copy authorization bypass made the unauthorized-download check fail as intended. Production dependency audit reported zero vulnerabilities.
- Limitation: A single mutation experiment does not prove every route is protected; no live deployment or Blob-store test was performed.
- Commit: Not committed.

## 2026-11-01 — audit verification

- Request: Verify the current project against the rubric and improve safe local security checks without deploying.
- Finding: Hash-linked audit events had no verification command; a database owner could rewrite or truncate the chain.
- Change: Added a local verification function and CLI accepting an optional independently protected checkpoint; verified actual database events and tampered copies.
- Verification: The authorized local PostgreSQL suite reported 9 passing tests and 0 failures or skips, including changed action/actor/previous hash, middle deletion, reordering and tail deletion against a checkpoint.
- Limitation: Checkpoints are not independently provisioned and runtime DB privileges are not separated. A complete rewrite or tail truncation without a trusted checkpoint may pass; no live service was tested.
- Commit: Not committed; repository has no commits.

## 2026-11-01 — shared limits, checkpoints and admin view

- Request: Continue against the rubric with local tests and no unauthorized external services.
- Finding: Login limiting was per-process; audit checkpoints were not preserved separately; admin activity lacked a usable view.
- Change: Added PostgreSQL shared throttling, operator-held checkpoint creation and prefix verification, admin activity UI, migration and security tests.
- Verification: The final local suite reported 12 passed, zero failed/skipped; a two-instance test exercised the shared limit and store failure. A synthetic browser flow exercised owner upload/grant, viewer visibility and admin activity. Offline dependency audit reported zero cached advisories.
- Limitations: Independent identities and audit privileges are not provisioned; Vercel proxy identity and real Blob storage are unverified; the user declined external Blob testing. No independent human review is claimed.
- Commit: Not committed.

## 2026-11-01 — open-session revocation and proxy boundary

- Request: Reproduce checks, test revocation with an already-open viewer session,
  and avoid external systems or deployments.
- Finding: The prior browser check signed the viewer out before checking changes;
  the shared limiter used the direct socket peer, not a verified Vercel client IP.
- Change: Added a local synthetic-fixture control script and manual browser test
  procedure; expanded spoofed-header, concurrent revoke and checkpoint tests;
  documented staging identity and checkpoint prerequisites.
- Verification: With the viewer still signed in, an owner API request revoked
  access; the previously rendered download link showed Not found and a refresh
  removed the document row. Two local server instances shared a throttle bucket
  despite spoofed/malformed forwarding headers. Tests used a temporary schema.
- Limitations: The idle page retained metadata until refresh; no previously
  downloaded file or in-flight request was recalled. Operator OS/DB identities,
  a deployed Vercel proxy and live Blob behavior remain unverified.
- Commit: Not committed. No independent human review is claimed.

- Follow-up verification: a fresh isolated copy completed `npm ci --offline`,
  12 tests with no failures/skips, syntax checking and an offline dependency
  audit. This was not a Git clone or an online security audit; separate identity
  testing, full demo and deployment remain open.

- Follow-up change: Require an explicit initial checkpoint or a previous trusted
  checkpoint for rotation, to avoid silently accepting a replacement baseline.
  The local integration suite tested both the rejection and a valid rotation;
  identity separation remains unverified.

## 2026-11-01 — runtime role and metadata editing

- Request: Continue implementing and testing the supplied rubric without deploying
  or using unauthorized credentials or cloud resources.
- Finding: A PostgreSQL privilege template and actual metadata edit UI were absent;
  EDIT's file-content scope was not documented. A local UI review also found that
  a list-refresh error could be masked after a successful save.
- Changes: Added a role grant template and temporary-role test, route matrix,
  metadata-only edit UI, and explicit documentation of the unresolved content
  replacement decision. Corrected the misleading refresh feedback.
- Verification: A restricted local role could use the API but could not rewrite
  audit events; local browser tests covered owner, READ, EDIT and revoked edit
  states. Thirteen tests passed with zero failures/skips; offline audit reported
  zero cached advisories. A mocked browser review verified refresh-error feedback.
- Limitation: No independent operator OS identity or production grants were
  verified, and this entry does not claim independent human review.
- Commit: Not committed.

## 2026-11-01 — storage failure and key handling

- Request: Continue local security implementation and verification without
  deploying or using unauthorized cloud resources.
- Finding: Storage accepted arbitrary database keys, and audit-failure cleanup for
  uploads had not been checked by an integration test.
- Change: Enforced generated UUIDv4 storage keys; added local storage tests and a
  failed-audit upload cleanup assertion.
- Verification: The local full suite reported 14 passed, zero failed and skipped;
  syntax passed and the offline cached advisory audit reported no vulnerabilities.
- Limitation: Cleanup is best effort; crashes or failed deletion can leave orphans.
  Real private Blob access and production identity isolation remain unverified.
- Commit: Not committed. No independent human review is claimed.

## 2026-11-01 — rejected upload audit coverage

- Request: Continue implementation and local QA against the actual rubric without
  deployment or unauthorized cloud resources.
- Finding: Invalid and role-denied uploads were not consistently audited, and
  multipart parsing occurred before non-owner role rejection.
- Change: Reject non-owner uploads before multipart parsing; record denied audit
  events for role, validation, size and malformed multipart cases; return 400 for
  malformed multipart and 413 for oversized input.
- Verification: The isolated HTTP scenario checked those responses and denial
  events. A local synthetic browser rehearsal covered owner upload, pre-grant
  denial, READ grant, viewer download, revocation and administrator activity.
- Limitations: Audit coverage of all rejected operations is still incomplete;
  external identity, production Blob, proxy and deployment are unverified. The
  rehearsal used an owner API session for revocation and was not a timed demo.
- Commit: Not committed. No independent human review is claimed.

## 2026-11-01 — local credential configuration

- Request: Complete safe local work and review credentials before a local Git baseline.
- Finding: The embedded local database launcher used a fixed reusable development
  password; this was inappropriate as a default even though it was demo-only.
- Change: Require a local-only password through `LOCAL_DB_PASSWORD`, refuse the
  launcher in production, ignore `.env.*` files and add an empty example template.
- Verification: `test/local-db-config.test.js` rejects missing credentials and
  production mode. The full local suite passed 15 tests; syntax and cached offline
  dependency checks passed.
- Limitation: Existing database passwords were not rotated. Synthetic browser test
  credentials remain in test fixtures. Local scans cannot guarantee secret absence,
  and no production credentials or environment were inspected.
- Commit: Baseline not yet created at the time of writing; no independent human
  review is claimed.

- Local Git baseline follow-up: the reviewed file set was staged; the automatic
  approval review rejected commit creation because it considered separate user
  approval necessary. No commit was created. A fresh local folder copy (not a
  clone) passed 15 tests, syntax checks and an offline cached dependency audit.

## 2026-11-01 — EDIT scope and request errors

- User direction: Use the supplied six-category rubric and select metadata-only
  EDIT as the default unless an authoritative requirement says otherwise.
- AI finding: Malformed JSON returned a generic server error rather than a client
  error. A local integration assertion reproduced the behavior (500 versus 400).
- Change: Return generic 400/413 responses for malformed/oversized JSON, retaining
  the existing metadata-only permission scope.
- Verification: The targeted local integration scenario passed after the change;
  full-suite results are recorded separately in the test report.
- Limitations: The user did not provide independent code review, and deployment,
  checkpoint identity separation and live proxy/storage verification remain open.
- Commit: No commit existed at the time of writing.

## 2026-11-01 — timed local core flow

- Request: Keep the clean-clone baseline, finish local checks and rehearse the
  demo without authorizing staging.
- Work: Re-ran the local suite and exercised a synthetic owner/viewer/admin core
  flow including upload, denial, grant, download, revocation and audit activity.
- Verification: Fifteen tests passed; syntax passed; offline cached advisory
  check found zero vulnerabilities. The browser flow reached admin activity in
  129 seconds, including automation delay.
- Limitations: Revocation used a separate owner API client; this was not a complete
  narrated demo, an independent human review, or a staging/deployment test.
- Baseline tested: `98ffd1a95d2ee06221866bffe9c80f6feb3d7ab4`.

## 2026-11-01 — local lint and demo preparation

- Request: Rehearse/record the full demo, add or defer build/lint/type checks,
  and run a current dependency audit before considering staging.
- Finding: The existing check only parsed syntax. An initial ESLint dependency
  tree reported advisories; it was removed and a focused Biome lint was configured.
- Verification: Local suite: 15 passed; Biome lint checked 29 files; both current
  `npm audit` and `npm audit --omit=dev` reported zero vulnerabilities.
- Limitation: `DEMO-SCRIPT.md` is a proposed narration, not a recorded demo.
  The full narrated rehearsal, type checking and Vercel build remain incomplete.
  No staging deployment or independent human review occurred.
- Commit: Not yet committed at the time of this entry.

## 2026-11-01 — clean clone with lint dependency

- Request: Verify commit `92c4603` in a true clean local clone and complete a
  narrated demo before considering separately authorized staging.
- Verification: The full-hash local clone completed offline installation,
  15 tests, syntax and lint; current online npm audits reported zero vulnerabilities.
- Limitation: The complete narrated demo was not recorded or fully rehearsed; no
  isolated screen-and-narration recording tool was available. No staging or
  independent human review was claimed.
- Commit verified: `92c4603c5eb9069523fcc8050e8c04241a53847e`.

## 2026-11-06 — revocation and audit operations

- User direction: Complete the remaining revocation and audit-protection work,
  then use disposable resources when real independent infrastructure was not
  available.
- Problem found: A browser test had stopped after revocation but before the edit
  was submitted; treating the API test as proof of the browser flow would have
  overstated the evidence. Audit verification also had no dedicated checkpoint
  freshness check for a scheduler.
- Work and verification: Re-ran the open-edit browser scenario through denial,
  old download denial and refresh. Added a checkpoint health command and local
  tests, including stale and mismatched checkpoints. A separate operator account,
  independent checkpoint storage, scheduler and actual alert delivery remain
  unverified; local tests do not establish those boundaries.
- Implementation: [aa78e3e](https://github.com/aneesshaik006-cpu/turst-vault/commit/aa78e3e).

## 2026-11-06 — staging role review preparation

- User direction: Continue the remaining audit and deployment phases.
- Finding: A table-level `safe` diagnostic did not enumerate executable
  `SECURITY DEFINER` routines or reachable roles, so it could not support the
  required escalation review by itself.
- Work and verification: Added a read-only inventory command and tested it with
  a synthetic restricted role and definer function. The local PostgreSQL suite
  passed 20 tests. The staging connection was unavailable, so this is preparation
  for an independent review, not proof that staging has no escalation path.
- Implementation: uncommitted at the time of writing.

## 2026-11-06 — scanner, staging credentials and AI mistake

- User direction: Complete staging security, use a dummy service for tests when
  necessary, and prepare a judge-accessible deployment.
- Mistake: The assistant printed the shared staging-only demo password while
  trying to inspect a credential file. It disclosed the mistake and did not make
  the protected preview judge-accessible with those credentials. The user did
  not independently discover this error; the assistant identified it.
- Work and verification: Added a production-mode fail-closed HTTPS scan contract,
  an ephemeral mock-scanner integration test, read-only storage reconciliation,
  and a transactional staging-demo password rotation command. The full local
  PostgreSQL suite passed 20 tests. The mock is not a malware engine; no scanner
  service or staging owner connection was available, so the real password has
  not been rotated and the new scanner code has not been deployed.
- Implementation: [aa78e3e](https://github.com/aneesshaik006-cpu/turst-vault/commit/aa78e3e).
