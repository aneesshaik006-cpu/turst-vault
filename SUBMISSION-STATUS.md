# TrustVault submission status

This source package is a work-in-progress submission candidate, not a claim of
production readiness. Phase 3's local browser revocation scenario passed. The
staging preview passed the synthetic API revocation, private Blob URL, HTTPS
cookie, cross-origin rejection, upload-size and logout checks recorded in
`DEPLOYMENT.md`. The full local suite most recently passed 20 tests, including
the scanner-outage and audit-role integration tests, using a disposable database.
The scanner integration test uses an ephemeral self-signed HTTPS mock, not a
malware engine. It exercised a simulated clean file, simulated infected file and
scanner outage. A targeted integration run also verified that checkpoint health
returns failure for a stale checkpoint.

Phases 4 and 5 are not complete. Independent checkpoint custody, scheduling,
alerting, protected backups, the actual scanner service, the trusted proxy
boundary, session expiration and failed-upload Blob cleanup remain to be
provisioned or verified. A staging-only demo password was exposed and must be
rotated by a database owner before further use. Do not use confidential data.
An audited, narrowly scoped staging credential rotation command was tested on a
disposable local database; it has not yet been executed against staging.

The production-mode scanner integration in this source requires a configured
HTTPS service and fails closed without one. It has not been deployed to the
existing staging preview. `BACKLOG.md` contains the current outstanding work;
`CHECKPOINT-OPERATIONS.md` and `STORAGE-POLICY.md` document the operational
requirements and trust boundaries.
