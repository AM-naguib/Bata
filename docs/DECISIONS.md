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

## Hosting choice (2026-10-19)
- D-008: Owner prioritizes **free hosting**, with no provider preference. Technical plan selected for an initial **prototype**, not a production approval: **Render Free Web Service** running Node.js + **Neon Free PostgreSQL** for durable roster/attendance data.
- D-009: Repository remains Public, as explicitly requested; database credentials and real student data must only exist in access-controlled runtime environments.
- D-010: Do **not** represent the site as launched until both services are connected, storage is migrated, P1 security tasks and launch tests pass, and a real URL is verified. Render Free spins down after 15 minutes idle and its local filesystem is ephemeral. Its free tier is not recommended for production by the provider.
- D-011: Neon Free allowance advertised October 2026 is 1 GB per project, subject to compute/network quotas. Verify limits during provisioning. Free services may change terms.

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

- 2026-10-19: User accepted any free host. Chose Render Free + Neon Free for development/staging; no hosting accounts linked yet, so no deployment, no data import and no operational database established.

## Implementation record — 2026-10-19
- I-001: Only unequivocal low-risk security hardening has been implemented on the audit branch; the attendance/absence grade policy and student authentication design are unchanged.
- I-002: Keep the GitHub pull request in Draft; **do not merge or deploy yet** because code remains incomplete, storage is still JSON and student identity/spoofing vulnerabilities are unresolved.
- I-003: Render and Neon plugin installations verified from ChatGPT integration catalog; their management actions were **not accessible in this session**, so cloud services were not provisioned. No live URL available.
- I-004: Regression checks passed locally with synthetic students; GitHub Actions run #39208681784 succeeded on audit branch; this does not constitute production approval.

## New feature requirements received 2026-10-19
- FR-D1 (confirmed): Student UI must show matching student name and make correction of previously saved seat number clear.
- FR-D2 (confirmed): Lecturer can delete mistaken lectures.
- FR-D3 (confirmed): Lecturer can add/remove students to a specific course roster.
- FR-D4 (confirmed): Lecturer and course names must be captured alongside a lecture.
- FR-D5 (confirmed): Excel attendance sheet saving/export requested; format not specified.
- FR-D6 (confirmed): Separate account for every lecturer with account management and password change.
- FR-D7 (resolved): A single superadmin creates lecturers and assigns lecturer-course memberships; no lecturer self-registration.
- FR-D8 (pending): Whether lecture deletion is recoverable and how to preserve existing recorded attendance.
- FR-D9 (pending): Student name lookup authorization and how to handle mistaken attendance recorded under another student's ID.
- FR-D10 (pending): Whether Excel means native XLSX or CSV compatible with Excel.
- FR-D11 (pending): How historical records map to courses, with course-by-course attendance percentages and exact privileges.
No changes to grading/absence rules authorized yet. Implement safe UI improvements before irreversible data operations.

## Feature-branch interim safety choices — 2026-10-19 (not owner-approved product policies)
- Pending student identity design, show full student name **only after successful attendance**, not as a public ID->name directory. Seat number can be cleared locally; correcting a prior recorded attendance remains lecturer-controlled and needs design.
- A lecturer can archive an accidentally created **empty lecture** and restore it; if attendance exists, deletion is blocked (409). Archive removes it from current absence calculations without erasing any records. Restored lecture is CLOSED until explicitly reopened. Owner still needs to decide policy for lectures with attendance.
- Course and lecturer names currently are metadata labels on lectures, **not user identities or validated per-course enrollments**. Do not confuse with account ownership.
- Existing CSV is labelled 'opens in Excel' accurately; native XLSX remains pending.
- Approved status: only the user feature requirements, not onboarding/deletion/privacy policies. No private roster or account secrets in public GitHub.

## Confirmed role policy (2026-10-19)
- **OWNER APPROVED:** A single main superadmin creates lecturer accounts and assigns courses to them; lecturers cannot sign themselves up or assign courses.
- Lecturer accounts must be limited to their assigned courses; users may change their own passwords after authentication.
- SQL schema deployed to new Neon Free project `bata-attendify` (ID `wandering-mode-56487150`), with 10 tables, no student records or credentials. Database schema is not the same as working application accounts. See docs/SUPERADMIN.md.
- Do not invent superadmin credentials, privileges outside this policy, or a legacy-course mapping; remain pending.

## Final superadmin permissions — OWNER CONFIRMED 2026-10-19
- D-012: **Superadmin only creates lecturer accounts and distributes/withdraws course assignments.** Showing the minimal names/course IDs needed for those two actions is acceptable; there is **no right** to view or modify students, course enrollments, lectures, attendance, absence calculations, lecturer reports/exports or historical records.
- D-013: A lecturer can manage student enrollments and attendance **only within their assigned course(s)**; all enforcement must be by server-side ownership checks.
- D-014: Superadmin does **not** inherit all lecturer permissions. Role gates must explicitly deny access, even to direct URLs/API calls.
- D-015: Account self-service logout/profile and password change are universal identity functions, not academic/lecturer permissions. Do not assume superadmin may reset other users' passwords without explicit owner authorization.
- Still pending: Who creates the catalog of courses if none exist? Initial superadmin credentials must be chosen privately. Superadmin account not created yet.
