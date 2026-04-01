import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  try {
    const user = await import("@/lib/supabase/server").then((m) => m.getUser());

    if (!user) {
      return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    let ticketId: string | undefined;
    try {
      const body = await request.json();
      ticketId = body?.ticketId;
    } catch {
      return withCors(NextResponse.json({ error: "Invalid request body" }, { status: 400 }));
    }

    if (!ticketId) {
      return withCors(NextResponse.json({ error: "ticketId is required" }, { status: 400 }));
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return withCors(NextResponse.json({ error: "Server misconfiguration" }, { status: 500 }));
    }

    const adminClient = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: ticket, error: fetchError } = await adminClient
      .from("attendance_requests")
      .select("id, student_id, status")
      .eq("id", ticketId)
      .single();

    if (fetchError || !ticket) {
      return withCors(NextResponse.json({ error: "Ticket not found" }, { status: 404 }));
    }

    if (ticket.student_id !== user.id) {
      return withCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }

    if (ticket.status !== "pending") {
      return withCors(NextResponse.json({ error: "Only pending tickets can be closed" }, { status: 400 }));
    }

    const { error: updateError } = await adminClient
      .from("attendance_requests")
      .update({
        status: "rejected",
        teacher_notes: "Closed by student",
        resolved_at: new Date().toISOString(),
        new_attendance_status: null,
      })
      .eq("id", ticketId)
      .eq("student_id", user.id);

    if (updateError) {
      return withCors(NextResponse.json({ error: "Failed to close ticket" }, { status: 500 }));
    }

    return withCors(NextResponse.json({ success: true }));
  } catch (error: any) {
    if (error?.code === "ECONNRESET" || String(error?.message || "").toLowerCase().includes("aborted")) {
      return withCors(NextResponse.json({ error: "Request aborted" }, { status: 499 }));
    }
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}
