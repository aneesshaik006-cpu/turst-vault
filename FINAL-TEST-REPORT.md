# TrustVault local security and readiness checklist

Assessment date: 2026-11-01. The six user-supplied scoring criteria and the ten
original functionality requirements are mapped in `RUBRIC-MAP.md`. No Git commit
exists; all project files were untracked, so no committed diff or clean Git clone
could be inspected. No deployed or production environment was accessed.

## Completed and checked

- Baseline: `TEST_DATABASE_URL=<local-test-url> npm test`: 9 passed, 0 failed,
  0 skipped, 784 ms before this iteration.
- Final: the same command after changes: 12 passed, 0 failed, 0 skipped, 996 ms.
  Integration tests use synthetic data, temporary schemas and temporary storage.
- `npm run check`: passed JavaScript syntax checks. This is not lint or typecheck;
  no lint, typecheck or production build scripts are configured.
- `npm audit --offline --omit=dev`: found 0 vulnerabilities in the locally cached
  advisory data; freshness was not established and no online audit was run.
- An isolated clean *copy* (not a Git clone) completed `npm ci --offline` and
  `TEST_DATABASE_URL=<local-test-url> npm test`: 12 passed, 0 failed, 0 skipped,
  1128 ms. This copy was made before the final additional browser-fixture and test
  assertions, so it does not prove the latest full tree from a clean clone.
- A synthetic local browser fixture was used to sign in as an owner, upload a
  synthetic PDF, grant READ, sign in as the viewer and see the shared file, then
  sign in as admin and see upload and grant audit events. A separate visual
  fixture inspected desktop, tablet and mobile admin layouts. Browser revocation
  without logout, actual downloading, error states and full demo were not tested.
- Concurrent duplicate grants, simultaneous deletes, disabled users, expired
  sessions, admin API authorization and denial of admin document access were
  added to the HTTP scenario. Post-commit revocation is checked sequentially;
  revoke/download and revoke/edit races are not exhaustively tested.
- Two local application instances sharing PostgreSQL collectively limited 20
  concurrent login attempts; both rejected subsequent attempts. Renaming the
  isolated test throttle table caused login to return 503 (fail closed).
- An external-file checkpoint can be created exclusively and verified against a
  prefix even after new events append. Tests show that a fully rewritten valid
  chain is accepted without a checkpoint and rejected against the earlier one.

## Trust boundary and remaining work

- Checkpoint ownership/separation is a **deployment prerequisite**, not enforced
  by the application: a separate operator must control the checkpoint location
  and read-only audit credentials, and the application/database identities must
  be unable to modify them. No such accounts, storage policies or protected
  database audit role were provisioned or tested. Tail changes after the latest
  checkpoint and a compromised initial baseline remain undetectable.
- The shared limiter keys on the direct socket peer and does not trust forwarded
  headers. Behind Vercel this may group users by proxy; trusted client identity,
  availability behavior and table cleanup need deployment-specific validation.
- Full attack, race, accessibility and browser workflow coverage, API docs,
  production build, complete demo and all-route mutation tests remain incomplete.
- Private Blob was not tested against the real service: the user requested local
  testing only. No external test account, paid service, deployment, live HTTPS
  check, production data, or external attack was used.
- `PROMPTS.md` records genuine observations and test results; it does not claim
  independent human review. Its history is not a substitute for such review.

Local checks pass in the stated scope. Deployment readiness is **not established**.
Live authorized environment verification has **not occurred**. No honest 100/100
score or judge outcome can be guaranteed. Do not use confidential documents.

## Follow-up local verification — 2026-11-01

- Baseline re-run `TEST_DATABASE_URL=<local-test-url> npm test`: 12 passed,
  0 failed, 0 skipped, 1437 ms. `npm run check` passed. The offline production
  dependency audit reported zero cached advisories, with unknown freshness.
- `TEST_DATABASE_URL=<local-test-url> node --test test/throttle.integration.test.js`:
  1 passed; two instances shared a bucket despite spoofed/malformed forwarding
  headers. This does not verify Vercel's runtime proxy or client identity.
- `node --test test/checkpoint.test.js`: 1 passed; exclusive creation, local
  file permissions, backup copy/recovery and rotation were exercised under one OS
  identity. It does not prove the application or database identities cannot
  change the operator's checkpoint.
