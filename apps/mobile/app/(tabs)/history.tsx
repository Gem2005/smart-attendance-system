import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Platform,
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

interface EnrolledClass {
  class_id: string;
  class_name: string;
  class_code: string;
}

interface ClassGroup {
  class_id: string;
  class_name: string;
  class_code: string;
  last_status: "present" | "absent" | "manual" | null;
  last_date: string | null;
  last_scanned_at: string | null;
  records: AttendanceItem[];
  percentage: number;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Report Modal State
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportItem, setReportItem] = useState<AttendanceItem | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Fetch all enrolled classes
      const { data: enrollments, error: enrollError } = await supabase
        .from("class_enrollments")
        .select(`
          class_id,
          classes!inner(name, code)
        `)
        .eq("student_id", user.id);

      if (enrollError) throw enrollError;

      const classes = (enrollments || []).map((e: any) => ({
        class_id: e.class_id,
        class_name: e.classes.name,
        class_code: e.classes.code,
      }));
      setEnrolledClasses(classes);

      // 2. Fetch all attendance records
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          status,
          scanned_at,
          created_at,
          class_id,
          session_id,
          attendance_sessions!inner(session_date),
          classes!inner(name, code)
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
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
    } catch (err: any) {
      console.error("Error fetching history:", err.message);
    }
  }, [user]);

  useEffect(() => {
    fetchRecords().finally(() => setLoading(false));
  }, [fetchRecords]);

  // Group records by class
  const classGroups = useMemo(() => {
    const groups: Record<string, ClassGroup> = {};
    
    // Initialize with all enrolled classes
    enrolledClasses.forEach(c => {
      groups[c.class_id] = {
        class_id: c.class_id,
        class_name: c.class_name,
        class_code: c.class_code,
        last_status: null,
        last_date: null,
        last_scanned_at: null,
        records: [],
        percentage: 0,
      };
    });

    records.forEach(record => {
      if (groups[record.class_id]) {
        if (groups[record.class_id].records.length === 0) {
          groups[record.class_id].last_status = record.status;
          groups[record.class_id].last_date = record.session_date || record.created_at;
          groups[record.class_id].last_scanned_at = record.scanned_at;
        }
        groups[record.class_id].records.push(record);
      }
    });

    // Calculate percentages
    Object.values(groups).forEach(g => {
      if (g.records.length > 0) {
        const present = g.records.filter(r => r.status === "present" || r.status === "manual").length;
        g.percentage = Math.round((present / g.records.length) * 100);
      } else {
        g.percentage = 0;
      }
    });

    return Object.values(groups);
  }, [records, enrolledClasses]);

  const overallAverage = useMemo(() => {
    const activeGroups = classGroups.filter((g) => g.records.length > 0);
    if (activeGroups.length === 0) return 0;
    const total = activeGroups.reduce((acc, g) => acc + g.percentage, 0);
    return Math.round(total / activeGroups.length);
  }, [classGroups]);

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
          .from("attendance-photos")
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

  function renderSessionItem({ item }: { item: AttendanceItem }) {
    const dateValue = item.session_date || item.created_at;
    const date = dateValue ? new Date(dateValue) : new Date();
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
            <Text style={styles.sessionDate} numberOfLines={1}>
              {formatted}
            </Text>
            <View style={[styles.badge, { backgroundColor: config.bg }]}>
              <Ionicons name={config.icon} size={12} color={config.color} />
              <Text style={[styles.badgeText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.cardBottomLeft}>
              {item.scanned_at && (
                <>
                  <Ionicons name="time-outline" size={13} color="#9ca3af" />
                  <Text style={styles.dateText}>
                    Scanned at {new Date(item.scanned_at).toLocaleTimeString("en-US", {
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

  function renderClassCard({ item }: { item: ClassGroup }) {
    const config = item.last_status ? (statusConfig[item.last_status] ?? statusConfig.manual) : null;
    const date = item.last_date ? new Date(item.last_date) : null;
    const dateFormatted = date ? date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }) : "No sessions yet";

    const timeFormatted = item.last_scanned_at 
      ? new Date(item.last_scanned_at).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const percentageColor = item.percentage >= 75 ? "#059669" : item.percentage >= 60 ? "#d97706" : "#dc2626";

    return (
      <TouchableOpacity 
        style={styles.classCard} 
        onPress={() => setSelectedClassId(item.class_id)}
        activeOpacity={0.7}
      >
        <View style={styles.classCardHeader}>
          <View style={styles.classInfo}>
            <Text style={styles.classNameText} numberOfLines={1}>{item.class_name}</Text>
            <Text style={styles.classCodeText}>{item.class_code}</Text>
          </View>
          <View style={styles.percentageContainer}>
            <Text style={[styles.percentageText, { color: percentageColor }]}>{item.percentage}%</Text>
            <Text style={styles.percentageLabel}>Attendance</Text>
          </View>
        </View>
        
        <View style={styles.classCardFooter}>
          <View style={styles.lastSessionInfo}>
            <Text style={styles.lastLabel}>Last Session:</Text>
            <Text style={styles.lastValue}>
              {dateFormatted}{timeFormatted ? ` • ${timeFormatted}` : ""}
            </Text>
          </View>
          {config && (
            <View style={[styles.badge, { backgroundColor: config.bg }]}>
              <Ionicons name={config.icon} size={11} color={config.color} />
              <Text style={[styles.badgeText, { color: config.color, fontSize: 11 }]}>
                {config.label}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
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

  if (selectedClassId) {
    const selectedGroup = classGroups.find(g => g.class_id === selectedClassId);
    
    if (!selectedGroup) {
      return (
        <View style={styles.center}>
          <Text>Class not found.</Text>
          <TouchableOpacity onPress={() => setSelectedClassId(null)}>
            <Text style={{ color: "#4f46e5", marginTop: 10 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setSelectedClassId(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <View style={styles.detailHeaderInfo}>
            <Text style={styles.detailClassName} numberOfLines={1}>{selectedGroup.class_name}</Text>
            <Text style={styles.detailClassCode}>{selectedGroup.class_code}</Text>
          </View>
        </View>
        
        <FlatList
          data={selectedGroup.records || []}
          keyExtractor={(item) => item.id}
          renderItem={renderSessionItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No Records</Text>
              <Text style={styles.emptyDesc}>No attendance sessions found for this class.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
        
        {/* Reuse the report modal */}
        <ReportModal 
          visible={reportModalVisible} 
          onClose={() => setReportModalVisible(false)}
          item={reportItem}
          description={reportDescription}
          setDescription={setReportDescription}
          photos={reportPhotos}
          setPhotos={setReportPhotos}
          pickPhoto={pickReportPhoto}
          submitting={submittingReport}
          onSubmit={submitReport}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Overall Attendance</Text>
            <Text style={[styles.summaryValue, { color: overallAverage >= 75 ? "#059669" : "#d97706" }]}>
              {overallAverage}%
            </Text>
          </View>
          <View style={styles.summaryChart}>
            <Ionicons name="stats-chart" size={32} color="#4f46e5" />
          </View>
        </View>
      </View>

      <FlatList
        data={classGroups}
        keyExtractor={(item) => item.class_id}
        renderItem={renderClassCard}
        contentContainerStyle={
          classGroups.length === 0 ? styles.center : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="school-outline" size={48} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No Enrolled Classes</Text>
            <Text style={styles.emptyDesc}>
              You are not enrolled in any classes yet.
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
    </View>
  );
}

function ReportModal({ 
  visible, 
  onClose, 
  item, 
  description, 
  setDescription, 
  photos, 
  setPhotos, 
  pickPhoto, 
  submitting, 
  onSubmit 
}: any) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Missing Attendance</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Explain the issue..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Proof Images</Text>
            <View style={styles.photoContainer}>
              {photos.map((uri: string, idx: number) => (
                <View key={idx} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setPhotos((prev: string[]) => prev.filter((_, i) => i !== idx))}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
                <Ionicons name="camera-outline" size={24} color="#6b7280" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  summaryHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "800",
    marginTop: 4,
  },
  summaryChart: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  classCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  classCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  classInfo: {
    flex: 1,
    marginRight: 12,
  },
  classNameText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  classCodeText: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  percentageContainer: {
    alignItems: "flex-end",
  },
  percentageText: {
    fontSize: 20,
    fontWeight: "800",
  },
  percentageLabel: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  classCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  lastSessionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lastLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },
  lastValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
    overflow: "hidden",
  },
  cardLeft: {
    width: 4,
  },
  statusDot: {
    width: 4,
    height: "100%",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
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
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardBottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  reportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  reportBtnText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "600",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  detailHeaderInfo: {
    flex: 1,
  },
  detailClassName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  detailClassCode: {
    fontSize: 13,
    color: "#6b7280",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: 40,
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
