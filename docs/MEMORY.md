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

## Owner decision update — course creation (2026-10-19)
**Superadmin creates the course by typing its name first, then assigns it to a lecturer.** This replaces the previous explicit prohibition on course creation, but does **not** permit superadmin to see or edit enrolled students, lectures, attendance, reports or course content, or to rename/delete a course.
- `lib/permissions.js` now allows superadmin action `course.create`, denies it to lecturer.
- `lib/admin-management.js` implements isolated `createCourse` DB transaction (validated name + created_by principal + audit event) and existing `assignCourse` follows.
- No schema mutation needed: Neon `courses` table already supports name, created_by, and assignment rows. No real student or course records were inserted into Neon.
- No login/API/UI integration yet: DO NOT call course creation live or claim website deployed. Tests and GitHub Actions status must be verified.

## Verified course-creation regression — 2026-10-19
- GitHub Actions run [#39215894790](https://github.com/AM-naguib/Bata/actions/runs/39215894790) completed **successfully** on this feature branch (CI run 39).
- The tests exercise administrator-only course insertion, validation, rollback, audit log and create-then-assign workflow using synthetic data; existing security regression suite also passed. This is **not** a test of a live admin UI or production role-based HTTP endpoints.


## Admin portal v2 progress — 2026-10-19
- New working code on `feature/superadmin-accounts-courses`: `server-v2.js`, `lib/http-app.js`, `public/portal.html`, `public/app-v2.js`, `public/app-v2.css`, `test/http-portal.test.js`.
- Default `npm start` points to v2 (DB-backed admin portal) to prevent accidental serving of insecure old academic APIs. Legacy `server.js` remains in source history but is not started by npm.
- Real account API + web UI: log in/logout, admin lecturer create, course create, assignment grant/revoke, lecturer assigned-course list; password change revokes all sessions, mandatory for newly created doctor; cookie secure with Origin validation for mutations.
- New HTTP integration tests exercise cross-role restrictions, lecturer setup and account lifecycle. GitHub Actions run #39217213315 succeeded with `pg` npm install, JavaScript syntax validation, and security suite.
- Read-only Neon query confirmed project `wandering-mode-56487150`, DB `attendify`: 0 accounts, 0 courses, 0 students, 0 lecturer-course assignments. No real data migrated.
- Outstanding: *every* real student/lecture/QR/check-in/report API requires v2 course-scoped implementation and backfill. No website deploy. No private admin credentials, no Render workspace confirmation. Use docs/PORTAL_V2.md for current truth; prior dated notes concern older branch stages.

## Important owner correction: student identification — 2026-10-19
The student enters **roll number AND full name**, both editable. The user does NOT want a secret student code. Do not ask again about roll-number-only vs PIN; the decision is final unless user changes it.
- Updated `public/student.html`: both input boxes; reset clears locally cached ID/name; they are stored only after successful check-in.
- Updated old `server.js` attendance: checks the pair before device binding. This old server is **not** default production entry.
- `lib/student-identity.js`: normalize name (NFC/whitespace), exact ID match including leading zeros, no guessing spelling; require both values.
- `lib/student-enrollment.js`: future v2 Neon lookup requires the student be actively enrolled in that course; returns internal ID only, no public names/IDs enumeration endpoint. It has tests but is NOT connected to a working v2 attendance handler yet.
- User's requirement matches a record, it cannot prove a student's physical identity. GPS/device spoofing remains an open security concern.


## Verified student form correction — 2026-10-19
- User requires **both roll number and typed full name** (no student PIN). Implementation and ownership documented in D-022 and ST-01..ST-06.
- Code: `public/student.html`, `server.js`, `lib/student-identity.js`, `lib/student-enrollment.js`; tests `test/student-identity.test.js`, `test/student-enrollment.test.js`, extended `test/guardrails.test.js`.
- Regression initially identified comparing Postgres student internal UUID instead of roll_number; fixed in commit `651aa31`.
- GitHub Actions [run #39218694375](https://github.com/AM-naguib/Bata/actions/runs/39218694375) **succeeded** after fix. Tests verify correct name+roll accepted, missing/wrong entries rejected, mismatch before device binding, and course enrollment constraints.
- Not a live app yet: `npm start` serves v2 account portal only; student check-in endpoint for v2 is an open task. No real records published or uploaded.

## Latest implementation: v2 QR attendance (2026-10-19)
- Owner's identity input stays **seat/roll number + full typed student name**, no PIN. New `public/checkin.html` and `public/checkin.js` handle the phone camera QR URL and let students edit cached values before trying again.
- `lib/attendance-v2.js`: HMAC QR 30-second tokens, lecturer assignment checks, closed lectures, GPS validation, Neon course enrollment + name/roll match, transactionally locked check-in, per-lecture HMAC device fingerprint and duplicate protection.
- `lib/attendance-routes.js` mounted in `lib/http-app.js` only when `ATTENDANCE_ENABLED=1`. `qrcode@1.5.4` produces server-side QR images with a self-hosted student check-in URL.
- Lecturer portal added lecture creation with GPS center, rotating QR, closed state and attendance count (not roster).
- `db/002_attendance_device_guard.sql` applied to the real EMPTY Neon Free project: version=2, unique device index present, 0 student/account/attendance rows.
- GitHub Actions #39238772639 succeeded. Prior failing HTTP test caught an unhandled rejection; fixed by `return await attendanceRouter(...)` so unauthorized operations yield HTTP errors.
- Enabled attendance requires private `ATTENDANCE_QR_SECRET` and `ATTENDANCE_DEVICE_KEY` and HTTPS `PUBLIC_ORIGIN`. Config remains private; only variable names in `.env.example`.
- **Outstanding**: per-course roster management/import and real database integration tests, genuine browser testing, report/Excel, backups and secure deploy. Website is NOT live and first admin account is NOT created. Features are on branch, not merged to main.

## Course roster manager + private import — 2026-10-19
User requested to continue by implementing lecturer-managed per-course student add/remove and *privately and safely* importing the original student roster into Neon. Implemented code; **real import NOT executed** due to missing real lecturer/course mapping.
- `lib/course-roster.js`: authenticated lecturer-only course listing, roster insert/reinstate and soft remove. Assignment checked inside SQL transaction with row lock; historical attendance untouched. Global student roll numbers reused across courses; conflicting names are rejected rather than overwritten.
- `lib/roster-routes.js`: `GET/POST /api/v2/lecturer/courses/:courseUUID/students` and `POST .../students/remove`; independent `ROSTER_ENABLED=1` flag. `public/portal.html` + `public/app-v2.js` now show lecturer-only course roster select/entry/list/remove UI.
- `scripts/import-roster.js`: default private JSON dry-run, `--apply` for atomic DB insertion into an **existing assigned course** under active lecturer ID. No student details logged. See `docs/PRIVATE_ROSTER_IMPORT.md`.
- Locally inspected user-uploaded `attendify.zip`, its `attendify/students.json`: exactly **172** entries, JSON keys `id` and `name`, no duplicates/missing fields. Did NOT copy names or ID values to GitHub nor to a public URL.
- Neon project `wandering-mode-56487150` still holds **zero** accounts, courses, assignments, students, enrollments and attendance; can't import into a nonexistent course. No personal records migrated or published.
- CI verified successful: [run #39242649707](https://github.com/AM-naguib/Bata/actions/runs/39242649707). Feature branch only, not merged/deployed.
- Remaining: create first superadmin privately, create lecturer/course, choose which course(s) original students belong to, then run private import; verify safely and arrange backup.


## Owner confirms one-course initial student allocation — 2026-10-19
The 172 student name/roll pairs from the private source ZIP are to be imported into **ONE course first**. Future courses can enroll the same underlying student records without duplicating the person. **Do not make the superadmin a student manager**: admin only creates courses/lecturer accounts and assigns courses to lecturers; lecturer handles enrolling students in their assigned courses. Existing addStudent/importRoster routines already reuse the existing student row via roll_number conflict handling and create a separate enrollment per course. No first course/lecturer/superadmin exists yet (last verified), so the actual private 172-person import must wait for owner-selected course/lecturer provisioning. No student PII goes to public GitHub.


## Initial course placeholder — user decision 2026-10-19
User explicitly allowed **any initial course name and editing it later**. Chosen Arabic placeholder: **المقرر الأول (مؤقت)**. Added `course.rename` permission for superadmin (only course catalog metadata), `lib/admin-management.js` transactional `renameCourse`, `POST /api/v2/courses/rename` role/origin-protected API, and UI rename form. Course IDs remain stable so assignments/rosters/lectures/attendance do not change. This *supersedes* prior prohibition on superadmin course rename; academic data restrictions remain.
**Important distinction:** name is prefilled in the creation form on the GitHub feature branch, but the course itself has NOT been created in Neon because the required first superadmin account does not exist. No accounts or student records are created or published; no production website deployment.


## First live database initialization — 2026-10-19
User explicitly authorized creating the admin account and giving them a temporary password, and later changing it. A random high-entropy credential was generated and stored in the existing Neon Free `bata-attendify` project using the exact salted `scrypt:v1:32768` hash format expected by `lib/passwords.js`; **never put the plaintext, salted hash, or login identifier in GitHub**. The credentials were provided to the owner in the chat. The account login identifier is a placeholder and NOT a real mailbox for recovery.
- Inserted one `superadmin` and the existing agreed course label `المقرر الأول (مؤقت)` in one atomic PostgreSQL statement, plus `superadmin.bootstrap` / `course.create` audit events. Verified: 1 superadmin, 1 course, 2 setup audit records, salted hash stored.
- Database still has 0 students, 0 lecturer assignments and no imported 172-person roster. Do not invent lecturer account details or allocate students outside the one course.
- The feature branch `feature/superadmin-accounts-courses` contains the admin UI and course-rename code; website NOT deployed. User can change their password from the real portal after a working HTTPS service is deployed. No email/password recovery service yet.
