# Attendify — issue tracker

All remediation tasks are OPEN. [ ] means not implemented. Priority P0 blocks safe production.

- [ ] T-00 P0 — Repo bootstrap, privacy review and ensure no student records reach public git. **Owner confirmed this is the correct project**. Deploy real roster only via controlled data source. Verify full git history and artifacts.
- [ ] T-01 P0 — Decide private/public repo and how admins will import/manage enrolled students. Add safe provisioning, backup and access controls. **Decision pending**.
- [x] T-02 P1 — F-01 Removed fallback 1234, require DOCTOR_PASSWORD with length >=12. Verified by synthetic Node test. Commit `1335905`. **Operational secret still must be set securely at deploy.**
- [ ] T-03 P1 — F-02 Add login brute-force protection. Test repeated incorrect attempts limited without unnecessary class-wide lockout.
- [ ] T-04 P1 — F-04/F-05 Decide threat model and independent student identification. Test replay/impersonation within chosen mechanism. **Decision pending**.
- [x] T-05 P1 — F-06 Reject missing/non-numeric/zero/negative accuracy and invalid coordinates, plus enforce MAX_ACC. Verified by synthetic Node test. Commit `1335905`.
- [ ] T-06 P1 — F-07 Replace unsafe innerHTML interpolation with DOM textContent/escaped HTML; browser regression using adversarial text.
- [ ] T-07 P1 — F-08 Fail safely on corrupt data.json; preserve original and add backup/restore; test no overwrite on parse error.
- [ ] T-08 P1 — F-09 Define when lectures count for absence and eligibility. Test open/closed lessons and exact threshold. **Decision pending**.
- [ ] T-09 P1 — F-10 Restrict open/close to authenticated POST/PATCH with CSRF defenses; test GET cannot mutate.
- [ ] T-10 P1 — F-11 Server logout invalidates session, true expiry, secure cookies on HTTPS. Test cookie reuse fails after logout.
- [ ] T-11 P2 — F-12 Avoid shared-IP false positives; cleanup limiter; support trusted reverse proxy. Test 50 valid users behind NAT.
- [ ] T-12 P2 — F-13 Reject impossible coordinates when doctor creates lecture.
- [ ] T-13 P2 — F-14 Validate token encoding/length/shape before timing-safe comparison; fuzz malformed Unicode strings no 500.
- [ ] T-14 P2 — F-15 Decide whether device binding is per lecture or ongoing; update implementation and README. **Decision pending**.
- [ ] T-15 P2 — F-16 Preserve historical attendee information when roster changes; test old records still work.
- [ ] T-16 P2 — F-17 Neutralize spreadsheet formula injection in CSV exports.
- [ ] T-17 P2 — F-18 Pick durable storage, atomic writes, backups and concurrency strategy based on hosting. **Decision pending**.
- [ ] T-18 P2 — F-19 Add unit/integration/browser regression tests and CI using synthetic student fixtures.
- [ ] T-19 P2 — F-20 Add CSP, security headers, and pinned/self-hosted third-party JS with integrity validation.
- [ ] T-20 P3 — F-21 Improve admin UI failure feedback and camera scanner lifecycle; test repeated taps and permission errors.

**Workflow:** Write a failing test; implement a minimal change; run tests; commit to review branch; mark [x] only after passing acceptance criteria, with commit evidence. Do not merge into main without owner decisions on operational security. 

- [ ] T-21 P0 — Complete safe source staging: `public/student.html` still absent following upload rejection. Verify GitHub tree against ZIP (excluding real `students.json`) and test both `/` and `/doctor`; do not deploy incomplete branch.
- [ ] T-22 P1 — Public website launch: owner chose Public repository. Select Node hosting, provision private real roster, persistent attendance storage and backup, HTTPS, production env vars. Gate rollout on security fixes and acceptance tests. Hosting provider **pending**.

- [ ] T-23 P1 — Prepare **Render Free** deployment with HTTPS, manual deploy gate and environment variables set securely. Confirm `/`, `/doctor`, health check, QR behavior and cold-start tolerance. NO deployment until other P1 blockers close.
- [ ] T-24 P1 — Migrate private roster/attendance/device persistence to **Neon Free PostgreSQL**; write schema, import routine, atomic transactions and migration tests with synthetic fixtures. Never store real student data in source control.
- [ ] T-25 P1 — Create backup/export and restore test for private student and attendance records, including free-tier service outage response.
- [ ] T-26 P1 — Verify free plan spend limits, any credit-card requirement, instance sleep/recovery, Neon quotas, backup and reliability before running a real class.

