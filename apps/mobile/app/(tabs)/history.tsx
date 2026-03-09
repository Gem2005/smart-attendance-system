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

  const statusColors: Record<string, string> = {
    present: "#4CAF50",
    absent: "#f44336",
    manual: "#ff9800",
  };

  const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    present: "checkmark-circle",
    absent: "close-circle",
    manual: "pencil",
  };

  function renderItem({ item }: { item: AttendanceItem }) {
    const date = new Date(item.session_date || item.created_at);
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return (
      <View style={styles.card}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: statusColors[item.status] },
          ]}
        />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.className}>{item.class_name}</Text>
            <View style={styles.statusBadge}>
              <Ionicons
                name={statusIcons[item.status]}
                size={14}
                color={statusColors[item.status]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: statusColors[item.status] },
                ]}
              >
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.classCode}>{item.class_code}</Text>
          <Text style={styles.date}>{formatted}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Loading...</Text>
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
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No attendance records yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  list: { padding: 16, gap: 12 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    elevation: 2,
  },
  statusIndicator: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  className: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  classCode: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  date: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});
