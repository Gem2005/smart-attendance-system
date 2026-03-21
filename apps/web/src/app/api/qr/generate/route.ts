import { NextRequest, NextResponse } from "next/server";
import { createQRPayload } from "@/lib/qr";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, classId } = body;

  if (!sessionId || !classId) {
    return NextResponse.json(
      { error: "sessionId and classId are required" },
      { status: 400 }
    );
  }

  // Verify the session belongs to this teacher's class
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id, teacher_id, is_active")
    .eq("id", sessionId)
    .eq("class_id", classId)
    .single();

  if (!session || session.teacher_id !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.is_active) {
    return NextResponse.json(
      { error: "Session is no longer active" },
      { status: 400 }
    );
  }

  const payload = createQRPayload(sessionId, classId);
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return NextResponse.json({ qrDataUrl });
}
