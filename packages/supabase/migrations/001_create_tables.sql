-- 001_create_tables.sql
-- Smart Attendance System — Full schema

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TEACHERS
-- ============================================================
CREATE TABLE teachers (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  roll_number TEXT UNIQUE NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLASSES
-- ============================================================
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  building    TEXT NOT NULL,
  room_number TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLASS SCHEDULES
-- ============================================================
CREATE TABLE class_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CHECK (end_time > start_time)
);

-- ============================================================
-- CLASS ↔ TEACHER ASSIGNMENTS
-- ============================================================
CREATE TABLE class_teacher_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  UNIQUE (class_id, teacher_id)
);

-- ============================================================
-- CLASS ↔ STUDENT ENROLLMENTS
-- ============================================================
CREATE TABLE class_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

-- ============================================================
-- CLASS LOCATIONS (geofence config)
-- ============================================================
CREATE TABLE class_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID UNIQUE NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  radius_meters INT NOT NULL DEFAULT 100
);

-- ============================================================
-- WIFI CONFIGS
-- ============================================================
CREATE TABLE wifi_configs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id     UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  ssid           TEXT NOT NULL,
  min_signal_dbm INT NOT NULL DEFAULT -50,
  UNIQUE (class_id, teacher_id)
);

-- ============================================================
-- ATTENDANCE SESSIONS (one per QR generation event)
-- ============================================================
CREATE TABLE attendance_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  qr_payload   JSONB,
  is_active    BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
CREATE TABLE attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'manual')),
  scanned_at      TIMESTAMPTZ,
  gps_latitude    DOUBLE PRECISION,
  gps_longitude   DOUBLE PRECISION,
  geofence_passed BOOLEAN,
  wifi_ssid_found TEXT,
  wifi_signal_dbm INT,
  wifi_passed     BOOLEAN,
  photo_url       TEXT,
  marked_by       TEXT NOT NULL DEFAULT 'system' CHECK (marked_by IN ('system', 'teacher')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- ============================================================
-- INDEXES for common queries
-- ============================================================
CREATE INDEX idx_class_teacher ON class_teacher_assignments(teacher_id);
CREATE INDEX idx_class_enrollment ON class_enrollments(student_id);
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_class ON attendance_records(class_id);
CREATE INDEX idx_sessions_class ON attendance_sessions(class_id);
CREATE INDEX idx_schedules_class ON class_schedules(class_id);
