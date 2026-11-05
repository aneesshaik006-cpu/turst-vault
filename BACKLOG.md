# Outstanding security and deployment work

## Phase 4 — audit protection

- A non-owner runtime role is configured on the staging database and passed the
  effective audit-role diagnostic. Independently review inherited roles,
  SECURITY DEFINER functions and administrative escalation paths in staging.
- Provision independently administered, tamper-resistant checkpoint storage and
  an operator identity the application and database host cannot control.
- Schedule and monitor checkpoint verification and rotation; test recovery and
  alerting when verification or a scheduled run fails.
- Test audit rewriting, truncation, role restrictions and checkpoint replacement
  with the real deployment identities and preserve the results.
- Rejected origins, malformed or oversized JSON, throttled logins, and failed
  document downloads are audited. Finish reviewing other validation failures
  and failed upload/storage operations without recording secrets.
- Address audit-log abuse, storage capacity, retention and alerting. A compromised
  application can still append misleading events; checkpoints cannot establish
  truth or protect the uncheckpointed tail.

## Other carried-forward verification

- Run the expanded Phase 3 open-edit browser revocation procedure and repeat the
  revocation and authorization tests against the deployed storage environment.

## Phase 5 — deployment-dependent storage and session checks

- Verify private Blob access, direct object URLs, revocation and cleanup against
  the actual storage service; local filesystem tests cannot establish Blob privacy.
- Configure and test a trustworthy client identity at the deployment proxy;
  the current direct-peer limiter can group users behind a proxy.
- Verify Secure cookies over deployed HTTPS, session expiration and logout with
  the deployed environment and test upload limits end to end.
- Decide and document the malware-scanning policy, orphan-file reconciliation,
  backup protection and storage isolation against host administrators. Signature
  and checksum checks do not prove a document is safe or prevent an attacker who
  can change both the stored file and its database checksum.
