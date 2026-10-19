# Superadmin-managed lecturer accounts — 2026-10-19

## Owner-approved policy
- **One superadmin** creates individual lecturer accounts and assigns each lecturer to their own courses.
- Lecturers must not create other lecturer accounts or assign courses to themselves.
- Each lecturer must only manage the students, lectures, attendance and reports of courses assigned to that lecturer.
- All accounts may change **their own** passwords after re-authentication. Whether superadmin can reset a lecturer password is NOT approved; deny by default.
- Public GitHub must never contain real student records, passwords, session tokens, or DB connection strings.

## Implemented infrastructure
- Neon Free project: `bata-attendify` (project ID `wandering-mode-56487150`, database `attendify`).
- SQL schema `db/001_initial.sql` created and checked as 10 actual tables in Neon; all were empty on creation. No real student information or user credentials inserted.
- GitHub branch `feature/superadmin-accounts-courses` branches from `feature/teacher-student-improvements`.
- Schema supports unique superadmin, lecturers, courses, lecturer/course assignments, students, enrollment per course, lectures, attendances, hashed sessions and audit events.
- SQL schema is not connected to existing Node server yet: it still uses JSON and a shared DOCTOR_PASSWORD. **Do not deploy as production.**

## Security and implementation requirements
- Bootstrap first superadmin via a one-time command/configured secret or secure administrative flow, not with embedded credentials.
- Password hash: scrypt/Argon2id + unique random salt, constant-time checking; never plaintext.
- Sessions stored as hashes with expiry and revocation; cookies Secure, HttpOnly, SameSite and server CSRF defenses.
- Every lecturer API call must check authenticated user ID and **active** lecturer_courses assignment; never trust user-supplied lecturer ID/course ID.
- Superadmin only: create lecturer account, **create course by typed name**, list lecturer identities for assignment, view minimal course catalog identifiers, list/grant/revoke lecturer-course assignments. **No** course edit/archive/delete, student roster, lecturer attendance/report, lecture access, or other lecturer account editing/reset granted without a separate owner decision. Log management changes in audit_events.
- Course enrollment is separate from the global student directory. Removing an enrollment must not delete historical attendance.
- Migrate old JSON data only after backup and identity/course mapping decisions; no migration has happened.
- SQL migrations must be additive and have synthetic-data tests before production use.

## Pending decisions
- Superadmin display name and login email; choose their password through a private setup process, **not via chat or GitHub files**.
- **Resolved**: superadmin is explicitly forbidden from viewing or modifying attendance, student lists, lectures or reports, even via direct APIs.
- Whether a lecturer may have multiple courses (schema supports this, not yet approved as policy).
- How legacy single-course historical lectures should be mapped into course records.
- Recovery route when the superadmin loses access. Course creation by the superadmin is now confirmed; no password reset-by-email flow implemented.

## Next steps
1. Implement PostgreSQL persistence and DB-backed identity/auth routes.
2. Implement superadmin-only lecturer/course/assignment endpoints and UI.
3. Implement lecturer-only course/attendance management plus own-password change.
4. Test direct API access with 2 lecturers, including cross-course denied and revoked assignments.
5. Only then create a private superadmin and authorize deployment.

## Exact authorization boundary
- Superadmin: `lecturer.create`, `lecturer.list`, `course.create`, `course.catalog.list`, `assignment.list`, `assignment.grant`, `assignment.revoke` only, plus personal login/logout/password change. No broad `admin:*` privileges.
- Lecturer: `course.list.assigned`, course-scoped lecture and attendance operations, course-scoped student roster management and academic export, plus personal account actions.
- Superadmin cannot export Excel, inspect QR attendance, access `/api/report` or any student roster. Logging and testing must prove denial by direct HTTP request.


## Foundations implemented but NOT yet active (2026-10-19)
- Auth/authorization foundation: `lib/permissions.js` (role boundaries + verified course membership), `lib/passwords.js` (salted scrypt), `lib/admin-management.js` (superadmin-only DB functions).
- Private first-admin bootstrap: `scripts/bootstrap-superadmin.js` (reads DATABASE_URL and INIT_ADMIN_* variables, refuses second superadmin, writes audit entry).
- Node test suite: `test/permissions.test.js`, `test/passwords.test.js`, `test/bootstrap.test.js`, `test/admin-management.test.js`; GitHub Actions run #39213860392 passed.
- **NOT DONE:** No initial superadmin created, no API/UI integration, no lecturer sign-in, no switch-over from JSON data, no deployment. The current old server **does not enforce these permissions**.
- Avoid handling superadmin password in chat, PR, CI logs or public GitHub. One-time bootstrap must happen in a trusted private environment.
- Current administrative actions allow lecturer creation, **course creation by name**, metadata listings, assignment listings/grants/revocations, plus own-profile actions. No course edit/delete, no password reset of other users, no academic data reads/writes.

## Course creation workflow — confirmed by owner 2026-10-19
1. Main superadmin types course name and submits.
2. Server validates the name, inserts into `courses` with `created_by` set to authenticated superadmin and writes `audit_events` in the same transaction.
3. Superadmin selects existing lecturer and the course ID to create or restore an assignment.
4. If no lecturer is assigned yet, the course stays in the catalog; the lecturer cannot see or manage it.
5. This is a **data-layer implementation only** until identity-backed API and UI are connected. The current shared-password app must not be used for this feature.
