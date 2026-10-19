# Attendify — Decisions

## Accepted
- D-001 — Confirmed by owner on 2026-10-19: **attendify.zip is the intended project for AM-naguib/Bata**.
- D-002a — Owner confirmed students must be entered into the application. This means the production application **must support real student records**; it does **not** mean publishing them to GitHub.
- W-001 — Audit first, do not modify application logic without justified requirements.
- W-002 — If policy is unclear, ask instead of inventing requirements.
- W-003 — Upload incrementally to GitHub. Documentation is being uploaded to branch `audit/attendify-review-2026-10-19`.

## Safety boundaries
- Repository was confirmed **public** during review.
- The uploaded ZIP has **172 student records with names and IDs**. Do not commit this file, include it in issue descriptions, or embed it in tests.
- Keep real data on a secured runtime volume/database or another access-controlled location, separate from the public repo. A test fixture is not a replacement for production enrollment.
- No code-level fix has yet been approved or completed; merely adding documentation is not fixing the issues.

## Hosting choice (2026-10-19)
- D-008: Owner prioritizes **free hosting**, with no provider preference. Technical plan selected for an initial **prototype**, not a production approval: **Render Free Web Service** running Node.js + **Neon Free PostgreSQL** for durable roster/attendance data.
- D-009: Repository remains Public, as explicitly requested; database credentials and real student data must only exist in access-controlled runtime environments.
- D-010: Do **not** represent the site as launched until both services are connected, storage is migrated, P1 security tasks and launch tests pass, and a real URL is verified. Render Free spins down after 15 minutes idle and its local filesystem is ephemeral. Its free tier is not recommended for production by the provider.
- D-011: Neon Free allowance advertised October 2026 is 1 GB per project, subject to compute/network quotas. Verify limits during provisioning. Free services may change terms.

## Pending owner decisions
- D-002b (resolved): Owner instructed on 2026-10-19 to keep the GitHub repository **Public**, with the goal of operating the project as a website. Hosting does not require a public GitHub repo, but the requested visibility is retained.
- D-002c (pending): Where/how will the actual 172 student records be stored and provisioned securely at runtime? Never commit the actual roster to public GitHub.
- D-003 (partly resolved): Owner requires roll number PLUS typed full name; no secret PIN/code was requested. This is not strong identity authentication. Lost-device handling and GPS impersonation risk remain unresolved.
- D-004: Should absences count only after lectures close? Is the >=25% rule per course, semester or overall, and are exemptions needed?
- D-005: Hosting provider (GitHub Pages cannot run this Node API), HTTPS, persistent storage/backup, number of classes and admins/instances. Do not deploy to a public URL until P1 security fixes and private roster provisioning are in place.
- D-006: Device binding per lecture or throughout the course?
- D-007: Intended geofence and GPS accuracy thresholds, and fallback when indoor geolocation fails.

## Change log
- 2026-10-19: User confirmed ZIP is project and students are intended to be entered into app. No consent to public disclosure of their records was given.

- 2026-10-19: Owner expressly chose a Public GitHub repository for eventual website deployment. Private runtime student records and hosting details are still pending. Source files may be staged in the audit branch; do not deploy as production in its current audited state.

- 2026-10-19: User accepted any free host. Chose Render Free + Neon Free for development/staging; no hosting accounts linked yet, so no deployment, no data import and no operational database established.

## Implementation record — 2026-10-19
- I-001: Only unequivocal low-risk security hardening has been implemented on the audit branch; the attendance/absence grade policy and student authentication design are unchanged.
- I-002: Keep the GitHub pull request in Draft; **do not merge or deploy yet** because code remains incomplete, storage is still JSON and student identity/spoofing vulnerabilities are unresolved.
- I-003: Render and Neon plugin installations verified from ChatGPT integration catalog; their management actions were **not accessible in this session**, so cloud services were not provisioned. No live URL available.
- I-004: Regression checks passed locally with synthetic students; GitHub Actions run #39208681784 succeeded on audit branch; this does not constitute production approval.

