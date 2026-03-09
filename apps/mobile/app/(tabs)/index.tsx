import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import type { QRPayload } from "shared";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const router = useRouter();

  function handleBarCodeScanned({ data }: { data: string }) {
    if (!scanning) return;
    setScanning(false);

    try {
      const payload: QRPayload = JSON.parse(data);

      if (!payload.sid || !payload.cid || !payload.iat || !payload.exp || !payload.hmac) {
        throw new Error("Invalid QR format");
      }

      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        Alert.alert("Expired", "This QR code has expired. Ask your teacher to refresh.", [
          { text: "OK", onPress: () => setScanning(true) },
        ]);
        return;
      }

      router.push({
        pathname: "/verify",
        params: { payload: JSON.stringify(payload) },
      });
    } catch {
      Alert.alert("Invalid QR", "This is not a valid attendance QR code.", [
        { text: "OK", onPress: () => setScanning(true) },
      ]);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera access is required to scan QR codes.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.hint}>Point camera at the QR code</Text>
          {!scanning && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setScanning(true)}
            >
              <Text style={styles.retryText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    color: "#666",
  },
  button: {
    backgroundColor: "#2f95dc",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 16,
  },
  hint: {
    color: "#fff",
    fontSize: 16,
    marginTop: 24,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
  },
});
