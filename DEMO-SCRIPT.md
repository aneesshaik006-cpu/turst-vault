# Proposed narrated demo — synthetic data

This is a script to rehearse and record; it is **not** a recording or proof that
every browser step was rehearsed. Use the live demo or the isolated fixture
described in BROWSER-REVOCATION-TEST.md, synthetic accounts and a synthetic PDF only. Keep a
second isolated browser session for the viewer. Do not use confidential files or
show credentials. Check each step in the actual environment before recording.

| Time | Screen/action | Suggested narration |
|---|---|---|
| 0:00–0:25 | Sign-in / workspace | “TrustVault shares documents with named people. The backend checks each request against current ownership and grants.” |
| 0:25–0:55 | Owner uploads a synthetic PDF | “The server assigns ownership, validates the upload and stores it privately.” |
| 0:55–1:20 | Viewer searches and opens a copied download route before a grant | “The viewer cannot discover or download this document before access is granted.” |
| 1:20–1:50 | Owner grants READ; viewer refreshes and downloads | “READ allows the named viewer to access the document. It does not allow editing.” |
| 1:50–2:15 | Try viewer edit; then show owner metadata edit and category filter | “EDIT currently covers name and category, not replacing file bytes. The server is authoritative.” |
| 2:15–2:45 | Revoke while viewer stays signed in; retry old URL and refresh | “A later request checks the current grant and is denied. An idle page can show old metadata until refreshed.” |
| 2:45–3:10 | Owner soft-deletes a separate synthetic file and searches | “Deleting blocks future access while the audit record is retained.” |
| 3:10–3:40 | Admin opens activity; show denied and permission events | “Administrators can inspect activity but do not automatically receive document contents.” |
| 3:40–4:15 | Show one representative validation/error state | “The application rejects invalid uploads; current coverage and failure cases are documented.” |
| 4:15–4:40 | Run local tests and show `THREATS.md` | “The integration tests check isolation and revocation; the threat model records residual risks.” |
| 4:40–5:00 | Show audit checkpoint documentation and limitations | “An independently controlled checkpoint and restricted roles are required; they are not provisioned here. Files already downloaded cannot be recalled.” |

If any step fails or is unsupported, pause and fix or mark it incomplete instead
of presenting it as working. A real staged deployment and its security behavior
must be verified separately. The live Preview accepts unscanned synthetic uploads;
it is not suitable for confidential files.
