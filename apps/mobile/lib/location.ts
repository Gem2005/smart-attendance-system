import * as Location from "expo-location";
import { GEOFENCE_DEFAULT_RADIUS_METERS } from "shared";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Request foreground location permission and get current GPS.
 */
export async function getCurrentGPS(): Promise<GeoPoint> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission denied");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

/**
 * Haversine distance between two GPS points in meters.
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}

/**
 * Check if a point is within the geofence radius of a target location.
 */
export function isWithinGeofence(
  studentLocation: GeoPoint,
  classLocation: GeoPoint,
  radiusMeters: number = GEOFENCE_DEFAULT_RADIUS_METERS
): boolean {
  const distance = haversineDistance(studentLocation, classLocation);
  return distance <= radiusMeters;
}
