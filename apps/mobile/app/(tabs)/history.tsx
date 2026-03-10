import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
            <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
            <Text style={styles.dateText}>{formatted}</Text>
            {item.scanned_at && (
              <>
                <Ionicons name="time-outline" size={13} color="#9ca3af" />
                <Text style={styles.dateText}>
                  {new Date(item.scanned_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </>
            )}
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
    gap: 6,
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
});
