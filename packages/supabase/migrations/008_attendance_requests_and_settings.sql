-- 1. Add QR refresh interval to classes (to allow teacher to change it)
-- Options requested: 30, 60 (1m), 120 (2m), 300 (5m). Defaulting to 30.
ALTER TABLE public.classes ADD COLUMN qr_refresh_interval INTEGER DEFAULT 30;

-- 2. Create Attendance Requests Table
CREATE TABLE public.attendance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  proof_urls TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  teacher_notes TEXT,
  new_attendance_status TEXT CHECK (new_attendance_status IN ('present', 'absent', 'manual'))
);

-- 3. Indexes
CREATE INDEX idx_attendance_requests_class ON public.attendance_requests(class_id);
CREATE INDEX idx_attendance_requests_student ON public.attendance_requests(student_id);

-- 4. RLS for Requests
ALTER TABLE public.attendance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create attendance requests" ON public.attendance_requests
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can read own requests" ON public.attendance_requests
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Teachers can read requests for their classes" ON public.attendance_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.class_teacher_assignments cta 
      WHERE cta.class_id = attendance_requests.class_id 
      AND cta.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update requests for their classes" ON public.attendance_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.class_teacher_assignments cta 
      WHERE cta.class_id = attendance_requests.class_id 
      AND cta.teacher_id = auth.uid()
    )
  );

-- 5. Storage for Proof Images
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-proofs', 'attendance-proofs', false) ON CONFLICT DO NOTHING;

CREATE POLICY "students_upload_proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attendance-proofs' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "students_read_own_proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attendance-proofs' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "teachers_read_all_proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attendance-proofs' AND public.is_teacher()
  );

-- 6. Trigger for handling updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.attendance_requests
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();