## Implementation update — 2026-10-19
- T-03 **partial**: IP-based login limiter implemented (10 attempts / 15 min), but classroom NAT behaviour and distributed-instance enforcement untested.
- T-06 **partial**: escaped untrusted text in doctor UI (commit c95dcd3); browser XSS regression still required.
- T-07 **partial**: startup fails closed on malformed/invalid data.json (commit 1335905); full backups, restores, storage migration still OPEN.
- T-09 **partial**: close/open now require POST, and GET is read-only (commit 1335905); CSRF/origin protection still OPEN.
- T-10 **partial**: logout now revokes server session, enforces 12-hour expiry and HTTPS cookie Secure flag in NODE_ENV=production (commits 1335905, c95dcd3); production proxy/HTTPS checks still OPEN.
- T-12 **partial**: invalid lecture coordinates rejected (commit 1335905); dedicated regression test outstanding.
- T-13 **partial**: malformed signatures now rejected without timingSafeEqual length mismatch (commit 1335905); fuzz suite outstanding.
- T-19 **partial**: synthetic regression tests and GitHub Actions CI added. Browser tests still missing; GitHub Actions run #39208681784 succeeded; browser tests still missing.
- T-21 remains **OPEN**: original student.html could not be published; do not deploy this branch.
- T-24 remains **OPEN**: Postgres migration not implemented. Render Free loses JSON data on restart. No live website or database connection was established.

## Feature requests — 2026-10-19 (all separate from historical security backlog)
- [x] FR-01 P1 — Student can clear/edit cached seat number. Saving now happens only after successful attendance. Verified by source/HTTP tests; full browser storage interaction test still desirable. Commit 737ac52.
- [ ] FR-02 P1 — Show matching student name safely with validated seat number and suitable privacy protections (requires identity-flow decision; guard against enumeration).
- [ ] FR-03 P1 — PARTIAL: reversible delete/restore of **empty** lectures implemented; refuses deletion when attendance exists (409), excludes archived from reports, restores closed. Await decision for populated lectures and audit/access control; commits 93200bf, 8d1330e.
- [ ] FR-04 P1 — Course roster add/remove with lecturer scoping and persisted enrollment; preserve history; tests for unauthorized changes and cross-course isolation.
- [x] FR-05 P2 — Save free-text lecturer/course labels with lectures; display on lecturer page, live projection and CSV headers, keeping backwards compatibility. Later account/course relationships remain separate. Commits 9f6e9f6, 47e00dd, 38a19d8.
- [ ] FR-06 P1 — Export Excel sheet (.xlsx vs existing .csv TBD) with correct Arabic names, course filter, and formula-injection defense.
- [ ] FR-07 P0 — Per-lecturer accounts, unique IDs, secure password hashing, session ownership, course access checks, and password self-service/change; owner decision required on provisioning and recovery.
- [ ] FR-08 P0 — Migrate students, courses, enrollments, lecturers and attendance to persistent Neon DB with synthetic migration tests and backups; **do not migrate actual student names into GitHub**.
- [ ] FR-09 P1 — Unit/API/E2E regression tests for new workflows, especially deleted lectures and enrollment changes.
- [x] FR-10 P1 — Built and restored student page on feature branch; `/` loads in synthetic integration test. The parent audit branch is still missing that file until this PR is merged.

## Verified feature branch tests
- 2026-10-19: GitHub Actions run #39210678172 **passed** for feature branch PR #2. Tests cover login/session/GPS, public student page, saved-ID control presence, lecturer/course metadata in lecture/CSV, confirmed student name after attendance, and archival/recovery of no-attendance lectures.
- FR-02 **partial**: name appears only after verified successful attendance, not at roll-number entry. A public identity lookup is not yet approved due to privacy/enumeration risks.
- FR-06 **partial**: Excel-compatible CSV download exists; native XLSX export not implemented.
- FR-04 / FR-07 / FR-08 **open**: per-course roster, per-doctor accounts/password management and persistent Neon database.
- NO production deployment and NO real student records uploaded.

## Superadmin implementation work
- [x] SA-01 — Define owner-approved superadmin-managed lecturer onboarding/course assignment and document role boundaries (docs/SUPERADMIN.md).
- [x] SA-02 — Provision empty Neon Free `bata-attendify` project and create 10-table baseline schema; verified table list. No real records inserted. SQL checked into db/001_initial.sql.
- [ ] SA-03 — Implement first-superadmin one-time bootstrap command using a private configured credential (never hardcoded/default).
- [ ] SA-04 — Replace single shared DOCTOR_PASSWORD and in-memory sessions with per-user salted slow password hashes and DB-backed sessions; password change/recovery and revocation.
- [ ] SA-05 — Superadmin-only lecturer account create/disable, course creation and lecturer/course assignment API and UI.
- [ ] SA-06 — Enforce active lecturer-course membership server-side on ALL lecturer routes, attendance reports, enrollment and lecture deletion; test cross-tenant denials.
- [ ] SA-07 — Add audit logging, per-course student enrollment and soft removal retaining attendance.
- [ ] SA-08 — Safely migrate existing local data into Neon after confirming legacy lecture/course mapping and backup; prohibit real roster in public git.
- [ ] SA-09 — Security and E2E tests using synthetic users/rosters, and upgrade frontend login/account flows.
- [ ] SA-10 — Create deployment only after readiness, initial admin credentials chosen securely and all core authorisation tests pass.


