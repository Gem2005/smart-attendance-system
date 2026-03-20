-- Drop the incorrect foreign key referencing auth.users if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'attendance_requests_student_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_requests DROP CONSTRAINT attendance_requests_student_id_fkey;
  END IF;
END $$;

-- Add the correct foreign key referencing public.students
ALTER TABLE public.attendance_requests 
  ADD CONSTRAINT attendance_requests_student_id_fkey 
  FOREIGN KEY (student_id) 
  REFERENCES public.students(id) 
  ON DELETE CASCADE;

-- Also force the schema cache to reload
NOTIFY pgrst, 'reload schema';
