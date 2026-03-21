import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptPassword } from "@/lib/auth/encryption";
import {
  isTeacherSignupAccessTokenValid,
  TEACHER_SIGNUP_ACCESS_COOKIE,
} from "@/lib/auth/register-access";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(TEACHER_SIGNUP_ACCESS_COOKIE)?.value;

    if (!isTeacherSignupAccessTokenValid(token)) {
      return NextResponse.json({ error: "Access denied or token expired" }, { status: 403 });
    }

    const { email, password, confirmPassword } = await request.json();

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Email, password, and confirm password are required" },
        { status: 400 }
      );
    }
    
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if the email exists in teachers table
    const { data: teacher, error } = await adminClient
      .from("teachers")
      .select("id, email")
      .eq("email", email)
      .single();

    if (error || !teacher) {
      return NextResponse.json({ error: "Email not in db or registered as teacher" }, { status: 404 });
    }

    const encrypted_password = encryptPassword(password);

    const { error: updateError } = await adminClient
      .from("teachers")
      .update({ encrypted_password })
      .eq("id", teacher.id);
      
    if (updateError) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });

  } catch (error: unknown) {
    console.error("Reset password route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
