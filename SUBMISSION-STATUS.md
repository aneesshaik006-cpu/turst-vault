# TrustVault submission status

## Latest verification — 2026-11-07

The live Preview was updated after adding calendar-date and reversed-range
validation. Login and valid/invalid date filters passed on the new deployment.

The complete local suite passed 24 tests with no failures or skips against a
disposable database. On the live demo, synthetic owner, viewer and administrator
accounts exercised login, upload, pre-grant denial, EDIT grant, download,
metadata edit, search, revocation, post-revoke denial and administrator access
controls. The test document was soft-deleted and the sessions were logged out.
The staging runtime-role diagnostic reported safe; its read-only inventory found
one reachable role and no executable non-system security-definer routines. This
does not replace independent review of escalation paths and checkpoint custody.

## Synthetic demo preview — 2026-11-07

The `trustvault-stage-9d4d7e4f.vercel.app` alias points to the new
Preview deployment. With its restricted database credential, the synthetic
owner login returned HTTP 200 and a synthetic PDF upload returned HTTP 201.
The Preview explicitly permits unscanned uploads when no scanner is configured;
production deployments still require a scanner. Use synthetic data only.
The Preview currently uses Vercel Blob, not Neon Object Storage. Vercel
Authentication was disabled at the user's request; the URL is publicly reachable
and the application still requires its own sign-in.

## Demo account update — 2026-11-07

The confirmed Neon database contained no users or documents. Five synthetic
demo accounts were seeded with a newly generated staging-only password, stored
in the ignored, private `.local/staging-demo-credentials.txt` file. Password
hash verification succeeded for all five accounts using the restricted runtime
database role. The later deployed workflow above also verified login. A database-owner password was exposed in
conversation and must be rotated, with dependent connections updated securely.
The Neon storage cutover, deployed scanner, and remaining staging checks are
not complete. Use synthetic data only.

This source package is a work-in-progress submission candidate, not a claim of
production readiness. Phase 3's local browser revocation scenario passed. The
staging preview passed the synthetic API revocation, private Blob URL, HTTPS
cookie, cross-origin rejection, upload-size and logout checks recorded in
`DEPLOYMENT.md`. On 2026-11-06 the full local suite passed 21 tests with no
failures or skips using a disposable database; syntax and lint checks also passed.
The suite includes scanner-outage and audit-role integration tests, server-side
session expiry, and audit-capacity threshold checks.
The scanner integration test uses an ephemeral self-signed HTTPS mock, not a
malware engine. It exercised a simulated clean file, simulated infected file and
scanner outage. A targeted integration run also verified that checkpoint health
returns failure for a stale checkpoint.

Phases 4 and 5 are not complete. Independent checkpoint custody, scheduling,
alerting, protected backups, the actual scanner service, the trusted proxy
boundary, deployed session expiration and failed-upload Blob cleanup remain to be
provisioned or verified. The previously exposed staging demo password was not
reused for the newly seeded accounts. The audited rotation command stopped safely
when the five expected accounts were absent; the accounts were subsequently
seeded as described above. Do not use confidential data.

The scanner integration requires a configured HTTPS service except for the
explicit synthetic Preview bypass above. `BACKLOG.md` contains outstanding work;
`CHECKPOINT-OPERATIONS.md` and `STORAGE-POLICY.md` document the operational
requirements and trust boundaries.
