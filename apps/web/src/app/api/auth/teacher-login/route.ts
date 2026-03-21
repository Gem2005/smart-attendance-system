import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword } from "@/lib/auth/encryption";
import { createSessionJwt } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: teacher, error } = await adminClient
      .from("teachers")
      .select("id, email, full_name, encrypted_password")
      .eq("email", email)
      .single();

    if (error || !teacher || !teacher.encrypted_password) {
      return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
    }

    const isPasswordValid = verifyPassword(password, teacher.encrypted_password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
    }

    const accessToken = await createSessionJwt({
      sub: teacher.id,
      role: "authenticated",
      email: teacher.email,
      app_metadata: { role: "teacher" },
    });

    // In a pure web context, we just return the token and the client can set it in Supabase
    return NextResponse.json({
      success: true,
      access_token: accessToken,
      user: {
        id: teacher.id,
        email: teacher.email,
        full_name: teacher.full_name,
      }
    });

  } catch (error: unknown) {
    console.error("Login route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
