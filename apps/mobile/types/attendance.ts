export type AttendanceStatus = "present" | "absent" | "manual";
export type MarkedBy = "system" | "teacher";

export interface VerificationResult {
  qrValid: boolean;
  timingValid: boolean;
  geofenceValid: boolean;
  wifiValid: boolean;
  photoUploaded: boolean;
}

export interface AttendanceSubmission {
  sessionId: string;
  classId: string;
  gpsLatitude: number;
  gpsLongitude: number;
  geofencePassed: boolean;
  wifiSsidFound: string | null;
  wifiSignalDbm: number | null;
  wifiPassed: boolean;
  photoUrl: string;
}