# Attendify — Decisions

## Accepted
- D-001 — Confirmed by owner on 2026-10-19: **attendify.zip is the intended project for AM-naguib/Bata**.
- D-002a — Owner confirmed students must be entered into the application. This means the production application **must support real student records**; it does **not** mean publishing them to GitHub.
- W-001 — Audit first, do not modify application logic without justified requirements.
- W-002 — If policy is unclear, ask instead of inventing requirements.
- W-003 — Upload incrementally to GitHub. Documentation is being uploaded to branch `audit/attendify-review-2026-10-19`.

## Safety boundaries
- Repository was confirmed **public** during review.
- The uploaded ZIP has **172 student records with names and IDs**. Do not commit this file, include it in issue descriptions, or embed it in tests.
- Keep real data on a secured runtime volume/database or another access-controlled location, separate from the public repo. A test fixture is not a replacement for production enrollment.
- No code-level fix has yet been approved or completed; merely adding documentation is not fixing the issues.

## Pending owner decisions
- D-002b (resolved): Owner instructed on 2026-10-19 to keep the GitHub repository **Public**, with the goal of operating the project as a website. Hosting does not require a public GitHub repo, but the requested visibility is retained.
- D-002c (pending): Where/how will the actual 172 student records be stored and provisioned securely at runtime? Never commit the actual roster to public GitHub.
- D-003: How strongly must student identities be verified? Roll-over/recovery for lost devices? Browsers cannot prove physical GPS/device authenticity.
- D-004: Should absences count only after lectures close? Is the >=25% rule per course, semester or overall, and are exemptions needed?
- D-005: Hosting provider (GitHub Pages cannot run this Node API), HTTPS, persistent storage/backup, number of classes and admins/instances. Do not deploy to a public URL until P1 security fixes and private roster provisioning are in place.
- D-006: Device binding per lecture or throughout the course?
- D-007: Intended geofence and GPS accuracy thresholds, and fallback when indoor geolocation fails.

## Change log
- 2026-10-19: User confirmed ZIP is project and students are intended to be entered into app. No consent to public disclosure of their records was given.

- 2026-10-19: Owner expressly chose a Public GitHub repository for eventual website deployment. Private runtime student records and hosting details are still pending. Source files may be staged in the audit branch; do not deploy as production in its current audited state.
