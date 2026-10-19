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
