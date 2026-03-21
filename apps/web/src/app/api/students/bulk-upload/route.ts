import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { encryptPassword } from "@/lib/auth/encryption";

interface StudentRow {
  name: string;
  roll_number: string;
  email?: string;
}

const SUPPORTED_UPLOAD_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);

const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const NAME_HEADER_ALIASES = new Set([
  "name",
  "full name",
  "student name",
]);

const ROLL_HEADER_ALIASES = new Set([
  "roll number",
  "roll no",
  "roll",
  "rollno",
  "roll num",
  "register number",
  "registration number",
  "admission number",
]);

const EMAIL_HEADER_ALIASES = new Set([
  "email",
  "student email",
  "email address",
]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");
}

function getFileExtension(fileName: string): string | null {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 0) return null;

  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

function isSupportedUploadFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  if (ext && SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) {
    return true;
  }

  return SUPPORTED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase());
}

function parseStudentsFromRows(rows: unknown[][]): StudentRow[] | null {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeCell(cell).length > 0)
  );

  if (headerRowIndex === -1) return null;

  const normalizedHeaders = rows[headerRowIndex].map((cell) =>
    normalizeHeader(normalizeCell(cell))
  );

  const nameIdx = normalizedHeaders.findIndex((h) =>
    NAME_HEADER_ALIASES.has(h)
  );
  const rollIdx = normalizedHeaders.findIndex((h) =>
    ROLL_HEADER_ALIASES.has(h)
  );
  const emailIdx = normalizedHeaders.findIndex((h) =>
    EMAIL_HEADER_ALIASES.has(h)
  );

  if (nameIdx === -1 || rollIdx === -1) {
    return null;
  }

  const students: StudentRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = normalizeCell(row[nameIdx]);
    const roll = normalizeCell(row[rollIdx]);
    const email = emailIdx !== -1 ? normalizeCell(row[emailIdx]) : "";

    if (!name || !roll) continue;

    students.push({
      name,
      roll_number: roll,
      email: email || undefined,
    });
  }

  return students;
}

async function parseStudentFile(file: File): Promise<StudentRow[]> {
  if (!isSupportedUploadFile(file)) {
    throw new Error("Only .csv, .xlsx, and .xls files are supported");
  }

  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    dense: true,
    raw: false,
  });

  if (workbook.SheetNames.length === 0) return [];

  let foundValidHeaderSheet = false;
  const students: StudentRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    const parsed = parseStudentsFromRows(rows);
    if (parsed) {
      foundValidHeaderSheet = true;
      students.push(...parsed);
    }
  }

  if (!foundValidHeaderSheet) {
    throw new Error("File must have 'Name' and 'Roll Number' columns");
  }

  return students;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await import('@/lib/supabase/server').then(m => m.getUser());

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!teacher) {
    return NextResponse.json(
      { error: "Only teachers can upload students" },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const classId = formData.get("classId") as string | null;

  if (!file || !classId) {
    return NextResponse.json(
      { error: "file and classId are required" },
      { status: 400 }
    );
  }

  let students: StudentRow[];

  try {
    students = await parseStudentFile(file);
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }

  if (students.length === 0) {
    return NextResponse.json(
      { error: "No valid student rows found in the file" },
      { status: 400 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const adminClient = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const rollNumbers = students.map(s => s.roll_number);

  // 1. Fetch ALL existing students in these roll numbers
  const { data: existingStudents, error: fetchError } = await adminClient
    .from("students")
    .select("id, roll_number")
    .in("roll_number", rollNumbers);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const existingMap = new Map(existingStudents.map(s => [s.roll_number, s.id]));

  // 2. Identify students to create and students to just enroll
  const toCreate: any[] = [];
  const toEnrollExisting: string[] = [];
  const results: { rollNumber: string; status: string; error?: string }[] = [];

  for (const student of students) {
    const existingId = existingMap.get(student.roll_number);
    if (existingId) {
      toEnrollExisting.push(existingId);
      results.push({ rollNumber: student.roll_number, status: "enrolled_existing" });
    } else {
      toCreate.push({
        email: student.email || null,
        full_name: student.name,
        roll_number: student.roll_number,
        encrypted_password: encryptPassword(student.roll_number)
      });
    }
  }

  // 3. Batch Create New Students
  let newlyCreatedIds: string[] = [];
  if (toCreate.length > 0) {
    const { data: createdData, error: createError } = await adminClient
      .from("students")
      .insert(toCreate)
      .select("id, roll_number");

    if (createError) {
      return NextResponse.json({ error: "Failed to create students: " + createError.message }, { status: 500 });
    }

    newlyCreatedIds = createdData.map(s => s.id);
    createdData.forEach(s => {
      results.push({ rollNumber: s.roll_number, status: "created" });
    });
  }

  // 4. Batch Enroll ALL Students (Existing + New)
  const allStudentIdsToEnroll = [...toEnrollExisting, ...newlyCreatedIds];
  if (allStudentIdsToEnroll.length > 0) {
    const enrollments = allStudentIdsToEnroll.map(sid => ({
      class_id: classId,
      student_id: sid
    }));

    // upsert will ignore duplicates (roll numbers we already enrolled in this class)
    const { error: enrollError } = await adminClient
      .from("class_enrollments")
      .upsert(enrollments, { onConflict: "class_id,student_id" });

    if (enrollError) {
       // Non-fatal for the whole batch if some fail, but we log it
       console.error("Enrollment error:", enrollError.message);
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const enrolled = results.filter((r) => r.status === "enrolled_existing").length;

  return NextResponse.json({
    message: `Processed ${students.length} students: ${created} created, ${enrolled} existing enrolled`,
    results,
  });
}