- `TEST_DATABASE_URL=<local-test-url> npm test` after concurrency additions:
  12 passed, 0 failed, 0 skipped, 1310 ms. The concurrent revoke/download/edit
  scenario allows already-in-flight requests to finish, then checks post-revoke
  requests fail; it does not prove every possible interleaving.
- Manual isolated browser procedure: `BROWSER-REVOCATION-TEST.md`. Viewer was
  signed in before a separate owner API request revoked the synthetic grant;
  the previously visible download link showed Not found, and after refresh the
  workspace showed zero files. The old row remained visible before refresh.
  Already-downloaded files, browser cache behavior for previously retrieved
  content and production URLs were not tested.
- Limited pattern scan of 43 untracked files reported credential-like assignments
  in the local demo/readme/test files; these need human review before any Git
  baseline and are not proof of a comprehensive secret-free repository. No values were logged.
  `.local`, `node_modules` and Git internals were excluded; no baseline was
  committed or proposed.
- Vercel request-header documentation was inspected read-only. No production
  proxy configuration or staging request was exercised.

Audit checkpoint isolation remains **blocked**, not verified: an independent
operator OS/service identity, non-owner application/database identities,
protected checkpoint storage and authorized staging evidence are required as
specified in `CHECKPOINT-OPERATIONS.md`. Do not call the audit log immutable.

### Final fresh-copy checks

A fresh isolated copy of the application, tests and documentation was made with
`tar` excluding `.git`, `.local`, `node_modules` and `.DS_Store`. This is not a
Git clone. In that copy, `npm ci --offline` succeeded, then
`TEST_DATABASE_URL=<local-test-url> npm test` reported 12 passed, 0 failed,
0 skipped in 1089 ms. `npm run check` passed, and
`npm audit --offline --omit=dev` reported zero vulnerabilities using cached
advisory data. The report was updated after the copy was made; no application or
test code changed after that copy. No lint/typecheck or production build script
is configured, and none was claimed.

Next authorized work: provision separate synthetic application, database-server,
and operator identities and independently controlled storage in an isolated
staging environment; execute the negative role and checkpoint tests described in
`CHECKPOINT-OPERATIONS.md`. A separate user approval and test environment are
required for real Vercel/Blob, proxy and HTTPS verification. A complete demo and
all-route/race/security matrix remain incomplete.

## Checkpoint rotation safeguard

The checkpoint CLI now requires an explicit `--initial` for a first baseline or
`PREVIOUS_AUDIT_CHECKPOINT` for rotation; neither may be silently omitted. In
an isolated PostgreSQL schema, the HTTP integration scenario verified that a
missing previous checkpoint is rejected, then created an initial checkpoint,
appended an event and rotated against the previous file. The local suite after
this change reported 12 passed, 0 failed and 0 skipped (1449 ms). This does not
prove that a separate operator identity protects checkpoint storage.

### Final checkpoint-rotation copy verification

After the explicit checkpoint-baseline safeguard, a fresh isolated `tar` copy
(not a Git clone) completed `npm ci --offline`, then
`TEST_DATABASE_URL=<local-test-url> npm test` (12 passed, 0 failed, 0 skipped,
1165 ms), `npm run check` (passed), and `npm audit --offline --omit=dev` (zero
cached advisories; freshness unknown). This report was updated after the copy;
no application or test source changed after it was made.

## Implementation and QA follow-up — 2026-11-01

- Baseline `TEST_DATABASE_URL=<local-test-url> npm test`: 12 passed, 0 failed,
  0 skipped, 1325 ms. `npm run check` passed; `npm audit --offline --omit=dev`
  reported 0 cached advisories, with unknown freshness.
- Added `ops/grant-runtime-privileges.sql` and local isolated PostgreSQL role test.
  `TEST_DATABASE_URL=<local-test-url> node --test test/audit-role.integration.test.js`
  passed: the non-owner runtime role could append/read audit but could not modify,
  delete, truncate or alter historical events or change/delete users; a separate
  read-only role could read but not append. A real local API process running with
  the assumed runtime role logged in and uploaded a synthetic file. Test roles
  and schema were created and removed; a CREATEROLE-capable disposable local
  database is required. This does not prove production role membership or an
  independent checkpoint filesystem identity.
