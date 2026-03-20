-- 006_rebuild.sql
-- Destroy and rebuild schema cleanly

-- 1. DESTROY EXISTING TABLES
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS attendance_sessions CASCADE;
DROP TABLE IF EXISTS wifi_configs CASCADE;
DROP TABLE IF EXISTS class_locations CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS class_teacher_assignments CASCADE;
DROP TABLE IF EXISTS class_schedules CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;

-- 2. CREATE TABLES
-- Teachers
CREATE TABLE teachers (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Students
CREATE TABLE students (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  roll_number TEXT UNIQUE NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Classes
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  building    TEXT NOT NULL,
  room_number TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Class schedules
CREATE TABLE class_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CHECK (end_time > start_time)
);

-- Class Teacher Assignments
CREATE TABLE class_teacher_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  UNIQUE (class_id, teacher_id)
);

-- Class Enrollments
CREATE TABLE class_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

-- Class Locations
CREATE TABLE class_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID UNIQUE NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  radius_meters INT NOT NULL DEFAULT 100
);

-- WiFi configs
CREATE TABLE wifi_configs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id     UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  ssid           TEXT NOT NULL,
  min_signal_dbm INT NOT NULL DEFAULT -50,
  UNIQUE (class_id, teacher_id)
);

-- Attendance Sessions
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

-- Attendance Records
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

-- 3. ENABLE RLS
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 4. SECURITY DEFINER FUNCTS
CREATE OR REPLACE FUNCTION public.is_teacher() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.teachers WHERE id = auth.uid());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_student() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = auth.uid());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.teaches_class(cid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teacher_assignments WHERE teacher_id = auth.uid() AND class_id = cid
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.enrolled_in_class(cid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments WHERE student_id = auth.uid() AND class_id = cid
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 5. POLICIES
-- Teachers
CREATE POLICY "teachers_manage_own" ON teachers FOR ALL USING (id = auth.uid());
-- Students
CREATE POLICY "students_manage_own" ON students FOR ALL USING (id = auth.uid());
CREATE POLICY "teachers_read_students" ON students FOR SELECT USING (public.is_teacher());

-- Classes
CREATE POLICY "teachers_manage_classes" ON classes FOR ALL USING (public.is_teacher());
CREATE POLICY "students_read_classes" ON classes FOR SELECT USING (public.is_student());

-- Class Schedules
CREATE POLICY "teachers_manage_schedules" ON class_schedules FOR ALL USING (public.is_teacher());
CREATE POLICY "students_read_schedules" ON class_schedules FOR SELECT USING (public.is_student());

-- Class Teacher Assignments
CREATE POLICY "teachers_manage_assignments" ON class_teacher_assignments FOR ALL USING (public.is_teacher());

-- Class Enrollments
CREATE POLICY "teachers_manage_enrollments" ON class_enrollments FOR ALL USING (public.is_teacher());
CREATE POLICY "students_read_enrollments" ON class_enrollments FOR SELECT USING (student_id = auth.uid());

-- Class Locations
CREATE POLICY "teachers_manage_locations" ON class_locations FOR ALL USING (public.is_teacher());
CREATE POLICY "students_read_locations" ON class_locations FOR SELECT USING (public.is_student());

-- WiFi Configs
CREATE POLICY "teachers_manage_wifi" ON wifi_configs FOR ALL USING (public.is_teacher());
CREATE POLICY "students_read_wifi" ON wifi_configs FOR SELECT USING (public.is_student());

-- Attendance Sessions
CREATE POLICY "teachers_manage_sessions" ON attendance_sessions FOR ALL USING (public.is_teacher());
CREATE POLICY "students_read_sessions" ON attendance_sessions FOR SELECT USING (public.is_student());

-- Attendance Records
CREATE POLICY "teachers_manage_records" ON attendance_records FOR ALL USING (public.is_teacher());
CREATE POLICY "students_manage_own_records" ON attendance_records FOR ALL USING (student_id = auth.uid());

-- 6. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "students_upload_own_photo" ON storage.objects;
DROP POLICY IF EXISTS "students_read_own_photo" ON storage.objects;
DROP POLICY IF EXISTS "teachers_read_class_photos" ON storage.objects;

CREATE POLICY "students_upload_own_photo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attendance-photos' AND (storage.foldername(name))[3] = auth.uid()::text
  );

CREATE POLICY "students_read_own_photo" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attendance-photos' AND (storage.foldername(name))[3] = auth.uid()::text
  );

CREATE POLICY "teachers_read_class_photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attendance-photos' AND public.is_teacher()
  );


-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_class_teacher ON class_teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollment ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance_records(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_class ON class_schedules(class_id);
