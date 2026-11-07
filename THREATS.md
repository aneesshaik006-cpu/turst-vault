# Threat model

TrustVault is a synthetic-data document-sharing demo. Its main assets are document contents and metadata, account sessions, permissions, and audit records. The browser is untrusted: every document operation must use the current server-side identity and grant. The application database role and file store are separate from the end user. A database owner, storage administrator, or compromised application has greater access than a normal user.

## Threats, controls and evidence

| Threat | Control and evidence | Remaining risk |
|---|---|---|
| An unrelated user guesses a document ID or searches for its name | The API checks ownership or the current grant. `test/security.integration.test.js` covers unrelated owners, viewers, administrators and search isolation. | Not every input and request interleaving is covered. |
| A revoked user reuses an old link or an open edit form | Permissions are checked on requests and repeated in the metadata update. Integration and browser revocation tests cover post-revocation denial. A deployed synthetic API flow also passed on 2026-11-07. | Already downloaded files and requests authorized before revocation cannot be recalled. |
| A viewer escalates privileges or an administrator reads files | Permission management is owner-only and admin access does not imply document access. Tests and the deployed synthetic flow check denial. | A compromised privileged database or app identity is outside these checks. |
| An attacker sends forged sessions, cross-origin requests or repeated logins | Random session tokens are stored as hashes; cookies use HttpOnly and SameSite, with Secure in production mode. Unsafe requests require the configured Origin. Database-backed throttling fails closed. | The limiter uses the direct socket peer; client identity behind Vercel and availability under abuse need validation. |
| A malicious or oversized upload reaches storage | Uploads have size, extension, MIME and signature checks; generated UUID keys prevent path selection. Integration tests cover invalid files and local cleanup after an insert failure. | Signatures are not malware detection. The public Preview deliberately allows unscanned uploads for the synthetic demo; no real scanner is provisioned. Blob cleanup on failure is unverified. |
| Stored content is altered | Downloads compare stored bytes against the database size and checksum, and use attachment responses. | An administrator able to alter both the object and its database checksum can defeat this check. |
| Audit records are changed or truncated | Mutations and success audit events share database transactions. Events are hash chained. `test/checkpoint.test.js` covers detection against a prior trusted checkpoint; local role tests deny updates, deletes and truncation. | A database owner can rewrite the chain; without an independently held checkpoint a rewrite or tail truncation can go undetected. A compromised app can append misleading events. |
| Runtime database privileges permit escalation | A restricted staging role passed `audit:review-role` on 2026-11-07. Its read-only inventory reported one reachable role and no executable non-system security-definer routines. | This diagnostic does not prove the absence of other escalation paths or independent checkpoint protection. |
| Secrets or configuration expose data | Secrets are excluded from the repository and staging uses a restricted runtime database role. | A database-owner password was exposed during setup and needs coordinated rotation. Independent encrypted backups and alerting are not verified. |
| Malicious input produces SQL injection or stored XSS | Queries use parameters and UI rendering uses text-based DOM operations. | Full injection and browser security coverage has not been established. |
| Abuse fills the audit log or object store | Audit capacity and storage reconciliation commands report thresholds and discrepancies. | Independent schedules, alerting, retention, and recovery procedures are not configured. |

## Verification scope

On 2026-11-07 the complete local suite passed 24 tests against a disposable PostgreSQL database with no skips. The live synthetic API flow verified owner upload, pre-grant denial, EDIT grant, download, metadata edit, search, revocation, post-revoke denial and administrator access control. The test document was soft-deleted; soft deletion intentionally retains the storage object.

A private Vercel Blob object was previously tested for unauthenticated denial, authenticated reading and deletion. The Neon storage driver has not completed a live round trip or cutover. These checks are evidence for the stated scenarios, not proof against every attack. Do not use confidential files in the demo.
