# User-requested improvements — 2026-10-19

Scope: Attendify student and lecturer interfaces, with future per-course rosters and per-lecturer accounts. No changes should silently alter historical attendance, grade policy or access rights.

## Confirmed requests (verbatim interpreted conservatively)
1. Student: show the **student name next to the seat/roll number**, and provide an obvious option to edit/correct a number that was previously remembered locally.
2. Lecturer: ability to remove a lecture created by mistake.
3. Lecturer: add/remove enrolled students for an individual course, without modifying unrelated courses.
4. Lecturer: fields for lecturer name and course name alongside a lecture.
5. Lecturer: save attendance as an Excel sheet.
6. Lecturer: personal account for each lecturer, with account management and password change.

## Safe implementation boundary
- Student UI: permit editing/resetting locally remembered ID with no automatic attendance submission.
- Do not expose a bulk student directory or unrestricted ID->name lookup via public API until an authentication/privacy strategy is settled.
- Lecturer/subject metadata may be collected as free text in a lecture draft initially. Relationship to lecturer accounts and course identity must be decided before rolling out multi-user reporting.
- Lecture deletion: cannot silently delete attendance or alter absence counts; deletion semantics and recovery choice need approval.
- Course roster changes: require server-enforced lecturer permissions, audit trail, and preservation of historical attendance.
- Account creation: no public self-registration/admin invite policy invented here. Passwords must be salted, slow-hashed and never stored in plaintext.
- Excel: current report CSV opens in Excel but isn't native .xlsx; owner needs to confirm .xlsx vs CSV.
- Public repo contains NO real student records or password data.

## Questions needing owner's product decisions
1. **Lecturer onboarding:** Does an administrator create accounts and assign courses, or can lecturers register themselves? If admin, who owns the first super-admin account?
2. **Deleting a lecture with existing attendance:** should this archive/hide the lecture reversibly (recommended, preserves audit history), or permanently erase it including student attendance?
3. **Student name display:** before or after QR verification/login? A public ID->name endpoint exposes student names to guessers. Should the student enter a private code, or should the name be shown only to already-verified students? Choose one identity protection mechanism.
4. **Student correction after attendance already recorded:** should editing the number just affect this device, or should lecturers be able to correct attendance records and rebind a device?
5. **Excel:** actual .xlsx, or is Excel-compatible .csv sufficient? Should files be per course/lecturer, or an all-course report?

## Dependencies
Multi-doctor permissions and per-course rosters require persistent schema changes (Neon Postgres from previous hosting choice), migration of the existing single roster, safe provisioning/import of real names/IDs, and end-to-end tests. The free website is not launched.

## Implementation status
- Original `public/student.html` is absent on the prior GitHub branch; uploading an enhanced privacy-conscious replacement is an outstanding task.
- New work is isolated on `feature/teacher-student-improvements`, not deployed to production.

## Delivered subset (verified CI #39210678172)
- Added editable saved roll number with reset button; updated number is persisted only after successful attendance.
- Full name shown only after attendance success, not a pre-registration identity lookup (decision needed).
- Lecturer name and course title captured per lecture and shown in reports/CSV and live view (just free-text metadata, no authenticated lecturer association).
- Reversible deletion of mistaken empty lectures, attendance-bearing lectures protected from deletion.
- Student page restored to new feature branch. PR #2 is Draft and should not be deployed/merged until core architectural work is complete.

## Confirmed follow-up: admin course creation (2026-10-19)
Before assigning a lecturer, the main superadmin enters a course name and creates it. This is the **only newly authorized course management operation** for superadmin; no lecture/student/attendance access. Implemented in permissions and administrative DB functions, awaiting secured HTTP/UI integration.

## Confirmed identity inputs (2026-10-19)
Owner corrected repeated misunderstandings: student types **seat/roll number AND full name** (both required). They are editable/correctable. No extra PIN or secret code. Use the pair to validate course enrollment server-side before attendance. Do not expose public lookup of names from roll IDs. The pending plan for password-based student authentication is NOT approved.
