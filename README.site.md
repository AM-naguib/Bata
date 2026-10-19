# حاضر — Attendify

Student attendance application based on rotating QR codes + browser geolocation.

This is a **Node.js web server**, not a GitHub Pages static site. GitHub is public for the application's SOURCE CODE, not for actual student roster or attendance data.

## Current status
**Audit in progress. Not safe for real student attendance until priority security findings are resolved.**

- App server: `server.js`
- Student page: `/`
- Lecturer/admin page: `/doctor`
- Runtime roster: `students.json` (PRIVATE — excluded from Git)
- Runtime attendance: `data.json` (PRIVATE — excluded from Git)
- Example records: `students.example.json` (synthetic)
- Audit/memory/tasks/decisions: `docs/`

## Local-only test
```sh
cp students.example.json students.json
DOCTOR_PASSWORD='choose-your-own-strong-password' npm start
```

See [deployment and safety checklist](docs/DEPLOYMENT.md) and [outstanding tasks](docs/TASKS.md). **Do not publicly deploy the current code.** Avoid placing actual student data into GitHub or web-accessible folders.
