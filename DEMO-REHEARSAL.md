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

## Timed local core rehearsal — 2026-11-01

Elapsed time from opening the sign-in page to displaying administrator activity:
129 seconds, including browser-automation and file-chooser delays. This is an
observed core-flow rehearsal, not a timed narrated five-minute submission video.
The fixture used a temporary schema, local storage and synthetic accounts/file.

- Owner signed in and uploaded the synthetic PDF through the browser.
- Viewer signed in before a grant, saw no file and received `Not found` from the
  known download route.
- Owner granted READ using the UI; the viewer signed in again, saw the file
  marked READ with no edit control, and downloaded it.
- While the viewer stayed signed in, a separate synthetic owner API session
  revoked access. Direct navigation to the old route returned `Not found` and
  a refresh showed zero documents. The downloaded copy remained available and
  was removed after comparing it against the synthetic fixture.
- Administrator signed in, saw no ungranted document, and displayed activity
  including upload, grant, successful download, revoke and denied access.

Revocation used an API client, not a second owner browser. The rehearsal did not
exercise UI deletion, every search filter or error state, show the automated tests
and threat model during the timed window, or verify a deployed environment. No
claim is made that an already-authorized response or downloaded file is recalled.

### Additional local browser exercise, 2026-11-01

In a separate disposable local fixture, an owner used combined name, owner and
category filters; a nonexistent category produced the empty-result state. The
owner changed a synthetic PDF's category in the UI and saw confirmation. A
synthetic owner API session deleted that PDF (HTTP 204); after browser reload,
the owner's workspace showed zero files. A wrong password produced `Invalid
credentials`. The administrator's activity view displayed upload, READ grant,
metadata edit, deletion, and failed-login events. The fixture seeded the upload
and grant through its setup API; deletion was also performed through the API.
The temporary fixture was stopped and its synthetic state file removed.

These observations and the earlier core-flow rehearsal are separate exercises,
not one complete narrated end-to-end rehearsal. No screen or narration recording
was made. They do not establish live deployment behavior or that previously
received document bytes can be recalled after revocation.
