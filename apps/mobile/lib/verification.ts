import type { QRPayload, AttendanceSubmission } from "shared";
import { CLASS_TIME_BUFFER_MINUTES } from "shared";
import { supabase } from "./supabase";
import { getCurrentGPS, isWithinGeofence } from "./location";
import { scanNearbyWifi, matchWifiSSID } from "./wifi";

type StepStatus = "pending" | "checking" | "passed" | "failed";

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

  if (error) throw new Error("Failed to fetch class schedule");
  if (!schedules || schedules.length === 0) {
    throw new Error("No class scheduled for today");
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
    throw new Error("Class is not currently in session");
  }
}

/**
 * Full verification flow — returns data for attendance submission.
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

  // Step 1: QR validation
  state.qr = "checking";
  onStep({ ...state });
  await validateQR(payload);
  state.qr = "passed";
  onStep({ ...state });

  // Step 2: Timing check
  state.timing = "checking";
  onStep({ ...state });
  await checkTiming(payload.cid);
  state.timing = "passed";
  onStep({ ...state });

  // Step 3: Geofence check
  state.geofence = "checking";
  onStep({ ...state });
  const gps = await getCurrentGPS();

  const { data: classLocation, error: locError } = await supabase
    .from("class_locations")
    .select("latitude, longitude, radius_meters")
    .eq("class_id", payload.cid)
    .single();

  if (locError || !classLocation) {
    throw new Error("Failed to fetch class location");
  }

  const geofencePassed = isWithinGeofence(
    gps,
    { latitude: classLocation.latitude, longitude: classLocation.longitude },
    classLocation.radius_meters
  );

  if (!geofencePassed) {
    throw new Error("You are not near the classroom");
  }
  state.geofence = "passed";
  onStep({ ...state });

  // Step 4: WiFi check
  state.wifi = "checking";
  onStep({ ...state });

  const { data: wifiConfig, error: wifiError } = await supabase
    .from("wifi_configs")
    .select("ssid, min_signal_dbm")
    .eq("class_id", payload.cid)
    .single();

  if (wifiError || !wifiConfig) {
    throw new Error("WiFi configuration not found for this class");
  }

  const networks = await scanNearbyWifi();
  const wifiResult = matchWifiSSID(
    networks,
    wifiConfig.ssid,
    wifiConfig.min_signal_dbm
  );

  if (!wifiResult.found) {
    throw new Error("Campus WiFi not detected nearby");
  }
  state.wifi = "passed";
  onStep({ ...state });

  return {
    sessionId: payload.sid,
    classId: payload.cid,
    gpsLatitude: gps.latitude,
    gpsLongitude: gps.longitude,
    geofencePassed: true,
    wifiSsidFound: wifiResult.ssid,
    wifiSignalDbm: wifiResult.signal,
    wifiPassed: true,
  };
}
