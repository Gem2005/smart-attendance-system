"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
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
import { markAbsentRemaining, updateAttendanceStatus, getSessionRecords } from "@/lib/actions/attendance";
import { Loading } from "@/components/ui/loading";

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
  student?: {
    full_name: string;
    roll_number: string;
    email: string | null;
  };
}

interface Session {
  id: string;
  session_date: string;
  started_at: string;
  is_active: boolean;
}

export function AttendanceTab({ 
  classId, 
  token,
  initialSessions = []
}: { 
  classId: string; 
  token?: string;
  initialSessions?: Session[];
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");

  const supabase = useMemo(() => createClient(token), [token]);

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
  }, [classId, supabase]);

  const fetchRecords = useCallback(async (sessionId: string) => {
    setLoading(true);
    const result = await getSessionRecords(sessionId);
    if (result.data) {
      setRecords(result.data as AttendanceRecord[]);
    } else if (result.error) {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialSessions.length === 0) {
      setTimeout(() => fetchSessions(), 0);
    }
  }, [classId, initialSessions.length, fetchSessions]);

  useEffect(() => {
    if (selectedSession) {
      setTimeout(() => fetchRecords(selectedSession), 0);
    } else {
      setTimeout(() => setRecords([]), 0);
    }
  }, [selectedSession, fetchRecords]);

  async function handleManualMark() {
    if (!selectedSession) return;

    startTransition(async () => {
      const result = await markAbsentRemaining(classId, selectedSession);
      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.count && result.count > 0) {
          toast.success(`Marked ${result.count} students as absent`);
          void fetchRecords(selectedSession);
        } else {
          toast.info("All enrolled students already have attendance records.");
        }
      }
    });
  }

  async function handleUpdateStatus(recordId: string, newStatus: "present" | "absent" | "manual", notes: string) {
    startTransition(async () => {
      const result = await updateAttendanceStatus(classId, recordId, newStatus, notes);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Attendance updated");
        setEditOpen(false);
        setEditingRecord(null);
        if (selectedSession) void fetchRecords(selectedSession);
      }
    });
  }

  const filteredSessions = useMemo(() => {
    return dateFilter
      ? sessions.filter((s) => s.session_date === dateFilter)
      : sessions;
  }, [sessions, dateFilter]);

  useEffect(() => {
    if (!dateFilter) {
      setTimeout(() => setSelectedSession(null), 0);
    } else if (filteredSessions.length === 0) {
      setTimeout(() => setSelectedSession(null), 0);
    } else {
      const currentInFiltered = filteredSessions.find(s => s.id === selectedSession);
      if (!currentInFiltered) {
        setTimeout(() => setSelectedSession(filteredSessions[0].id), 0);
      }
    }
  }, [dateFilter, filteredSessions, selectedSession]);

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
              <Button size="sm" variant="outline" onClick={handleManualMark} disabled={isPending}>
                {isPending && <Loading inline className="mr-2" iconClassName="h-4 w-4" />}
                Mark Absent
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
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
                <SelectValue placeholder="Select a session">
                  {selectedSession 
                    ? (() => {
                        const s = sessions.find((x) => x.id === selectedSession);
                        return s ? `${format(new Date(s.started_at), "MMM d, yyyy h:mm a")} ${s.is_active ? "(Active)" : ""}` : "Select a session";
                      })()
                    : "Select a session"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                {filteredSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {format(new Date(s.started_at), "MMM d, yyyy h:mm a")}
                    {s.is_active && " (Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Records table */}
            {loading ? (
              <Loading text="Loading records..." className="py-12" />
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {selectedSession ? "No records for this session yet." : "Please select a session above."}
              </p>
            ) : (
              <div className="overflow-x-auto w-full border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Roll No.</TableHead>
                      <TableHead className="whitespace-nowrap">Name</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Time</TableHead>
                      <TableHead className="whitespace-nowrap">GPS</TableHead>
                      <TableHead className="whitespace-nowrap">WiFi</TableHead>
                      <TableHead className="whitespace-nowrap">Photo</TableHead>
                      <TableHead className="w-[60px] whitespace-nowrap">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.student?.roll_number}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {record.student?.full_name}
                      </TableCell>
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
            </div>
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
              {editingRecord?.student?.full_name} — {editingRecord?.student?.roll_number}
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <EditAttendanceForm
              record={editingRecord}
              onSave={handleUpdateStatus}
              isPending={isPending}
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
  isPending
}: {
  record: AttendanceRecord;
  onSave: (id: string, status: "present" | "absent" | "manual", notes: string) => void;
  isPending?: boolean;
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
              disabled={isPending}
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
          disabled={isPending}
        />
      </div>
      <Button
        className="w-full"
        onClick={() => onSave(record.id, status, notes)}
        disabled={isPending}
      >
        {isPending && <Loading inline className="mr-2" iconClassName="h-4 w-4" />}
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

