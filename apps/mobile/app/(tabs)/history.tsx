import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";

interface AttendanceItem {
  id: string;
  status: "present" | "absent" | "manual";
  scanned_at: string | null;
  created_at: string;
  class_name: string;
  class_code: string;
  session_date: string;
  class_id: string;
  session_id: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Report Modal State
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportItem, setReportItem] = useState<AttendanceItem | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        `
        id,
        status,
        scanned_at,
        created_at,
        class_id,
        session_id,
        attendance_sessions!inner(session_date),
        classes!inner(name, code)
      `
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setRecords(
        data.map((r: any) => ({
          id: r.id,
          status: r.status,
          scanned_at: r.scanned_at,
          created_at: r.created_at,
          class_id: r.class_id,
          session_id: r.session_id,
          class_name: r.classes?.name ?? "",
          class_code: r.classes?.code ?? "",
          session_date: r.attendance_sessions?.session_date ?? "",
        }))
      );
    }
  }, [user]);

  useEffect(() => {
    fetchRecords().finally(() => setLoading(false));
  }, [fetchRecords]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  }

  function openReportModal(item: AttendanceItem) {
    setReportItem(item);
    setReportDescription("");
    setReportPhotos([]);
    setReportModalVisible(true);
  }

  async function pickReportPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission", "Permission to access media library is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setReportPhotos((prev) => [...prev, ...uris]);
    }
  }

  async function submitReport() {
    if (!reportItem || !user) return;
    if (!reportDescription.trim()) {
      Alert.alert("Description required", "Please describe why you are reporting this attendance record.");
      return;
    }

    setSubmittingReport(true);
    try {
      const uploadedUrls: string[] = [];

      for (const uri of reportPhotos) {
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const { data, error } = await supabase.storage
          .from("attendance-proofs")
          .upload(fileName, blob, { contentType: "image/jpeg" });
        
        if (error) throw error;
        if (data?.path) {
          uploadedUrls.push(data.path);
        }
      }

      const { error: insertError } = await supabase
        .from("attendance_requests")
        .insert({
          class_id: reportItem.class_id,
          session_id: reportItem.session_id,
          student_id: user.id,
          description: reportDescription,
          proof_urls: uploadedUrls,
          status: "pending",
        });

      if (insertError) throw insertError;
      
      Alert.alert("Success", "Your request has been raised successfully.");
      setReportModalVisible(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit report.");
    } finally {
      setSubmittingReport(false);
    }
  }

  const statusConfig: Record<
    string,
    { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }
  > = {
    present: {
      color: "#059669",
      bg: "#ecfdf5",
      icon: "checkmark-circle",
      label: "Present",
    },
    absent: {
      color: "#dc2626",
      bg: "#fef2f2",
      icon: "close-circle",
      label: "Absent",
    },
    manual: {
      color: "#d97706",
      bg: "#fffbeb",
      icon: "pencil",
      label: "Manual",
    },
  };

  function renderItem({ item }: { item: AttendanceItem }) {
    const date = new Date(item.session_date || item.created_at);
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const config = statusConfig[item.status] ?? statusConfig.manual;

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={[styles.statusDot, { backgroundColor: config.color }]} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <Text style={styles.className} numberOfLines={1}>
              {item.class_name}
            </Text>
            <View style={[styles.badge, { backgroundColor: config.bg }]}>
              <Ionicons name={config.icon} size={12} color={config.color} />
              <Text style={[styles.badgeText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
          </View>
          <Text style={styles.classCode}>{item.class_code}</Text>
          <View style={styles.cardBottom}>
            <View style={styles.cardBottomLeft}>
              <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
              <Text style={styles.dateText}>{formatted}</Text>
              {item.scanned_at && (
                <>
                  <Ionicons name="time-outline" size={13} color="#9ca3af" style={styles.timeIcon} />
                  <Text style={styles.dateText}>
                    {new Date(item.scanned_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity 
              style={styles.reportBtn} 
              onPress={() => openReportModal(item)}
            >
              <Text style={styles.reportBtnText}>Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Ionicons name="hourglass-outline" size={32} color="#9ca3af" />
        <Text style={styles.loadingText}>Loading records...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          records.length === 0 ? styles.center : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No Records Yet</Text>
            <Text style={styles.emptyDesc}>
              Your attendance history will appear here after you scan a QR code.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4f46e5"
            colors={["#4f46e5"]}
          />
        }
      />

      {/* Report Issue Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Missing Attendance</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Explain the issue (e.g. Scanner glitched, present but marked absent)..."
                multiline
                numberOfLines={4}
                value={reportDescription}
                onChangeText={setReportDescription}
                textAlignVertical="top"
              />

              <Text style={styles.modalLabel}>Proof Images</Text>
              <View style={styles.photoContainer}>
                {reportPhotos.map((uri, idx) => (
                  <View key={idx} style={styles.photoWrapper}>
                    <Image source={{ uri }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => setReportPhotos(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickReportPhoto}>
                  <Ionicons name="camera-outline" size={24} color="#6b7280" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submittingReport && styles.submitBtnDisabled]}
                onPress={submitReport}
                disabled={submittingReport}
              >
                {submittingReport ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  list: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 15,
    color: "#9ca3af",
    marginTop: 12,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  cardLeft: {
    width: 4,
  },
  statusDot: {
    width: 4,
    height: "100%" as any,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  className: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  classCode: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  dateText: {
    fontSize: 13,
    color: "#9ca3af",
    marginRight: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },
  cardBottomLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  reportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  reportBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  timeIcon: {
    marginLeft: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1a1a2e",
    backgroundColor: "#f9fafb",
    height: 100,
  },
  photoContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  photoWrapper: {
    position: "relative",
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  addPhotoText: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 15,
  },
  submitBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
