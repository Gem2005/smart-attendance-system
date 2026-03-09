-- 002_rls_policies.sql
-- Row Level Security for all tables

-- ============================================================
-- Helper: get current user's role from JWT
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'student'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- Helper: set user role in app_metadata (called by admin/trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_role(user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', new_role)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TEACHERS
-- ============================================================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_read_own" ON teachers
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "teachers_update_own" ON teachers
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- STUDENTS
-- ============================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Students can read their own profile
CREATE POLICY "students_read_own" ON students
  FOR SELECT USING (id = auth.uid());

-- Teachers can read students enrolled in their classes
CREATE POLICY "teachers_read_students" ON students
  FOR SELECT USING (
    public.get_user_role() = 'teacher'
    AND id IN (
      SELECT ce.student_id FROM class_enrollments ce
      JOIN class_teacher_assignments cta ON cta.class_id = ce.class_id
      WHERE cta.teacher_id = auth.uid()
    )
  );

-- Teachers can update students in their classes
CREATE POLICY "teachers_update_students" ON students
  FOR UPDATE USING (
    public.get_user_role() = 'teacher'
    AND id IN (
      SELECT ce.student_id FROM class_enrollments ce
      JOIN class_teacher_assignments cta ON cta.class_id = ce.class_id
      WHERE cta.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- CLASSES
-- ============================================================
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Teachers see classes assigned to them
CREATE POLICY "teachers_own_classes" ON classes
  FOR SELECT USING (
    id IN (
      SELECT class_id FROM class_teacher_assignments
      WHERE teacher_id = auth.uid()
    )
  );

-- Students see classes they are enrolled in
CREATE POLICY "students_enrolled_classes" ON classes
  FOR SELECT USING (
    id IN (
      SELECT class_id FROM class_enrollments
      WHERE student_id = auth.uid()
    )
  );

-- Teachers can create classes
CREATE POLICY "teachers_create_classes" ON classes
  FOR INSERT WITH CHECK (public.get_user_role() = 'teacher');

-- Teachers can update their own classes
CREATE POLICY "teachers_update_classes" ON classes
  FOR UPDATE USING (
    id IN (
      SELECT class_id FROM class_teacher_assignments
      WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- CLASS SCHEDULES
-- ============================================================
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_class_schedules" ON class_schedules
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
      UNION
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "teachers_manage_schedules" ON class_schedules
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- CLASS TEACHER ASSIGNMENTS
-- ============================================================
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_read_own_assignments" ON class_teacher_assignments
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "teachers_manage_assignments" ON class_teacher_assignments
  FOR ALL USING (teacher_id = auth.uid());

-- ============================================================
-- CLASS ENROLLMENTS
-- ============================================================
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

-- Teachers can see/manage enrollments for their classes
CREATE POLICY "teachers_manage_enrollments" ON class_enrollments
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

-- Students can see their own enrollments
CREATE POLICY "students_read_enrollments" ON class_enrollments
  FOR SELECT USING (student_id = auth.uid());

-- ============================================================
-- CLASS LOCATIONS
-- ============================================================
ALTER TABLE class_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_class_locations" ON class_locations
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
      UNION
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "teachers_manage_locations" ON class_locations
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- WIFI CONFIGS
-- ============================================================
ALTER TABLE wifi_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_wifi_configs" ON wifi_configs
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
      UNION
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "teachers_manage_wifi" ON wifi_configs
  FOR ALL USING (teacher_id = auth.uid());

-- ============================================================
-- ATTENDANCE SESSIONS
-- ============================================================
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Teachers see sessions they created
CREATE POLICY "teachers_own_sessions" ON attendance_sessions
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "teachers_create_sessions" ON attendance_sessions
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teachers_update_sessions" ON attendance_sessions
  FOR UPDATE USING (teacher_id = auth.uid());

-- Students see active sessions for their enrolled classes
CREATE POLICY "students_read_active_sessions" ON attendance_sessions
  FOR SELECT USING (
    is_active = true
    AND class_id IN (
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Teachers see records for their classes
CREATE POLICY "teachers_view_attendance" ON attendance_records
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

-- Teachers can insert/update (manual marking)
CREATE POLICY "teachers_manage_attendance" ON attendance_records
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

-- Students see only their own records
CREATE POLICY "students_own_attendance" ON attendance_records
  FOR SELECT USING (student_id = auth.uid());

-- Students can insert only their own attendance
CREATE POLICY "students_mark_attendance" ON attendance_records
  FOR INSERT WITH CHECK (student_id = auth.uid());
