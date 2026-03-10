-- 005_comprehensive_rls_fix.sql
-- Comprehensive RLS policy overhaul
-- Uses SECURITY DEFINER helpers so policy sub-queries bypass RLS on other tables

-- ============================================================
-- SECURITY DEFINER HELPERS
-- These run as the function owner (superuser), bypassing RLS,
-- so policies that reference other RLS-protected tables work correctly.
-- ============================================================

-- Check if current user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.teachers WHERE id = auth.uid());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is a student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE id = auth.uid());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user teaches a specific class
CREATE OR REPLACE FUNCTION public.teaches_class(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teacher_assignments
    WHERE teacher_id = auth.uid() AND class_id = cid
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is enrolled in a specific class
CREATE OR REPLACE FUNCTION public.enrolled_in_class(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments
    WHERE student_id = auth.uid() AND class_id = cid
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get class IDs taught by current user
CREATE OR REPLACE FUNCTION public.taught_class_ids()
RETURNS SETOF UUID AS $$
  SELECT class_id FROM public.class_teacher_assignments
  WHERE teacher_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get class IDs where current user is enrolled
CREATE OR REPLACE FUNCTION public.enrolled_class_ids()
RETURNS SETOF UUID AS $$
  SELECT class_id FROM public.class_enrollments
  WHERE student_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get student IDs enrolled in classes taught by current user
CREATE OR REPLACE FUNCTION public.students_in_my_classes()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT ce.student_id
  FROM public.class_enrollments ce
  WHERE ce.class_id IN (SELECT public.taught_class_ids());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- DROP ALL EXISTING POLICIES (clean slate)
-- Includes both old names (from 002/004) and new names (from this file)
-- so the migration is idempotent if re-run after a partial failure.
-- ============================================================

-- Teachers (old + new)
DROP POLICY IF EXISTS "teachers_read_own" ON teachers;
DROP POLICY IF EXISTS "teachers_update_own" ON teachers;
DROP POLICY IF EXISTS "teachers_insert_own" ON teachers;
DROP POLICY IF EXISTS "teachers_select_own" ON teachers;

-- Students (old + new)
DROP POLICY IF EXISTS "students_read_own" ON students;
DROP POLICY IF EXISTS "students_insert_own" ON students;
DROP POLICY IF EXISTS "teachers_read_students" ON students;
DROP POLICY IF EXISTS "teachers_update_students" ON students;
DROP POLICY IF EXISTS "students_select_own" ON students;
DROP POLICY IF EXISTS "teachers_select_students" ON students;

-- Classes (old + new)
DROP POLICY IF EXISTS "teachers_own_classes" ON classes;
DROP POLICY IF EXISTS "students_enrolled_classes" ON classes;
DROP POLICY IF EXISTS "teachers_create_classes" ON classes;
DROP POLICY IF EXISTS "teachers_update_classes" ON classes;
DROP POLICY IF EXISTS "teachers_select_classes" ON classes;
DROP POLICY IF EXISTS "students_select_classes" ON classes;
DROP POLICY IF EXISTS "teachers_insert_classes" ON classes;

-- Class schedules (old + new)
DROP POLICY IF EXISTS "read_class_schedules" ON class_schedules;
DROP POLICY IF EXISTS "teachers_manage_schedules" ON class_schedules;
DROP POLICY IF EXISTS "teachers_select_schedules" ON class_schedules;
DROP POLICY IF EXISTS "students_select_schedules" ON class_schedules;
DROP POLICY IF EXISTS "teachers_insert_schedules" ON class_schedules;
DROP POLICY IF EXISTS "teachers_update_schedules" ON class_schedules;
DROP POLICY IF EXISTS "teachers_delete_schedules" ON class_schedules;

-- Class teacher assignments (old + new)
DROP POLICY IF EXISTS "teachers_read_own_assignments" ON class_teacher_assignments;
DROP POLICY IF EXISTS "teachers_manage_assignments" ON class_teacher_assignments;
DROP POLICY IF EXISTS "teachers_select_assignments" ON class_teacher_assignments;
DROP POLICY IF EXISTS "teachers_insert_assignments" ON class_teacher_assignments;
DROP POLICY IF EXISTS "teachers_delete_assignments" ON class_teacher_assignments;

-- Class enrollments (old + new)
DROP POLICY IF EXISTS "teachers_manage_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "students_read_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "teachers_select_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "teachers_insert_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "teachers_delete_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "students_select_enrollments" ON class_enrollments;

-- Class locations (old + new)
DROP POLICY IF EXISTS "read_class_locations" ON class_locations;
DROP POLICY IF EXISTS "teachers_manage_locations" ON class_locations;
DROP POLICY IF EXISTS "teachers_select_locations" ON class_locations;
DROP POLICY IF EXISTS "students_select_locations" ON class_locations;
DROP POLICY IF EXISTS "teachers_insert_locations" ON class_locations;
DROP POLICY IF EXISTS "teachers_update_locations" ON class_locations;
DROP POLICY IF EXISTS "teachers_delete_locations" ON class_locations;

-- WiFi configs (old + new)
DROP POLICY IF EXISTS "read_wifi_configs" ON wifi_configs;
DROP POLICY IF EXISTS "teachers_manage_wifi" ON wifi_configs;
DROP POLICY IF EXISTS "teachers_select_wifi" ON wifi_configs;
DROP POLICY IF EXISTS "students_select_wifi" ON wifi_configs;
DROP POLICY IF EXISTS "teachers_insert_wifi" ON wifi_configs;
DROP POLICY IF EXISTS "teachers_update_wifi" ON wifi_configs;
DROP POLICY IF EXISTS "teachers_delete_wifi" ON wifi_configs;

-- Attendance sessions (old + new)
DROP POLICY IF EXISTS "teachers_own_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "students_read_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "students_read_active_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "teachers_manage_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "teachers_select_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "students_select_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "teachers_insert_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "teachers_update_sessions" ON attendance_sessions;

-- Attendance records (old + new)
DROP POLICY IF EXISTS "teachers_read_class_records" ON attendance_records;
DROP POLICY IF EXISTS "students_read_own_records" ON attendance_records;
DROP POLICY IF EXISTS "students_insert_own_records" ON attendance_records;
DROP POLICY IF EXISTS "teachers_manage_records" ON attendance_records;
DROP POLICY IF EXISTS "teachers_select_records" ON attendance_records;
DROP POLICY IF EXISTS "students_select_records" ON attendance_records;
DROP POLICY IF EXISTS "students_insert_records" ON attendance_records;
DROP POLICY IF EXISTS "teachers_insert_records" ON attendance_records;
DROP POLICY IF EXISTS "teachers_update_records" ON attendance_records;
DROP POLICY IF EXISTS "teachers_delete_records" ON attendance_records;

-- ============================================================
-- TEACHERS
-- ============================================================

-- Teachers can read their own profile
CREATE POLICY "teachers_select_own" ON teachers
  FOR SELECT USING (id = auth.uid());

-- Teachers can update their own profile
CREATE POLICY "teachers_update_own" ON teachers
  FOR UPDATE USING (id = auth.uid());

-- Teachers can insert their own profile (during registration)
CREATE POLICY "teachers_insert_own" ON teachers
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- STUDENTS
-- ============================================================

-- Students can read their own profile
CREATE POLICY "students_select_own" ON students
  FOR SELECT USING (id = auth.uid());

-- Teachers can read students in their classes
CREATE POLICY "teachers_select_students" ON students
  FOR SELECT USING (
    public.is_teacher()
    AND id IN (SELECT public.students_in_my_classes())
  );

-- Teachers can update students in their classes
CREATE POLICY "teachers_update_students" ON students
  FOR UPDATE USING (
    public.is_teacher()
    AND id IN (SELECT public.students_in_my_classes())
  );

-- Students can insert own profile (service role handles this, but just in case)
CREATE POLICY "students_insert_own" ON students
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- CLASSES
-- ============================================================

-- Teachers can read classes they teach
CREATE POLICY "teachers_select_classes" ON classes
  FOR SELECT USING (public.teaches_class(id));

-- Students can read classes they are enrolled in
CREATE POLICY "students_select_classes" ON classes
  FOR SELECT USING (public.enrolled_in_class(id));

-- Teachers can create classes (any authenticated teacher)
CREATE POLICY "teachers_insert_classes" ON classes
  FOR INSERT WITH CHECK (public.is_teacher());

-- Teachers can update their own classes
CREATE POLICY "teachers_update_classes" ON classes
  FOR UPDATE USING (public.teaches_class(id));

-- ============================================================
-- CLASS TEACHER ASSIGNMENTS
-- ============================================================

-- Teachers can read their own assignments
CREATE POLICY "teachers_select_assignments" ON class_teacher_assignments
  FOR SELECT USING (teacher_id = auth.uid());

-- Teachers can insert assignments for themselves
CREATE POLICY "teachers_insert_assignments" ON class_teacher_assignments
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

-- Teachers can delete their own assignments
CREATE POLICY "teachers_delete_assignments" ON class_teacher_assignments
  FOR DELETE USING (teacher_id = auth.uid());

-- ============================================================
-- CLASS ENROLLMENTS
-- ============================================================

-- Teachers can read enrollments for their classes
CREATE POLICY "teachers_select_enrollments" ON class_enrollments
  FOR SELECT USING (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can insert enrollments for their classes
CREATE POLICY "teachers_insert_enrollments" ON class_enrollments
  FOR INSERT WITH CHECK (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can delete enrollments for their classes
CREATE POLICY "teachers_delete_enrollments" ON class_enrollments
  FOR DELETE USING (class_id IN (SELECT public.taught_class_ids()));

-- Students can read their own enrollments
CREATE POLICY "students_select_enrollments" ON class_enrollments
  FOR SELECT USING (student_id = auth.uid());

-- ============================================================
-- CLASS SCHEDULES
-- ============================================================

-- Teachers can read schedules for their classes
CREATE POLICY "teachers_select_schedules" ON class_schedules
  FOR SELECT USING (class_id IN (SELECT public.taught_class_ids()));

-- Students can read schedules for their classes
CREATE POLICY "students_select_schedules" ON class_schedules
  FOR SELECT USING (class_id IN (SELECT public.enrolled_class_ids()));

-- Teachers can insert schedules for their classes
CREATE POLICY "teachers_insert_schedules" ON class_schedules
  FOR INSERT WITH CHECK (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can update schedules for their classes
CREATE POLICY "teachers_update_schedules" ON class_schedules
  FOR UPDATE USING (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can delete schedules for their classes
CREATE POLICY "teachers_delete_schedules" ON class_schedules
  FOR DELETE USING (class_id IN (SELECT public.taught_class_ids()));

-- ============================================================
-- CLASS LOCATIONS
-- ============================================================

-- Teachers can read locations for their classes
CREATE POLICY "teachers_select_locations" ON class_locations
  FOR SELECT USING (class_id IN (SELECT public.taught_class_ids()));

-- Students can read locations for their classes
CREATE POLICY "students_select_locations" ON class_locations
  FOR SELECT USING (class_id IN (SELECT public.enrolled_class_ids()));

-- Teachers can insert locations for their classes
CREATE POLICY "teachers_insert_locations" ON class_locations
  FOR INSERT WITH CHECK (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can update locations for their classes
CREATE POLICY "teachers_update_locations" ON class_locations
  FOR UPDATE USING (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can delete locations for their classes
CREATE POLICY "teachers_delete_locations" ON class_locations
  FOR DELETE USING (class_id IN (SELECT public.taught_class_ids()));

-- ============================================================
-- WIFI CONFIGS
-- ============================================================

-- Teachers can read WiFi configs for their classes
CREATE POLICY "teachers_select_wifi" ON wifi_configs
  FOR SELECT USING (class_id IN (SELECT public.taught_class_ids()));

-- Students can read WiFi configs for their classes
CREATE POLICY "students_select_wifi" ON wifi_configs
  FOR SELECT USING (class_id IN (SELECT public.enrolled_class_ids()));

-- Teachers can insert WiFi configs (own teacher_id)
CREATE POLICY "teachers_insert_wifi" ON wifi_configs
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND class_id IN (SELECT public.taught_class_ids())
  );

-- Teachers can update their own WiFi configs
CREATE POLICY "teachers_update_wifi" ON wifi_configs
  FOR UPDATE USING (teacher_id = auth.uid());

-- Teachers can delete their own WiFi configs
CREATE POLICY "teachers_delete_wifi" ON wifi_configs
  FOR DELETE USING (teacher_id = auth.uid());

-- ============================================================
-- ATTENDANCE SESSIONS
-- ============================================================

-- Teachers can read sessions they created
CREATE POLICY "teachers_select_sessions" ON attendance_sessions
  FOR SELECT USING (teacher_id = auth.uid());

-- Students can read sessions for their classes
CREATE POLICY "students_select_sessions" ON attendance_sessions
  FOR SELECT USING (class_id IN (SELECT public.enrolled_class_ids()));

-- Teachers can create sessions for their classes
CREATE POLICY "teachers_insert_sessions" ON attendance_sessions
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND class_id IN (SELECT public.taught_class_ids())
  );

-- Teachers can update their own sessions
CREATE POLICY "teachers_update_sessions" ON attendance_sessions
  FOR UPDATE USING (teacher_id = auth.uid());

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================

-- Teachers can read records for their classes
CREATE POLICY "teachers_select_records" ON attendance_records
  FOR SELECT USING (class_id IN (SELECT public.taught_class_ids()));

-- Students can read their own records
CREATE POLICY "students_select_records" ON attendance_records
  FOR SELECT USING (student_id = auth.uid());

-- Students can insert their own attendance record
CREATE POLICY "students_insert_records" ON attendance_records
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Teachers can insert records (manual marking)
CREATE POLICY "teachers_insert_records" ON attendance_records
  FOR INSERT WITH CHECK (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can update records for their classes
CREATE POLICY "teachers_update_records" ON attendance_records
  FOR UPDATE USING (class_id IN (SELECT public.taught_class_ids()));

-- Teachers can delete records for their classes
CREATE POLICY "teachers_delete_records" ON attendance_records
  FOR DELETE USING (class_id IN (SELECT public.taught_class_ids()));