## New feature requirements received 2026-10-19
- FR-D1 (confirmed): Student UI must show matching student name and make correction of previously saved seat number clear.
- FR-D2 (confirmed): Lecturer can delete mistaken lectures.
- FR-D3 (confirmed): Lecturer can add/remove students to a specific course roster.
- FR-D4 (confirmed): Lecturer and course names must be captured alongside a lecture.
- FR-D5 (confirmed): Excel attendance sheet saving/export requested; format not specified.
- FR-D6 (confirmed): Separate account for every lecturer with account management and password change.
- FR-D7 (resolved): A single superadmin creates lecturers and assigns lecturer-course memberships; no lecturer self-registration.
- FR-D8 (pending): Whether lecture deletion is recoverable and how to preserve existing recorded attendance.
- FR-D9 (partly resolved): Owner requires student to TYPE both roll number and full name; server must match both to an enrolled student's record. No public ID-to-name lookup. Historical incorrect attendance correction still pending.
- FR-D10 (pending): Whether Excel means native XLSX or CSV compatible with Excel.
- FR-D11 (pending): How historical records map to courses, with course-by-course attendance percentages and exact privileges.
No changes to grading/absence rules authorized yet. Implement safe UI improvements before irreversible data operations.

## Feature-branch interim safety choices — 2026-10-19 (not owner-approved product policies)
- Pending student identity design, show full student name **only after successful attendance**, not as a public ID->name directory. Seat number can be cleared locally; correcting a prior recorded attendance remains lecturer-controlled and needs design.
- A lecturer can archive an accidentally created **empty lecture** and restore it; if attendance exists, deletion is blocked (409). Archive removes it from current absence calculations without erasing any records. Restored lecture is CLOSED until explicitly reopened. Owner still needs to decide policy for lectures with attendance.
- Course and lecturer names currently are metadata labels on lectures, **not user identities or validated per-course enrollments**. Do not confuse with account ownership.
- Existing CSV is labelled 'opens in Excel' accurately; native XLSX remains pending.
- Approved status: only the user feature requirements, not onboarding/deletion/privacy policies. No private roster or account secrets in public GitHub.

## Confirmed role policy (2026-10-19)
- **OWNER APPROVED:** A single main superadmin creates lecturer accounts and assigns courses to them; lecturers cannot sign themselves up or assign courses.
- Lecturer accounts must be limited to their assigned courses; users may change their own passwords after authentication.
- SQL schema deployed to new Neon Free project `bata-attendify` (ID `wandering-mode-56487150`), with 10 tables, no student records or credentials. Database schema is not the same as working application accounts. See docs/SUPERADMIN.md.
- Do not invent superadmin credentials, privileges outside this policy, or a legacy-course mapping; remain pending.

## Final superadmin permissions — OWNER CONFIRMED 2026-10-19
- D-012: **Superadmin only creates lecturer accounts and distributes/withdraws course assignments.** Showing the minimal names/course IDs needed for those two actions is acceptable; there is **no right** to view or modify students, course enrollments, lectures, attendance, absence calculations, lecturer reports/exports or historical records.
- D-013: A lecturer can manage student enrollments and attendance **only within their assigned course(s)**; all enforcement must be by server-side ownership checks.
- D-014: Superadmin does **not** inherit all lecturer permissions. Role gates must explicitly deny access, even to direct URLs/API calls.
- D-015: Account self-service logout/profile and password change are universal identity functions, not academic/lecturer permissions. Do not assume superadmin may reset other users' passwords without explicit owner authorization.
- Still pending: Who creates the catalog of courses if none exist? Initial superadmin credentials must be chosen privately. Superadmin account not created yet.


