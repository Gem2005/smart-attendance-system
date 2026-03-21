-- 010_make_student_email_nullable.sql
-- Make email optional for students (not all students have emails)

ALTER TABLE students
  ALTER COLUMN email DROP NOT NULL;

-- Drop the unique constraint and recreate it as a partial unique index
-- so that multiple students can have NULL email (only non-NULL emails must be unique)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS students_email_unique
  ON students (email)
  WHERE email IS NOT NULL;
