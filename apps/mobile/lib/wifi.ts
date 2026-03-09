import { Platform, PermissionsAndroid } from "react-native";
import WifiManager from "react-native-wifi-reborn";
import { WIFI_MIN_SIGNAL_DBM } from "shared";

export interface WifiNetwork {
  ssid: string;
  level: number; // signal strength in dBm
}

/**
 * Scan nearby WiFi networks (no connection needed).
 * Returns list of detected SSIDs with signal strength.
 */
export async function scanNearbyWifi(): Promise<WifiNetwork[]> {
  if (Platform.OS === "android") {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error("Location permission required for WiFi scanning");
    }

    const networks = await WifiManager.loadWifiList();
    return networks.map((n) => ({
      ssid: n.SSID,
      level: n.level,
    }));
  }

  // iOS: Limited WiFi scanning capability
  // Can only get currently connected network SSID
  try {
    const ssid = await WifiManager.getCurrentWifiSSID();
    return ssid ? [{ ssid, level: -30 }] : [];
  } catch {
    return [];
  }
}

/**
 * Check if a specific SSID is detected with excellent signal strength.
 */
export function matchWifiSSID(
  networks: WifiNetwork[],
  targetSSID: string,
  minSignal: number = WIFI_MIN_SIGNAL_DBM
): { found: boolean; ssid: string | null; signal: number | null } {
  const match = networks.find(
    (n) => n.ssid === targetSSID && n.level >= minSignal
  );

  return {
    found: !!match,
    ssid: match?.ssid ?? null,
    signal: match?.level ?? null,
  };
}
