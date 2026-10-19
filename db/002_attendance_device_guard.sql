-- Attendify migration 002: prevent reusing one browser device in one lecture.
-- Privacy: no roster rows, secrets or attendance data are included.
-- Apply additively after validating existing historical records.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_device_per_lecture
 ON attendances(lecture_id,device_fingerprint_hash)
 WHERE device_fingerprint_hash IS NOT NULL;
INSERT INTO schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING;
COMMIT;
