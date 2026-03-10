-- 004_fix_policies_and_schema.sql
-- Fix missing RLS INSERT policies and schema adjustments

-- ============================================================
-- SCHEMA FIXES
-- ============================================================

-- Make students.email nullable (students can register with just roll number)
ALTER TABLE students ALTER COLUMN email DROP NOT NULL;

-- Drop old unique constraint on email, re-add as partial (allowing nulls)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS students_email_unique ON students(email) WHERE email IS NOT NULL;

-- ============================================================
-- TRIGGER: auto-copy role from user_metadata to app_metadata
-- on auth.users insert so get_user_role() works immediately
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Copy role from raw_user_meta_data to raw_app_meta_data
  IF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', NEW.raw_user_meta_data ->> 'role');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates (e.g., when role changes)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'role' IS DISTINCT FROM OLD.raw_user_meta_data ->> 'role')
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- MISSING INSERT POLICIES
-- ============================================================

-- Teachers can insert their own profile row (during registration)
CREATE POLICY "teachers_insert_own" ON teachers
  FOR INSERT WITH CHECK (id = auth.uid());

-- Students can insert their own profile row (during self-signup)
CREATE POLICY "students_insert_own" ON students
  FOR INSERT WITH CHECK (id = auth.uid());

-- Fix: teachers_create_classes should check teachers table, not just app_metadata
-- This handles users whose app_metadata.role was not set (registered before trigger)
DROP POLICY IF EXISTS "teachers_create_classes" ON classes;
CREATE POLICY "teachers_create_classes" ON classes
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM teachers)
  );

-- ============================================================
-- FIX: Allow students to also read class_schedules
-- (already covered by read_class_schedules policy via UNION)
-- ============================================================

-- No change needed — existing policy covers it.

-- ============================================================
-- FIX: attendance_sessions — allow students to read even
-- inactive sessions (for history page)
-- ============================================================
DROP POLICY IF EXISTS "students_read_active_sessions" ON attendance_sessions;

CREATE POLICY "students_read_sessions" ON attendance_sessions
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );
