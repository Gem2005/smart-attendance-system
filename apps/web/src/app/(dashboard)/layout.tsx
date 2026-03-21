import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { verifySessionJwt } from "@/lib/auth/session";
import { cookies } from "next/headers";

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
    <div className="flex h-screen">
      <Sidebar
        teacherName={teacher.full_name ?? user.email ?? "Teacher"}
        teacherEmail={teacher.email ?? user.email ?? ""}
      />
      <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {children}
      </main>
    </div>
  );
}
