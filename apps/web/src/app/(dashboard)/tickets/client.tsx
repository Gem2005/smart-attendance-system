"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Check, Link as LinkIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface RequestItem {
  id: string;
  class_id: string;
  session_id: string;
  student_id: string;
  description: string;
  proof_urls: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
  teacher_notes: string | null;
  new_attendance_status: "present" | "absent" | "manual" | null;
  classes: { name: string; code: string };
  sessions: { session_date: string };
  students: { full_name: string; roll_number: string };
}

export function TicketsClient({ initialRequests }: { initialRequests: RequestItem[] }) {
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [isResolverOpen, setIsResolverOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Form states
  const [newStatus, setNewStatus] = useState<"approved" | "rejected">("approved");
  const [notes, setNotes] = useState("");
  const [attendanceUpdate, setAttendanceUpdate] = useState<"present" | "absent" | "manual">("present");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const handleOpenResolve = (req: RequestItem) => {
    setSelectedRequest(req);
    setNewStatus("approved");
    setNotes(req.teacher_notes || "");
    setAttendanceUpdate(req.new_attendance_status || "present");
    setIsResolverOpen(true);
  };

  const handleViewProofs = async (urls: string[]) => {
    try {
      const signedUrls = await Promise.all(
        urls.map(async (url) => {
          // Proof uploads are stored in attendance-proofs. Keep a fallback for legacy rows.
          const { data: proofData } = await supabase.storage
            .from("attendance-proofs")
            .createSignedUrl(url, 300);

          if (proofData?.signedUrl) return proofData.signedUrl;

          const { data: legacyData } = await supabase.storage
            .from("attendance-photos")
            .createSignedUrl(url, 300);

          return legacyData?.signedUrl || "";
        })
      );
      setPreviewImages(signedUrls.filter(Boolean));
      setIsPreviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load proof images.");
    }
  };

  const submitResolution = async () => {
    if (!selectedRequest) return;
    setIsSubmitting(true);

    try {
      const { error: reqError } = await supabase
        .from("attendance_requests")
        .update({
          status: newStatus,
          teacher_notes: notes,
          new_attendance_status: newStatus === "approved" ? attendanceUpdate : selectedRequest.new_attendance_status,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (reqError) throw reqError;

      if (newStatus === "approved") {
        const { error: attError } = await supabase
          .from("attendance_records")
          .update({
            status: attendanceUpdate,
            marked_by: "teacher",
            notes: `Resolved via Request #${selectedRequest.id}`,
          })
          .eq("session_id", selectedRequest.session_id)
          .eq("student_id", selectedRequest.student_id);

        if (attError) throw attError;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? { ...r, status: newStatus, teacher_notes: notes, new_attendance_status: newStatus === "approved" ? attendanceUpdate : r.new_attendance_status }
            : r
        )
      );

      toast.success("Request resolved successfully.");
      setIsResolverOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to resolve request.");
      } else {
        toast.error("Failed to resolve request.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((req) => (
          <Card key={req.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{req.students.full_name}</CardTitle>
                  <CardDescription>{req.students.roll_number}</CardDescription>
                </div>
                <Badge
                  variant={
                    req.status === "approved"
                      ? "default"
                      : req.status === "rejected"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {req.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="text-sm">
                <div className="font-medium">Class: {req.classes.name}</div>
                <div className="text-muted-foreground" suppressHydrationWarning>Session: {new Date(req.sessions.session_date).toLocaleDateString()}</div>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Student Description:</p>
                <p className="text-muted-foreground">{req.description}</p>
              </div>

              <div className="flex gap-2">
                {req.proof_urls && req.proof_urls.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleViewProofs(req.proof_urls)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    View Proofs ({req.proof_urls.length})
                  </Button>
                )}
              </div>

              <div className="flex gap-2 mt-auto pt-4">
                <Button
                  className="flex-1"
                  variant={req.status === "pending" ? "default" : "outline"}
                  onClick={() => handleOpenResolve(req)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {req.status === "pending" ? "Resolve Request" : "Update Resolution"}
                </Button>
                <Link href={`/classes?id=${req.class_id}`} passHref>
                  <Button variant="secondary" size="icon">
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {requests.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            <AlertCircle className="mx-auto h-8 w-8 mb-3 opacity-50" />
            <p>No attendance requests found.</p>
          </div>
        )}
      </div>

      <Dialog open={isResolverOpen} onOpenChange={setIsResolverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Request</DialogTitle>
            <DialogDescription>
              Review the student&apos;s request and update their attendance accordingly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision</label>
              <Select
                value={newStatus}
                onValueChange={(val) => {
                  if (val) setNewStatus(val as "approved" | "rejected");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newStatus === "approved" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Attendance Status</label>
                <Select
                  value={attendanceUpdate}
                  onValueChange={(val) => {
                    if (val) setAttendanceUpdate(val as "present" | "absent" | "manual");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="manual">Manual (Excused)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Teacher Notes (Visible to Student)</label>
              <Textarea
                placeholder="Explain why this request was approved/rejected..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsResolverOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitResolution} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Resolution"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Proof Images</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            {previewImages.map((src, i) => (
              <div key={i} className="relative w-full aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Proof" className="h-full w-full rounded-lg border object-contain" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
