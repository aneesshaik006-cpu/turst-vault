# Vercel staging preparation

Status (2026-11-05): a protected Vercel preview, private Blob store and free Neon
database have been provisioned. Synthetic viewer login and cookie attributes
were checked, and the runtime audit-role diagnostic passed. Storage privacy,
revocation, proxy behavior and independent audit checkpoints remain unverified.
Use synthetic data only. The app is not approved for confidential documents.

Preview: https://trustvault-stage-9d4d7e4f.vercel.app (Vercel authentication is
enabled, so it is not yet a public judge-facing URL). Demo credentials are in
the ignored local file `.local/staging-demo-credentials.txt`; do not commit it.
The first Vercel deployment was automatically assigned to the production slot
without the preview-only environment. The active staging URL points to a later
preview, not that first deployment. The current deployment was made from the
local working tree, including uncommitted changes.

The explicit Express framework setting points Vercel at the default export in
`src/server.js`; static files in
`public/` are served separately by Vercel. `vercel.json` applies no-store and
nosniff headers to responses, including static assets. Verify actual deployed
headers; Express middleware does not necessarily process CDN-served assets.

## Before deployment

1. Create or identify a separate staging project, a disposable managed PostgreSQL
   database, and a private Vercel Blob store. Do not reuse an unrelated project or
   production data. Review provider pricing before creating resources.
2. Run migrations as an independent schema owner. Create a restricted runtime
   database role and apply the reviewed grant template. Set the runtime role's
   schema search path and run `npm run audit:check-role` using its connection.
   See `CHECKPOINT-OPERATIONS.md` for limitations and independent checkpoints.

3. Configure environment variables in Vercel's project settings for the target
   environment: `DATABASE_URL` (restricted role; secret), `STORAGE_DRIVER` set to
   `vercel-blob`, `BLOB_READ_WRITE_TOKEN` (private store; secret), `NODE_ENV` set
   to `production`, and `APP_ORIGIN` set to the exact HTTPS URL used by clients.
   Never commit or paste credentials into chat. A preview URL can change on each
   deployment; use an appropriate stable staging hostname or update `APP_ORIGIN`
   and redeploy. Vercel deployment protection may affect judge access.
4. Provision a separate operator identity and checkpoint location outside the
   application and database trust boundaries. Do not claim audit immutability
   without verifying that separation.
5. Seed only synthetic demo users and files. The seed script intentionally
   refuses to run with `NODE_ENV=production`; run it as an authorized separate
   setup operation against the staging database with the necessary permissions
   and a disposable demo password. Do not weaken runtime restrictions to seed.

## Verification after deployment

Run `STAGING-TEST-PLAN.md` against the staging target, including direct Blob
access, access grants and revocation, HTTPS cookies, cross-origin requests, audit
roles and checkpoint protection, proxy behavior, and upload limits. Record the
deployment URL, exact build/commit, date, and results without storing secrets.
The current limiter keys on the direct socket peer and may group users behind a
proxy. No live system is verified until those checks pass.
