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

  const results: { rollNumber: string; status: string; error?: string }[] = [];

  for (const student of students) {
    try {
      // Check if student already exists by roll number
      const { data: existing } = await adminClient
        .from("students")
        .select("id")
        .eq("roll_number", student.roll_number)
        .single();

      if (existing) {
        // Just enroll
        const { error: enrollError } = await adminClient
          .from("class_enrollments")
          .insert({ class_id: classId, student_id: existing.id });

        if (enrollError && enrollError.code !== "23505") {
          results.push({
            rollNumber: student.roll_number,
            status: "error",
            error: enrollError.message,
          });
        } else {
          results.push({
            rollNumber: student.roll_number,
            status: "enrolled_existing",
          });
        }
        continue;
      }

      // Create student profile
      const { data: profileData, error: profileError } = await adminClient
        .from("students")
        .insert({
          email: student.email || null,
          full_name: student.name,
          roll_number: student.roll_number,
          encrypted_password: encryptPassword(student.roll_number)
        }).select('id').single();

      if (profileError) {
        results.push({
          rollNumber: student.roll_number,
          status: "error",
          error: profileError.message,
        });
        continue;
      }

      // Enroll in class
      await adminClient
        .from("class_enrollments")
        .insert({ class_id: classId, student_id: profileData.id });

      results.push({ rollNumber: student.roll_number, status: "created" });
    } catch (err: unknown) {
      results.push({
        rollNumber: student.roll_number,
        status: "error",
        error: errorMessage(err),
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const enrolled = results.filter((r) => r.status === "enrolled_existing").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    message: `Processed ${students.length} students: ${created} created, ${enrolled} existing enrolled, ${errors} errors`,
    results,
  });
}