## Role-restricted admin follow-through (2026-10-19)
- [x] SA-11 — Owner resolved superadmin access: lecturer account creation + lecturer-course assignment only. Explicitly DENY attendance, student roster, lectures, report export and course/lecturer deletion, even via direct APIs. See D-012..D-015.
- [x] SA-12 — Implement/test deny-by-default RBAC module `lib/permissions.js`, including assigned-course lookup fail-closed and self-service boundaries; CI #39213860392 passed.
- [x] SA-13 — Implement/test salted scrypt passwords and one-time bootstrap **code**, with no hardcoded credentials; CI #39213860392 passed.
- [x] SA-14 — Implement/test account-management **data layer**: superadmin-only lecturer creation, minimal lists, course grant/revoke, audit log; CI #39213860392 passed.
- [ ] SA-15 — Wire DB-backed authentication, sessions and RBAC to *every* HTTP endpoint; remove shared DOCTOR_PASSWORD; direct-HTTP cross-role tests. Required before public use.
- [ ] SA-16 — Build superadmin UI limited to lecturer creation and course assignments (minimal names/codes, never student/attendance info). Build lecturer UI limited to assigned courses.
- [ ] SA-17 — Validate live Neon connection/migrations, course provisioning policy, create initial superadmin via private one-time bootstrap, and import students securely after backup. No real records inserted yet.
- [ ] SA-18 — Implement lecturer self-service password change and session invalidation after change.
- [x] SA-19 — Owner confirmed: superadmin types course name, creates a catalog entry, and then assigns it to a lecturer. Previous no-course-create policy superseded (D-020).
- Remaining SA-03/SA-04/SA-05/SA-06 are **PARTIAL ONLY**. Bootstrap script is not run; functions are NOT exposed by an authenticated API; the running server does not enforce roles. GitHub Actions unit/integration tests verify only new code and existing legacy routes; they are not a live security assessment.

## Course creation implementation — 2026-10-19
- [x] SA-20 — Add narrowly scoped `course.create` permission for superadmin, lecturer forbidden; no report/student/lecture access granted.
- [x] SA-21 — Add `createCourse(pool,principal,{name})` to `lib/admin-management.js`: validated course name, authenticated creator ID, parameterized INSERT and audit event in one transaction; create then assign tested with synthetic IDs. **Not attached to HTTP endpoints yet.**
- [ ] SA-22 — Connect course creation/assignment to new DB-backed authenticated admin API, plus UI name input, course selector and lecturer selector; tests must block lecturers and unauthenticated callers. Depends on SA-15 and SA-16.
- [ ] SA-23 — Decide whether identical course names are allowed across academic terms and whether a course code/semester should be required. No unrequested uniqueness assumption in current code.

