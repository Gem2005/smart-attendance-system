"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Upload, Download, KeyRound } from "lucide-react";
import { Loading } from "@/components/ui/loading";

interface Student {
  id: string;
  email: string | null;
  full_name: string;
  roll_number: string;
  phone: string | null;
  attendance_percentage: number | null;
}

interface StudentBase {
  id: string;
  email: string | null;
  full_name: string;
  roll_number: string;
  phone: string | null;
}

interface AttendanceRecordRow {
  student_id: string;
  status: "present" | "absent" | "manual";
}

interface EnrollmentRow {
  student: StudentBase | StudentBase[] | null;
}

function isStudentBase(value: unknown): value is StudentBase {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StudentBase>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.full_name === "string" &&
    typeof candidate.roll_number === "string"
  );
}

interface BulkUploadResult {
  rollNumber: string;
  status: string;
  error?: string;
}

export function StudentsTab({ classId, token }: { classId: string; token?: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordStudent, setPasswordStudent] = useState<Student | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient(token);

  const fetchStudents = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("class_enrollments")
      .select(`
        student:students (
          id,
          email,
          full_name,
          roll_number,
          phone
        )
      `)
      .eq("class_id", classId);

    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance_records")
      .select("student_id,status")
      .eq("class_id", classId);

    if (error) {
      toast.error("Failed to fetch students");
      setLoading(false);
      return;
    }

    if (attendanceError) {
      toast.error("Failed to fetch attendance stats");
      setLoading(false);
      return;
    }

    const attendanceByStudent = new Map<string, { total: number; presentLike: number }>();

    for (const record of (attendanceData ?? []) as AttendanceRecordRow[]) {
      const existing = attendanceByStudent.get(record.student_id) ?? { total: 0, presentLike: 0 };
      existing.total += 1;
      if (record.status === "present" || record.status === "manual") {
        existing.presentLike += 1;
      }
      attendanceByStudent.set(record.student_id, existing);
    }

    const normalizedStudents = ((data ?? []) as unknown as EnrollmentRow[])
      .map((d) => (Array.isArray(d.student) ? d.student[0] : d.student))
      .filter((student): student is StudentBase => isStudentBase(student));

    const students: Student[] = normalizedStudents
      .map((student) => {
        const stats = attendanceByStudent.get(student.id);
        const attendance_percentage =
          stats && stats.total > 0
            ? Math.round((stats.presentLike / stats.total) * 1000) / 10
            : null;

        return {
          ...student,
          attendance_percentage,
        };
      })
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number));

    setStudents(students);
    setLoading(false);
  }, [classId, supabase]);

  useEffect(() => {
    void fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleAddStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("studentEmail") as string)?.trim() || undefined;
    const fullName = (formData.get("fullName") as string).trim();
    const rollNumber = (formData.get("rollNumber") as string).trim();
    const phone = (formData.get("phone") as string)?.trim() || undefined;

    const res = await fetch("/api/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        fullName,
        rollNumber,
        phone,
        classId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to add student");
      setAddLoading(false);
      return;
    }

    toast.success(data.message);
    setAddOpen(false);
    setAddLoading(false);
    fetchStudents();
  }

  function downloadTemplate() {
    const csv = "Name,Roll Number,Email\nJohn Doe,CS2024001,john@university.edu\nJane Smith,CS2024002,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("classId", classId);

    const res = await fetch("/api/students/bulk-upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Upload failed");
    } else {
      toast.success(data.message);
      const errors =
        (data.results as BulkUploadResult[] | undefined)?.filter(
          (r) => r.status === "error"
        ) ?? [];
      if (errors.length > 0) {
        errors.forEach((err) => {
          toast.error(`${err.rollNumber}: ${err.error ?? "Unknown error"}`);
        });
      }
      fetchStudents();
    }

    setUploadLoading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleRemoveStudent(studentId: string) {
    const { error } = await supabase
      .from("class_enrollments")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Student removed from class");
    fetchStudents();
  }

  async function handleEditStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingStudent) return;

    const formData = new FormData(e.currentTarget);
    const full_name = formData.get("full_name") as string;
    const roll_number = formData.get("roll_number") as string;
    const email = (formData.get("email") as string) || null;
    const phone = (formData.get("phone") as string) || null;

    const { error } = await supabase
      .from("students")
      .update({ full_name, roll_number, email, phone })
      .eq("id", editingStudent.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Student updated");
    setEditOpen(false);
    setEditingStudent(null);
    fetchStudents();
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passwordStudent) return;
    setPasswordLoading(true);

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get("newPassword") as string;

    const res = await fetch("/api/students/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: passwordStudent.id, newPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to reset password");
      setPasswordLoading(false);
      return;
    }

    toast.success("Password updated for " + passwordStudent.full_name);
    setPasswordOpen(false);
    setPasswordStudent(null);
    setPasswordLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              {students.length} students enrolled in this class.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              CSV Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadLoading ? "Uploading..." : "Upload CSV/Excel"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger render={<Button size="sm" />}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Student
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Student</DialogTitle>
                  <DialogDescription>
                    Create a student account and enroll them in this class.
                    Default password is the roll number.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rollNumber">Roll Number</Label>
                      <Input
                        id="rollNumber"
                        name="rollNumber"
                        placeholder="CS2024001"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="studentEmail">Email (optional)</Label>
                    <Input
                      id="studentEmail"
                      name="studentEmail"
                      type="email"
                      placeholder="student@university.edu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={addLoading}>
                    {addLoading ? "Creating..." : "Create & Enroll Student"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loading text="Loading students..." className="py-4" />
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No students enrolled yet.
          </p>
        ) : (
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Roll No.</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Phone</TableHead>
                  <TableHead className="whitespace-nowrap">Attendance %</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.roll_number}
                  </TableCell>
                  <TableCell>{student.full_name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.phone ?? "—"}</TableCell>
                  <TableCell>
                    {student.attendance_percentage == null
                      ? "—"
                      : `${student.attendance_percentage.toFixed(1)}%`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingStudent(student);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setPasswordStudent(student);
                          setPasswordOpen(true);
                        }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveStudent(student.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>

      {/* Edit Student Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student details.
            </DialogDescription>
          </DialogHeader>
          {editingStudent && (
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input
                  id="edit_full_name"
                  name="full_name"
                  defaultValue={editingStudent.full_name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_roll_number">Roll Number</Label>
                <Input
                  id="edit_roll_number"
                  name="roll_number"
                  defaultValue={editingStudent.roll_number}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  name="email"
                  type="email"
                  defaultValue={editingStudent.email ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  name="phone"
                  defaultValue={editingStudent.phone ?? ""}
                />
              </div>
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordStudent?.full_name} ({passwordStudent?.roll_number}).
            </DialogDescription>
          </DialogHeader>
          {passwordStudent && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={passwordLoading}>
                {passwordLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
