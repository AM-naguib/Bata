# Website launch checklist — NOT PRODUCTION READY

The repository is **Public by owner's request (2026-10-19)**. GitHub Pages serves static websites and does **not** host the Node.js API in `server.js`. Hosting provider is pending user decision. Use a Node-compatible host with HTTPS and durable private storage.

## Keep student records separate from public GitHub
- `students.json` from the uploaded ZIP contains 172 real records. It has NEVER been pushed to this repository.
- `students.example.json` is a synthetic **example only**. Production needs the real roster supplied securely to the running server.
- Current code reads `./students.json` at startup. Provision it as a private runtime file before starting the app. On some hosts, a secret file or private volume can do this; details depend on the chosen provider.
- Do not expose student JSON under `public/`, paste it into Github Actions, upload it as a GitHub Release artifact, or embed student records in an HTML page.
- `data.json` holds attendance/device records; keep it on persistent private storage with verified backups, not in a git checkout or ephemeral filesystem.
- `.gitignore` only prevents future accidental additions. Before every commit/release verify `students.json`, `data.json`, `.env`, and student names do not appear in the diff/history.

**INCOMPLETE SOURCE:** public/student.html is not yet in the GitHub review branch; the `/` path will not work until its upload is resolved.\n\n## Temporary local smoke test (synthetic roster ONLY)
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
- Current audit branch is missing `public/student.html`. Its upload remains blocked, so verify file completeness before any deploy.
- Do not enable automatic deployment of the unremediated audit branch.

Change control: see `docs/DECISIONS.md`. Fixes require tests and reviewed PR, with each issue tracked in `docs/TASKS.md`.
