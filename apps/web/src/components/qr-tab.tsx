"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Square, Clock } from "lucide-react";

type Schedule = { day_of_week: number; start_time: string; end_time: string };

export function QRTab({ classId, schedules = [], qrRefreshInterval = 30 }: { classId: string; schedules?: Schedule[], qrRefreshInterval?: number }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canStart, setCanStart] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState("Checking schedule...");
  const [currentActiveSchedule, setCurrentActiveSchedule] = useState<Schedule | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const endSessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Helper to dynamically stop session
  const dynamicStopSession = useCallback(async (sId: string) => {
    try {
      await fetch("/api/classes/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sId, classId }),
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIsActive(false);
      setQrDataUrl(null);
      setSessionId(null);
      setCountdown(0);
      toast.info("Session automatically ended as class time is over.");
    } catch (error) {
      console.error("Auto end session error", error);
    }
  }, [classId]);

  useEffect(() => {
    const checkSchedule = () => {
      if (!schedules || schedules.length === 0) {
        setCanStart(true);
        setScheduleStatus("No schedule constraints. You can start anytime.");
        setCurrentActiveSchedule(null);
        return;
      }

      const todayDay = new Date().getDay();
      // find all schedules for today
      const todaySchedules = schedules.filter((s) => s.day_of_week === todayDay);

      if (todaySchedules.length === 0) {
        setCanStart(false);
        setScheduleStatus("No class scheduled for today.");
        setCurrentActiveSchedule(null);
        return;
      }

      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}:00`;

      // Check if we are within any active schedule slot currently
      const activeSlot = todaySchedules.find(s => currentTimeStr >= s.start_time && currentTimeStr <= s.end_time);

      if (activeSlot) {
         setCanStart(true);
         setScheduleStatus(`Class is currently ongoing (${activeSlot.start_time} - ${activeSlot.end_time}).`);
         setCurrentActiveSchedule(activeSlot);
         return;
      }

      // If not active, find the next upcoming one today
      const upcoming = todaySchedules.find(s => currentTimeStr < s.start_time);
      if (upcoming) {
         setCanStart(false);
         setScheduleStatus(`Class starts later today at ${upcoming.start_time}.`);
         setCurrentActiveSchedule(upcoming);
         return;
      }

      // If neither active nor upcoming, all classes ended today
      const lastEnded = todaySchedules[todaySchedules.length - 1];
      setCanStart(true); // maybe allow starting for late records, or false if strictly restricted.
      setScheduleStatus(`All classes ended for today. Last ended at ${lastEnded.end_time}.`);
      setCurrentActiveSchedule(lastEnded);
    };

    checkSchedule();
    const timer = setInterval(checkSchedule, 10000); // Check more frequently (every 10s)
    return () => clearInterval(timer);
  }, [schedules]);

  // Monitor end time to auto-close session
  useEffect(() => {
     if (isActive && sessionId && currentActiveSchedule) {
        if (endSessionTimerRef.current) clearInterval(endSessionTimerRef.current);
        endSessionTimerRef.current = setInterval(() => {
            const now = new Date();
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}:00`;
            
            if (currentTimeStr > currentActiveSchedule.end_time) {
               console.log("Class time exceeded. Ending session automatically.");
               dynamicStopSession(sessionId);
               clearInterval(endSessionTimerRef.current!);
            }
        }, 10000);
        return () => {
           if (endSessionTimerRef.current) clearInterval(endSessionTimerRef.current);
        }
     }
  }, [isActive, sessionId, currentActiveSchedule, dynamicStopSession]);


  const generateQR = useCallback(async (sId: string) => {
    const res = await fetch("/api/qr/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sId, classId }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to generate QR");
      return;
    }

    const { qrDataUrl: url } = await res.json();
    setQrDataUrl(url);
    setCountdown(qrRefreshInterval);
  }, [classId, qrRefreshInterval]);

  useEffect(() => {
    async function checkActiveSession() {
      const { data } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("class_id", classId)
        .eq("is_active", true)
        .maybeSingle();

      if (data && data.id) {
        setSessionId(data.id);
        setIsActive(true);
        generateQR(data.id);

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          generateQR(data.id);
        }, qrRefreshInterval * 1000);

        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
      }
    }
    checkActiveSession();
  }, [classId, generateQR, supabase, qrRefreshInterval]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  async function startSession() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const expiresAt = new Date(
      Date.now() + 2 * 60 * 60 * 1000
    ).toISOString();

    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .insert({
        class_id: classId,
        teacher_id: user.id,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSessionId(session.id);
    setIsActive(true);
    setLoading(false);

    await generateQR(session.id);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      generateQR(session.id);
    }, qrRefreshInterval * 1000);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  }

  async function stopSession() {
    if (!sessionId) return;
    setLoading(true);

    try {
      const res = await fetch("/api/classes/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, classId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to end session");
      }

      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      setIsActive(false);
      setQrDataUrl(null);
      setSessionId(null);
      setCountdown(0);
      toast.success("Session ended & absent students recorded");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to end session");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Attendance Session
          </div>
          <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "animate-pulse" : ""}>
            {isActive ? "Live" : "Inactive"}
          </Badge>
        </CardTitle>
        <CardDescription>
          When class begins, start the session to display the rotating QR. Ending the session will automatically mark remaining students as absent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6">
          {!isActive ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <QrCode className="h-16 w-16 text-muted-foreground/40" />
              
              <div className="flex flex-col items-center gap-2 mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {scheduleStatus}
                </span>
              </div>

              <Button onClick={startSession} disabled={loading || (!canStart && schedules && schedules.length > 0)} size="lg">
                {loading ? "Starting..." : "Start Session & Generate QR"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  QR refresh in {countdown}s
                </span>
              </div>

              {qrDataUrl && (
                <div className="rounded-lg border bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Attendance QR Code"
                    className="h-64 w-64"
                  />
                </div>
              )}

              <Button
                variant="destructive"
                onClick={stopSession}
                disabled={loading}
                className="w-full max-w-sm"
              >
                <Square className="mr-2 h-4 w-4" />
                {loading ? "Ending..." : "End Session"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
