# Outstanding security and deployment work

## Phase 4 — audit protection

- A non-owner runtime role is configured on the staging database and passed the
  effective audit-role diagnostic. Independently review inherited roles,
  SECURITY DEFINER functions and administrative escalation paths in staging.
- Provision independently administered, tamper-resistant checkpoint storage and
  an operator identity the application and database host cannot control.
- Schedule and monitor checkpoint verification and rotation; test recovery and
  alerting when verification or a scheduled run fails. `npm run audit:health`
  checks a required checkpoint and its age but still needs an independent
  scheduler, heartbeat monitor and alert destination.
- Test audit rewriting, truncation, role restrictions and checkpoint replacement
  with the real deployment identities and preserve the results.
- Rejected origins, malformed or oversized JSON, throttled logins, invalid search
  dates, permission recipients and document details, and failed document
  downloads and upload/storage operations are audited with fixed reason codes.
  Continue reviewing coverage and monitor failures of the audit system itself.
- Address audit-log abuse, storage capacity, retention and alerting. A compromised
  application can still append misleading events; checkpoints cannot establish
  truth or protect the uncheckpointed tail.

## Phase 3 verification completed

- On 2026-11-06 the expanded local browser test kept a viewer signed in with an
  edit form open across revocation. Saving reported lost access, the stored name
  remained unchanged, the old download link returned Not found, and a refresh
  showed zero files. An earlier synthetic staging API test passed upload,
  ungranted download denial, EDIT grant and download, and post-revocation
  download and edit denial. Direct Blob URL privacy remains a Phase 5 task.

## Phase 5 — deployment-dependent storage and session checks

- Test failed-upload cleanup against the actual Blob and database environment;
  the 2026-11-06 direct Blob privacy, authenticated read and explicit deletion
  checks passed for a synthetic object, and staging API revocation passed.
- Configure and test a trustworthy client identity at the deployment proxy;
  the current direct-peer limiter can group users behind a proxy.
- Verify session expiration against the deployed environment. On 2026-11-06,
  deployed Secure/HttpOnly/SameSite cookie flags, logout invalidation,
  cross-origin denial and an oversized upload rejection passed.
- Provision and verify the scanning service and the safeguards described in
  `STORAGE-POLICY.md`, including reconciliation and protected backups. Local
  production-mode code fails closed until a scanner is configured, but this code
  is not deployed and no scanner has been provisioned. A read-only reconciliation
  command and local comparison test exist; it has not been run against the staging
  database or scheduled. Signature and checksum checks do not prove a file safe.
