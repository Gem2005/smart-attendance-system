// Geofencing
export const GEOFENCE_DEFAULT_RADIUS_METERS = 100;

// WiFi
export const WIFI_MIN_SIGNAL_DBM = -50; // "excellent" range

// QR Code
export const QR_ROTATION_INTERVAL_MS = 30_000; // 30 seconds
export const QR_EXPIRY_SECONDS = 300; // 5 minutes

// Timing
export const CLASS_TIME_BUFFER_MINUTES = 5; // ±5 min tolerance

// Days of week
export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