## Implementation status after owner role decision (2026-10-19)
- D-016: New files `lib/permissions.js`, `lib/passwords.js`, `lib/admin-management.js`, `scripts/bootstrap-superadmin.js` implement reusable foundations, not a connected/live multi-lecturer app.
- D-017: The admin function for lecturer account creation generates a one-time strong temporary password; a doctor must change it at first login. Temporary password is NOT stored or logged as plaintext.
- D-018: No superadmin login/password was invented and no real account created in Neon. No exposure of student details in public GitHub.
- D-019: Keep app offline; the legacy JSON server still has a single shared doctor password and bypasses the new role module. Even with correct policy code, this prevents production deployment.
- GitHub Actions #39213860392 passed RBAC/admin/password/bootstrap tests; these do NOT prove the live API enforces role boundaries.

## D-020 — Course creation by superadmin — CONFIRMED 2026-10-19
- **Owner explicitly approved:** the main superadmin types a course name, creates the course catalog entry, then assigns the new course to a lecturer.
- This **supersedes** the earlier pending question about who creates the course catalog and earlier restriction denying `course.create`. The superadmin has this narrowly defined course-creation permission.
- All previous academic-data restrictions remain: no student rosters, lectures, attendance/absence, reports or exports, and no course edit/delete rights have been granted.
- Course name alone is required; duplicate-name, course-code, academic-term, rename/delete policies have NOT been approved. Do not impose a new uniqueness policy without further decision.
- The approval permits a server-side `course.create` and create-then-assign flow, not self-service lecturer signup or any new role privileges.
- Status: `lib/permissions.js` and `lib/admin-management.js` have an isolated implementation and tests. Legacy `server.js` still does **not** invoke them, so no live admin form/API or deployed site yet.


## D-021 — Operational boundary of new account portal (2026-10-19)
- `npm start` on the feature branch now runs **`server-v2.js`**, a PostgreSQL-backed role-restricted account portal (not legacy student attendance). Old `server.js` is kept only for migration/testing.
- The owner-approved superadmin operations (create doctor, create named course, assign/unassign) are served over authenticated v2 HTTP APIs and RTL UI. Doctor can change own password and list assigned course names only.
- This is **not** permission to deploy an incomplete live class attendance system. The prior student/lecture/check-in API is deliberately NOT exposed by the new server.
- No additional user-facing policy was assumed about name uniqueness, semester, report access, ID verification or course deletion.
- No first superadmin or real student records have been inserted; private admin email/password and Render workspace have not been confirmed.
- Tests passed with synthetic data only; real Neon bootstrap and production deployment are pending.

## D-022 — Student attendance identification — OWNER CONFIRMED 2026-10-19
- Student enters **BOTH seat/roll number AND full name** on the attendance page. Do NOT request a PIN, secret code or student password.
- Validate the pair server-side against the **student enrolled in that specific course** before recording attendance. Invalid/incomplete/mismatched pairs must not bind a device or create attendance.
- The student can edit or clear both fields, including after a locally saved typo. Corrections to previously recorded attendance remain subject to an authorized lecturer; browser changes do not rewrite history.
- Preserve meaningful ID leading zeros; normalize name to Unicode NFC, trim and collapse whitespace, but do not guess alternate spellings.
- Never provide an unauthenticated public ID-to-name lookup or publish the 172 real names/IDs in GitHub.
- This pair is personally known information, NOT secure proof of physical identity. Additional anti-impersonation mechanisms have not been approved; no new student PIN requirement.
- Implementation: legacy `server.js` and `public/student.html` updated on feature branch; `lib/student-enrollment.js` supports future course-scoped v2 lookups. **V2 check-in and actual class attendance are NOT deployed or implemented yet.**

