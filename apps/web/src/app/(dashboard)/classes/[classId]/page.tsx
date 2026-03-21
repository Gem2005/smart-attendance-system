import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClassTabs } from "@/components/class-tabs";
import { Badge } from "@/components/ui/badge";
import { Building, DoorOpen } from "lucide-react";
import { cookies } from "next/headers";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const token = cookieStore.get("sas-auth-token")?.value;

  const { data: cls, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .single();

  if (error || !cls) {
    notFound();
  }

  // Fetch related data in parallel
  const [enrollmentsRes, schedulesRes, locationRes, wifiRes, sessionsRes] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("class_id", classId),
    supabase
      .from("class_schedules")
      .select("*")
      .eq("class_id", classId)
      .order("day_of_week"),
    supabase
      .from("class_locations")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle(),
    supabase
      .from("wifi_configs")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle(),
    supabase
      .from("attendance_sessions")
      .select("id, session_date, started_at, is_active")
      .eq("class_id", classId)
      .order("session_date", { ascending: false })
      .limit(50)
  ]);

  const studentCount = enrollmentsRes.count;
  const schedules = schedulesRes.data;
  const location = locationRes.data;
  const wifiConfig = wifiRes.data;
  const sessions = sessionsRes.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{cls.name}</h1>
          <Badge variant="secondary">{cls.code}</Badge>
        </div>
        <div className="flex items-center gap-4 mt-1 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Building className="h-3.5 w-3.5" />
            {cls.building}
          </span>
          <span className="flex items-center gap-1">
            <DoorOpen className="h-3.5 w-3.5" />
            Room {cls.room_number}
          </span>
          <span>{studentCount ?? 0} students</span>
        </div>
      </div>

      <ClassTabs
        classId={classId}
        schedules={schedules ?? []}
        location={location}
        wifiConfig={wifiConfig}
        qrRefreshInterval={cls.qr_refresh_interval ?? 30}
        token={token}
        initialSessions={sessions ?? []}
      />
    </div>
  );
}
