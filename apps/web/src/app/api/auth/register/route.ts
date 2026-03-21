import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { encryptPassword } from "@/lib/auth/encryption";
import {
  isTeacherSignupAccessTokenValid,
  TEACHER_SIGNUP_ACCESS_COOKIE,
} from "@/lib/auth/register-access";

export async function POST(request: NextRequest) {
  const signupAccessToken = request.cookies.get(TEACHER_SIGNUP_ACCESS_COOKIE)?.value;
  if (!isTeacherSignupAccessTokenValid(signupAccessToken)) {
    return NextResponse.json({ error: "Signup access not granted" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, fullName, department } = body;

  if (!email || !password || !fullName) {
    return NextResponse.json(
      { error: "email, password, and fullName are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

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

  // Check if email is already registered
  const { data: existing } = await adminClient.from("teachers").select("id").eq("email", email).single();
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  // Create teacher profile
  const { error: profileError } = await adminClient.from("teachers").insert({
    email,
    full_name: fullName,
    department: department || null,
    encrypted_password: encryptPassword(password)
  });

  if (profileError) {
    return NextResponse.json(
      { error: "Account creation failed: " + profileError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Account created successfully. You can now sign in.",
  });
}
