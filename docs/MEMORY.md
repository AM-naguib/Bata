# Attendify — project memory / verified audit findings

Date: 2026-10-19. Source: user-provided attendify.zip (Node.js HTTP server and browser UI). This repo was initially empty and public.

**User requirements:** ZIP is the correct Bata project; application must support entry of real students; document bugs/tasks/decisions; upload incrementally; ask before changing unclear requirements.

**Privacy invariant:** Original students.json contains 172 real student name/ID pairs. Keep the file and any other real student data OUT of public git, PR diffs, tickets, examples and CI artifacts. `students.example.json` is illustrative only. Deployment must securely provision an actual roster separately. `.gitignore` prevents accidental new additions, but does NOT protect previously committed files.

### Findings — none fixed yet
- F-01 Critical: server.js:3 falls back to professor password 1234.
- F-02 High: server.js:38-41 has no rate limiting on professor login.
- F-03 Critical publication risk: real students.json contains identifying records.
- F-04 High: server.js:42-52 accepts studentId without independent student authentication; deviceId comes from browser.
- F-05 High: server.js:53-58 trusts client-submitted coordinates and device ID; browser geolocation can be falsified.
- F-06 High: server.js:53-55 accepts missing, zero or negative accuracy; confirmed by API tests.
- F-07 High: doctor.html:58-63 inserts lecture titles and student names into innerHTML (stored XSS sink); browser execution not tested.
- F-08 High: server.js:9 silently swallows broken data.json and first write can destroy existing data; confirmed by isolated test.
- F-09 High policy issue: server.js:24-29 counts an open lecture as an absence immediately.
- F-10 High: server.js:67-70 changes lecture open/closed state even on GET, confirmed.
- F-11 High: client-side-only logout leaves authenticated session valid on server; cookie lacks Secure.
- F-12 Medium: server.js:42-44 limits attendees by shared IP and stores rate-limit keys indefinitely.
- F-13 Medium: server.js:64-65 accepts invalid latitude/longitude ranges, confirmed.
- F-14 Medium: server.js:14-15 malformed Unicode signature can trigger 500, confirmed.
- F-15 Medium: device cannot represent two people ONLY within same lecture, despite more general README claim.
- F-16 Medium: server.js:68 breaks if a recorded student disappears from students.json.
- F-17 Medium: CSV cells may be interpreted as formulas by spreadsheet programs.
- F-18 Medium: synchronous full-file JSON persistence isn't appropriate for multiple app instances.
- F-19 Medium: no tests or CI.
- F-20 Medium: CDN scripts lack SRI/CSP controls.
- F-21 Low: camera scanning and admin errors are not well handled.

### Verified test scope
Isolated Node v22 tests on synthetic users showed: default password login success, invalid GPS accuracy acceptance, invalid lecture GPS acceptance, GET state mutation, malformed QR 500, open lecture counted absent, 429 after 40 shared-IP hits, damaged database overwritten upon mutation. Static review found XSS sink; actual browser exploit and production load tests were NOT run.

### Rules for future assistants/developers
Check DECISIONS.md first. Do not change grading/absence/device/GPS policy without owner consent. Every fix needs regression test, documented commit, and updated TASKS.md. No task is closed just because a document exists. Never commit real student data or passwords.

### Hosting decision 2026-10-19
Owner wants Public GitHub + free website hosting, no provider preference. Prototype stack selected: Render Free Node web service + Neon Free PostgreSQL. No Render/Neon account connected, website URL does not exist, student.html missing from audit branch, and code still relies on local JSON. Do not assume deployed/production-ready. Source of limitations: https://render.com/docs/free and https://neon.com/blog/neon-free-plan-1-gb-per-project .

