"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Check,
  X,
  MapPin,
  Wifi,
  Camera,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: "present" | "absent" | "manual";
  scanned_at: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  geofence_passed: boolean | null;
  wifi_ssid_found: string | null;
  wifi_signal_dbm: number | null;
  wifi_passed: boolean | null;
  photo_url: string | null;
  marked_by: string;
  notes: string | null;
  created_at: string;
  student_name?: string;
  student_roll?: string;
}

interface Session {
  id: string;
  session_date: string;
  started_at: string;
  is_active: boolean;
}

export function AttendanceTab({ classId }: { classId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const supabase = createClient();

  const handlePhotoClick = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .createSignedUrl(path, 300);

    if (error) {
      console.error("Error fetching photo URL:", error);
      return;
    }

    if (data?.signedUrl) {
      setPhotoPreview(data.signedUrl);
    }
  };

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from("attendance_sessions")
      .select("id, session_date, started_at, is_active")
      .eq("class_id", classId)
      .order("session_date", { ascending: false })
      .limit(50);

    setSessions(data ?? []);
    if (data && data.length > 0 && !selectedSession) {
      setSelectedSession(data[0].id);
    }
    setLoading(false);
  }, [classId, supabase, selectedSession]);

  const fetchRecords = useCallback(async () => {
    if (!selectedSession) return;

    const { data: recordsData } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("session_id", selectedSession)
      .order("created_at");

    if (!recordsData) {
      setRecords([]);
      return;
    }

    // Get student details
    const studentIds = [...new Set(recordsData.map((r) => r.student_id))];
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name, roll_number")
      .in("id", studentIds);

    const studentMap = new Map(
      (studentsData ?? []).map((s) => [s.id, s])
    );

    const enriched = recordsData.map((r) => ({
      ...r,
      student_name: studentMap.get(r.student_id)?.full_name ?? "Unknown",
      student_roll: studentMap.get(r.student_id)?.roll_number ?? "—",
    }));

    setRecords(enriched);
  }, [selectedSession, supabase]);

  useEffect(() => {
    void fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    void fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession]);

  async function handleManualMark() {
    if (!selectedSession) return;

    // Get all enrolled students
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId);

    if (!enrollments) return;

    // Find students not yet marked
    const markedIds = new Set(records.map((r) => r.student_id));
    const unmarked = enrollments.filter(
      (e) => !markedIds.has(e.student_id)
    );

    if (unmarked.length === 0) {
      toast.info("All enrolled students already have attendance records.");
      return;
    }

    // Mark remaining as absent
    const inserts = unmarked.map((e) => ({
      session_id: selectedSession,
      student_id: e.student_id,
      class_id: classId,
      status: "absent" as const,
      marked_by: "teacher" as const,
      notes: "Marked absent by teacher",
    }));

    const { error } = await supabase
      .from("attendance_records")
      .insert(inserts);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Marked ${unmarked.length} students as absent`);
    fetchRecords();
  }

  async function handleUpdateStatus(recordId: string, newStatus: "present" | "absent" | "manual", notes: string) {
    const { error } = await supabase
      .from("attendance_records")
      .update({
        status: newStatus,
        marked_by: "teacher",
        notes: notes || null,
      })
      .eq("id", recordId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Attendance updated");
    setEditOpen(false);
    setEditingRecord(null);
    fetchRecords();
  }

  const filteredSessions = dateFilter
    ? sessions.filter((s) => s.session_date === dateFilter)
    : sessions;

  const statusColor = (status: string) => {
    switch (status) {
      case "present":
        return "default";
      case "absent":
        return "destructive";
      case "manual":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>
              View and manage attendance for each session.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40"
            />
            {selectedSession && (
              <Button size="sm" variant="outline" onClick={handleManualMark}>
                Mark Absent
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading...
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No attendance sessions yet. Generate a QR code to start a session.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Session selector */}
            <Select
              value={selectedSession ?? ""}
              onValueChange={setSelectedSession}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {filteredSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {format(new Date(s.started_at), "MMM d, yyyy h:mm a")}
                    {s.is_active && " (Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Records table */}
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No records for this session yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>WiFi</TableHead>
                    <TableHead>Photo</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="w-[60px]">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.student_roll}
                      </TableCell>
                      <TableCell>{record.student_name}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.scanned_at
                          ? format(new Date(record.scanned_at), "h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {record.geofence_passed != null ? (
                          record.geofence_passed ? (
                            <MapPin className="h-4 w-4 text-green-600" />
                          ) : (
                            <MapPin className="h-4 w-4 text-red-500" />
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {record.wifi_passed != null ? (
                          record.wifi_passed ? (
                            <Wifi className="h-4 w-4 text-green-600" />
                          ) : (
                            <Wifi className="h-4 w-4 text-red-500" />
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {record.photo_url ? (
                          <button
                            onClick={() => handlePhotoClick(record.photo_url!)}
                            className="text-primary hover:underline"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {record.marked_by}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingRecord(record);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>

      {/* Edit attendance dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              {editingRecord?.student_name} — {editingRecord?.student_roll}
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <EditAttendanceForm
              record={editingRecord}
              onSave={handleUpdateStatus}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Photo preview dialog */}
      <Dialog
        open={!!photoPreview}
        onOpenChange={() => setPhotoPreview(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attendance Photo</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoPreview}
              alt="Attendance verification"
              className="w-full rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EditAttendanceForm({
  record,
  onSave,
}: {
  record: AttendanceRecord;
  onSave: (id: string, status: "present" | "absent" | "manual", notes: string) => void;
}) {
  const [status, setStatus] = useState<"present" | "absent" | "manual">(record.status);
  const [notes, setNotes] = useState(record.notes ?? "");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>
        <div className="flex gap-2">
          {(["present", "absent", "manual"] as const).map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(s)}
            >
              {s === "present" && <Check className="mr-1 h-3 w-3" />}
              {s === "absent" && <X className="mr-1 h-3 w-3" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note..."
        />
      </div>
      <Button
        className="w-full"
        onClick={() => onSave(record.id, status, notes)}
      >
        Save Changes
      </Button>

      {/* Verification details */}
      <div className="rounded-md bg-muted p-3 text-xs space-y-1">
        <p className="font-medium text-sm mb-2">Verification Details</p>
        <p>
          GPS:{" "}
          {record.gps_latitude != null
            ? `${record.gps_latitude.toFixed(6)}, ${record.gps_longitude?.toFixed(6)}`
            : "N/A"}
        </p>
        <p>
          Geofence:{" "}
          {record.geofence_passed != null
            ? record.geofence_passed
              ? "✅ Passed"
              : "❌ Failed"
            : "N/A"}
        </p>
        <p>
          WiFi:{" "}
          {record.wifi_ssid_found
            ? `${record.wifi_ssid_found} (${record.wifi_signal_dbm} dBm)`
            : "N/A"}
        </p>
        <p>
          WiFi Check:{" "}
          {record.wifi_passed != null
            ? record.wifi_passed
              ? "✅ Passed"
              : "❌ Failed"
            : "N/A"}
        </p>
        <p>Marked by: {record.marked_by}</p>
      </div>
    </div>
  );
}
