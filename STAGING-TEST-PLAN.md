# Staging verification plan — not executed

Requires the user's explicit approval for the specific staging deployment,
provider resources and any charges; a named non-production target and synthetic
accounts/files; separate test-only credentials; a managed PostgreSQL database;
a private Blob test store; and separate operator-controlled checkpoint storage.
Do not paste credentials in chat, commit them, or target production systems.

1. Have the database owner run migrations and review/apply the runtime grant
   template with a non-owner, non-superuser app role. Verify effective inherited
   and PUBLIC grants. As that role, attempt audit UPDATE, DELETE, TRUNCATE and
   ALTER against synthetic rows; all must fail. Verify app login, upload and audit
   append still work. Have a separate read-only operator capture and verify a
   checkpoint held somewhere the app and database OS identities cannot replace
   or delete. Follow `CHECKPOINT-OPERATIONS.md`; test recovery using a backup.
2. Configure a private Blob store and upload synthetic documents through the API.
   Confirm direct unauthenticated Blob access fails, authorized backend download
   works, denied access yields no bytes, and revocation blocks the old API route.
   Check server responses for no-store and no reusable public URLs. Test cleanup
   on a failed database insert and identify orphan cleanup limits.
3. Deploy a staging-only instance with a test hostname and valid HTTPS. Verify
   cookie Secure/HttpOnly/SameSite attributes, CSRF Origin checks and logout.
   Vercel's request-header documentation is at
   https://vercel.com/docs/headers/request-headers. The current app ignores all
   forwarding headers. Test socket-peer behavior and known synthetic client IPs
   through the actual staging topology, spoofed and malformed headers, multiple
   instances and shared-store failure. Do not enable forwarded-header trust until
   the proxy boundary and lack of direct bypass are verified.
4. Rehearse the complete demo: synthetic owner upload; unrelated user denied;
   owner grants READ; viewer succeeds but cannot edit; revoke while the viewer
   remains signed in; old route denied; admin sees successful and denied events;
   show tests, threat model and real AI-use history. Record what actually occurs.
5. On the explicitly authorized target only, execute the evaluator-like IDOR,
   privilege escalation, parameter tampering, upload, search, storage and audit
   attacks. Record exact requests without logging credentials or confidential
   data. Do not claim readiness if any critical check fails or is unverified.

Revocation cannot recall bytes already downloaded. In-flight responses may finish;
precisely record what was initiated before and after the revoke commit.
