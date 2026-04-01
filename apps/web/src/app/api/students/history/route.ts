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

    // 1. Fetch Enrolled Classes
    const { data: enrollments, error: enrollError } = await adminClient
      .from("class_enrollments")
      .select(`
        class_id,
        classes!inner(name, code, id)
      `)
      .eq("student_id", user.id);

    if (enrollError) {
      return withCors(NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 }));
    }

    const classIds = enrollments?.map((e) => e.class_id) || [];

    // 2. Fetch Attendance Records
    const { data: recordsData, error: recordsError } = await adminClient
      .from("attendance_records")
      .select(`
        id,
        status,
        scanned_at,
        created_at,
        class_id,
        session_id,
        gps_latitude,
        gps_longitude,
        geofence_passed,
        wifi_ssid_found,
        wifi_passed,
        photo_url,
        marked_by,
        notes,
        attendance_sessions!inner(session_date, teacher_id),
        classes!inner(name, code)
      `)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (recordsError) {
      return withCors(NextResponse.json({ error: "Failed to fetch records" }, { status: 500 }));
    }

    // 3. Collect all teacher IDs needed
    const teacherIds = new Set<string>();

    const { data: assignments } = await adminClient
      .from("class_teacher_assignments")
      .select("class_id, teacher_id")
      .in("class_id", classIds);

    assignments?.forEach((a) => {
      if (a.teacher_id) teacherIds.add(a.teacher_id);
    });

    recordsData?.forEach((r: any) => {
      if (r.attendance_sessions?.teacher_id) {
        teacherIds.add(r.attendance_sessions.teacher_id);
      }
    });

    // 4. Fetch Teachers
    const { data: teachers } = await adminClient
      .from("teachers")
      .select("id, full_name")
      .in("id", Array.from(teacherIds));

    const teacherMap = new Map<string, string>(
      teachers?.map((t) => [t.id, t.full_name]) || []
    );

    const assignmentMap = new Map<string, string>(
      assignments?.map((a) => [a.class_id, teacherMap.get(a.teacher_id) || ""]) || []
    );

    // 5. Enrich Data
    const enrichedClasses = enrollments?.map((e: any) => ({
      class_id: e.class_id,
      class_name: e.classes?.name || "Unknown",
      class_code: e.classes?.code || "N/A",
      teacher_name: assignmentMap.get(e.class_id),
    })) || [];

    const enrichedRecords = recordsData?.map((r: any) => ({
      ...r,
      id: r.id || Math.random().toString(),
      class_name: r.classes?.name ?? "",
      class_code: r.classes?.code ?? "",
      session_date: r.attendance_sessions?.session_date ?? "",
      teacher_name: teacherMap.get(r.attendance_sessions?.teacher_id),
    })) || [];

    // 6. Generate signed URLs for photos (attendance-photos bucket is private)
    const recordsWithSignedPhotos = await Promise.all(
      enrichedRecords.map(async (record: any) => {
        if (!record.photo_url) {
          return record;
        }

        try {
          // If photo_url already starts with http, it's already a full URL
          if (record.photo_url.startsWith("http")) {
            return record;
          }
          
          // Generate a signed URL valid for 24 hours
          const { data: signed, error: signError } = await adminClient.storage
            .from("attendance-photos")
            .createSignedUrl(record.photo_url, 86400); // 24 hours

          if (signError || !signed?.signedUrl) {
            console.warn(`Failed to sign photo URL for ${record.photo_url}:`, signError);
            return record; // Return original if signing fails
          }

          return {
            ...record,
            photo_url: signed.signedUrl,
          };
        } catch (err) {
          console.error(`Error generating signed URL for photo ${record.photo_url}:`, err);
          return record;
        }
      })
    );

    return withCors(NextResponse.json({
      enrolledClasses: enrichedClasses,
      records: recordsWithSignedPhotos
    }));
  } catch (error: any) {
    if (error?.code === "ECONNRESET" || String(error?.message || "").toLowerCase().includes("aborted")) {
      return withCors(NextResponse.json({ error: "Request aborted" }, { status: 499 }));
    }
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}
