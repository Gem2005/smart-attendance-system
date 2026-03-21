import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Users, CalendarCheck, BarChart3 } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  // Fetch stats for this teacher
  const { data: assignments } = await supabase
    .from("class_teacher_assignments")
    .select("class_id")
    .eq("teacher_id", user!.id);

  const classIds = assignments?.map((a) => a.class_id) ?? [];

  // Total classes
  const totalClasses = classIds.length;

  // Total enrolled students across all classes
  let totalStudents = 0;
  if (classIds.length > 0) {
    const { count } = await supabase
      .from("class_enrollments")
      .select("*", { count: "exact", head: true })
      .in("class_id", classIds);
    totalStudents = count ?? 0;
  }

  // Today's sessions
  const today = new Date().toISOString().split("T")[0];
  let todaySessions = 0;
  if (classIds.length > 0) {
    const { count } = await supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("teacher_id", user!.id)
      .eq("session_date", today);
    todaySessions = count ?? 0;
  }

  // Total attendance records this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let monthRecords = 0;
  if (classIds.length > 0) {
    const { count } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .in("class_id", classIds)
      .gte("created_at", monthStart.toISOString());
    monthRecords = count ?? 0;
  }

  const stats = [
    {
      title: "Total Classes",
      value: totalClasses,
      icon: BookOpen,
    },
    {
      title: "Total Students",
      value: totalStudents,
      icon: Users,
    },
    {
      title: "Today's Sessions",
      value: todaySessions,
      icon: CalendarCheck,
    },
    {
      title: "Records This Month",
      value: monthRecords,
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&apos;s an overview of your classes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
