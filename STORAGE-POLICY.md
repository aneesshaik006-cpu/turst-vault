# Staging storage and document handling policy

Status: staging only. Use synthetic, non-confidential files. The deployed Preview
explicitly allows unscanned demo uploads when no scanner is configured. Other
production-mode deployments require a scan. No scanning service is configured
or verified. Missing configuration outside the Preview bypass, scanner errors,
malformed responses and timeouts reject uploads.
In non-production mode only, an absent scanner is skipped for local fixtures;
when one is configured its failure still rejects the upload. PDF/PNG signatures
and checksums are not malware scans.

The scanning service contract is an HTTPS POST to `MALWARE_SCAN_URL`, with the
raw document bytes as `application/octet-stream` and a bearer credential in
`MALWARE_SCAN_TOKEN`. It must return HTTP 200 and JSON with status `clean` or
`infected` only after a complete scan; redirects and other outcomes fail closed.
Use an operator-controlled, authenticated service with appropriate document
privacy, scanning limits, current signatures and alerting. The app never
stores the file before the service says clean. Service availability, signature
updates, threat detection, data handling and the deployment connection must be
independently tested before admitting real users or untrusted files. Existing
documents are not retroactively scanned.

The local integration suite exercises clean, simulated infected and unavailable
responses from a disposable HTTPS mock, including a storage/database non-write
check for rejected uploads. The mock recognizes a test string and does not scan
for malware. These results do not verify a real scanner or its signatures.

Soft deletion hides documents but intentionally does not remove stored objects.
The app supports the private Neon bucket when `STORAGE_DRIVER=neon` and the
branch-scoped AWS credentials, HTTPS endpoint, region, and `NEON_STORAGE_BUCKET`
(default `assets`) are configured. Reads pass through the app's authorization
checks; no object URL is given to the browser. Switching drivers does not move
existing objects or database records. Migrate and verify both before cutover.
Failed writes can also leave orphans if cleanup fails. An authorized operator
can run `npm run storage:reconcile` with a read-only database credential,
`STORAGE_DRIVER=vercel-blob` and the designated Blob store credential, or
`STORAGE_DRIVER=neon` and the designated private Neon bucket credentials. The
command lists the entire store, compares every document key including deleted
records, and reports older unmatched objects, missing objects and unrecognized
pathnames. It never deletes objects. Its default age threshold is 24 hours;
`RECONCILE_GRACE_HOURS` may increase it. Exit status 2 signals discrepancies,
and another nonzero status signals an error. Output contains storage identifiers
and must be protected. The application and database can change during the two
listings, so findings are candidates, not proof. Investigate against fresh data,
including in-progress writes, before taking action. Do not automatically delete
objects without a tested grace period, a consistent database snapshot and
protected backups. No scheduled reconciliation or retention enforcement is
currently configured.

Before confidential or valuable data is admitted, an independently administered
encrypted backup of the database and objects must be configured, monitored and
tested for restoration. The application and database host must not control all
backup copies or checkpoint storage. Access, encryption keys, retention,
recovery objectives and incident ownership must be set by the service owner.
Provider or host administrators with sufficient privileges can otherwise alter
both documents and database checksums; application checks alone cannot provide
isolation from them. These controls have not been provisioned or verified.