## D-023 — V2 attendance integration boundary (2026-10-19)
- User instructed to proceed with the next implementation step, connecting QR and attendance to Neon-backed v2.
- Honour D-022: student enters full name AND seat/roll number only, no PIN/password. Students can edit both locally.
- Each QR is tied to a specific lecturer course and lecture; lecturer APIs require active course assignment. Main admin still cannot view student/attendance data.
- GPS and browser device identifiers are NOT reliable proof against deliberate spoofing, so the implementation must not be described as fraud-proof.
- Check-in enabled only explicitly with two separate strong secrets via private env, default OFF pending roster imports, permissions audit and operational testing.
- Migration 002 is additive and was applied on a database with zero student and attendance records; no real data moved.
- Keep rollout blocked until course roster management, backups, browser/mobile and live Neon tests are complete.

## D-024 — Lecturer course roster and private import safeguards — 2026-10-19
- Owner asked to implement adding/removing students per course and privately import original students to Neon.
- Soft removal is used: remove student from **this course's active enrollment only**, never delete global student identity or historical attendance. Re-adding a previously removed student restores that course enrollment.
- Global roll number is unique across student records; if a matching roll already exists with a different full name, return a generic conflict and do NOT rewrite identity or other courses.
- Only a logged-in **lecturer with an ACTIVE assignment** may read/write a course's roster. Superadmin remains forbidden from academic and student data, including roster APIs.
- Private bulk import uses an explicitly assigned lecturer UUID and course UUID, checks permissions under a locked DB transaction, dry-runs by default and writes only with `--apply`. The real roster will be imported only after course ownership/mapping is confirmed; no invented memberships.
- Separate `ROSTER_ENABLED` flag allows setting up a lecturer roster without enabling public QR attendance. Both default OFF.
- No student identity data, secrets, or user ZIP contents have been uploaded to public GitHub.
- **Still pending:** mapping 172 original records to one or more courses, first private superadmin setup, lecturer account and real source backup. Real Neon data import is NOT performed.


## D-025 — Initial 172-student course allocation — OWNER CONFIRMED (2026-10-19)
- The 172 valid real students in the original private roster should initially be enrolled into **one course only**, not automatically distributed to every course.
- Later, the *assigned lecturer* can enroll a pre-existing student in an additional course. The same global students row is reused by roll number + full-name match; enrollment in multiple courses is represented by separate enrollments rows, and historical attendance is preserved.
- **Superadmin can create courses and assign courses to lecturers**, NOT distribute students to courses or view any roster. This reinforces D-012/D-024: academic/student enrollment permissions are lecturer-only.
- Do not invent which course, its title, initial lecturer, or private superadmin credentials. As of last verified Neon state, all are absent. No real student import has been performed.
- Before import, superadmin privately creates one course, creates/assigns its lecturer, then the lecturer approves the roster mapping. Only then privately dry-run and apply the import against that one course.
- Additional courses later: their assigned lecturers can add existing students by roll number+full name, reusing identities; do NOT automatically copy the 172 names to unrelated courses.


## D-026 — Temporary first course name and future rename — OWNER APPROVED 2026-10-19
- The **initial course display name is `المقرر الأول (مؤقت)`**, selected as a reversible placeholder. The owner permits renaming this course later.
- Superadmin gains the narrowly scoped **`course.rename`** right, in addition to previously authorized lecturer creation, course creation and assignments. This **supersedes** earlier notes saying superadmin cannot rename a course.
- Rename changes only `courses.name` by existing course UUID. It must NOT modify UUID, course enrollments, assignments, lectures, attendance, historical data or lecturer academic permissions. Record an audit event.
- Do not grant deleting courses or editing student/attendance information. Lecturers cannot rename course catalog entries.
- Admin course creation form is prefilled with the placeholder; this is *not a database insertion*. Last verified Neon state had **zero superadmin accounts and zero courses**, and no real course, lecturer or 172-student roster has been inserted.
- After owner-selected superadmin is bootstrapped privately, the superadmin may create this named first course, assign it to a lecturer, and the lecturer can privately import the original 172 student records into this ONE course.