- Expanded unauthenticated and attacker route checks and confirmed metadata edit
  does not replace bytes. `ROUTE-AUTHORIZATION.md` maps route/role behavior and
  identifies untested cells.
- Implemented name/category metadata-edit controls only. In an isolated real
  local browser fixture, an owner saved changes; a READ user saw no edit control;
  an EDIT user saved changes; a revoked user with an already-open edit form saw
  a denial. A separate mocked-browser review found and then verified a fix for
  refresh-failure feedback after a successful mutation. Other browser error states
  and a complete demo remain unverified.
- Full suite after changes: 13 passed, 0 failed, 0 skipped, 1513 ms;
  `npm run check` passed; offline dependency audit found 0 cached advisories.
- A selected-pattern scan covered 48 untracked files; private-key, AWS, GitHub,
  OpenAI and Stripe patterns had no matches. Seven files contained assignment
  matches classified against known synthetic/demo placeholders. Values were not
  printed. This is not a comprehensive secret scan, ignored local data and Git
  internals were not scanned, and no production credential was verified; no
  rotation decision can be made without a comprehensive review.
- EDIT currently changes metadata (name/category) only and cannot replace file
  content. The product/evaluation decision on file-content editing remains open.
- `API.md`, `ROUTE-AUTHORIZATION.md`, `STAGING-TEST-PLAN.md`, and `CLEAN-CLONE.md`
  document current behavior and future approval-dependent verification. No
  production role, separate operator checkpoint identity, real Blob store,
  staging environment, external attack, commit, push or deployment was used.

### Final isolated-copy verification for this iteration

A fresh `tar` copy (excluding `.git`, `.local`, `node_modules`, `.DS_Store`) ran
`npm ci --offline`, then `TEST_DATABASE_URL=<local-test-url> npm test`: 13 passed,
0 failed, 0 skipped, 1248 ms. `npm run check` passed. `npm audit --offline
--omit=dev` reported zero vulnerabilities in cached advisory data (freshness
unknown). The report was updated after the copy; no application or test source
changed afterward. This was not a Git clone, online audit or production build.

## Storage hardening follow-up — 2026-11-01

Baseline rerun at start of this iteration: `TEST_DATABASE_URL=<local-test-url>
npm test` returned 13 passed, 0 failed, 0 skipped (1460 ms); `npm run check`
passed and the offline dependency audit reported zero cached advisories. These
are newly executed local checks; earlier report sections are historical.

Changes: validate all storage identifiers as generated lowercase UUIDv4 values;
add local storage round-trip, duplicate and path-manipulation tests; exercise a
failed audit write during upload and verify the local file and document row are
removed. File cleanup is best effort; process interruption or deletion failure can
still leave orphaned files. Blob behavior was not tested.

Targeted `node --test test/storage.test.js`: 1 passed. Targeted local database
security scenario: 1 passed. Full `TEST_DATABASE_URL=<local-test-url> npm test`:
14 passed, 0 failed, 0 skipped, 1372 ms; `npm run check` passed;
`npm audit --offline --omit=dev` reported 0 vulnerabilities from cached advisories
with unknown freshness. No current online audit, lint/type check or production
build was run; none is configured as a project script.

A selected-pattern scan inspected 50 untracked files without printing values.
Seven files had credential-like assignments that matched known local demo/test
placeholders; no selected private-key, AWS, GitHub or provider-key patterns
matched. This cannot establish the absence of real secrets, excluded ignored files
and Git internals, and does not justify assuming credentials are safe for reuse.
No known real credential was identified for rotation by this limited scan; if a
demo value was reused outside this local setup, replace it in that environment.

No separate application/database/operator OS identities or protected checkpoint
store were provisioned. No staging or production credentials, private Blob store,
cloud resources, deployment, live HTTPS, commit or push were used. The latest
iteration did not rerun the complete browser demo; earlier browser results remain
historical. See `STAGING-TEST-PLAN.md` for approvals and `CLEAN-CLONE.md` for the
future user-approved Git procedure.

### Final isolated-copy result for storage hardening

