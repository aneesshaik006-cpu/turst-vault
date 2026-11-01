# Evaluation rubric and evidence

The six criteria below are the rubric supplied by the user. No additional scoring
weights are assumed. Current evidence is local and incomplete; this is not a
judge's score.

| Criterion | Required evidence | Current artifact | Gap |
|---|---|---|---|
| Security (35) | Judge attack attempts against deployed application | `test/security.integration.test.js`, `test/throttle.integration.test.js` | No deployment or live authorized attacks; all-route, concurrency and Blob tests incomplete. |
| Threat thinking (15) | Threat model compared to tests | `THREATS.md`, audit verifier tests | Incomplete matrix; protected checkpoint/role not provisioned. |
| Functionality (15) | Ten original requirements work | Local API scenario, workspace, admin panel | Full browser workflow and requirement-by-requirement verification incomplete. |
| Use of AI (15) | Genuine evidence of direction and caught errors | `PROMPTS.md` | No invented independent human review; historical entries incomplete. |
| Engineering quality (10) | Readable and sensible implementation | `src/`, migrations, syntax and database tests | No configured lint/type checks; route/race coverage and production controls incomplete. |
| Documentation, deployment, demo (10) | Reproducible setup, live deployment and demonstration | `README.md`, `FINAL-TEST-REPORT.md` | No committed clean clone, deployed system, live HTTPS checks or complete demo. |

The original ten requirements are: (1) authentication/roles, (2) document upload,
organization, search and management, (3) named READ/EDIT grants, (4) owner grant
and revoke, (5) unauthorized operations denied, (6) audit of document and grant
changes, (7) search filters, (8) upload validation, (9) admin activity, and
(10) automated isolation tests. Relevant server routes are in `src/server.js`;
the local HTTP scenario exercises portions of each but does not prove the complete
user workflow or live deployment.

## 2026-11-01 follow-up status

- Security: spoofed/malformed forwarding headers and two-instance throttling
  tested locally; a manual open-viewer-session revocation procedure is recorded
  in `BROWSER-REVOCATION-TEST.md`. An externally protected checkpoint, restricted
  database role, real private Blob isolation and deployed attacks remain unproved.
- Threat thinking: `CHECKPOINT-OPERATIONS.md` describes the exact independent
  identities, permissions, staging attempts and recovery evidence needed; local
  checkpoint create/rotate/restore and tamper tests do not prove OS or database
  identity separation.
- Functionality: local revocation browser scenario passed; complete five-minute
  demo, browser download, and all error/UI scenarios remain incomplete.
- AI use: `PROMPTS.md` contains the real documented interactions only; no human
  review or judge validation is represented as having occurred.
- Engineering: local syntax, full test suite, offline audit and isolated-copy
  install/test checks are available; no lint/type/build pipeline is configured.
- Deployment/demo: no deployment, live HTTPS, external Blob test, Git commit or
  committed clean-clone test was performed. User approval and an authorized
  staging setup are needed before live checks.

## Local role and metadata follow-up

- Security: the optional runtime grant template was exercised under temporary
  PostgreSQL roles; audit UPDATE/DELETE/TRUNCATE/ALTER were denied while the API
  could log in and upload. Operator checkpoint filesystem identity remains
  unproven, and the template is not applied to production.
- Functionality: owner/READ/EDIT/revoked metadata controls were exercised with a
  synthetic local browser fixture. EDIT currently means name/category only;
  file-content replacement is an unresolved product requirement, not a feature.
- Documentation/deployment: `STAGING-TEST-PLAN.md` and `CLEAN-CLONE.md` provide
  procedures, not evidence that staging, production or a clone were completed.

## Current local follow-up

| Rubric criterion | Status | Evidence and outstanding work |
|---|---|---|
| Security (35) | Blocked for deployed criterion | Local 14-test suite includes storage-key and upload audit-failure checks. Operator filesystem separation, real Blob, production proxy and deployed judge attacks require authorization and a staging environment. |
| Threat thinking (15) | Partially verified | `THREATS.md` maps several threats to tests; incomplete attack/race and operational-boundary coverage remains. |
| Functionality (15) | Partially verified | Core local API scenarios and earlier synthetic browser tests exist. Full workflow, all error states and file-content EDIT requirement remain unresolved. |
| Use of AI (15) | Partially verified | `PROMPTS.md` records actual requests/findings/checks; no independent human review or judge assessment claimed. |
| Engineering quality (10) | Partially verified | Local tests, SQL roles, syntax check and repeatable migration; no configured lint, typecheck or production build. |
| Documentation/deployment/demo (10) | Blocked for deployed criterion | Runbooks exist, but no approved commit/true clone, staging, HTTPS verification or complete demo rehearsal. |

## Latest local completion attempt

| Criterion | Status | Latest evidence and gap |
|---|---|---|
| Security — 35 | Blocked for deployed evaluation | Local route and upload-denial checks expanded; no authorized deployment, real Blob or separate operator boundary. |
| Threat thinking — 15 | Partially verified | `THREATS.md` maps upload denial changes and remaining untested attacks; no judge comparison. |
| Functionality — 15 | Partially verified | `DEMO-REHEARSAL.md` records an untimed synthetic local scenario; not every UI and error path was rehearsed. |
| AI use — 15 | Partially verified | `PROMPTS.md` records real requests, issues, changes and tests; no independent human review claimed. |
| Engineering quality — 10 | Partially verified | Local suite, migrations and syntax check; lint/typecheck/build remain unconfigured. |
| Documentation/deployment/demo — 10 | Blocked for deployed evaluation | Local rehearsal and runbooks exist; no approved commit, true clone, staging, HTTPS or live judge test. |

### Local credential follow-up

The local embedded database launcher now requires a separately configured
password and refuses production mode. Its negative configuration test and the
full 15-test local suite passed. Secret-pattern review is limited and does not
prove production credentials or ignored local data are safe. This improves local
engineering evidence but does not establish the deployed security criterion.

### Latest baseline and evidence

A local credential configuration change passed a 15-test suite. A reviewed file
set was staged, but automatic approval rejected the requested local commit; no
commit, true clean clone, deployment, staging or independent human review exists.
No criterion requiring deployed judge testing is verified locally.

## User-supplied rubric wording

| Marks | What is checked |
|---:|---|
| 35 | Security: what a judge can get at on the deployed system, using the same attempts for everyone. |
| 15 | Threat thinking: `THREATS.md` against the judges' model and whether tests actually test it. |
| 15 | Functionality: the ten problem-statement requirements working. |
| 15 | Use of AI: `PROMPTS.md` evidence that the user directed the tool and caught it being wrong. |
| 10 | Engineering quality: readable, sensibly built, with errors handled. |
| 10 | Documentation, deployment and demo. |

This is the rubric supplied in the conversation; no separate authenticated
judge source has been verified. The user's selected default for EDIT is metadata
only, unless an authoritative requirement says otherwise. The UI and API support
name/category edits; file-content replacement remains unsupported.

### Local baseline and timed core rehearsal

Local commit `98ffd1a` exists and a true local Git clone completed offline install
and the local suite. A subsequent 129-second synthetic browser core-flow rehearsal
reached admin activity, but was not a complete narrated demo and did not validate a
deployed service. Earlier notes stating that no commit exists are historical.
