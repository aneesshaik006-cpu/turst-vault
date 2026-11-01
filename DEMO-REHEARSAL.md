# Synthetic local demo rehearsal — 2026-11-01

This rehearsal used `scripts/browser-fixture.js` with the authorized local test
database, temporary schema/storage, and synthetic owner, viewer, administrator
and PDF. It was not timed, was not run against Vercel, and is not a production
or complete five-minute demonstration.

Observed in the local browser:

1. Owner signed in, saw an empty workspace, and uploaded a synthetic PDF.
2. Viewer signed in before any grant, saw zero files, and direct navigation to
   the known download route displayed `Not found`.
3. Owner signed in and granted the named viewer READ via the permissions UI.
4. Viewer signed in, saw the document marked READ, searched by name, and
   downloaded the synthetic file. The viewer UI showed no edit control.
5. While the viewer remained signed in, a separate synthetic owner API session
   revoked access. The row remained visible in the idle page. Direct navigation
   to the previous download URL displayed `Not found`; after refreshing the
   workspace, the viewer saw zero files. The already-downloaded synthetic copy
   was still present, as expected, and was removed after comparing it to the
   fixture. An already-authorized in-flight request was not tested here.
6. Administrator signed in, saw no ungranted document, opened Security activity,
   and saw upload, grant, successful download, revoke and access-denied events.

The owner revocation in this rehearsal was performed by a separate API client,
not a second browser window. EDIT, UI deletion, all search filters, loading and
service-error states, and a complete timed demonstration were not rehearsed here.
The test process and synthetic schema/storage were stopped and cleaned up.