## D-027 — Initial superadmin and provisional course provisioned in Neon (2026-10-19)
- Owner explicitly requested **create the initial superadmin and send a generated temporary password to them**, then let them change it later. A random strong secret was created and **only the salted scrypt hash was stored in Neon**. Credentials must NOT be copied into any public GitHub source, docs, Actions, or artifacts.
- Bootstrap inserted exactly one superadmin, one course `المقرر الأول (مؤقت)`, and two audit events in one atomic database statement. Verified counts are 1 superadmin / 1 temporary course, 0 students / 0 lecturer assignments, audit count 2.
- A placeholder login ID was used because no real recovery email was supplied. It is not a functional inbox: email delivery/recovery is NOT available. Account login details were provided directly to the owner in chat, not in GitHub.
- Course ID and creator ID are stored in Neon, with valid foreign keys. Superadmin has NOT been granted any student/lecture/attendance access.
- Do not create a duplicate admin/course. Next: choose and create the initial lecturer account via the admin UI once hosted, assign course, privately import the 172-person roster to that course. No students were inserted, no public website deployed.


## D-028 — Direct owner-authorized initial import / deployment blocker — 2026-10-19
- The owner explicitly requested to add the 172 already-provided real students. One-time private database operator import inserted all 172 into `المقرر الأول (مؤقت)`, without requiring a fabricated doctor account and **without granting any student/roster permissions to superadmin**. It logged `enrollment.owner_initial_import` as an owner-requested maintenance action (actor null), not as an admin action.
- Verified count: 172/172 unique students/active course enrollments, no second-course enrollments, no attendance; full ordered name+roll checksum matched uploaded source. No PII/credentials were pushed to public source.
- The original superadmin temporary password was verified to match the stored scrypt hash. Website remains offline, no doctor account exists.
- Render Free workspace selection is blocked until explicit user confirmation that `ahmed's workspace` is the intended destination (only workspace listed). A safe blueprint was added but no live service or HTTPS URL created. Keep `ATTENDANCE_ENABLED=0` until further testing.


