# حاضر — Attendify (Bata)

A role-restricted Node.js attendance management project. The GitHub repository is **Public**, but production students, user credentials and attendance history must stay in private storage.

## Current branch — admin portal v2 (development only)

The default `npm start` now runs **`server-v2.js`**, the database-backed lecturer-account portal. It **does not** expose the legacy `server.js` attendance API.

Implemented and tested with synthetic users:
- Email/password login with salted `scrypt` hashes and 12-hour revocable database sessions.
- Single superadmin account bootstrapped privately (never by default).
- Superadmin creates lecturer accounts, creates courses by name, assigns/removes lecturer-course relationships.
- Lecturer sees **only** the catalog of their own assigned courses.
- Both roles can change their own password; old sessions are revoked.
- Origin checking for POST, secure production cookies, strict CSP and no-store API responses.
- Safe `/healthz` endpoint checks database connectivity.

**Not yet built:** actual lecturer course attendance/enrollment/lecture management in v2, student QR/GPS check-in, Excel export, real student import and backups. Do NOT deploy to live classes or expose real student rosters until these are finished.

## Local portal configuration

Requires Node.js >=18, PostgreSQL schema in `db/001_initial.sql`, and a **private** Neon PostgreSQL connection string:

```sh
npm install
# Set DATABASE_URL in a private environment, never in Git.
# Set PUBLIC_ORIGIN to the exact HTTPS URL when NODE_ENV=production.
npm test
npm run test:syntax
npm start
```

Visit `/portal` (login/admin/lecturer roles). Create initial superadmin securely with `npm run bootstrap:superadmin` using `INIT_ADMIN_EMAIL`, `INIT_ADMIN_NAME`, `INIT_ADMIN_PASSWORD` and `DATABASE_URL` configured privately. Never check those environment values into Git, paste them into issues, or put student data in public web assets.

[Portal architecture](docs/PORTAL_V2.md) · [Review tasks](docs/TASKS.md) · [Owner decisions](docs/DECISIONS.md) · [Privacy/deployment](docs/DEPLOYMENT.md).

## V2 QR attendance development note (2026-10-19)
- New mobile page: `/checkin?t=<signed-QR-token>` (when `ATTENDANCE_ENABLED=1`).
- Lecturer dashboard can create a class lecture, show auto-updating QR and close it. Student must type **seat number and full name**, with GPS. No student PIN.
- This new feature is **OFF by default** and unprovisioned. Neon student roster is still empty, so it is NOT a deployable live class app. Documentation and required private environment variables are in [ATTENDANCE_V2.md](docs/ATTENDANCE_V2.md).


## Verified cohort import and current deployment status
The approved original **172 private students** have now been imported into the ONE provisional course `المقرر الأول (مؤقت)` in Neon (172 unique active enrollments, 0 attendance), with a source-integrity match. Their identities are not present in public GitHub.

The site is **not live yet**. `render.yaml` provides a Render Free staff-portal template, but Render workspace choice needs the owner's explicit confirmation. Initial deployment must keep public QR attendance disabled (`ATTENDANCE_ENABLED=0`) until further review. See `docs/DEPLOYMENT.md` and `docs/PRIVATE_ROSTER_IMPORT.md`.


## LIVE HTTPS STAFF PORTAL (2026-10-19)
The account/lecturer staff portal is now deployed at **https://bata-attendify-node.onrender.com/portal** on a **new Render Free Node service** connected to Neon PostgreSQL. The separate old Render service named Bata has a misconfigured Go runtime and must not be used. The live deployment passed a public HTTPS/Neon/database health and unauthorized-endpoint smoke test ([GitHub Actions #39258848867](https://github.com/AM-naguib/Bata/actions/runs/39258848867)).
- `ROSTER_ENABLED=1`; real 172 students are in the private Neon database, not GitHub. Only a lecturer assigned to the first course may view their roster.
- `ATTENDANCE_ENABLED=0` so student QR check-in remains disabled pending security/operational testing.
- Admin should log in using the temporary password already provided privately, change it immediately, then create a lecturer account/assignment. Do not copy any credentials into repository files.
- No automated deployment on each commit (Render autoDeploy off), no GitHub main merge. See `docs/DEPLOYMENT.md` and `docs/TASKS.md`.


## Updated Arabic RTL interface — LIVE 2026-10-19
- **Homepage:** https://bata-attendify-node.onrender.com/
- **Superadmin:** https://bata-attendify-node.onrender.com/admin
- **Lecturer:** https://bata-attendify-node.onrender.com/lecturer
- **Student guidance:** https://bata-attendify-node.onrender.com/student
The staff portal includes role-based navigation, admin lecturer/course/assignment workflows, security/password change and lecturer-only searchable paginated roster (20/page). The student page is a safe informational guide only; QR attendance/check-in are still OFF. **Never put student data or temporary passwords in the public repo.**
This release passed both [security CI](https://github.com/AM-naguib/Bata/actions/runs/39263443641) and [live HTTPS smoke test](https://github.com/AM-naguib/Bata/actions/runs/39263443594). Render service deployment is LIVE, but real-user account sign-in and lecturer/student use still need manual acceptance testing.


## Superadmin reset of lecturer login — live 2026-10-19
At https://bata-attendify-node.onrender.com/admin, superadmin opens **حسابات الدكاترة** and selects **إعادة تعيين الباسورد** beside an existing lecturer. After confirmation, a fresh random temporary password appears once. Old sessions and password become invalid; lecturer must change the temporary password on first new login. No current password lookup is available, and administrators do not get academic/student access. Existing accounts and private 172 students were not modified by this release.
