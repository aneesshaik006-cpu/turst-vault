# TrustVault

TrustVault is a document-sharing demo built with Express and PostgreSQL. Owners can upload PDF or PNG files, organize and search documents, and grant or revoke access. Viewers can open documents shared with them; administrators can review activity without gaining document access.

The [live demo](https://trustvault-stage-9d4d7e4f.vercel.app/) is intended for synthetic files only. Request the demo credentials privately. Its Preview deployment explicitly permits unscanned uploads, so it must not be used for sensitive documents or treated as production-ready.

## Features

- Email/password login with server-side sessions and role-based access.
- Owner-managed READ and EDIT grants, with access checked on each request. EDIT allows name and category changes; it does not replace file contents.
- PDF and PNG upload validation, search, metadata editing, deletion, and an administrator activity view.
- Hash-chained audit events, verification tools, and a restricted database role. Independent checkpoint storage and monitoring still need to be set up.

## Run locally

Requirements: Node.js 22, PostgreSQL, and OpenSSL for the scanner integration test.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL` and `APP_ORIGIN` for your local environment. Keep credentials out of version control.
3. Load the environment before running the migration and seed commands. For example:

   ```sh
   node --env-file=.env scripts/migrate.js
   # Set DEMO_PASSWORD to a unique local-only password before running the seed.
   node --env-file=.env scripts/seed.js
   node --env-file=.env src/server.js
   ```

4. Open the configured `APP_ORIGIN`. The seed creates `admin`, `owner`, `bob`, `viewer`, and `dave` accounts at `@trustvault.demo`; it does not replace passwords for existing accounts.

For a local PostgreSQL instance, see the `db:local` script and `.env.example`. The application does not automatically load `.env` when started with `npm start`.

## Checks

- `npm run build` runs syntax and focused Biome lint checks.
- `npm test` runs the test suite. Set `TEST_DATABASE_URL` to a disposable PostgreSQL database to include the integration tests; otherwise they are skipped. The role test requires a database account with `CREATEROLE`.
- `npm run audit:verify` verifies the audit chain using `DATABASE_URL`. A trusted, independently held checkpoint is needed to detect changes to previously recorded history.

The local database suite passed 24 tests without skips on 2026-11-07. A live synthetic API flow also verified upload, grant, download, edit, search, revocation and administrator access controls. These checks do not establish full deployment security.

## Deployment and security notes

The demo currently stores files in private Vercel Blob. A Neon storage driver is present in the working tree but has not completed live verification or cutover. The Preview has an explicit demo-only scanner bypass; a production deployment requires a configured scanner. Upload cleanup is best effort because storage and database writes are separate operations.

The audit chain is not immutable: privileged database access can rewrite it, and a checkpoint cannot protect events added after it. Independent checkpoint custody, monitoring, backups, trusted proxy identity, and several deployment checks remain open. The database-owner credential disclosed during setup also needs rotation and coordinated updates to dependent connections.

## Project notes

- [API reference](API.md) and [authorization matrix](ROUTE-AUTHORIZATION.md)
- [Threat model](THREATS.md) and [storage policy](STORAGE-POLICY.md)
- [Submission status](SUBMISSION-STATUS.md) and [outstanding work](BACKLOG.md)
- [Deployment notes](DEPLOYMENT.md) and [audit operations](CHECKPOINT-OPERATIONS.md)
- [Test report](FINAL-TEST-REPORT.md), [demo script](DEMO-SCRIPT.md), and [AI-assisted development history](PROMPTS.md)
