import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { encryptPassword } from "@/lib/auth/encryption";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify teacher (RLS on teachers table handles this)
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!teacher) {
    return NextResponse.json(
      { error: "Only teachers can reset student passwords" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { studentId, newPassword } = body;

  if (!studentId || !newPassword) {
    return NextResponse.json(
      { error: "studentId and newPassword are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Verify this student is in one of the teacher's classes
  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("student_id", studentId)
    .limit(1)
    .single();

  if (!enrollment) {
    return NextResponse.json(
      { error: "Student not found in your classes" },
      { status: 404 }
    );
  }

  // Use admin client only for auth operation
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const adminClient = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await adminClient.from("students").update({
    encrypted_password: encryptPassword(newPassword),
  }).eq("id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: "Password updated successfully" });
}
