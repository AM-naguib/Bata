# Website launch checklist — NOT PRODUCTION READY

The repository is **Public by owner's request (2026-10-19)**. GitHub Pages serves static websites and does **not** host the Node.js API in `server.js`. Hosting provider is pending user decision. Use a Node-compatible host with HTTPS and durable private storage.

## Keep student records separate from public GitHub
- `students.json` from the uploaded ZIP contains 172 real records. It has NEVER been pushed to this repository.
- `students.example.json` is a synthetic **example only**. Production needs the real roster supplied securely to the running server.
- Current code reads `./students.json` at startup. Provision it as a private runtime file before starting the app. On some hosts, a secret file or private volume can do this; details depend on the chosen provider.
- Do not expose student JSON under `public/`, paste it into Github Actions, upload it as a GitHub Release artifact, or embed student records in an HTML page.
- `data.json` holds attendance/device records; keep it on persistent private storage with verified backups, not in a git checkout or ephemeral filesystem.
- `.gitignore` only prevents future accidental additions. Before every commit/release verify `students.json`, `data.json`, `.env`, and student names do not appear in the diff/history.

**FEATURE BRANCH:** public/student.html was restored on `feature/teacher-student-improvements` and test GET `/` passed. Parent audit branch remains incomplete until merged.\n\n## Temporary local smoke test (synthetic roster ONLY)
1. `cp students.example.json students.json` or use a separate synthetic roster.
2. Set `DOCTOR_PASSWORD` to a *non-default strong password*. Never use the source-code fallback `1234`.
3. `npm start` (Node.js 18+); visit `http://localhost:3000` for student UI, `/doctor` for lecturer.
4. Delete the synthetic `students.json` afterward. No production deployment with current vulnerabilities.

## BLOCKERS to production launch
- T-02 default admin password; T-03 login brute force; T-04 student impersonation threat model; T-05 GPS input validation; T-06 stored XSS; T-07 data integrity; T-09 mutation routes/session security; T-10 logout/secure cookies.
- Clarify T-08 absence policy, T-14 device-binding policy, and choose a hosting/storage solution T-17.
- HTTPS required for browser geolocation and camera outside localhost.
- Choose data durability, backup and restore plan BEFORE recording any real attendance.
- Test on real devices with synthetic IDs and real classroom network (multiple users may share an IP).

## Selected free-tier prototype architecture
- **Compute:** Render Free Web Service; Node server requires a running compute service, GitHub Pages cannot host it. Cold starts after 15 min idle can take about one minute; it has no persistent disk. Reference: https://render.com/docs/free
- **Data:** Neon Free PostgreSQL, provision database independently from the GitHub repo and keep DATABASE_URL secret in Render's environment variables. Neon reported 1 GB/project in October 2026: https://neon.com/blog/neon-free-plan-1-gb-per-project . Confirm ongoing compute/data quotas.
- **Code work required:** Migrate local JSON `students.json` and `data.json` reads/writes to transactional Postgres tables with indexes and data-preservation tests; add secure provisioning/import for the real 172 student records, with no rows in Git. Do not add DATABASE_URL or student records to committed config.
- **Cost/reliability:** Both plans advertise $0 under quota; cold starts, suspended accounts, resource caps or terms changes mean these are prototype tiers. Configure billing to avoid unintended charges and devise a safe restore/export procedure.
- **Safety gate:** Private student roster, strong admin auth, anti-spoofing policy, cookies/CSRF, HTML escaping, reliable writes and browser E2E must be addressed before live classes.

## Hosting connection still needed
- Render and Neon need to be connected/provisioned under an authorized account. Nothing has been deployed.
- `feature/teacher-student-improvements` has a student page verified in CI #39210678172; the base audit branch does not have it. Keep PR Draft; verify full file completeness before any deploy.
- Do not enable automatic deployment of the unremediated audit branch.

Change control: see `docs/DECISIONS.md`. Fixes require tests and reviewed PR, with each issue tracked in `docs/TASKS.md`.

## Current code readiness — 2026-10-19
- Source on audit branch includes security fixes for default password, GPS validation, corrupt JSON startup, GET mutation and admin UI injection, with partial authentication measures.
- GitHub CI now runs the synthetic test suite; inspect Actions results before relying on branch changes.
- **Do not deploy**: no Neon integration, remaining identity fraud & CSRF risks, multi-account authorization, and no private data import path. Student page now restored on feature branch.
- The Render + Neon ChatGPT apps were installed, but provisioning actions were not exposed to the assistant in this session. No service was created.


