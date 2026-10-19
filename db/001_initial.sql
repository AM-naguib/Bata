-- Attendify database version 1 (2026-10-19)
-- Privacy: schema only, NO real student data or passwords in Git.
-- Run only once / use IF NOT EXISTS for safe provisioning; no DROP statements.
-- PostgreSQL 14+ / Neon compatible.
BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('superadmin','lecturer')),
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_email CHECK (length(email) BETWEEN 3 AND 254),
  CONSTRAINT valid_display_name CHECK (length(trim(display_name)) BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_email ON app_users ((lower(trim(email))));
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_superadmin ON app_users (role) WHERE role='superadmin';

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 150),
  code text,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_code ON courses ((lower(trim(code)))) WHERE code IS NOT NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS lecturer_courses (
  lecturer_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  PRIMARY KEY (lecturer_id,course_id)
);
CREATE INDEX IF NOT EXISTS ix_active_lecturer_courses ON lecturer_courses (lecturer_id,course_id) WHERE unassigned_at IS NULL;

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL CHECK (length(trim(roll_number)) BETWEEN 1 AND 64),
  full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_roll ON students (roll_number);

CREATE TABLE IF NOT EXISTS enrollments (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY (student_id,course_id)
);
CREATE INDEX IF NOT EXISTS ix_active_enrollments ON enrollments (course_id,student_id) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  location_lat double precision CHECK (location_lat BETWEEN -90 AND 90),
  location_lng double precision CHECK (location_lng BETWEEN -180 AND 180),
  radius_m integer CHECK (radius_m BETWEEN 20 AND 500),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_lectures_course ON lectures (course_id,opened_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS attendances (
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  device_fingerprint_hash text,
  distance_m integer,
  PRIMARY KEY (lecture_id,student_id)
);
CREATE INDEX IF NOT EXISTS ix_attendance_student ON attendances (student_id,lecture_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions (user_id,expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES app_users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_events_time ON audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS schema_versions (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_versions (version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
