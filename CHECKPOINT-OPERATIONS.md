# Audit checkpoint trust boundary and staging verification

The application does not provision operator identities, database roles or a
write-protected checkpoint store. The current local PostgreSQL account is a demo
administrator; local tests do not establish production privilege separation.

For an authorized staging environment, the operator must arrange:

1. A non-superuser application database role that does not own the audit table,
   does not inherit its owner role or server-file roles, and has only the audit
   SELECT/INSERT and sequence privileges needed. An independent migration owner
   controls table ownership and grants. Confirm effective privileges, including
   inherited roles; a REVOKE alone does not constrain an owner or superuser.
2. A separate operator identity with read-only audit database access and an
   external, access-controlled checkpoint location. Neither the application OS
   identity nor the database server OS identity should be able to replace or
   delete checkpoint files or their containing directory. Use versioned/WORM or
   otherwise separately administered storage where appropriate; mode 0600 alone
   does not prevent a file owner from changing permissions or deleting a file.
3. Independently verify and approve the initial history before recording the
   first checkpoint. A checkpoint captures the chain as it exists at that moment;
   it cannot prove that initial history was truthful.
4. Run `npm run audit:checkpoint -- --initial <new-operator-controlled-file>`. The command
   uses `DATABASE_URL`; supply the operator's read-only credential securely via
   the environment, never in a committed file or public command history. Keep an
   independent backup. Subsequent checkpoints must use a new filename and set
   `PREVIOUS_AUDIT_CHECKPOINT` to the last trusted file so the old prefix is
   verified before accepting a new one. Schedule independent verification and
   checkpoint rotation at least daily and after a security incident; monitor
   missed runs. This is an operational target, not an implemented scheduler.
   The interval is the exposure window for uncheckpointed tail truncation.
   An independently operated scheduler can run `npm run audit:health` with
   `AUDIT_CHECKPOINT_FILE` set to the latest trusted checkpoint and `DATABASE_URL`
   set to read-only audit credentials. The command requires a matching checkpoint,
   checks the complete chain and fails if its file is older than 48 hours (or
   `AUDIT_CHECKPOINT_MAX_AGE_HOURS`). Configure the external monitor to alert on
   nonzero exit, missing runs, and a missing or stale heartbeat; the command does
   not send alerts or schedule itself. File modification time is meaningful only
   if the file and its metadata are independently protected and clocks are sound.
   Local tests cover fresh, stale and future modification times, successful
   verification with a trusted checkpoint, and rejection of a mismatched one;
   an integration test also confirms the health command exits unsuccessfully
   for a stale checkpoint. These do not establish staging operator isolation or
   alert delivery.
5. In a disposable staging environment only, attempt audit UPDATE/DELETE/TRUNCATE
   as the app database role and attempt checkpoint file replacement/deletion as
   both the app and database server identities. Require denial in each case;
   also verify the operator can rotate and recover from a separately protected
   backup, and that tampering with database events or truncating below the saved
   checkpoint causes verification failure. Preserve the evidence without exposing
   real credentials or documents.
6. On a verification failure, stop, preserve the database and checkpoints, and
   investigate. Never overwrite the trusted checkpoint to make verification pass.
   Recovery from a lost latest checkpoint depends on a trustworthy backup; without
   it, events beyond the last available checkpoint must be treated as unverified.

A compromised app can still append misleading events; a database owner can rewrite
the chain, but an independently held previous checkpoint detects changes to its
recorded prefix. Changes after the latest checkpoint, a compromised initial
baseline, and collusion across the operator boundary are not ruled out.

## Local role test and grant template

`ops/grant-runtime-privileges.sql` provides an optional grant template for a
schema and an already-created runtime role. An authorized database owner can run
it using `psql -v ON_ERROR_STOP=1 -v schema_name=<schema> -v app_role=<role> -f
ops/grant-runtime-privileges.sql`; provide the connection securely. The operator
must verify that the runtime role is not a table/schema owner or superuser, does
not inherit a privileged role, and has no access through PUBLIC grants. The grant
template is not a substitute for reviewing effective privileges and is not
applied automatically.

The local integration test creates unique temporary NOLOGIN test roles and a
schema, applies the same grant template, and removes the roles and schema. It
requires CREATEROLE on a dedicated disposable PostgreSQL instance. It verified
that the runtime role could read/append audit events but could not UPDATE, DELETE,
TRUNCATE or ALTER the audit table or alter/delete users; a separate read-only
test role could read but not append. A local API process assuming the runtime
role successfully logged in and uploaded a synthetic document. This establishes
only those privileges under the test configuration, not production privileges,
operator identity separation, or checkpoint filesystem protection.

## Check the effective runtime role

With `DATABASE_URL` set securely to the actual application role and its intended
schema first in the search path, run `npm run audit:check-role`. A safe result
returns `safe: true` and exit status 0; unsafe privileges or a missing table
return a nonzero status. The command checks effective table grants, membership in
the table and schema owner roles, schema CREATE, superuser and CREATEROLE. Local
tests confirm that a restricted role passes and an owner or a role granted UPDATE
fails.

This check is a useful diagnostic, not proof of the trust boundary. It does not
inspect other reachable databases, other role escalation mechanisms, SECURITY
DEFINER functions, extension privileges, the host, backups, or whether an
independent checkpoint is protected. An operator must review those paths and
run the staging tests above; do not interpret `safe: true` alone as deployment
approval.
