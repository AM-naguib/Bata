# Private per-course student roster setup — 2026-10-19

## Status
- Lecturer student roster UI and API implemented on **feature/superadmin-accounts-courses**, not merged/deployed.
- Name and roll number stay PRIVATE: never commit the original real `students.json`, copied ZIP, database dump, connection URL or secret variables.
- Original owner-supplied `attendify.zip` inspected **locally only**: one `attendify/students.json` file with **172 records**, each with `id` and `name`, **zero missing fields**, **zero duplicate roll numbers**. No student identifying value is disclosed here.
- Neon Free `bata-attendify` currently has **0 accounts, 0 courses, 0 lecturer assignments, 0 students, 0 enrollments**. Do NOT write the real roster yet; there is no course or authorized lecturer to assign the rows to.
- Actual private import is **not executed**. The script is staged and tested with synthetic rows only.

## Lecturer web workflow
1. Superadmin creates a course and lecturer account, then assigns that course to that lecturer.
2. Private v2 server is configured with `ROSTER_ENABLED=1`. This is independent from `ATTENDANCE_ENABLED`: the student public check-in can remain disabled.
3. Lecturer logs in (and completes mandatory initial password change).
4. In `/portal`, choose **طالبات المقرر**, select assigned course, enter roll number and full name, press add.
5. To remove a student, choose **إزالة من المقرر** and confirm. Only the **active enrollment** is ended; the global student record and historic attendance are retained. Re-adding the same student restores their enrollment.
6. The server verifies the logged-in lecturer and their current assignment from Neon *inside the database transaction*. Other lecturers and superadmin receive HTTP 403, anonymous users receive 401. No public roster endpoint exists.

## Private bulk import (no website upload or public GitHub data)
The one-time script accepts a **private JSON array** like `[{ "id": "00001", "name": "Synthetic Name" }]`; the real file is **not** included.

**First:** Prepare a private absolute path outside the public Git checkout. For the original ZIP, extract `attendify/students.json` into an access-controlled private folder on the trusted machine. Never commit this file to Git, open a PR containing it, paste its content into chat, or place it under `public/`.

Then, on a trusted computer/server:

```sh
# No DB writes, no DATABASE_URL required:
IMPORT_FILE=/absolute/private/students.json npm run import:students

# ONLY after a lecturer, course and active assignment exist in Neon:
# Configure DATABASE_URL, IMPORT_FILE, IMPORT_COURSE_ID and IMPORT_LECTURER_ID
# through the private runtime/secret manager, not checked-in files.
npm run import:students -- --apply
```

- The default mode validates source rows, preserves leading zeros and reports **only count**.
- `--apply` is required for writes. The script checks that the given lecturer is active, has changed their temporary password and is assigned to that course. It performs a **single Postgres transaction**, so any mismatch/duplicate conflict aborts the complete import rather than partly enrolling the class.
- Existing roll numbers with a conflicting full name cannot be silently overwritten. Multiple courses may enroll the same student without duplicating the student identity. Running the import again **re-enrolls** students previously removed from that course, so check with the lecturer before reapplying.
- The audit event includes lecturer/course IDs and import count, never students' names or entire rosters.
- No sensitive student data appears in GitHub Actions or test fixtures. Tests use invented identities only.

## Before actual import
1. Bootstrap one superadmin privately with a user-chosen email, display name and strong password. None has been created yet.
2. Sign in as superadmin to create real course and lecturer account, and grant assignment.
3. Lecturer changes their initial temporary password, confirms which course gets the 172 existing students, and validates the source privately.
4. Back up the source file and set a recovery procedure for Neon. Run dry-run and obtain course/lecturer consent.
5. Run the private apply command; verify enrolled count from **lecturer's own** authenticated view, not a public roster link.

## Remaining limitations
No production service exists yet. The `ROSTER_ENABLED` / `ATTENDANCE_ENABLED` flags are OFF unless explicitly enabled. Actual Neon import has not been performed and cannot be bound to a course while Neon holds zero real courses. Native Excel XLSX export, attendance reports, robust anti-impersonation measures, backups, end-to-end browser testing and launch remain pending.


## Owner's initial allocation decision (2026-10-19)
The first real import should enroll **all 172 students in ONE explicitly selected course** only. Do not automatically add these students to other courses. When a lecturer subsequently has another assigned course, the lecturer can add matching pre-existing students to that course using roll number + full name; `students` is global, while `enrollments` is per course. The superadmin has **no** permission to read names, bulk-import students or redistribute student enrollments. Superadmin creates the first course and assigns it to a lecturer, who then authorizes the private import. The real course name and lecturer identity remain unprovided; don't invent them.


## First course label ready for setup — 2026-10-19
Use **المقرر الأول (مؤقت)** as the first course *name* once the owner privately sets up the superadmin. The name is editable later by the superadmin and the course UUID stays fixed, so active enrollments, attendance and lecturer assignments remain linked. This is a UI default/approved plan, not an actual existing Neon course. Import the 172 records only after the first lecturer is created/assigned and source is backed up. Do not bypass the superadmin account requirement to manufacture a course.


## Database setup progress — 2026-10-19
- Real Neon now has ONE superadmin and ONE pre-created course named `المقرر الأول (مؤقت)`, established atomically with two audit events. No real student data was imported.
- Before importing the 172 rows: create the initial lecturer under the real superadmin, assign this existing course, ensure lecturer changes their initial password, then run private dry-run and atomic import. The import script requires active lecturer-course assignment and currently that assignment does not exist.
- The login account currently uses a placeholder identifier without an inbox. Never put any real credential, its hash, or student PII into this repository.


## Actual owner-authorized one-time import — COMPLETED 2026-10-19
- The 172 records from the previously uploaded, private `attendify.zip` were inserted directly into the existing private Neon database, into **only** `المقرر الأول (مؤقت)`.
- A single atomic SQL operation validated count, uniqueness, conflicts and active course mapping and recorded an audit event without any student names or roll numbers in public GitHub.
- Read-only verification: **172** global students, **172** active first-course enrollments, **0** other-course enrollments and **0** attendance; full ordered roster checksum matches the original file.
- The tool `scripts/import-roster.js` remains useful for future authorized imports, but the *initial cohort is already imported*. Do NOT run the same 172-person import again unless the owner intentionally wants to restore enrollments (may re-add previously removed students).
- Next: user confirms Render workspace, HTTPS staff portal is deployed, admin creates and assigns a real lecturer. Lecturer can then see and manage this existing roster through their authenticated course view. Superadmin must not receive roster access.
