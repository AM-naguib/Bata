# Attendify private recovery plan

Last verified: 2026-10-19. **No student data, database credentials or password hashes are stored in this repository.**

## Safe restore point already made in Neon
- Project: `bata-attendify` / `wandering-mode-56487150`, database `attendify`.
- Default writable production branch: `main` (`br-polished-rice-ak97392e`).
- Point-in-time copy before activating QR attendance: **`backup-pre-attendance-2026-10-19`** (`br-blue-frost-akgrnlty`), parent LSN `0/1DC9EF0`. Branch was created as `no_compute: true`; status `ready`.
- This is a **Neon internal copy-on-write backup branch**, not an independent/offsite backup. It stays inside the same Neon project/account; deleting that account/project can remove both. Do **not** direct Render's `DATABASE_URL` to the backup branch, write student test data there, reset it or delete it automatically.
- All 172 real students and enrollment records stayed private on Neon. At last production verification, there were 172 students, 0 lectures, 0 attendance entries and 0 corrections. Schema v3 corrections table was added non-destructively.

## Before real classroom rollout
1. Verify current Render deployment, lecturer login/password change, course assignment, per-course roster, Excel/report export, and audit trail.
2. Export a **separate encrypted PostgreSQL custom-format backup** using a trusted local or secure private environment with `pg_dump`. Never print/paste database credentials into a shell command transcript, GitHub, CI, or chat. Restrict file permissions; encrypt the dump immediately and store it offsite with access controls.
3. Test the encrypted backup can be restored to a **separate nonproduction database** (never restore over production). Validate counts, foreign keys, report access boundaries and a synthetic attendance workflow. Do not upload an unencrypted dump or copy identifiable student records into a public test repo.
4. Establish a repeatable daily/weekly backup retention policy appropriate to Neon plan limits. Check real costs/quotas before enabling any paid Neon snapshots or scheduled backups.
5. Only after the above and device/GPS/QR browser tests should `ATTENDANCE_ENABLED` be set to `1`. Store `ATTENDANCE_QR_SECRET` and `ATTENDANCE_DEVICE_KEY` privately, never commit them.

## Recovery procedure (needs explicit owner approval at execution)
- Stop real-world check-ins; capture production incident, approximate timestamp and branch/restore point.
- Create a **new recovery branch** from the chosen backup snapshot or use an isolated restore destination. Compare row counts, audit history and course assignments.
- Validate read-only app access in a private/isolated Render deployment before routing live traffic. Restoring a backup onto production can permanently discard later student check-ins; never do so without owner confirmation and a backup of the current production state.
- Review differences and prepare a reconciliation plan for lectures/corrections created after the restore point.
- Switch `DATABASE_URL` only when the owner explicitly confirms, then retest lecturer permissions and disabled QR status.

## Known limitations
A backup branch created without compute cannot run SQL checks until a compute is provisioned. Neon project-level backups are not an offsite disaster recovery plan. Real phone/browser tests and an independent encrypted dump/restore drill remain outstanding.
