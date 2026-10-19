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

## Hosting decision: pending
- Is deployment on Render, Railway, a VPS or another provider intended?
- Render, as one possible service, uses ephemeral filesystem by default; a persistent disk or external database is needed for attendance records. Persistent disks are available for paid web services. See https://render.com/docs/disks .
- Do not enable automatic deployment of the unremediated audit branch.

Change control: see `docs/DECISIONS.md`. Fixes require tests and reviewed PR, with each issue tracked in `docs/TASKS.md`.
