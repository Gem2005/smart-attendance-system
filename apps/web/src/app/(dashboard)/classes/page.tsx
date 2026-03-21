import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
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
  const user = await getUser();

  if (!user) return null;

  // Get classes assigned to this teacher with enrollment counts in a single efficient query
  const { data: classes } = await supabase
    .from("classes")
    .select(`
      id, 
      name, 
      code, 
      building, 
      room_number,
      class_teacher_assignments!inner(teacher_id),
      class_enrollments(count)
    `)
    .eq("class_teacher_assignments.teacher_id", user.id)
    .order("name");

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

      {!classes || classes.length === 0 ? (
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
          {classes.map((cls: any) => (
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
                    {cls.class_enrollments?.[0]?.count ?? 0} students enrolled
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