## Implemented and tested partial remediation (2026-10-19)
Branch audit/attendify-review-2026-10-19 now has `server.js` fixes and `public/doctor.html` fixes. Locally ran Node v22 integration tests using synthetic roster: 3 tests passed. Pushed `test/guardrails.test.js` and GitHub Actions `.github/workflows/security-tests.yml`; GitHub Actions run #39208681784 completed successfully on the audit branch at commit ff9bcd1 (verified via GitHub API). **Not all findings resolved**. See TASKS.md for per-task states. No real records uploaded.
- No `1234` default; strong DOCTOR_PASSWORD required.
- Reject missing/negative GPS accuracy, out-of-range coordinates, malformed QR signatures.
- Refuse to start and overwrite malformed data.json.
- Login limiter, expiring sessions, POST-only close/open and revocable logout.
- Escape dynamic text in the admin HTML.
- Confirm user installed Render + Neon apps; installation status verified, but no Render/Neon management tool actions were exposed in this session, so no infrastructure changes or deployments took place.
- Page `public/student.html` remains absent on GitHub, despite being present in original ZIP. The audit branch is incomplete.

## Feature implementation on branch feature/teacher-student-improvements — 2026-10-19
User asked for student name + editable roll number; lecturer deletion of accidental lectures, course-specific roster add/removal, lecturer/course labels, saving Excel, separate lecturer accounts and password change. Decisions requiring approval in docs/FEATURE_REQUESTS.md.
- Implemented `public/student.html` with clear cached-ID reset. It stores corrected ID only after successful attendance; displays full confirmed student name on success (no unauthenticated name lookup endpoint).
- Lecturer/course labels saved with new lectures and displayed in admin list, live QR view, report API and CSV heading.
- Empty-lecture soft delete/restore available to logged-in lecturer. If any attendance recorded, delete returns 409 to protect the history. Deleted lectures excluded from reports and cannot accept QR attendance; restoration leaves closed.
- Existing CSV exports continue; not native XLSX yet. Single shared lecturer password and single global student roster remain; no multi-account/course access controls.
- 3 GitHub Actions integration tests successful in run #39210678172 (PR #2). Browser e2e, privacy audit and production load remain pending. Not deployed.

## October 19 2026 — owner-approved account model
User chose **one superadmin**, who creates lecturer accounts and assigns courses. No self-registration. Separate `feature/superadmin-accounts-courses` branch with `db/001_initial.sql` and `docs/SUPERADMIN.md`. Neon Free project `bata-attendify` ID `wandering-mode-56487150` created, database `attendify` holds 10 new EMPTY tables, verified. No student data, user accounts, passwords or sessions inserted. Existing Node app not yet migrated; continue tracking SA-03..SA-10. Render workspace discovered but no workspace selected/production service created. Do not assume site is live or that role security is working.


## Role restriction development — 2026-10-19
Owner explicitly limited superadmin to **creating lecturer accounts and distributing/revoking lecturer-course assignments ONLY**. It cannot view or edit student rosters, attendance, reports, lectures or absences. It cannot inherit lecturer privileges; exceptions limited to personal account self-service. Course catalog creation and cross-role password reset have not been authorized.
- `lib/permissions.js`: deny-by-default action authorization; lecturer course operations require server-side verified active membership, not client flags.
- `lib/passwords.js`: salted scrypt password hashes with unique random salts and fixed format, no plaintext.
- `lib/admin-management.js`: backend data-access module for admin-only lecturer creation with one-time random temporary password, minimal identity/course catalog lists, course assignment/revocation and audit events. **NOT wired to HTTP or existing server.**
- `scripts/bootstrap-superadmin.js`: one-time private-env provisioning program. **NOT executed**, no superadmin credentials ever entered or created.
- New permission, bootstrap, account-management and password tests passed in GitHub Actions #39213860392.
- `package.json` pins pg v8.23.1 for future Neon connection. Database schema exists but `server.js` still uses local JSON and shared DOCTOR_PASSWORD, so there is **NO actual live multi-user security yet**.
- Render not provisioned/deployed. Do not tell user the site is live, that admin UI works, or that permission policy protects the current server.
