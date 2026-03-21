import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TicketsClient } from "./client";

export default async function TicketsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch pending tickets for this teacher's classes
  // RLS handles the filtering inherently via the "Teachers can read requests for their classes" policy.
  const { data: requests, error } = await supabase
    .from("attendance_requests")
    .select(`
      *,
      classes:class_id (name, code),
      sessions:session_id (session_date),
      students:student_id (full_name, roll_number)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tickets:", error);
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Attendance Requests</h2>
      </div>
      <TicketsClient initialRequests={requests || []} />
    </div>
  );
}