## D-029 — Render deployment route confirmed (2026-10-19)
- Owner authorized immediate automated deployment after original Go runtime error. Render connector offers create/free but no update-runtime/branch service action; create a **separate new free Node service** rather than changing the old service through unsupported API or destructive action.
- New canonical app URL is `https://bata-attendify-node.onrender.com/portal`; old `https://bata-yil7.onrender.com` still points to improperly configured Go/main and should be ignored.
- Private Neon DATABASE_URL placed in Render secrets, never committed. New service runs staff portal with `ROSTER_ENABLED=1`, `ATTENDANCE_ENABLED=0`. Keep student public QR check-in disabled.
- Independent GitHub Actions HTTPS smoke (#39258848867) verified Neon health, public login form, unauthenticated roster rejection and QR/legacy endpoints disabled.
- Live staff staging is NOT equivalent to full production student attendance readiness; do not claim password-change/login with real credentials tested yet.


## D-030 — Separate UI entry points without weakening privacy (2026-10-19)
- User approved redesign without design constraints. Added public home / and role entry /admin /lecturer, retaining shared server-side role verification and per-course lecturer DB authorization; staff HTML is shared but view selection is role-specific. Client navigation does NOT confer access.
- A no-identity /student guidance page is public, but /checkin and POST attendance remain disabled until explicitly enabled after tests. No real student PII in public repo/static pages.
- Optimize mobile roster UX with simple in-browser filtering and 20-row paging for authorized lecturer data; no cross-course public search API. Eliminate inline styles that conflict with CSP and use safe textContent everywhere.
- The existing Render service uses autoDeploy OFF, so we manually deployed the successful CI-tested UI version; verified status Live and independent external HTTPS smoke.


## D-031 — Three user gateways with server-side role authorization (2026-10-19)
- User expressly rejected prior experience as "gate مش مقسومة 3" and reported password-change crash. We keep the same secure staff backend but visually divide entry into three role-specific choices: admin login via /admin, lecturer login via /lecturer, and student no-login QR guidance via /student. HTML role-card links and JS role intros highlight selected role. Distinct navigation does not create a student account or any new role permissions.
- Real DB error SQLSTATE 42P08 caused prior password changes to fail entirely; fix audit bind types without manually resetting user credentials or editing existing Neon student data.
- Critical operational limitation: GitHub Actions simulated HTTP tests and public live smoke passed; authenticated live user password-change needs user's independent browser retry. No real QR attendance is enabled.


## D-032 — Owner-authorized superadmin lecturer password resets (2026-10-19)
- Owner approved allowing superadmin to reset a lecturer's password. This is a **one-way reset**, not retrieval or display of previous password, and never direct account impersonation.
- Superadmin selects a specific active lecturer and confirms. Generate fresh high-entropy temporary password, store only salted scrypt hash, require lecturer to change password on next sign-in, revoke all existing lecturer sessions, log actor/target but never the password. Only superadmin can invoke. Invalid lecturer ID, missing/disabled target or admin target fail closed. No new academic access granted.
- One-time display and clear in admin UI. The lecturer must receive the password through a trusted channel. Keep student roster and attendance data private.
- Tested with fake PostgreSQL, including transaction rollback and typed audit parameters; manual real credentialed reset must be initiated by owner. Deployed to same Render Free Node service with Live status.


## D-033 — Lecturer-only closed-lecture attendance & absence reports and real XLSX (2026-10-19)
- Implement attendance reporting as a **read-only course-scoped feature**, even when live QR attendance is disabled. Reports require a verified lecturer session, completed initial password change and an active `lecturer_courses` assignment. Superadmin cannot view or export any roster or attendance record.
- Denominator is the number of **closed, non-archived lectures** on/after the student's enrollment timestamp. Open, archived and pre-enrollment lectures do not create absences; if no eligible lectures, percentage is unknown (null / —) rather than 0%, and absence is 0. Current active course enrollments form the roster; removed students are not included in current-roll reporting, though historical attendance remains in DB. This policy requires academic owner review before grading.
- Export is genuine Excel .xlsx (ZIP/OpenXML, three Arabic sheets: student summary, lecture summary and per-lecture attendance matrix), not mislabeled CSV; preserve leading-zero roll numbers as text, escape XML and never emit formula cells. No new third-party dependencies or on-disk exports.
- UI has dedicated lecturer reports section with per-course selection, search, 20-row display paging and authenticated download. Export is no-store and contains personal information; user is instructed to store securely.
- QR/real student check-in flag stays off until mobile/GPS/security and backup tests. No database write or student migration in reports deployment.


## D-034 — Non-destructive lecture archiving and override-based attendance corrections (2026-10-19)
- Owner requested continuation of lecture management with audit. Treat archiving as reversible and permitted only after lecture is closed. Archive hides lecture from active reports but retains raw attendance. Restore must not reopen the lecture or enable an old QR token.
- A lecturer with active course assignment may correct one enrolled student's attendance in a **closed unarchived** lecture only, with a mandatory 5–500-character reason. Store an overlay `attendance_corrections` row, not a hard DELETE or UPDATE of QR attendance. Maintain append-only audit with actor, target lecture/student UUID, prior override status, new status and reason. The report/Excel uses override as effective attendance.
- Superadmin does NOT see or modify academic data. Unassigned/disabled/forced-change lecturers are denied. Archived lectures cannot be corrected; neither can unenrolled students. URL-scoped lecture ID is authoritative over any client body.
- Migration v3 is additive and was applied safely to production Neon. No real student check-in has occurred. Public QR remains disabled.
## D-035 — A private internal Neon recovery branch is not an offsite backup (2026-10-19)
- Created a `no_compute` copy-on-write branch `backup-pre-attendance-2026-10-19` in the same Neon project, parent production `main`, ready at LSN `0/1DC9EF0`. This gives a pre-QR restore source without starting compute.
- Do not treat this as a separate encrypted offsite dump; backup/restore-drill and recovery plan documented. Never overwrite production from backup without explicit owner approval.
