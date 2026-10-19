# Portal v2 — account management integration

Date: 2026-10-19. Branch: `feature/superadmin-accounts-courses`.

## Delivered in this development branch

- `server-v2.js` is now the default `npm start` target, using the private `DATABASE_URL` PostgreSQL connection string.
- `lib/http-app.js` serves a server-session-authenticated v2 API with explicit deny-by-default role authorization.
- `public/portal.html`, `app-v2.css`, `app-v2.js`: mobile-friendly RTL admin/lecturer portal with login, creation and assignment forms.
- No legacy `/api/login`, `/api/attend`, `/api/report`, `/doctor` admin API is accessible through the new server (old `server.js` is still present for historical migration/testing but not started by npm).
- `test/http-portal.test.js`: fake Postgres data end-to-end HTTP integration tests using real HTTP requests and synthetic accounts. `npm test` plus syntax checks are run by GitHub Actions.
- Actual Neon Free project `bata-attendify` has 10 schema tables. Read-only verification returned **0 account / 0 course / 0 student / 0 assignment** records. No credentials or student names inserted.

## Routes

| Method | Route | Permission |
|---|---|---|
| GET | `/portal` | Static login/role UI |
| GET | `/healthz` | Database readiness check, no private data |
| POST | `/api/v2/login` | Email + password |
| GET | `/api/v2/me` | Authenticated self profile |
| POST | `/api/v2/logout` | Revokes own session |
| POST | `/api/v2/password` | Reauthenticate and change own password; revokes all sessions |
| GET/POST | `/api/v2/lecturers` | Superadmin minimal lecturer list / create |
| GET/POST | `/api/v2/courses` | Superadmin minimal course catalog / create |
| GET/POST | `/api/v2/assignments` | Superadmin list / grant lecturer-course mapping |
| POST | `/api/v2/assignments/revoke` | Superadmin revoke assignment |
| GET | `/api/v2/lecturer/courses` | Lecturer's assigned course labels **only** |

Superadmin may create lecturer accounts/courses and grant/revoke assignments only; no student/lecture/attendance reports or academic mutations. Lecturer cannot use admin APIs. All privileged requests are rechecked on the server against a session loaded from PostgreSQL; the client cannot claim a role.

## Safe first-account setup (NOT DONE)

1. Configure a private DATABASE_URL to the existing Neon project in a trusted machine or the hosting provider's secret manager.
2. Configure `INIT_ADMIN_EMAIL`, `INIT_ADMIN_NAME`, and a unique strong `INIT_ADMIN_PASSWORD` locally (never in public GitHub).
3. Run `npm run bootstrap:superadmin` **once**. It aborts if another superadmin exists.
4. Remove the bootstrap password from temporary environment/command history.
5. Launch the portal with `npm start` and `PUBLIC_ORIGIN=https://your-domain` when production HTTPS is active.
6. Superadmin signs in and creates lecturer/course assignments. Teacher must change temporary password on first login.

This is a **setup outline only**. No real account has been created or production launch performed.

## Remaining release blockers

- Connect and test against actual Neon with a private superadmin, including secured cross-role HTTP smoke tests.
- Lecturer course-scoped students, enrollments, lectures, attendance/check-in, QR/GPS, report/Excel and audit/history migration have NOT moved to v2.
- Student UI fields are now confirmed: **roll number + typed full name**, no extra PIN. Handling device swaps and spoofing still needs safeguards.
- Data backups and recovery, production load tests, rate-limiter under shared classroom IPs, and deployment workspace confirmation needed.
- Front-end browser end-to-end tests, accessibility and actual deployment remain outstanding.

Current state: **Admin portal preview implementation only; no live website.**

## Student input form and future v2 check-in
- `public/student.html` and legacy `server.js` now require both student ID and typed full name, with an edit/reset button and server roster check before saving attendance.
- The v2 portal intentionally does not serve the legacy student route. Shared `lib/student-enrollment.js` prepares a private Neon active-course roster match (no public ID-to-name lookup); no v2 QR attendance/check-in endpoint is integrated yet.
- Never deploy the old legacy server publicly as a workaround.