## Current deployment target — admin portal v2 (2026-10-19)
- The branch `feature/superadmin-accounts-courses` now defaults to `node server-v2.js`. Requires a private `DATABASE_URL`; production mode additionally requires HTTPS `PUBLIC_ORIGIN`.
- The v2 portal intentionally has no student attendance endpoints yet. It is **not suitable for live student use**. Do not connect a public class QR until course-scoped attendance and backup are implemented.
- Actual Neon Free database schema exists and is empty; the existing student JSON data has not been uploaded.
- Render free workspace has not been selected or provisioned. Never put connection strings, student records or admin secrets into a public repository.
- Detailed setup, routes and blockers: [Portal v2](PORTAL_V2.md).

## Current QR implementation limitation — 2026-10-19
- V2 has implemented gated lecturer lecture + student QR attendance but production feature flag is OFF. The real Neon DB has migration 002 / hashed-device unique index, and **zero student or attendance rows**.
- Never deploy live until lecturers can manage private per-course rosters, backup and recover attendance, and the platform passes mobile/GPS and HTTP security tests. Private QR/device keys and HTTPS origin required to enable.
- Legacy `server.js` stays offline. See ATTENDANCE_V2.md for routes and risks.

## Private roster launch gate — 2026-10-19
- Roster management is implemented, independently gated by `ROSTER_ENABLED=1`, with no QR student check-in activated by default.
- The real 172-record roster was validated **locally** and not published. Neon remains empty of accounts/courses/rosters. No import occurred.
- Before using the roster: bootstrap a real superadmin in a private trusted environment, create a lecturer and course, assign it, obtain consent/mapping for this private roster, then run the private JSON import with backup and dry-run. See `PRIVATE_ROSTER_IMPORT.md`.


## Render hosting preparation and imported real student data — 2026-10-19
- The private Neon database now contains **172 real student records, assigned solely to the first provisional course**. A private, atomic one-time import was verified against the source checksum. This corrects any older statement saying Neon has no students.
- Public GitHub contains **no names, seat numbers, passwords or connection strings** from the imported source. Course enrollment is visible only to an authorized lecturer through v2.
- Added `render.yaml` at repository root. It configures a free Frankfurt Node service on `feature/superadmin-accounts-courses`, checks `/healthz`, and keeps `ROSTER_ENABLED=1` / `ATTENDANCE_ENABLED=0`. `DATABASE_URL` and `PUBLIC_ORIGIN` are **private** Render environment values, not included in blueprint.
- Render lists one available workspace `ahmed's workspace`, but workspace ownership has not been explicitly confirmed by user. Render tool explicitly refuses auto-selection; no service has been created or deployed yet. After user's choice, obtain connection URL privately, configure HTTPS origin, create Free web service, verify health and login. No live URL exists yet.
- Do NOT enable public check-in until real mobile/GPS security, backups and operational readiness are verified. No lecturer accounts/assignments exist yet, so the 172 students are intentionally not visible to the superadmin.


## ACTUAL RENDER DEPLOYMENT SUCCEEDED — 2026-10-19 (newest status)
- Owner instructed us to perform deployment; Render account workspace previously confirmed: `ahmed's workspace` (`tea-dbar37cs728c739bm0ug`).
- Old Render service `Bata` (`srv-dbb1d2bbc2fs73d68900`, `https://bata-yil7.onrender.com`) was incorrectly configured as **Go/main** and was left unchanged to avoid destructive edits. **Do NOT use the old URL.**
- New Render Free service created via the connected Render API: `bata-attendify-node` (`srv-dbb1ehtg1s2s73dtkc1g`), Node runtime, Frankfurt region, branch `feature/superadmin-accounts-courses`, `npm install` build, `npm start` command, autoDeploy **off**.
- **LIVE HTTPS app URL: https://bata-attendify-node.onrender.com/portal** (service dashboard: `https://dashboard.render.com/web/srv-dbb1ehtg1s2s73dtkc1g`).
- Private Neon `DATABASE_URL` was transferred directly from the Neon connector into Render environment variables without logging/publishing its value. `NODE_ENV=production`, `PUBLIC_ORIGIN=https://bata-attendify-node.onrender.com`, `ROSTER_ENABLED=1`, `ATTENDANCE_ENABLED=0`.
- Render deploy `dep-dbb1estm14bs73cpb2s0` reported status **live**, successful npm build and `server-v2.js` listening on port 10000.
- Independent public-HTTPS smoke test in GitHub Actions **success**: `https://github.com/AM-naguib/Bata/actions/runs/39258848867`, `/healthz` gave `{"status":"ok"}` proving active Neon DB connection; `/portal` served login form; anonymous `/api/v2/me` and lecturer roster returned 401; `/api/v2/attendance/checkin` and legacy `/api/report` returned 404.
- Admin can sign in with the already-provided temporary credentials and should change password immediately through the portal. No doctor accounts or assignments have been created yet, so students are not visible to superadmin.
- **NOT FINISHED:** actual sign-in/password-change user journey has not been smoke tested with private credentials, no lecturer account has been created or assigned to the first course, no real mobile QR testing, no XLSX or backups/restore. Staff portal is live; real student attendance rollout remains disabled until confirmed safe.