A fresh local `tar` copy (not a Git clone) completed `npm ci --offline`, then
`TEST_DATABASE_URL=<local-test-url> npm test`: 14 passed, 0 failed, 0 skipped,
1331 ms. `npm run check` passed and `npm audit --offline --omit=dev` reported
zero vulnerabilities from cached data. The report was amended after copying; no
application or test code changed afterward. No current online audit, lint/type
check, production build, staging or deployment was performed.

## Local rejected-upload and demo follow-up — 2026-11-01

Baseline at start of this iteration: `TEST_DATABASE_URL=<local-test-url> npm test`
reported 14 passed, 0 failed, 0 skipped (1460 ms). `npm run check` passed;
`npm audit --offline --omit=dev` reported 0 cached advisories, freshness unknown.

Changed `src/server.js` to reject non-OWNER uploads before multipart parsing and
record denied upload audit events for role, invalid file, missing input, size and
malformed multipart cases. The targeted `test/security.integration.test.js`
scenario passed after these changes, including denied-event actor/reason checks,
malformed input 400, oversized input 413, and audit-store failure returning 500.
It also checks more role/permission routes, search filters, EDIT-to-READ downgrade,
revocation, disabled/expired sessions and direct local-storage URL denial.

`DEMO-REHEARSAL.md` records the untimed synthetic local browser rehearsal in this
iteration: owner upload, pre-grant denial, owner READ grant, viewer search and
synthetic download, separate owner API revoke while viewer remained signed in,
old URL denial and administrator activity. It does not claim a timed demo,
second browser owner session, complete EDIT/UI deletion/error flows, real Blob,
or deployed behavior. A synthetic browser download was compared to the fixture
and the test copy removed.

A selected-pattern scan of 51 untracked files found seven files containing
credential-like assignments matching known local demo/test placeholders and no
matches in the selected private-key, AWS, GitHub and provider-key formats. Values
were not printed. Ignored files, Git internals and other formats were not covered;
no real secret was identified, but this is not a comprehensive secret review.
If a demo credential was reused elsewhere, replace it there. No Git baseline was
created and no production or staging credential was used.

### Final isolated-copy result for rejected-upload follow-up

A fresh `tar` copy (not a Git clone) completed `npm ci --offline`. In that copy,
`TEST_DATABASE_URL=<local-test-url> npm test` reported 14 passed, 0 failed,
0 skipped, 1235 ms. `npm run check` passed; `npm audit --offline --omit=dev`
reported 0 cached vulnerabilities with unknown advisory freshness. The report
was updated after the copy was made; application and test code did not change.
No current online audit, production build, staged Blob check or deployment was
performed. The local browser rehearsal in `DEMO-REHEARSAL.md` was untimed and
used an owner API client, not a second browser, for revocation.

## Local credential configuration follow-up — 2026-11-01

Baseline: `TEST_DATABASE_URL=<local-test-url> npm test` returned 14 passed,
0 failed and 0 skipped (1536 ms). `npm run check` passed; offline cached dependency
advisory check reported zero vulnerabilities. These were rerun locally.

Changed `scripts/local-db.js` to require a supplied local-only password and refuse
production mode; `test/local-db-config.test.js` checks both failure paths. Added
`.env.*` ignore rules and an empty `.env.example`. Updated README. No password of
an already initialized local database was changed; if the old demo value has been
reused outside the local fixture, its owner should replace it there.

After the change, `TEST_DATABASE_URL=<local-test-url> npm test`: 15 passed,
0 failed, 0 skipped (1495 ms). `npm run check` passed and
`npm audit --offline --omit=dev` reported zero cached advisories, freshness unknown.
A local selected-pattern and high-entropy review covered 53 tracked/nonignored
untracked text files without printing values. It found no selected provider keys,
private keys, credential-bearing URLs or unclassified literal credential
assignments; five files matched known synthetic/test placeholders. This is not a
proof that secrets cannot be present in an unrecognized format. Ignored local data,
installed dependencies and Git internals were excluded; there was no commit history.

The independent checkpoint/OS identity, staging proxy, real Blob, live HTTPS and
production claims remain unverified. No external service, paid resource, deploy
or production credential was used in this iteration.

### Fresh-copy verification and Git baseline status