## Verified course-creation regression — 2026-10-19
- GitHub Actions run [#39215894790](https://github.com/AM-naguib/Bata/actions/runs/39215894790) completed **successfully** on this feature branch (CI run 39).
- The tests exercise administrator-only course insertion, validation, rollback, audit log and create-then-assign workflow using synthetic data; existing security regression suite also passed. This is **not** a test of a live admin UI or production role-based HTTP endpoints.


## Portal v2 HTTP/UI integration — 2026-10-19
- [x] SA-22 (development implementation) — Database-backed HTTP `POST /api/v2/courses` + lecturer creation and assignment/revocation, RTL web UI forms. Synthetic end-to-end HTTP tests passed. **Not deployed, no real accounts created.**
- [x] SA-24 — Implement `server-v2.js` and `lib/http-app.js` with Neon PostgreSQL sessions, role checks, POST same-origin enforcement and a verified public `/healthz` endpoint. `npm start` uses v2 rather than legacy server.
- [x] SA-25 — Web admin dashboard `public/portal.html` + JavaScript/CSS for superadmin login, lecturer creation, typed course creation, assignment/revocation, and personal password change; lecturer sees only assigned course names.
- [x] SA-26 — Integrate self-password-change API with current-password verification, updated hash and revocation of all existing sessions; initial temporary password must be changed first.
- [x] SA-27 — HTTP integration tests against a synthetic in-memory fake-PG pool: login, origin check, old API blocked, admin create course/lecturer, grant/revoke, compulsory password change, lecturer denied admin, logout revocation. GitHub CI runs npm install, syntax and tests.
- [ ] SA-28 — Connect to real Neon through an authorized private runtime, create first superadmin privately, and run real PostgreSQL integration smoke tests. Current Neon project is empty (0 accounts, 0 students, 0 courses, 0 assignments).
- [ ] SA-29 — Implement lecturer-only course-scoped enrollments, class sessions, attendance, QR/GPS and reports in v2; migrate legacy data privately with backup. **LIVE CLASS USE BLOCKED.**
- [ ] SA-30 — Add browser automation (real DOM), security audit for public deployment and a Render free-tier service only after confirming workspace and safety requirements.
- [ ] SA-31 — Student identifier input CONFIRMED as seat number + typed full name (no PIN). Remaining decisions: anti-impersonation beyond this, lost-device reset, absence calculation and XLSX export.
- Note: Previous SA-15/SA-16/SA-18 are now **partial**: completed for the new account portal, but not for course attendance workflows. Do not mark application-wide security complete. Read docs/PORTAL_V2.md.

## Student fields correction and validation — 2026-10-19
- [x] ST-01 — Owner confirmed student types BOTH roll/seat number and full name; no student code/PIN. This supersedes previous proposed secret-code approach.
- [x] ST-02 — Add full-name input and `تعديل رقم الجلوس أو الاسم` reset control; cache both only after attendance succeeds.
- [x] ST-03 — Legacy POST /api/attend now verifies submitted ID and full name against the roster BEFORE duplicate detection or device binding; mismatches use a generic error and do not register attendance.
- [x] ST-04 — Add `lib/student-identity.js` shared validation and `lib/student-enrollment.js` for active per-course Neon enrolled-student lookup, returns only internal student ID. Tested on synthetic records.
- [ ] ST-05 — **BLOCKER:** Wire the validated pair into a full *v2* QR attendance POST backed by Neon, including course lecture validation, geofence, anti-replay, and lecturer-only reports. Current v2 server has no student attendance route; the legacy server code is not exposed by default `npm start`.
- [ ] ST-06 — Browser E2E test editing both fields and preserving full names; privacy review and safeguards against name/roll-number impersonation. No stronger student credential should be added without owner decision.


## Verified student form correction — 2026-10-19
- User requires **both roll number and typed full name** (no student PIN). Implementation and ownership documented in D-022 and ST-01..ST-06.
- Code: `public/student.html`, `server.js`, `lib/student-identity.js`, `lib/student-enrollment.js`; tests `test/student-identity.test.js`, `test/student-enrollment.test.js`, extended `test/guardrails.test.js`.
- Regression initially identified comparing Postgres student internal UUID instead of roll_number; fixed in commit `651aa31`.
- GitHub Actions [run #39218694375](https://github.com/AM-naguib/Bata/actions/runs/39218694375) **succeeded** after fix. Tests verify correct name+roll accepted, missing/wrong entries rejected, mismatch before device binding, and course enrollment constraints.
- Not a live app yet: `npm start` serves v2 account portal only; student check-in endpoint for v2 is an open task. No real records published or uploaded.

## V2 QR attendance implementation — 2026-10-19
- [x] AT-01 — Implement HMAC-signed time-limited QR token (30-second slots, previous slot tolerated) tied to a lecture UUID; tamper/expiry tests passed.
- [x] AT-02 — Lecturer creates, lists, views QR and closes lectures only in actively assigned courses. Admin role forbidden. Add in-portal lecturer QR UI that refreshes automatically.
- [x] AT-03 — Create student check-in page `/checkin` with editable **roll number + full name**, GPS and the native camera QR link; no student code/PIN.
- [x] AT-04 — PostgreSQL check-in with FOR UPDATE lecture lock, active course roster validation, GPS accuracy/distance checks, duplicate detection, and privacy-preserving per-lecture device HMAC; regression tests.
- [x] AT-05 — Non-destructive migration `db/002_attendance_device_guard.sql` applied to empty Neon DB; confirmed `schema_versions=2` and unique index exists, no students/accounts/attendance imported.
- [x] AT-06 — Create gated `ATTENDANCE_ENABLED=1` API router and close unsafe HTTP rejection path; CI passing.
- [x] AT-07 (code/CI) — Lecturer-only per-course roster list/add/soft-remove and audit trail, with PostgreSQL transactions and historical attendance preserved. **Actual production/Neon import and browser tests remain pending.**
- [ ] AT-08 — Real-Neon integration tests using synthetic accounts and students only, backups and restore, security review of spoofing/device recovery; no live student deployment yet.
- [ ] AT-09 — Course-specific Excel XLSX and attendance reports, with no admin access.
- [ ] AT-10 — Real browser/mobile GPS check, HTTPS hosting, resilient free-tier operation; keep public rollout blocked.
- [ ] AT-11 — Confirm course/absence calculation policy; QR attendance records alone do not compute course absence grades.
- **Run**: GitHub Actions [#39238772639](https://github.com/AM-naguib/Bata/actions/runs/39238772639) passed HTTP+unit regression after fixes. SQL migration applied separately; course rosters still empty.
- **Important**: v2 attendance endpoints are OFF by default. Missing private QR/device secrets prevent starting an enabled attendance server. Do NOT treat tested code as launched website.

## Private course enrollment — 2026-10-19
- [x] RO-01 — `lib/course-roster.js`: validate roll and full name, enforce active lecturer assignment with locked DB row, list/enroll/soft-remove per course. Reject cross-course and superadmin access. Re-enrollment restores previous link, never deletes historical attendance.
- [x] RO-02 — `lib/roster-routes.js`: v2 HTTP list/add/remove endpoints with `ROSTER_ENABLED=1` (independent of `ATTENDANCE_ENABLED`). Frontend lecturer portal has course selector and student list/add/remove controls; no admin access.
- [x] RO-03 — `scripts/import-roster.js`: private JSON roster file, default dry-run, explicit `--apply`, verified assigned lecturer, one transaction and rollback-on-any-conflict, count-only stdout. Synthetic tests passed.
- [x] RO-04 — Original private ZIP inspected locally: 172 ID+name entries, 0 duplicate roll numbers, 0 missing names/IDs. Actual names and roll numbers never committed.
- [x] RO-05 — GitHub Actions [#39242649707](https://github.com/AM-naguib/Bata/actions/runs/39242649707) passed after roster UI/API/import tests.
- [ ] RO-06 — **REAL IMPORT BLOCKED**: Neon still has 0 accounts/courses/assignments, so the 172 students cannot be enrolled into an assigned course without inventing mapping. Create first private superadmin, lecturer, course and assignment; confirm which course(s) the original roster belongs to, then dry-run and apply in private runtime.
- [ ] RO-07 — Browser UX tests, actual Neon SQL integration with synthetic users, lecturer permissions, backup/restore and safe public deployment.
- [ ] RO-08 — Native Excel XLSX per-course reports and exam eligibility/absence policy; still pending.


## Initial cohort allocation — 2026-10-19
- [x] RO-09 — Owner chose to initially import the original 172 students into **one course only**. Reuse global student records via course enrollment for future courses.
- [x] RO-10 — Reconfirm authorization: superadmin creates courses and assigns them to lecturers; student enrollment/distribution belongs **only** to lecturers of assigned courses.
- [ ] RO-11 — Create first superadmin through **private** bootstrap with owner-selected credentials, then create target course and lecturer assignment. No default login or source-code secrets.
- [ ] RO-12 — Confirm which named course and lecturer receive the 172 students; do not infer or invent mapping. Then back up original roster, run private dry-run and atomic import.
- [ ] RO-13 — Verify course has exactly 172 active enrollments in lecturer-only UI, test second-course re-enrollment of a synthetic student, and confirm old attendance remains unaffected.
- **Current status:** no real student import yet; Neon remains unpopulated according to last read-only check. Website not deployed.


## Editable temporary course name — 2026-10-19
- [x] CO-01 — Owner authorized provisional first-course name `المقرر الأول (مؤقت)` and later rename, with no change of course UUID.
- [x] CO-02 — Add `course.rename` permission only to superadmin and `renameCourse` transaction with audited name update. No student/lecture/attendance writes.
- [x] CO-03 — Add `POST /api/v2/courses/rename` and RTL admin rename form. Creation form prefilled with the temporary name; renaming refreshes list/assignment labels.
- [ ] CO-04 — Bootstrap owner-controlled superadmin privately and CREATE the first course in Neon. As of last read-only verification, Neon had zero superadmin accounts/courses; never bypass created_by audit FK or invent an admin identity.
- [ ] CO-05 — Verify real Neon database rename and end-to-end browser UI once account exists. Import of real 172 students remains blocked until assigned lecturer and private backup exist.


## First real Neon bootstrap verified — 2026-10-19
- [x] BO-01 — Create exactly one real superadmin with generated strong temporary password stored only as a salted scrypt hash. Login details provided privately to user via chat, **never committed to GitHub**.
- [x] BO-02 — Create `المقرر الأول (مؤقت)` in Neon owned by initial admin; audit both creation events. Verified 1 superadmin, 1 course and 2 audit events. Name can later be edited in admin UI without changing course UUID.
- [ ] BO-03 — Deploy private/controlled HTTPS admin portal and verify actual sign-in and password change against Neon. **NOT done**, no live URL.
- [ ] BO-04 — Create first lecturer account through authorized admin page and assign the existing temporary course; current Neon still has 0 lecturers / 0 lecturer-course assignments.
- [ ] BO-05 — Back up real roster privately, have lecturer approve assignment, dry-run and import 172 students into this one course; current Neon still has 0 students.
- [ ] BO-06 — Setup usable account recovery/email migration for placeholder login. Do not advertise the placeholder as a deliverable real email address.
- Previous RO-11 / CO-04 / SA-03 are **partially/resolved regarding account and course provisioning** but full portal security and live deployment tests remain open.


## Confirmed real roster import and Render prep — 2026-10-19
- [x] BO-05 / RO-12 (data import part) — Owner explicitly requested importing the original 172 real students into the one already-created course `المقرر الأول (مؤقت)`. Completed one-time, atomic PostgreSQL import through the private Neon connection with no GitHub roster files or secrets. Verified 172 students, 172 active enrollments in first course, no duplicate student IDs, 0 students in other courses and 0 attendance records.
- [x] RO-13 (DB verification) — Compared a canonical ordered-roll/full-name checksum of the original uploaded private ZIP against the real Neon enrolled roster; **matched exactly**. No individual names or IDs appear in logs/docs.
- [x] BO-07 — Rechecked the previously provided temporary admin password locally against the stored salted scrypt hash: match confirmed. Do not publish credentials in docs.
- [x] DEP-01 — Add `render.yaml` for Render Free/Frankfurt on the working feature branch, `npm start`, PostgreSQL health check, private `DATABASE_URL` and `PUBLIC_ORIGIN`; private lecturer roster enabled and public QR attendance disabled by default.
- [ ] DEP-02 — **Render workspace must be explicitly confirmed by owner.** Exactly one connected workspace was listed, `ahmed's workspace`, but tool explicitly requires owner confirmation before managing services there. Do NOT assume a workspace or claim website deployed.
- [ ] DEP-03 — After workspace confirmation, create Render Free Node service on the feature branch, set Neon DATABASE_URL privately and PUBLIC_ORIGIN to the actual HTTPS domain, verify /healthz, admin sign-in, password change, and lecturer roster access.
- [ ] BO-04 (still open) — Admin creates a lecturer account and assigns existing course. Database currently has **0 lecturer accounts and 0 lecturer assignments**. DO NOT invent doctor identity or login credentials.
- [ ] DEP-04 — Backups/restoration, production student privacy checks, mobile QR/GPS and XLSX/report support need signoff before enabling `ATTENDANCE_ENABLED=1` for classes. Students are stored privately in Neon but the QR feature remains disabled.
- Previous dated notes saying zero real students/no actual import have been superseded by this verified import.


## DEPLOY SUCCESS — Render Node web service and Neon connection (2026-10-19)
- [x] DEP-02 — User explicitly confirmed Render workspace `ahmed's workspace`.
- [x] DEP-03 (basic production deployment) — New Render FREE Node web service `bata-attendify-node` deployed on Frankfurt, branch `feature/superadmin-accounts-courses`. Private Neon DATABASE_URL and exact HTTPS PUBLIC_ORIGIN set through connectors. Build/start successful; deployment status Live.
- [x] DEP-05 — Added live smoke check workflow and passed GitHub Actions [#39258848867](https://github.com/AM-naguib/Bata/actions/runs/39258848867): /healthz 200 + Neon OK, /portal login page 200, unauthenticated roster/account 401, legacy/check-in endpoints 404.
- [ ] DEP-06 — Owner signs in to https://bata-attendify-node.onrender.com/portal using previously provided temporary admin login and changes initial password. Actual credentialed browser login/password update not independently verified.
- [ ] DEP-07 — Owner creates first lecturer identity via portal, assigns provisional course, lecturer signs in/changes password and verifies 172 pre-enrolled private students via lecturer-only UI.
- [ ] DEP-08 — Document and test backups/restoration, real-browser/mobile checks, session/cookie behavior and remaining privacy protections before expanding access.
- [ ] DEP-09 — DO NOT enable public QR check-in until end-to-end roster and geolocation checks pass; ATTENDANCE_ENABLED remains 0.
- NOTE: prior incorrectly configured Go service `Bata` in same workspace is unchanged (free plan); use the NEW Node URL. The tool could not edit an existing service's runtime/branch through current API, so an explicit NEW free service was created.


## UI REDESIGN — implemented/deployed 2026-10-19
- [x] UI-01: polished accessible Arabic RTL responsive homepage, dedicated /admin /lecturer /student routes, improved staff visual hierarchy and navigation.
- [x] UI-02: role-specific admin summary, lecturers, course catalog/rename, assignments and security settings; no new superadmin student/attendance permissions.
- [x] UI-03: role-specific lecturer summary and roster filtering/pagination (20 per page), course-scoped CRUD, safe text node rendering; own courses only.
- [x] UI-04: public student QR guidance and visually updated check-in form (still disabled, no student info collection on public guide).
- [x] UI-05: tests cover role routes and UI DOM IDs, Arabic RTL, mobile CSS, student guide no inputs, QR disabled; CI success [#39263443641](https://github.com/AM-naguib/Bata/actions/runs/39263443641).
- [x] UI-06: manually deployed Render Free Node service update `dep-dbb1v4ijnfac739j6r4g` status LIVE; independent HTTPS page-and-privacy smoke [#39263443594](https://github.com/AM-naguib/Bata/actions/runs/39263443594) SUCCESS.
- [ ] UI-07: owner visually checks admin/lecturer/student pages on actual phone and desktop and reports UX issues; browser mobile/accessibility automated tests are not yet done.
- [ ] UI-08: first credentialed admin sign-in and password change, create lecturer, assign existing first course. No lecturer in database yet, so only lecturer after assignment sees the 172 real students.
- [ ] UI-09: actual student check-in/QR flag remains OFF pending mobile GPS/replay protections, data backup and all required attendance reporting features. No premature activation.
- NOTE: canonical deployed portal now `https://bata-attendify-node.onrender.com/` with staff /admin and /lecturer, public /student guide; old Go service still misconfigured and untouched.


## LIVE BUGFIX AND THREE GATES — 2026-10-19
- [x] BUG-001 — Diagnose user's password-change SERVER_ERROR from Render: PostgreSQL SQLSTATE `42P08` in mixed UUID/TEXT repeated bind for password audit; split into $1/$2 without changing password policy or exposing credentials.
- [x] BUG-002 — Extend integration fake DB to detect mixed audit placeholders, verify successful lecturer password change records audit, revoked cookie and new sign-in. CI passed [#39266948676](https://github.com/AM-naguib/Bata/actions/runs/39266948676).
- [x] UI-10 — Show three prominent separate role gates (admin / lecturer / student) from all staff login entries, role-specific intro and login labels, mobile responsive cards, explicit student no-account guidance.
- [x] UI-11 — Preserve role URL when signing out or changing password, translate SERVER_ERROR into actionable Arabic error, update UI contract test.
- [x] DEP-10 — Manually deploy fixed application build `dep-dbb29vu7bikc73bfnst0` to `bata-attendify-node`: Render status LIVE; test actual HTTPS 3 gates / login UI / Neon health / unauthorized password-change / QR disabled [#39266948714](https://github.com/AM-naguib/Bata/actions/runs/39266948714).
- [ ] QA-12 — Owner refreshes live /lecturer, changes temporary/current password via security panel and verifies success + forced logout/relogin. The previous failed transaction did **not** update password. Do not claim credentialed live action verified until user confirms.
- [ ] QA-13 — Browser visual testing at owner's viewport/mobiles to fine-tune sidebar and 3-card layout.
- [ ] QA-14 — QR attendance flag still OFF pending safe real-world location and attendance reporting tests.


## Owner-requested lecturer password reset (2026-10-19)
- [x] AC-01 — Add superadmin-only `lecturer.password.reset` permission, deny lecturer and anonymous access.
- [x] AC-02 — Secure transaction: validate active lecturer UUID, issue fresh strong one-time secret, hash scrypt, force own password change, revoke all active sessions, write typed UUID/TEXT audit without logging secret, rollback on errors.
- [x] AC-03 — Protected same-origin `POST /api/v2/lecturers/password/reset` endpoint; no password retrieval, no superadmin target.
- [x] AC-04 — Admin lecturer list reset button with confirmation, one-time temporary password display and dismissal; doctor account stays unchanged until explicit click.
- [x] AC-05 — Tested role boundaries, malformed IDs, target missing, rollback, forced old session logout, old password rejection, temp login/forced password change and subsequent login. Security regression CI [#39270935273](https://github.com/AM-naguib/Bata/actions/runs/39270935273) SUCCESS.
- [x] AC-06 — Verified Neon `app_users.updated_at` column exists; manually deployed Render `dep-dbb3p18n74is73bg2em0` **LIVE** from app commit `bcf762126514e12d0f79a076d8493fb0d7a1080c`.
- [ ] AC-07 — Owner uses /admin → حسابات الدكاترة → إعادة تعيين الباسورد for one selected lecturer, privately delivers one-time password, confirms logged-out lecturer can sign in and change password. Do not trigger any actual account reset in automated smoke test.
- [ ] AC-08 — Confirm first lecturer has active assignment to provisional course and can view private student roster; keep QR attendance disabled until required E2E tests.


## Attendance report + Excel implementation (2026-10-19)
- [x] RP-01 — Implement role-authenticated report query for ONLY the assigned course, current roster, closed non-archived lectures and attendance. Exclude lectures before the student's enrolled_at; avoid false absence for open/past lectures.
- [x] RP-02 — Implement native genuine XLSX generator with 3 Arabic sheets, UTF-8 names, leading-zero IDs, numeric attendance percentage and XML escaping (no external dependency).
- [x] RP-03 — Add read-only `GET /api/v2/lecturer/courses/:id/report` and `.../report.xlsx` with same verified lecturer login and DB assignment, no-store cache, binary attachment. Independent of `ATTENDANCE_ENABLED` flag.
- [x] RP-04 — Add lecturer-only Reports & Excel tab with course picker, filtered student stats, lecture totals, pagination and XLSX download.
- [x] RP-05 — Add automated tests (no-lecture reports, late-enrollment semantics, other-doctor/admin rejection, real HTTP/Excel ZIP structure, HTML DOM contract). Include new modules in npm test:syntax and live smoke for anonymous report 401.
- [ ] RP-06 — Confirm all CI tests and Render LIVE deployment of code, then authenticated E2E browser check with real lecturer. No real attendance records exist yet.
- [ ] RP-07 — Academic owner approves absence denominator and whether removed/reinstated students and cancellations should appear in historic reports. Current behavior documented in D-033.
- [ ] LT-01 — Build lecturer lecture archive/restore and corrections/audit separate from reporting. Must not enable public attendance before end-to-end safety checks.
- [ ] OPS-01 — Secure backups / restoration drills and actual mobile GPS/QR tests before using attendance with real students.


## Report release verification — latest 2026-10-19
- [x] RP-06 (CI/hosting checks) — Render Free Node deployment `dep-dbb4f1rncjis73dei5lg` LIVE, app commit `d4001556066b0acc9c555f281ec07fcd45d3f029`. New UI, JSON report and true XLSX endpoints are on the live service.
- [x] RP-08 — Latest **security regression CI passed** https://github.com/AM-naguib/Bata/actions/runs/39287349093; **real HTTPS live smoke passed** https://github.com/AM-naguib/Bata/actions/runs/39287349090. Initial report test fixture had an extra closing brace (only tests, not production module); corrected in test-only commit `ce2f1033cba5693f4431b5af96d300a72220a036`.
- [ ] RP-09 — Real lecturer must log in and download a 3-sheet XLSX once, confirming Excel opens it with correct Arabic/right-to-left layout. External smoke confirms protected endpoints but not authorized real student download.
- [ ] RP-10 — Owner confirms absenteeism policy (closed unarchived lecture after enrollment; current enrolled roster only) before official academic reports; no real attendance records exist yet.
- [ ] LT-01 — Next implementation: lecturer-scoped lecture archive/restore and correction audit. Do not enable QR prematurely.


## LT-01 archived lectures, LT-02 corrections, OPS backup point — 2026-10-19
- [x] LT-01 — Lecturer-only archive and restore of CLOSED lectures with row lock, course assignment check and immutable audit; archive hides lecture from reports, never deletes original attendance.
- [x] LT-02 — Dedicated `attendance_corrections` overlay table (DB migration v3 applied to Neon) plus lecturer-only POST correction with enrolled student, closed unarchived lecture, reason 5–500, atomic old/new/status audit.
- [x] LT-03 — Course JSON and 3-sheet XLSX reports reflect corrected effective status, not raw QR events overwritten; historical QR rows intact.
- [x] LT-04 — UI lecture archive/restore controls and per-lecture/per-student correction form, separate from public QR feature flag.
- [x] LT-05 — Tests verified role boundaries, cross-course denial, malformed IDs, body lecture spoofing, CSRF, concurrency locks, rollback and report overrides; [security CI passed](https://github.com/AM-naguib/Bata/actions/runs/39291403895).
- [x] LT-06 — Deployed live Render `dep-dbb4rf49v7es73a78c4g`; [post-deploy external HTTPS smoke PASSED](https://github.com/AM-naguib/Bata/actions/runs/39291403822): new archive/correction APIs anonymous 401, public check-in off, protected staff UI present.
- [x] OPS-02 — Created compute-free Neon internal branch `backup-pre-attendance-2026-10-19`, verified Ready, contains pre-attendance production state. NO external data shared and NO active compute; instructions `docs/BACKUP_RECOVERY.md`.
- [ ] QA-15 — Real lecturer logs in and checks archive/correct using a synthetic/test lecture only, not legitimate class records; there are currently zero lectures/attendance.
- [ ] OPS-03 — Make **independent encrypted offsite PG dump**, verify restore into isolated DB, check future backup schedule/cost/retention. Internal Neon branch is not independent backup.
- [ ] OPS-04 — Real phone GPS permission, QR rotating/replay and cross-device security checks in controlled environment, user sign-off, before enabling `ATTENDANCE_ENABLED=1`.
- [ ] OPS-05 — Approve academic policy for corrections and archived/removed students in historic reports before relying on grades.
