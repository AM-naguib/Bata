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
- [ ] SA-19 — Decide who creates the original course catalog; admin is NOT authorized to create a course under current narrow policy.
- Remaining SA-03/SA-04/SA-05/SA-06 are **PARTIAL ONLY**. Bootstrap script is not run; functions are NOT exposed by an authenticated API; the running server does not enforce roles. GitHub Actions unit/integration tests verify only new code and existing legacy routes; they are not a live security assessment.
