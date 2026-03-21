import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { verifySessionJwt } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sas-auth-token")?.value;
  const payload = token ? await verifySessionJwt(token) : null;
  
  if (!payload) {
    redirect("/login");
  }

  const user = { id: payload.sub, email: payload.email };
  const supabase = await createClient();

  // Get teacher profile (double check role at DB level)
  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("full_name, email, department")
    .eq("id", user.id)
    .single();

  if (error || !teacher) {
    // If not a teacher, shouldn't be here
    redirect("/");
  }

  return (
    <div className="flex flex-col h-screen md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger
              id="dashboard-mobile-nav-trigger"
              render={
                <button className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </button>
              }
            />
            <SheetContent side="left" className="w-[280px] p-0 border-r-0">
              <Sidebar
                teacherName={teacher.full_name ?? user.email ?? "Teacher"}
                teacherEmail={teacher.email ?? user.email ?? ""}
              />
            </SheetContent>
          </Sheet>
          <span className="text-lg font-semibold">Attendance</span>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar
          teacherName={teacher.full_name ?? user.email ?? "Teacher"}
          teacherEmail={teacher.email ?? user.email ?? ""}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-muted/40 p-4 sm:p-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
