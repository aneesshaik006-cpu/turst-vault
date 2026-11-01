# TrustVault — work in progress

This repository is not ready for storing sensitive documents or for deployment.
The current implementation consists of authentication primitives, initial
PostgreSQL schema and migration runner, authentication endpoints, a basic document
workspace and local PDF/PNG upload and download. Basic permission management, search, editing and deletion endpoints have been added.
Independent audit protection, complete security hardening and production deployment remain incomplete.
No end-to-end security claim is
made. See [REPOSITORY-AUDIT.md](REPOSITORY-AUDIT.md) and [THREATS.md](THREATS.md).

## Development prerequisites

Node.js 22 and a PostgreSQL database are required. Install with `npm ci`. Set
`DATABASE_URL` to a dedicated PostgreSQL database connection string and
`APP_ORIGIN` to the exact browser origin, e.g. `http://localhost:3000`.
Run `npm run migrate`, set a unique demo-only `DEMO_PASSWORD` of at least 12
bytes, and run `npm run seed`. Start the server with `npm start`. The server
binds only to loopback. Migrations have been applied to a local development database.

The seed creates admin, owner, bob, viewer and dave accounts at
`@trustvault.demo`; it is disabled in production. Existing accounts are not
updated by reseeding. Never use a demo password for real data.

Unsafe requests require an exact `Origin` match. Sessions use random bearer
cookies, with only their hash stored in PostgreSQL. Cookies are HTTP-only,
SameSite Strict, and Secure when `NODE_ENV=production`. Document listing, upload, download, grant, revoke, edit and deletion endpoints are available, with a 100-document listing limit.

Audit events are hash chained, but database privilege separation and external
checkpoints are not yet configured. A database owner can alter or rewrite the
chain, so it is not immutable. Audit and authentication have limited local integration coverage. Do not treat them as production-ready.

## Local demo database

For a local-only preview on supported systems, `npm run db:local` starts the
bundled development PostgreSQL on 127.0.0.1:55432 and stores data in the ignored
`.local/postgres` directory. Set `LOCAL_DB_PASSWORD` to a unique local-only value of at least 16 bytes before
starting it. This setting does not change the password of an already initialized
cluster: use its existing password or migrate it deliberately. Do not expose the
database or use it for sensitive data.
With the local database running, set `DATABASE_URL` to its connection string,
containing the local username, URL-encoded password and `127.0.0.1:55432/postgres`.
Run `npm run migrate`, set a unique demo-only `DEMO_PASSWORD`, and run `npm run
seed`. Run the app with `PORT=4173 APP_ORIGIN=http://127.0.0.1:4173 npm start`
and the same `DATABASE_URL`. The seeded owner is `owner@trustvault.demo` with
the password you supplied in `DEMO_PASSWORD`. Seed does not reset existing passwords. The basic workspace is available, but document management and security verification remain incomplete.

## Vercel preparation (not yet deployment-ready)

The Express application exports its app for Vercel and supports a private Vercel
Blob store when `STORAGE_DRIVER=vercel-blob` and `BLOB_READ_WRITE_TOKEN` are set.
Production startup fails if private Blob storage is not configured. Connect a
managed PostgreSQL database using `DATABASE_URL`, set `APP_ORIGIN` to the exact
HTTPS origin, and run migrations using appropriately separated database roles.
Vercel Functions limit request and response sizes, so uploads are capped at 4 MiB.
The private Blob integration, production environment, proxy address handling, audit role permissions, and deployed security behavior have not been
verified. Do not deploy this build for confidential documents.

## Audit-chain verification

Set `DATABASE_URL` to the intended database and run `npm run audit:verify`.
The command validates links and event hashes and prints the observed event count
and head hash. It only supports the application's current flat metadata values;
unsupported metadata makes verification fail. To detect truncation against a
previously saved checkpoint, supply both `AUDIT_CHECKPOINT_COUNT` and
`AUDIT_CHECKPOINT_HASH`. Save checkpoints in an independently protected location.
Without a trusted checkpoint, a truncated tail or fully rewritten chain can
verify. The database role can currently modify audit history, so the chain is not
immutable. Do not run verification on a confidential or production database
without appropriate authorization.

