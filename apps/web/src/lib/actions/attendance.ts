"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAbsentRemaining(classId: string, sessionId: string) {
  const supabase = await createClient();

  // Get all enrolled students
  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", classId);

  if (!enrollments) return { error: "Failed to fetch enrollments" };

  // Get already marked students
  const { data: records } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("session_id", sessionId);

  const markedIds = new Set((records ?? []).map((r) => r.student_id));
  const unmarked = enrollments.filter((e) => !markedIds.has(e.student_id));

  if (unmarked.length === 0) {
    return { success: true, count: 0 };
  }

  const inserts = unmarked.map((e) => ({
    session_id: sessionId,
    student_id: e.student_id,
    class_id: classId,
    status: "absent" as const,
    marked_by: "teacher" as const,
    notes: "Marked absent by teacher",
  }));

  const { error } = await supabase
    .from("attendance_records")
    .insert(inserts);

  if (error) return { error: error.message };

  revalidatePath(`/classes/${classId}`);
  return { success: true, count: unmarked.length };
}

export async function updateAttendanceStatus(
  classId: string,
  recordId: string,
  newStatus: "present" | "absent" | "manual",
  notes: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("attendance_records")
    .update({
      status: newStatus,
      marked_by: "teacher",
      notes: notes || null,
    })
    .eq("id", recordId);

  if (error) return { error: error.message };

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

export async function getSessionRecords(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attendance_records")
    .select(`
      *,
      student:students (
        full_name,
        roll_number,
        email
      )
    `)
    .eq("session_id", sessionId)
    .order("created_at");

  if (error) return { error: error.message };

  const enriched = (data ?? []).map((r) => {
    const student = Array.isArray(r.student) ? r.student[0] : r.student;
    return {
      ...r,
      student: student || null
    };
  });

  return { data: enriched };
}
