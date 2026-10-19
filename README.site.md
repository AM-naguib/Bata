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
