# Attendify — issue tracker

All remediation tasks are OPEN. [ ] means not implemented. Priority P0 blocks safe production.

- [ ] T-00 P0 — Repo bootstrap, privacy review and ensure no student records reach public git. **Owner confirmed this is the correct project**. Deploy real roster only via controlled data source. Verify full git history and artifacts.
- [ ] T-01 P0 — Decide private/public repo and how admins will import/manage enrolled students. Add safe provisioning, backup and access controls. **Decision pending**.
- [x] T-02 P1 — F-01 Removed fallback 1234, require DOCTOR_PASSWORD with length >=12. Verified by synthetic Node test. Commit `1335905`. **Operational secret still must be set securely at deploy.**
- [ ] T-03 P1 — F-02 Add login brute-force protection. Test repeated incorrect attempts limited without unnecessary class-wide lockout.
- [ ] T-04 P1 — F-04/F-05 Decide threat model and independent student identification. Test replay/impersonation within chosen mechanism. **Decision pending**.
- [x] T-05 P1 — F-06 Reject missing/non-numeric/zero/negative accuracy and invalid coordinates, plus enforce MAX_ACC. Verified by synthetic Node test. Commit `1335905`.
- [ ] T-06 P1 — F-07 Replace unsafe innerHTML interpolation with DOM textContent/escaped HTML; browser regression using adversarial text.
- [ ] T-07 P1 — F-08 Fail safely on corrupt data.json; preserve original and add backup/restore; test no overwrite on parse error.
- [ ] T-08 P1 — F-09 Define when lectures count for absence and eligibility. Test open/closed lessons and exact threshold. **Decision pending**.
- [ ] T-09 P1 — F-10 Restrict open/close to authenticated POST/PATCH with CSRF defenses; test GET cannot mutate.
- [ ] T-10 P1 — F-11 Server logout invalidates session, true expiry, secure cookies on HTTPS. Test cookie reuse fails after logout.
- [ ] T-11 P2 — F-12 Avoid shared-IP false positives; cleanup limiter; support trusted reverse proxy. Test 50 valid users behind NAT.
- [ ] T-12 P2 — F-13 Reject impossible coordinates when doctor creates lecture.
- [ ] T-13 P2 — F-14 Validate token encoding/length/shape before timing-safe comparison; fuzz malformed Unicode strings no 500.
- [ ] T-14 P2 — F-15 Decide whether device binding is per lecture or ongoing; update implementation and README. **Decision pending**.
- [ ] T-15 P2 — F-16 Preserve historical attendee information when roster changes; test old records still work.
- [ ] T-16 P2 — F-17 Neutralize spreadsheet formula injection in CSV exports.
- [ ] T-17 P2 — F-18 Pick durable storage, atomic writes, backups and concurrency strategy based on hosting. **Decision pending**.
- [ ] T-18 P2 — F-19 Add unit/integration/browser regression tests and CI using synthetic student fixtures.
- [ ] T-19 P2 — F-20 Add CSP, security headers, and pinned/self-hosted third-party JS with integrity validation.
- [ ] T-20 P3 — F-21 Improve admin UI failure feedback and camera scanner lifecycle; test repeated taps and permission errors.

**Workflow:** Write a failing test; implement a minimal change; run tests; commit to review branch; mark [x] only after passing acceptance criteria, with commit evidence. Do not merge into main without owner decisions on operational security. 

- [ ] T-21 P0 — Complete safe source staging: `public/student.html` still absent following upload rejection. Verify GitHub tree against ZIP (excluding real `students.json`) and test both `/` and `/doctor`; do not deploy incomplete branch.
- [ ] T-22 P1 — Public website launch: owner chose Public repository. Select Node hosting, provision private real roster, persistent attendance storage and backup, HTTPS, production env vars. Gate rollout on security fixes and acceptance tests. Hosting provider **pending**.

- [ ] T-23 P1 — Prepare **Render Free** deployment with HTTPS, manual deploy gate and environment variables set securely. Confirm `/`, `/doctor`, health check, QR behavior and cold-start tolerance. NO deployment until other P1 blockers close.
- [ ] T-24 P1 — Migrate private roster/attendance/device persistence to **Neon Free PostgreSQL**; write schema, import routine, atomic transactions and migration tests with synthetic fixtures. Never store real student data in source control.
- [ ] T-25 P1 — Create backup/export and restore test for private student and attendance records, including free-tier service outage response.
- [ ] T-26 P1 — Verify free plan spend limits, any credit-card requirement, instance sleep/recovery, Neon quotas, backup and reliability before running a real class.

## Implementation update — 2026-10-19
- T-03 **partial**: IP-based login limiter implemented (10 attempts / 15 min), but classroom NAT behaviour and distributed-instance enforcement untested.
- T-06 **partial**: escaped untrusted text in doctor UI (commit c95dcd3); browser XSS regression still required.
- T-07 **partial**: startup fails closed on malformed/invalid data.json (commit 1335905); full backups, restores, storage migration still OPEN.
- T-09 **partial**: close/open now require POST, and GET is read-only (commit 1335905); CSRF/origin protection still OPEN.
- T-10 **partial**: logout now revokes server session, enforces 12-hour expiry and HTTPS cookie Secure flag in NODE_ENV=production (commits 1335905, c95dcd3); production proxy/HTTPS checks still OPEN.
- T-12 **partial**: invalid lecture coordinates rejected (commit 1335905); dedicated regression test outstanding.
- T-13 **partial**: malformed signatures now rejected without timingSafeEqual length mismatch (commit 1335905); fuzz suite outstanding.
- T-19 **partial**: synthetic regression tests and GitHub Actions CI added. Browser tests still missing; check remote CI status after push.
- T-21 remains **OPEN**: original student.html could not be published; do not deploy this branch.
- T-24 remains **OPEN**: Postgres migration not implemented. Render Free loses JSON data on restart. No live website or database connection was established.
