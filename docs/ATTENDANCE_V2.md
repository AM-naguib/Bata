# v2 QR/GPS attendance — development implementation (2026-10-19)

## Confirmed user decision
Students type **seat number AND full name** exactly as on course roster. They can edit both fields. NO student secret code/PIN. The server matches both against an ACTIVE enrollment in the course inferred from the QR-signed lecture ID.

## Implemented
- `lib/attendance-v2.js`: lecturer-scoped lecture creation/list/live/close, 30-second HMAC rotating QR, coordinate/accuracy validation, Haversine geofence, active course-enrollment + name/seat check, atomic locked attendance insertion, duplicate detection.
- `lib/attendance-routes.js`: POST check-in, lecturer lecture routes, per-IP-per-roll in-memory attempt throttle. Superadmin blocked from lecturer routes; no student roster exposed to admin or anonymous users.
- `public/checkin.html` and `checkin.js`: open QR link using phone camera, fill name and seat, edit cached values, request GPS, save name/seat locally only after successful check-in. No external camera/CDN JavaScript.
- `public/portal.html` and `app-v2.js`: lecturer chooses assigned course, creates lecture from current GPS, displays continuously updating QR and attendance count, closes lecture.
- `db/002_attendance_device_guard.sql`: unique index to prevent one device fingerprint from registering two students **within one lecture**. Applied to Neon **while schema was empty** (zero student/lecture/attendance rows).
- `qrcode@1.5.4` is a server dependency generating QR PNG data URLs. Tokens sign the lecture ID and short time slot; token cannot be forged without private QR secret.
- Tests with synthetic records: token expiry/tampering, invalid accuracy, outside geofence, wrong full name/roll, duplicate, device reuse, lecture close, privileged API access, cross-course verification and HTTP QR link.

## Feature flag and private configuration
**Default OFF**: no `/checkin`, no `/api/v2/attendance/checkin`, no lecturer lecture API unless `ATTENDANCE_ENABLED=1`.
Setting that flag requires BOTH environment secrets:
- `ATTENDANCE_QR_SECRET`: 32+ unpredictable bytes, same across all app instances/restarts, not checked into git
- `ATTENDANCE_DEVICE_KEY`: 32+ unpredictable bytes, stable across restarts, also private
- `PUBLIC_ORIGIN`: exact HTTPS origin of the website in production, used for QR links
- `DATABASE_URL`: private Neon Postgres URL.

`npm start` remains `node server-v2.js`. The original legacy `server.js` must **NOT** be deployed.

## Privacy and limitations / DO NOT DEPLOY TO LIVE STUDENTS YET
- Neon currently has NO real student or course-enrollment data. Attendance can only work after lecturers safely add/import students into individual courses.
- Browser location and device IDs can be spoofed. Name+roll match verifies roster pairing, but is not strong identity proof or a guarantee that student is physically present. Additional measures and recovery policy are pending.
- Enrollment management, QR secret lifecycle/rotation, backups and recovery, device reset, true browser UI E2E, attendance reports and Excel export still need work.
- Lectures already closed cannot accept new attendance; open lectures count is an informational number, not an absence grade calculation. Existing absence rule has not been ported to v2.
- Never publish 172 real student records, database credentials, QR signing keys, or generated attendance data to public GitHub.
- Main superadmin can only create lecturers/courses and assign lecturers; **no** student/lecture/attendance access.

## API surface (when feature flag ON)
- POST `/api/v2/lecturer/lectures` (doctor only; course permission)
- GET `/api/v2/lecturer/lectures` (only assigned course lectures)
- GET `/api/v2/lecturer/lectures/{lectureUUID}/live` (doctor only; returns rotating QR PNG)
- POST `/api/v2/lecturer/lectures/{lectureUUID}/close` (doctor only)
- GET `/checkin?t={signedQR}` (anonymous student form)
- POST `/api/v2/attendance/checkin` (anonymous student, signed QR + name/roll + GPS, rate limited)

HTTP POSTs require same-origin headers; lecturer identity comes only from a PostgreSQL-backed session, never client-supplied IDs.
