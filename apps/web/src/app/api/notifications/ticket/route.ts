import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { studentId, classId, description, proof_urls } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get Teacher Email from Class ID
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("name, teacher_id, auth_users!teacher_id (email)")
      .eq("id", classId)
      .single();

    if (classError || !classData) {
      return NextResponse.json({ error: "Teacher not found for this class." }, { status: 404 });
    }

    const teacherEmail = Array.isArray(classData.auth_users) 
      ? classData.auth_users[0]?.email 
      : (classData.auth_users as { email?: string })?.email;

    if (!teacherEmail) {
      return NextResponse.json({ error: "Teacher email not found for this class." }, { status: 404 });
    }

    // 2. Get Student details
    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("full_name, roll_number")
      .eq("id", studentId)
      .single();

    if (studentError) {
      console.error("Failed to fetch student details:", studentError);
    }

    const studentName = studentData?.full_name || studentId;
    const rollNumber = studentData?.roll_number || "N/A";

    // Send email using Resend HTTP API
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set. Skipping email dispatch.");
      return NextResponse.json({ success: true, message: "Ticket created, but email skipped (no API key)." });
    }

    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const classUrl = `${dashboardUrl}/classes?id=${classId}`;
    const ticketsUrl = `${dashboardUrl}/tickets`;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">New Attendance Request Pending</h2>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Roll Number:</strong> ${rollNumber}</p>
          <p><strong>Class:</strong> ${classData.name}</p>
          <p><strong>Description:</strong> ${description}</p>
          ${proof_urls && proof_urls.length > 0 ? `<p><strong>Proof Attachments:</strong> ${proof_urls.length} images provided</p>` : ''}
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <a href="${classUrl}" style="background-color: #f3f4f6; color: #111827; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Go to Class
          </a>
          <a href="${ticketsUrl}" style="background-color: #2563eb; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View All Requests
          </a>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 14px;">Please review your Teacher Dashboard to approve or reject this request.</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Attendance System <onboarding@resend.dev>",
        to: [teacherEmail],
        subject: `[Action Required] New Attendance Request by ${studentName}`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errorData = await resendRes.json();
      console.error("Resend API Error:", errorData);
      return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Email sent successfully." });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error occurred" }, { status: 500 });
  }
}
