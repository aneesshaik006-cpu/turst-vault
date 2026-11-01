# Future clean-clone and demo verification

The repository has no commits or configured remote. A real clean-clone test
cannot be completed until the user approves a reviewed Git baseline and a
repository location. Do not commit or push as part of this procedure without
that explicit approval. Review all untracked files, ignored configuration,
credential-like assignments and Git history first; a pattern scan is not proof
of being secret-free.

After approval and an approved repository exists:

1. In a new directory, clone the approved repository and record its commit ID.
2. Install Node.js 22 and run `npm ci` from the clone. Use a dedicated disposable
   PostgreSQL server/database, with CREATEROLE permission for the temporary test
   roles. Configure `TEST_DATABASE_URL` securely; never target production.
3. Run `npm run check` and `npm test` with `TEST_DATABASE_URL` set. Confirm no
   security test is skipped. Run a current dependency audit when external access
   is approved; `npm audit --offline` alone uses potentially stale cached data.
4. For the demo, configure a separate local demo database, run `npm run migrate`
   twice, set an intentionally disposable `DEMO_PASSWORD`, run `npm run seed`,
   set `APP_ORIGIN` to the exact loopback origin and start with `npm start`.
   Existing seed users are not reset on rerun. Follow README environment notes.
5. Rehearse owner upload, denial, READ grant, viewer access, read-only edit denial,
   revocation without viewer logout, old URL denial, admin activity, and test and
   threat-model review with synthetic files. Record actual outcomes and cleanup.
6. Do not treat local checks as a deployment or production security verification.

A fresh local folder copy was used in earlier testing; it is not evidence of a
clone, a committed baseline, or the current online dependency state.
