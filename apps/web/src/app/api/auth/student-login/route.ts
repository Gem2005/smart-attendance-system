import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword } from "@/lib/auth/encryption";
import { createSessionJwt } from "@/lib/auth/session";

// Handle Preflight OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Identifier and password are required" },
        { status: 400 }
      );
    }

    // Connect using service role since auth is bypassed, we need full DB access to check student
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try finding the student by email or roll_number
    const { data: student, error } = await adminClient
      .from("students")
      .select("id, email, roll_number, full_name, phone, encrypted_password")
      .or(`email.eq.${identifier},roll_number.eq.${identifier}`)
      .single();

    if (error || !student || !student.encrypted_password) {
      return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
    }

    // Verify AES-256 password
    const isPasswordValid = verifyPassword(password, student.encrypted_password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
    }

    // Generate JWT pretending to be Supabase Auth
    const accessToken = await createSessionJwt({
      sub: student.id,
      role: "authenticated",
      email: student.email || undefined,
      app_metadata: { role: "student" },
    });

    const response = NextResponse.json({
      success: true,
      access_token: accessToken,
      // Provide user details expected by client
      user: {
        id: student.id,
        email: student.email,
        full_name: student.full_name,
        roll_number: student.roll_number,
        phone: student.phone,
      }
    });
    
    // Add CORS headers to POST response
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;

  } catch (error: unknown) {
    console.error("Login route error:", error);
    const errorResponse = NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    errorResponse.headers.set("Access-Control-Allow-Origin", "*");
    return errorResponse;
  }
}
