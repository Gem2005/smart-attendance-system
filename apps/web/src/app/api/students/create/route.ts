import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { encryptPassword } from "@/lib/auth/encryption";

export async function POST(request: NextRequest) {
  // Verify the requesting user is an authenticated teacher
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the user is a teacher
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!teacher) {
    return NextResponse.json(
      { error: "Only teachers can create student accounts" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { email, fullName, rollNumber, phone, classId } = body;

  if (!fullName || !rollNumber) {
    return NextResponse.json(
      { error: "fullName and rollNumber are required" },
      { status: 400 }
    );
  }

  // Password is always the roll number
  const actualPassword = rollNumber;

  if (actualPassword.length < 6) {
    return NextResponse.json(
      { error: "Roll number must be at least 6 characters (used as default password)" },
      { status: 400 }
    );
  }

  // Use admin client to create auth user
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: service role key not set" },
      { status: 500 }
    );
  }

  const adminClient = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check if student already exists by roll number
  const { data: existingByRoll } = await adminClient
    .from("students")
    .select("id")
    .eq("roll_number", rollNumber)
    .single();

  if (existingByRoll) {
    // Student already exists — just enroll in class if classId provided
    if (classId) {
      const { error: enrollError } = await adminClient
        .from("class_enrollments")
        .insert({ class_id: classId, student_id: existingByRoll.id });

      if (enrollError && enrollError.code !== "23505") {
        return NextResponse.json({ error: enrollError.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      student: existingByRoll,
      message: "Student already exists, enrolled in class",
    });
  }

  // Check if email already exists
  if (email) {
    const { data: existingByEmail } = await adminClient
      .from("students")
      .select("id")
      .eq("email", email)
      .single();

    if (existingByEmail) {
      if (classId) {
        const { error: enrollError } = await adminClient
          .from("class_enrollments")
          .insert({ class_id: classId, student_id: existingByEmail.id });

        if (enrollError && enrollError.code !== "23505") {
          return NextResponse.json({ error: enrollError.message }, { status: 400 });
        }
      }

      return NextResponse.json({
        student: existingByEmail,
        message: "Student already exists, enrolled in class",
      });
    }
  }

  // Create student profile
  const { data: profileData, error: profileError } = await adminClient.from("students").insert({
    email: email || null,
    full_name: fullName,
    roll_number: rollNumber,
    phone: phone || null,
    encrypted_password: encryptPassword(actualPassword)
  }).select('id').single();

  if (profileError) {
    return NextResponse.json(
      { error: "Student creation failed: " + profileError.message },
      { status: 500 }
    );
  }

  // Auto-enroll in class if classId provided
  if (classId) {
    await adminClient
      .from("class_enrollments")
      .insert({ class_id: classId, student_id: profileData.id });
  }

  return NextResponse.json({
    student: { id: profileData.id, email: email || null, full_name: fullName, roll_number: rollNumber },
    message: "Student account created successfully",
  });
}