A fresh isolated local folder copy completed `npm ci --offline`; with the
previously authorized local test database, `npm test` reported 15 passed,
0 failed, 0 skipped, 1434 ms. `npm run check` passed and `npm audit --offline
--omit=dev` reported zero cached advisories; freshness remains unknown. This
was not a Git clone, lint/typecheck, production build or online audit.

The user requested a local-only Git baseline after review. A local review used
selected provider-key patterns, literal-assignment classification and an
entropy/credential-bearing-URL scan over tracked and nonignored untracked text
files without displaying values; it did not cover ignored files or guarantee
all secret formats. The reviewed file set was staged and `git diff --cached
--check` passed. The automatic approval review rejected `git commit` because it
considered separate user approval necessary. No commit or push occurred; a true
clean clone remains blocked. This report was updated after staging and therefore
has changes not included in the currently staged version.

## JSON error handling and user-selected EDIT scope — 2026-11-01

The user selected metadata-only EDIT as the working scope unless the authoritative
requirement conflicts. The supplied six-category rubric was recorded in
`RUBRIC-MAP.md`; no separate judge source or official score was verified.

A new isolated API assertion reproduced malformed JSON returning 500 instead of
400. After the fix, the targeted `node --test test/security.integration.test.js`
run with `TEST_DATABASE_URL` passed (1 test, 0 failed). It also verifies oversized
JSON returns a generic 413. The full local suite after the fix reported 15 passed,
0 failed, 0 skipped (1355 ms). `npm run check` passed; the offline production
dependency audit reported zero cached advisories, freshness unknown.

A fresh isolated folder copy, not a Git clone, completed `npm ci --offline` and
then the same full suite: 15 passed, 0 failed, 0 skipped (1183 ms). Syntax and the
offline cached audit also passed. No production build, current online audit,
staging, live HTTPS, private Blob or deployed attack test was run. This report was
updated after the copy; application/test code did not change afterward.

A local commit remains blocked by the earlier automatic approval rejection, which
required separate user approval. Some files remain staged, and subsequent changes
are unstaged; no commit or push exists. An independent checkpoint trust boundary,
Vercel proxy validation, complete UI/error/race coverage and a timed demo remain
open. No claim of 100/100 or production readiness is supported.

## Timed local core rehearsal — 2026-11-01

At commit `98ffd1a95d2ee06221866bffe9c80f6feb3d7ab4`, the authorized local
PostgreSQL suite was rerun: 15 passed, 0 failed, 0 skipped (1509 ms).
`npm run check` passed and `npm audit --offline --omit=dev` found zero cached
advisories (freshness unknown). No current online audit, lint/typecheck or
production build was run.

A synthetic local browser core-flow rehearsal took 129 seconds from sign-in-page
opening to administrator activity. See `DEMO-REHEARSAL.md` for observed steps and
limits. It used one browser session at a time and a separate synthetic owner API
session for revocation, not two browser sessions. The downloaded synthetic file
was compared to the fixture and removed. It was not a complete narrated or
deployed demonstration. No staging, Blob or live HTTPS test was performed.

The earlier notes about a rejected commit describe the state before the user
explicitly approved the local baseline; commit `98ffd1a` now exists and a local
Git clone of it passed the recorded tests. No push or staging deployment occurred.

## Local lint and current advisory check — 2026-11-01

`npm audit` and `npm audit --omit=dev` queried the npm advisory service and both
reported 0 vulnerabilities at the time of the check. An initially tried ESLint
dependency tree reported advisories and was removed. Biome 2.6.4 was added for
focused linting; `npm run lint` checked 29 files using the six rules in
`biome.json`, with no diagnostics. An isolated synthetic global-eval probe caused
lint to exit 1, then was removed. This does not establish comprehensive linting,
type safety or production security.

`TEST_DATABASE_URL=<local-test-url> npm test` returned 15 passed, 0 failed, 0
skipped (2248 ms); `npm run check` and `npm run lint` passed. A fresh isolated
folder copy completed `npm ci --offline`, then the same test/syntax/lint checks
(15 passed, 0 failed/skipped, 1310 ms). This was not a Git clone of a committed
version of these new changes. `DEMO-SCRIPT.md` is a proposed narration only: a
complete narrated demo has not been recorded. Typechecking and a Vercel production
build are deferred, not passed. No staging environment or real Blob store was used.