## Latest LIVE UI update (2026-10-19)
- The existing correct FREE Node service `srv-dbb1ehtg1s2s73dtkc1g` is still canonical. Latest manual deployment `dep-dbb1v4ijnfac739j6r4g` of feature commit `72a96ed7fa606b03197c2b4fd92c7e8c0f363d9b` returned **LIVE**.
- New public routes confirmed by independent external HTTPS smoke test [#39263443594](https://github.com/AM-naguib/Bata/actions/runs/39263443594): `/` home page with links to role dashboards; `/admin` staff admin entry; `/lecturer` staff lecturer entry; `/student` informational student QR guide. Existing `/portal` shared staff login works.
- Smoke also validated Neon `/healthz`, anonymous API rejection and that /checkin and old academic report endpoints return 404. ATTENDANCE_ENABLED remains **0**, ROSTER_ENABLED **1**; no new lecturer permissions or real student data published.
- Self-hosted CSS/JS, no external libraries/CDNs; UI tests validate markup JS bindings and no CSP-violating inline styles. CI security [#39263443641](https://github.com/AM-naguib/Bata/actions/runs/39263443641) success.
- IMPORTANT Render autoDeploy is OFF. UI code commits after deployment do not go live automatically; trigger a deploy manually after future code changes and re-run external smoke.
- Real credentialed login/new lecturer course roster/mobile QR not independently verified yet. First lecturer and course assignment still required; previously imported 172 students remain intact and private.


## Render live 42P08 password fix and separated entry (2026-10-19)
- Production app log confirmed SQLSTATE 42P08 in password-change audit (same bind parameter UUID/TEXT). Fixed `lib/http-app.js` to use two separate typed placeholders; DB password/audit transaction previously rolled back on this error.
- New three role gateway selector with separate /admin /lecturer login copy, public /student guidance, mobile card layout.
- Render live deployment `dep-dbb29vu7bikc73bfnst0` reports **LIVE** on https://bata-attendify-node.onrender.com. App commit `3078ff438515177835eef2bf732a2e1b836c596a`.
- Public HTTPS smoke [#39266948714](https://github.com/AM-naguib/Bata/actions/runs/39266948714) succeeded: three role gates, /healthz Neon ok, protected password POST 401, role pages, check-in still 404. Security CI [#39266948676](https://github.com/AM-naguib/Bata/actions/runs/39266948676) succeeded including password audit binding regression.
- Actual credentialed browser password change **not yet verified** after deployment. User should retry with unchanged current password because failed transaction rolled back. Keep `ATTENDANCE_ENABLED=0`.


## LIVE RELEASE: superadmin lecturer password reset — 2026-10-19
- Latest application release LIVE at `https://bata-attendify-node.onrender.com/admin`, Render deploy `dep-dbb3p18n74is73bg2em0` built app commit `bcf762126514e12d0f79a076d8493fb0d7a1080c`. Changes: superadmin-only reset API and per-lecturer UI action, one-time temporary password display, forced change, target-session revocation and audit. No target user data or passwords modified by deployment itself.
- CI https://github.com/AM-naguib/Bata/actions/runs/39270935273 passed security/API/transaction/UI tests, and actual Neon schema checked `app_users.updated_at`.
- Live smoke updated to verify deployed UI script contains new endpoint and unauthenticated POST is rejected with 401 without mutating accounts. Keep Render autoDeploy OFF; commit after release may contain only docs and smoke workflow, not live app code.
- Data access unchanged: superadmin cannot view student roster/attendance, public QR attendance still disabled (`ATTENDANCE_ENABLED=0`), 172 students stay in Neon private first course.
