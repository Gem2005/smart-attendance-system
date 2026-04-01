import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  try {
    const user = await import("@/lib/supabase/server").then((m) => m.getUser());

    if (!user) {
      return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
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

    const { data: tickets, error: ticketError } = await adminClient
      .from("attendance_requests")
      .select("id, class_id, description, proof_urls, status, created_at, updated_at, resolved_at, teacher_notes")
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false });

    if (ticketError) {
      return withCors(NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 }));
    }

    type TicketRow = {
    id: string;
    class_id: string;
    description: string;
    proof_urls: string[];
    status: "pending" | "approved" | "rejected";
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    teacher_notes: string | null;
  };
  type ClassRow = { id: string; name: string; code: string };
  type AssignmentRow = { class_id: string; teacher_id: string };
  type TeacherRow = { id: string; full_name: string };

    const ticketRows = (tickets || []) as TicketRow[];
    const classIds = [...new Set(ticketRows.map((t) => t.class_id))];

    const [classesResult, assignmentsResult] = await Promise.all([
      classIds.length
        ? adminClient.from("classes").select("id, name, code").in("id", classIds)
        : Promise.resolve({ data: [], error: null } as any),
      classIds.length
        ? adminClient.from("class_teacher_assignments").select("class_id, teacher_id").in("class_id", classIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (classesResult.error || assignmentsResult.error) {
      return withCors(NextResponse.json({ error: "Failed to enrich ticket data" }, { status: 500 }));
    }

    const assignmentRows = (assignmentsResult.data || []) as AssignmentRow[];
    const classRows = (classesResult.data || []) as ClassRow[];
    const teacherIds = [...new Set(assignmentRows.map((a) => a.teacher_id))];
    const teachersResult = teacherIds.length
      ? await adminClient.from("teachers").select("id, full_name").in("id", teacherIds)
      : { data: [], error: null };

    if (teachersResult.error) {
      return withCors(NextResponse.json({ error: "Failed to load faculty data" }, { status: 500 }));
    }

    const classMap = new Map<string, ClassRow>(classRows.map((c) => [c.id, c]));
    const teacherRows = (teachersResult.data || []) as TeacherRow[];
    const teacherMap = new Map<string, string>(teacherRows.map((t) => [t.id, t.full_name]));
    const facultyByClass = new Map(
      assignmentRows.map((a) => [a.class_id, teacherMap.get(a.teacher_id) || null])
    );

    const enriched = ticketRows.map((ticket) => ({
      ...ticket,
      class_name: classMap.get(ticket.class_id)?.name || null,
      class_code: classMap.get(ticket.class_id)?.code || null,
      faculty_name: facultyByClass.get(ticket.class_id) || null,
    }));

    return withCors(NextResponse.json({ tickets: enriched }));
  } catch (error: any) {
    if (error?.code === "ECONNRESET" || String(error?.message || "").toLowerCase().includes("aborted")) {
      return withCors(NextResponse.json({ error: "Request aborted" }, { status: 499 }));
    }
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}
