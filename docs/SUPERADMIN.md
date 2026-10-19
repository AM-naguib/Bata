# Superadmin-managed lecturer accounts — 2026-10-19

## Owner-approved policy
- **One superadmin** creates individual lecturer accounts and assigns each lecturer to their own courses.
- Lecturers must not create other lecturer accounts or assign courses to themselves.
- Each lecturer must only manage the students, lectures, attendance and reports of courses assigned to that lecturer.
- All accounts may change their own passwords, subject to re-authentication; superadmin can initiate a secure password reset.
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
- Superadmin-only lecturer CRUD, course CRUD, assignments and account disable/reset. Log changes in audit_events.
- Course enrollment is separate from the global student directory. Removing an enrollment must not delete historical attendance.
- Migrate old JSON data only after backup and identity/course mapping decisions; no migration has happened.
- SQL migrations must be additive and have synthetic-data tests before production use.

## Pending decisions
- Superadmin display name and login email; choose their password through a private setup process, **not via chat or GitHub files**.
- Whether the superadmin can directly edit attendance or only manage lecturers/courses.
- Whether a lecturer may have multiple courses (schema supports this, not yet approved as policy).
- How legacy single-course historical lectures should be mapped into course records.
- Recovery route when the superadmin loses access. No password reset-by-email flow has been implemented.

## Next steps
1. Implement PostgreSQL persistence and DB-backed identity/auth routes.
2. Implement superadmin-only lecturer/course/assignment endpoints and UI.
3. Implement lecturer-only course/attendance management plus own-password change.
4. Test direct API access with 2 lecturers, including cross-course denied and revoked assignments.
5. Only then create a private superadmin and authorize deployment.
