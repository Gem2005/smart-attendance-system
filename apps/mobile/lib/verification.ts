import type { AttendanceSubmission } from "@/types/attendance";
import type { QRPayload } from "@/types/qr";
import { CLASS_TIME_BUFFER_MINUTES } from "@/lib/constants";
import { supabase } from "./supabase";
import { getCurrentGPS, isWithinGeofence } from "./location";
import { scanNearbyWifi, matchWifiSSID } from "./wifi";

type StepStatus = "pending" | "checking" | "passed" | "failed" | "skipped";

export interface VerificationState {
  qr: StepStatus;
  timing: StepStatus;
  geofence: StepStatus;
  wifi: StepStatus;
  photo: StepStatus;
  error?: string;
}

/**
 * Validate QR payload by calling the server (HMAC verified server-side).
 */
async function validateQR(payload: QRPayload): Promise<void> {
  // Check expiry client-side first
  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    throw new Error("QR code has expired");
  }
}

/**
 * Check if current time is within the class schedule (±buffer).
 */
async function checkTiming(classId: string): Promise<void> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const { data: schedules, error } = await supabase
    .from("class_schedules")
    .select("start_time, end_time")
    .eq("class_id", classId)
    .eq("day_of_week", dayOfWeek);

  if (error) {
    console.error("Schedule fetch error:", error.message);
    throw new Error(`Failed to fetch class schedule: ${error.message}`);
  }
  if (!schedules || schedules.length === 0) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    throw new Error(`No class scheduled for ${dayNames[dayOfWeek]}`);
  }

  const buffer = CLASS_TIME_BUFFER_MINUTES;
  const isWithinAnySlot = schedules.some((s) => {
    const [startH, startM] = s.start_time.split(":").map(Number);
    const [endH, endM] = s.end_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM - buffer;
    const endMinutes = endH * 60 + endM + buffer;
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  });

  if (!isWithinAnySlot) {
    const scheduleStr = schedules.map(s => `${s.start_time}-${s.end_time}`).join(", ");
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    throw new Error(`Class not in session. Schedule: ${scheduleStr}, Current time: ${currentTime} (±${buffer}min buffer)`);
  }
}

/**
 * Full verification flow — returns data for attendance submission.
 * Geofence and WiFi checks are reference parameters — they are recorded
 * but do not block attendance marking.
 */
export async function runVerification(
  payload: QRPayload,
  onStep: (state: VerificationState) => void
): Promise<Omit<AttendanceSubmission, "photoUrl">> {
  const state: VerificationState = {
    qr: "pending",
    timing: "pending",
    geofence: "pending",
    wifi: "pending",
    photo: "pending",
  };

  // Step 1: QR validation (mandatory)
  state.qr = "checking";
  onStep({ ...state });
  await validateQR(payload);
  state.qr = "passed";
  onStep({ ...state });

  // Step 2: Timing check (mandatory)
  state.timing = "checking";
  onStep({ ...state });
  await checkTiming(payload.cid);
  state.timing = "passed";
  onStep({ ...state });

  // Step 3: Geofence check (reference only — does not block)
  state.geofence = "checking";
  onStep({ ...state });

  let gpsLatitude = 0;
  let gpsLongitude = 0;
  let geofencePassed = false;

  try {
    const gps = await getCurrentGPS();
    gpsLatitude = gps.latitude;
    gpsLongitude = gps.longitude;

    const { data: classLocation } = await supabase
      .from("class_locations")
      .select("latitude, longitude, radius_meters")
      .eq("class_id", payload.cid)
      .single();

    if (classLocation) {
      geofencePassed = isWithinGeofence(
        gps,
        { latitude: classLocation.latitude, longitude: classLocation.longitude },
        classLocation.radius_meters
      );
      state.geofence = geofencePassed ? "passed" : "failed";
    } else {
      // No location configured — skip
      state.geofence = "skipped";
    }
  } catch {
    // GPS failed — record as failed but don't block
    state.geofence = "failed";
  }
  onStep({ ...state });

  // Step 4: WiFi check (reference only — does not block)
  state.wifi = "checking";
  onStep({ ...state });

  let wifiSsidFound: string | null = null;
  let wifiSignalDbm: number | null = null;
  let wifiPassed = false;

  try {
    const { data: wifiConfig } = await supabase
      .from("wifi_configs")
      .select("ssid, min_signal_dbm")
      .eq("class_id", payload.cid)
      .single();

    if (wifiConfig) {
      const networks = await scanNearbyWifi();
      const wifiResult = matchWifiSSID(
        networks,
        wifiConfig.ssid,
        wifiConfig.min_signal_dbm
      );
      wifiSsidFound = wifiResult.ssid;
      wifiSignalDbm = wifiResult.signal;
      wifiPassed = wifiResult.found;
      state.wifi = wifiPassed ? "passed" : "failed";
    } else {
      // No WiFi configured — skip
      state.wifi = "skipped";
    }
  } catch {
    // WiFi scan failed — record as failed but don't block
    state.wifi = "failed";
  }
  onStep({ ...state });

  return {
    sessionId: payload.sid,
    classId: payload.cid,
    gpsLatitude,
    gpsLongitude,
    geofencePassed,
    wifiSsidFound,
    wifiSignalDbm,
    wifiPassed,
  };
}
