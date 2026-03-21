import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateClassDialog } from "@/components/create-class-dialog";
import { Building, DoorOpen } from "lucide-react";

export default async function ClassesPage() {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  // Get classes assigned to this teacher
  const { data: assignments } = await supabase
    .from("class_teacher_assignments")
    .select("class_id")
    .eq("teacher_id", user!.id);

  const classIds = assignments?.map((a) => a.class_id) ?? [];

  let classes: {
    id: string;
    name: string;
    code: string;
    building: string;
    room_number: string;
  }[] = [];

  if (classIds.length > 0) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, code, building, room_number")
      .in("id", classIds)
      .order("name");
    classes = data ?? [];
  }

  // Get enrollment counts
  const enrollmentCounts: Record<string, number> = {};
  if (classIds.length > 0) {
    for (const classId of classIds) {
      const { count } = await supabase
        .from("class_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("class_id", classId);
      enrollmentCounts[classId] = count ?? 0;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">
            Manage your classes, students, and attendance.
          </p>
        </div>
        <CreateClassDialog />
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold">No classes yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first class to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link key={cls.id} href={`/classes/${cls.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{cls.name}</CardTitle>
                    <Badge variant="secondary">{cls.code}</Badge>
                  </div>
                  <CardDescription className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {cls.building}
                    </span>
                    <span className="flex items-center gap-1">
                      <DoorOpen className="h-3 w-3" />
                      Room {cls.room_number}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {enrollmentCounts[cls.id] ?? 0} students enrolled
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
