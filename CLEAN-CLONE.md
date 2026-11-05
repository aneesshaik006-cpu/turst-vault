# Clean-clone verification

Use a disposable local environment; this procedure is not a production deployment
or a security certification. Never run the integration tests against a production
database. The test account needs permission to create temporary schemas and roles
(`CREATEROLE`). The audit-role test creates and removes temporary database roles.

1. Clone the repository into a new directory and record `git rev-parse HEAD`.
2. Install Node.js 22 and run `npm ci` in the clone.
3. Start a dedicated disposable PostgreSQL instance and set `TEST_DATABASE_URL`
   to its connection string. Use a separate disposable database for the demo,
   and set `DATABASE_URL` to that database's connection string.
4. Run `npm run check`, `npm run lint`, and `npm test`. Confirm the test output
   shows zero failures and zero skips. Tests without `TEST_DATABASE_URL` skip the
   database-backed checks and do not verify the full suite.
5. Run `npm run migrate` twice to check that migrations can be rerun. Set a
   unique disposable `DEMO_PASSWORD` of at least 12 bytes and run `npm run seed`.
   Existing users are not updated by reseeding. Set `APP_ORIGIN` to the exact
   loopback URL, for example `http://127.0.0.1:4173`, set `PORT=4173`, and run
   `npm start`. Open the URL to verify that the application responds.
6. For the functional demo, follow `DEMO-SCRIPT.md` using synthetic documents.
   A server response alone does not verify the full browser workflow.

The README describes the optional embedded local database. Keep credentials out
of commits and use disposable values. A current online dependency audit should
be run separately; offline installation uses cached packages and is not a
current vulnerability assessment.

## Verification on 2026-11-05

Commit `7d0d440bd86f9b1f42d70db238097c4222724232` was cloned locally into a
separate directory on macOS with Node.js 22. `npm ci --offline` succeeded using
the local cache. Against a temporary embedded PostgreSQL instance, migrations
ran twice, demo seeding succeeded, syntax and lint passed, and all 15 tests
passed with no skips. The server returned HTTP 200 on loopback. The temporary
database was stopped and removed afterward. This did not test production
deployment, the full browser demo, online installation, or a current online
dependency audit. GitHub's public API returned 200 for the repository, and an
unauthenticated remote query reported the same commit on `main`.
