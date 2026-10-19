-- Attendify v3 — append-only audit trail + effective lecturer corrections.
-- PRIVATE student IDs live only in Neon. This schema migration publishes no data.
-- Safe re-runnable, non-destructive: no DROP, no DELETE, no historical rewrites.
BEGIN;
CREATE TABLE IF NOT EXISTS attendance_corrections (
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('present','absent')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  corrected_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lecture_id,student_id)
);
CREATE INDEX IF NOT EXISTS ix_attendance_corrections_lecture
  ON attendance_corrections (lecture_id,student_id);
INSERT INTO schema_versions(version) VALUES(3) ON CONFLICT DO NOTHING;
COMMIT;
