import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, classId } = await req.json();

    if (!sessionId || !classId) {
      return NextResponse.json({ error: "Missing sessionId or classId" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await import('@/lib/supabase/server').then(m => m.getUser());

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. End the session
    const { error: sessionError } = await supabase
      .from("attendance_sessions")
      .update({ is_active: false })
      .eq("id", sessionId)
      .eq("teacher_id", user.id);

    if (sessionError) {
      console.error("Session update error:", sessionError);
      return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
    }

    // 2. Fetch all enrolled students
    const { data: enrollments, error: enrollError } = await supabase
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId);

    if (enrollError) {
      console.error("Enrollment fetch error:", enrollError);
      return NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 });
    }

    // 3. Fetch all present/already-marked students
    const { data: records, error: recordsError } = await supabase
      .from("attendance_records")
      .select("student_id")
      .eq("session_id", sessionId);

    if (recordsError) {
      console.error("Records fetch error:", recordsError);
      return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
    }

    // 4. Calculate missing students
    const enrolledIds = enrollments.map(e => e.student_id);
    const presentIds = new Set(records.map(r => r.student_id));
    const missingIds = enrolledIds.filter(id => !presentIds.has(id));

    // 5. Insert absent records
    if (missingIds.length > 0) {
      const absentRecords = missingIds.map(studentId => ({
        session_id: sessionId,
        class_id: classId,
        student_id: studentId,
        status: "absent" as const,
        marked_by: "system" as const,
        scanned_at: new Date().toISOString() // timestamp of absence
      }));

      const { error: insertError } = await supabase
        .from("attendance_records")
        .insert(absentRecords);

      if (insertError) {
        console.error("Absent insert error:", insertError);
        return NextResponse.json({ error: "Failed to logic missing students" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, markedAbsent: missingIds.length });
  } catch (error: unknown) {
    console.error("End session error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
