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
import { useTabSwipe } from "@/lib/use-tab-swipe";

const DEFAULT_API_URL = "http://localhost:3000/api";

function resolveApiUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (__DEV__ && (!configuredUrl || /vercel\.app/i.test(configuredUrl))) {
    return DEFAULT_API_URL;
  }
  return configuredUrl || DEFAULT_API_URL;
}

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
  teacher_name?: string;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  geofence_passed?: boolean | null;
  wifi_ssid_found?: string | null;
  wifi_passed?: boolean | null;
  photo_url?: string | null;
  marked_by?: string | null;
  notes?: string | null;
}

interface EnrolledClass {
  class_id: string;
  class_name: string;
  class_code: string;
  teacher_name?: string;
}

interface ClassGroup {
  class_id: string;
  class_name: string;
  class_code: string;
  teacher_name?: string;
  last_status: "present" | "absent" | "manual" | null;
  last_date: string | null;
  last_scanned_at: string | null;
  records: AttendanceItem[];
  percentage: number;
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

const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  } catch (e) {
    return "N/A";
  }
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const minStr = minutes < 10 ? `0${minutes}` : minutes;
    
    return `${hours}:${minStr} ${ampm}`;
  } catch (e) {
    return "";
  }
};

function SessionItem({ item, onReport, onPhotoPress }: { item: AttendanceItem; onReport: (item: AttendanceItem) => void; onPhotoPress: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[item.status] || statusConfig.manual;
  const formattedDate = formatDate(item.session_date || item.created_at);
  const formattedTime = formatTime(item.scanned_at);

  return (
    <View style={styles.card}>
      <View style={[styles.cardLeft, { backgroundColor: config.color }]} />
      <TouchableOpacity 
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.sessionDate} numberOfLines={1}>
            {formattedDate}
          </Text>
          <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={12} color={config.color} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.cardBottomLeft}>
            {item.scanned_at && (
              <>
                <Ionicons name="time-outline" size={13} color="#9ca3af" style={{ marginRight: 4 }} />
                <Text style={styles.dateText}>
                  Scanned at {formattedTime}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity 
            style={styles.reportBtn} 
            onPress={(e) => { e.stopPropagation(); onReport(item); }}
          >
            <Text style={styles.reportBtnText}>Report</Text>
          </TouchableOpacity>
        </View>
        
        {expanded && (
          <View style={styles.expandedDetails}>
            {!!item.teacher_name && (
              <View style={styles.detailRow}>
                <Ionicons name="person-circle-outline" size={16} color="#6b7280" style={{marginRight: 6}} />
                <Text style={styles.detailText}>Teacher: {item.teacher_name}</Text>
              </View>
            )}
            {!!item.marked_by && (
              <View style={styles.detailRow}>
                <Ionicons name="create-outline" size={16} color="#6b7280" style={{marginRight: 6}} />
                <Text style={styles.detailText}>Marked By: {item.marked_by}</Text>
              </View>
            )}
            {item.geofence_passed !== null && item.geofence_passed !== undefined && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color={item.geofence_passed ? "#059669" : "#dc2626"} style={{marginRight: 6}} />
                <Text style={[styles.detailText, { color: item.geofence_passed ? "#059669" : "#dc2626" }]}>
                  Geofence: {item.geofence_passed ? "Passed" : "Failed"}
                </Text>
              </View>
            )}
            {item.wifi_passed !== null && item.wifi_passed !== undefined && (
              <View style={styles.detailRow}>
                <Ionicons name="wifi-outline" size={16} color={item.wifi_passed ? "#059669" : "#dc2626"} style={{marginRight: 6}} />
                <Text style={[styles.detailText, { color: item.wifi_passed ? "#059669" : "#dc2626" }]}>
                  WiFi: {item.wifi_passed ? "Verified" : "Failed"} {item.wifi_ssid_found && `(${item.wifi_ssid_found})`}
                </Text>
              </View>
            )}
            {!!item.notes && (
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={16} color="#6b7280" style={{marginRight: 6}} />
                <Text style={styles.detailText}>Notes: {item.notes}</Text>
              </View>
            )}
            {!!item.photo_url && (
              <TouchableOpacity
                onPress={() => onPhotoPress(item.photo_url!)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: item.photo_url }} 
                  style={styles.photoPreviewSquare}
                  onError={() => console.warn("Failed to load photo:", item.photo_url)}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ClassCard({ item, onPress }: { item: ClassGroup; onPress: (id: string) => void }) {
  const config = item.last_status ? (statusConfig[item.last_status] || statusConfig.manual) : null;
  const dateFormatted = formatDate(item.last_date);
  const timeFormatted = formatTime(item.last_scanned_at);
  const percentageColor = item.percentage >= 75 ? "#059669" : item.percentage >= 60 ? "#d97706" : "#dc2626";

  return (
    <TouchableOpacity 
      style={styles.classCard} 
      onPress={() => onPress(item.class_id)}
      activeOpacity={0.7}
    >
      <View style={styles.classCardHeader}>
        <View style={styles.classInfo}>
          <Text style={styles.classNameText} numberOfLines={1}>{item.class_name}</Text>
          <Text style={styles.classCodeText}>{item.class_code}</Text>
          {!!item.teacher_name && (
            <Text style={styles.teacherText}><Ionicons name="person-outline" size={12} /> {item.teacher_name}</Text>
          )}
        </View>
        <View style={styles.percentageContainer}>
          <Text style={[styles.percentageText, { color: percentageColor }]}>{item.percentage}%</Text>
          <Text style={styles.percentageLabel}>Attendance</Text>
        </View>
      </View>
      
      <View style={styles.classCardFooter}>
        <View style={styles.lastSessionInfo}>
          <Text style={styles.lastLabel}>Last Session: </Text>
          <Text style={styles.lastValue}>
            {dateFormatted}{timeFormatted ? ` • ${timeFormatted}` : ""}
          </Text>
        </View>
        {config && (
          <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={11} color={config.color} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: config.color, fontSize: 11 }]}>
              {config.label}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function PhotoPreviewModal({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  if (!imageUrl) return null;
  
  return (
    <View style={styles.previewOverlay}>
      <TouchableOpacity style={styles.previewBackdrop} onPress={onClose} />
      <TouchableOpacity style={styles.previewClose} onPress={onClose}>
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
      <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="contain" />
    </View>
  );
}

export default function HistoryScreen() {
  const { user, token } = useAuth();
  const swipeHandlers = useTabSwipe();
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportItem, setReportItem] = useState<AttendanceItem | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!token) return;

    try {
      const apiUrl = resolveApiUrl();
      const isAndroid = Platform.OS === "android";
      const normalizedUrl = isAndroid ? apiUrl.replace("localhost", "10.0.2.2") : apiUrl;
      
      const response = await fetch(`${normalizedUrl}/students/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }
      
      const result = await response.json();
      
      if (result.enrolledClasses && result.records) {
        setEnrolledClasses(result.enrolledClasses);
        setRecords(result.records);
      }
    } catch (err: any) {
      console.error("Error fetching history:", err.message);
      Alert.alert("Error", "Failed to load attendance history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRecords().finally(() => setLoading(false));
  }, [fetchRecords]);

  const classGroups = useMemo(() => {
    const groups: Record<string, ClassGroup> = {};
    
    enrolledClasses.forEach(c => {
      groups[c.class_id] = {
        class_id: c.class_id,
        class_name: c.class_name,
        class_code: c.class_code,
        teacher_name: c.teacher_name,
        last_status: null,
        last_date: null,
        last_scanned_at: null,
        records: [],
        percentage: 0,
      };
    });

    records.forEach(record => {
      // Ensure the group exists just in case a record has a class not in enrollments
      if (!groups[record.class_id]) {
        groups[record.class_id] = {
          class_id: record.class_id,
          class_name: record.class_name,
          class_code: record.class_code,
          teacher_name: record.teacher_name,
          last_status: null,
          last_date: null,
          last_scanned_at: null,
          records: [],
          percentage: 0,
        };
      }
      
      if (groups[record.class_id].records.length === 0) {
        groups[record.class_id].last_status = record.status;
        groups[record.class_id].last_date = record.session_date || record.created_at;
        groups[record.class_id].last_scanned_at = record.scanned_at;
      }
      groups[record.class_id].records.push(record);
    });

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
    if (!reportItem || !user?.id) return;
    if (!reportDescription.trim()) {
      Alert.alert("Description required", "Please describe why you are reporting this attendance record.");
      return;
    }

    setSubmittingReport(true);
    try {
      const uploadedUrls: string[] = [];

      for (const uri of reportPhotos) {
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const imageResponse = await fetch(uri);
        const imageBlob = await imageResponse.blob();

        const { data, error } = await supabase.storage
          .from("attendance-proofs")
          .upload(fileName, imageBlob, { contentType: "image/jpeg" });
        
        if (error) {
          console.error("attendance-proofs upload error", { fileName, error });
          const debug = JSON.stringify(error);
          throw new Error(error.message ? `${error.message} (${debug})` : debug);
        }
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading records...</Text>
      </View>
    );
  }

  if (selectedClassId) {
    const selectedGroup = classGroups.find(g => g.class_id === selectedClassId);
    
    return (
      <View style={styles.container} {...swipeHandlers}>
        <View style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setSelectedClassId(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <View style={styles.detailHeaderInfo}>
            <Text style={styles.detailClassName} numberOfLines={1}>{selectedGroup?.class_name || "Class Detail"}</Text>
            <Text style={styles.detailClassCode}>{selectedGroup?.class_code || ""}</Text>
          </View>
        </View>
        
        <FlatList
          key="session-list"
          data={selectedGroup?.records || []}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => <SessionItem item={item} onReport={openReportModal} onPhotoPress={setPreviewImageUrl} />}
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
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
        
        <ReportModal 
          visible={reportModalVisible} 
          onClose={() => setReportModalVisible(false)}
          description={reportDescription}
          setDescription={setReportDescription}
          photos={reportPhotos}
          setPhotos={setReportPhotos}
          pickPhoto={pickReportPhoto}
          submitting={submittingReport}
          onSubmit={submitReport}
        />
        
        <PhotoPreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
      </View>
    );
  }

  return (
    <View style={styles.container} {...swipeHandlers}>
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
        key="class-list"
        data={classGroups}
        keyExtractor={(item) => item.class_id?.toString()}
        renderItem={({ item }) => <ClassCard item={item} onPress={setSelectedClassId} />}
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
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
      
      <PhotoPreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
    </View>
  );
}

function ReportModal({ 
  visible, 
  onClose, 
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

          <ScrollView showsVerticalScrollIndicator={false}>
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
              {(photos || []).map((uri: string, idx: number) => (
                <View key={idx} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setPhotos((prev: string[]) => prev.filter((_: any, i: number) => i !== idx))}
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
  flatList: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
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
  teacherText: {
    fontSize: 13,
    color: "#4b5563",
    marginTop: 4,
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
  },
  cardLeft: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    alignSelf: "stretch",
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
    marginTop: 8,
  },
  photoWrapper: {
    position: "relative",
    marginRight: 12,
    marginBottom: 12,
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
    marginTop: 24,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    marginRight: 6,
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
    marginLeft: 6,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#4b5563",
  },
  photoPreviewLarge: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: "#f3f4f6",
  },
  photoPreviewSquare: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: "#f3f4f6",
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 1000,
  },
  previewBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1001,
    padding: 8,
  },
  previewImage: {
    width: "100%",
    height: "80%",
    borderRadius: 12,
  },
});
