import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { encryptPassword } from "@/lib/auth/encryption";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { newPassword } = body;

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Update password in DB using admin client to bypass any user auth restrictions if needed
  // Alternatively user could update their own row if RLS allows it, but using admin is safer here.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await adminClient
    .from("students")
    .update({ encrypted_password: encryptPassword(newPassword) })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }

  return NextResponse.json({ message: "Password updated successfully" });
}
