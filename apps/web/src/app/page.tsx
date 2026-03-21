import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentLogoutButton } from "@/components/student-logout-button";

export default async function HomePage() {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (user) {
    const role = user.user_metadata?.role || user.app_metadata?.role || "student";

    if (role === "teacher") {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (teacher) {
        redirect("/dashboard");
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">Teacher Profile Not Found</h1>
          <p className="text-lg mb-8 text-muted-foreground max-w-2xl">
            Your account is authenticated as a teacher, but no teacher profile exists in the database yet.
            Please contact an administrator or sign out and register again.
          </p>
          <StudentLogoutButton />
        </div>
      );
    }

    if (role === "student") {
      // Instead of an infinite loop, inform them they should use the mobile app
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
          <h1 className="text-3xl font-bold mb-4">Student Access</h1>
          <p className="text-lg mb-8 text-muted-foreground">
            The web portal is for teachers. Please use the mobile application to mark your attendance.
          </p>
          <StudentLogoutButton />
        </div>
      );
    }

    redirect("/login");
  } else {
    redirect("/login");
  }
}
