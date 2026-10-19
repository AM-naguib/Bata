# Attendify code/security review — 2026-10-19

Scope: server.js, public/doctor.html, public/student.html, README, package.json, and structure of students.json in the user ZIP. Node v22 isolated integration tests used **synthetic student data only**.

## Highest risk
1. Known fallback doctor password '1234' (server.js:3).
2. No independent student auth; device ID and GPS are entirely supplied by client (server.js:42-58).
3. Missing GPS accuracy accepted (server.js:53-55).
4. HTML lecture title flowing into doctor innerHTML (doctor.html:58-63).
5. Corrupt data.json silently treated as empty then overwritten by first edit (server.js:8-10).
6. Lecture status mutable on GET (server.js:67-70).
7. Logout does not revoke cookie session server-side (doctor.html:53, server.js:17-21).
8. 172 identifying student records are present in the uploaded ZIP; must not appear in public repository.

## Confirmed by isolated API/integrity tests
- Default password works when DOCTOR_PASSWORD unset.
- GET changes lecture closed flag.
- Missing accuracy and accuracy=-100 result in recorded attendance.
- latitude=999,longitude=-999 accepted for lecture creation.
- Invalid Unicode token signature leads to HTTP 500 rather than validation 400.
- Opening a lecture immediately counts absent students in report.
- 41st attendance attempt from same IP gets 429.
- Corrupt data.json silently replaced when first write occurs.
- Browser rendering XSS NOT executed; code sink and unescaped data path confirmed by static review.

## Constraints
Not a production pentest, no production load test, browser E2E or CDN dependency audit. Nothing in this report is evidence of a completed fix. Full tasks in TASKS.md; policy questions in DECISIONS.md.
