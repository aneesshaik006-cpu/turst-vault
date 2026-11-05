# Local browser revocation scenario

Use only the isolated test database and synthetic fixture. This manual browser
procedure keeps the viewer's browser session open; it does not require or use a
production account. It does not test a deployed environment, a cached downloaded
file, or requests already in flight.

1. Set `TEST_DATABASE_URL` to the dedicated local test database and run
   `node scripts/browser-fixture.js` in one terminal. It listens on 127.0.0.1:4193.
2. In another terminal run `node scripts/browser-revocation-control.js setup
   /tmp/trustvault-revocation-state.json`. The script creates a synthetic PDF,
   grants EDIT to `browser-viewer@test.invalid`, and prints its download route.
   The temporary file holds a synthetic session cookie and is mode 0600.
3. In an isolated browser, open `http://127.0.0.1:4193/` and sign in as
   `browser-viewer@test.invalid` with `Local-test-password-2026`. Confirm the
   synthetic document and download link appear. Open its Edit form and leave it
   open with a new name entered. Keep the browser session open.
4. Run `node scripts/browser-revocation-control.js revoke
   /tmp/trustvault-revocation-state.json`. Confirm the command reports success.
5. Without logging out, submit the already-open edit form. It should report that
   the document is unavailable or access has been lost. Then click the previously
   displayed download link. It should return `Not found`. Go back and refresh the
   workspace; the row should vanish.
6. Close the browser and stop the fixture with Ctrl-C; it removes the temporary
   schema and storage. If setup or revocation failed, remove the temporary state
   file yourself. Do not delete or reset a database containing real user data.

An idle page may continue displaying already-loaded metadata until refresh.
Revocation cannot erase content that a recipient already downloaded.
Requests authorized before the revocation commits may finish afterward. Once
the revocation response is received, new requests must use the current grant.