## Operator-held checkpoints

The database application role does not itself control an external file, but the
file is only independently protected if an operator uses a **separate OS/service
identity and storage** that neither the application process nor the database
server can modify. These identities and access policies are not provisioned by
this project. A database administrator or host administrator may still bypass
controls within their own trust boundary.

After independently validating the initial audit history, an authorized operator
with read-only audit database credentials can create the first checkpoint with
`npm run audit:checkpoint -- --initial /operator-controlled/new-checkpoint.json`. The file
is created exclusively; an existing checkpoint is never overwritten. Protect and
back it up independently. For each later checkpoint, set
`PREVIOUS_AUDIT_CHECKPOINT` to the last trusted file and write to a *new* path;
the command verifies that prefix first. Verify with
`AUDIT_CHECKPOINT_FILE=/operator-controlled/checkpoint.json npm run audit:verify`.
Keep the latest trusted checkpoint and earlier backups in a separate access domain.
If verification fails, stop, preserve database and checkpoint evidence, and
investigate; do not replace the checkpoint with a newly observed head. If a
checkpoint is lost, restore a trusted backup or treat the history since the last
trusted checkpoint as unverified. A compromised application may still append
false events, and truncation after the latest checkpoint remains undetectable.

## Shared login throttle

Migration `002_login_throttle.sql` stores fixed-window counters in PostgreSQL.
All instances sharing that database enforce 20 sign-in attempts per direct socket
peer in 15 minutes. If PostgreSQL is unavailable, login returns 503. Forwarded
headers are deliberately not trusted: behind a proxy, users can share a limit and
cause availability problems. Configure and test a platform-specific trusted-client
identity before deploying. An operator must also arrange cleanup of old counter
rows. `test/throttle.integration.test.js` checks two local instances and failure.

## Local verification

`npm run check` checks JavaScript syntax; it is not a linter or type checker. Set
`TEST_DATABASE_URL` to a dedicated disposable PostgreSQL database, then run
`npm test`. Integration tests create and remove temporary schemas; omitting the
variable skips them. The project has no configured production build, lint or
typecheck script. The local setup above is a demo procedure, not a verified
production deployment procedure.

The explicit staging setup and evidence needed to establish checkpoint and
database-role separation are in `CHECKPOINT-OPERATIONS.md`. The application has
not provisioned or verified these identities.

Vercel documents its forwarding headers at
https://vercel.com/docs/headers/request-headers. The local implementation ignores
all forwarding headers and uses the direct socket peer; this avoids trusting
spoofed headers but has not established client-level limiting behind Vercel. An
authorized staging test must verify actual proxy behavior, trusted-address
configuration, bypass attempts and shared counters before deployment readiness.

## Meaning of EDIT

Currently EDIT permits reading/downloading a document and changing its name and
category through the metadata API. It does **not** permit file-content replacement,
deletion, or permission management. The user selected metadata-only as the working scope unless an authoritative
requirement says otherwise; file-content editing is not implied or implemented.

`ops/grant-runtime-privileges.sql` is an operator-reviewed psql grant template.
It must be run by an independent migration owner with the `schema_name` and
`app_role` variables set. The runtime role must already exist and must not own
objects, be a superuser, or inherit privileged roles. The script is not applied
automatically and does not provision checkpoint identities or production roles.

See `ROUTE-AUTHORIZATION.md` for the current route/role matrix, `API.md` for the
API reference, `STAGING-TEST-PLAN.md` for the not-yet-authorized service checks,
and `CLEAN-CLONE.md` for the future approved-clone procedure.

The role integration test creates and removes unique temporary PostgreSQL roles;
the dedicated test database account needs CREATEROLE privilege. Never use a
production account or database for this test. `npm test` without a configured
`TEST_DATABASE_URL` skips the database integration tests.

Storage keys must be generated lowercase UUIDv4 identifiers; local storage tests
exercise invalid keys, duplicate creation and removal. This is defense in depth,
not a substitute for protecting the database or storage backend. A file write and
its database transaction are separate resources: failure cleanup is best effort
and orphan reconciliation is not implemented.
