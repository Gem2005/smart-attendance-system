-- 003_storage.sql
-- Supabase Storage bucket & policies for attendance photos

-- Create the bucket (private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false);

-- Students can upload their own photos
-- Path pattern: {class_id}/{session_id}/{student_id}.jpg
CREATE POLICY "students_upload_own_photo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

-- Students can read their own photos
CREATE POLICY "students_read_own_photo" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

-- Teachers can read photos for their classes
CREATE POLICY "teachers_read_class_photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT class_id::text FROM class_teacher_assignments
      WHERE teacher_id = auth.uid()
    )
  );
