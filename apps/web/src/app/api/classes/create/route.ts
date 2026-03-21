import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { name, code, building, roomNumber, latitude, longitude, radiusMeters } = body;

  if (!name || !code || !building || !roomNumber) {
    return NextResponse.json(
      { error: "name, code, building, and roomNumber are required" },
      { status: 400 }
    );
  }

  // Generate ID server-side so we can skip .select() on insert.
  // Using .select() after insert would fail because the SELECT policy
  // (teaches_class) requires a class_teacher_assignment that doesn't exist yet.
  const classId = randomUUID();

  const { error: classError } = await supabase
    .from("classes")
    .insert({ id: classId, name, code, building, room_number: roomNumber });

  if (classError) {
    return NextResponse.json({ error: classError.message }, { status: 400 });
  }

  const newClass = { id: classId };

  // Assign teacher to class
  const { error: assignError } = await supabase
    .from("class_teacher_assignments")
    .insert({ class_id: newClass.id, teacher_id: user.id });

  if (assignError) {
    // Rollback class creation
    await supabase.from("classes").delete().eq("id", newClass.id);
    return NextResponse.json({ error: assignError.message }, { status: 400 });
  }

  // Save class location if coordinates provided
  if (latitude != null && longitude != null) {
    const { error: locError } = await supabase.from("class_locations").insert({
      class_id: newClass.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius_meters: radiusMeters ? parseInt(radiusMeters) : 100,
    });

    if (locError) {
      // Non-fatal — class still created
      console.error("Failed to save location:", locError.message);
    }
  }

  return NextResponse.json({ id: newClass.id });
}
