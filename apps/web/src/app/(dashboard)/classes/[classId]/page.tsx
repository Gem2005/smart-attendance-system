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

  // Get enrollment count
  const { count: studentCount } = await supabase
    .from("class_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  // Get schedules
  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("*")
    .eq("class_id", classId)
    .order("day_of_week");

  // Get location
  const { data: location } = await supabase
    .from("class_locations")
    .select("*")
    .eq("class_id", classId)
    .single();

  // Get WiFi config
  const { data: wifiConfig } = await supabase
    .from("wifi_configs")
    .select("*")
    .eq("class_id", classId)
    .single();

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
      />
    </div>
  );
}
