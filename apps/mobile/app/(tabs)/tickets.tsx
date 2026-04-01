import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";

type TicketStatus = "pending" | "approved" | "rejected";

interface TicketItem {
  id: string;
  class_id: string;
  description: string;
  proof_urls: string[];
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  teacher_notes: string | null;
  class_name: string | null;
  class_code: string | null;
  faculty_name: string | null;
}

const DEFAULT_API_URL = "http://localhost:3000/api";

function resolveApiUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (__DEV__ && (!configuredUrl || /vercel\.app/i.test(configuredUrl))) {
    return DEFAULT_API_URL;
  }
  return configuredUrl || DEFAULT_API_URL;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export default function TicketsScreen() {
  const { user, token } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [proofMap, setProofMap] = useState<Record<string, string[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const statusConfig = useMemo(
    () => ({
      pending: { label: "Pending", color: "#d97706", bg: "#fffbeb" },
      approved: { label: "Approved", color: "#059669", bg: "#ecfdf5" },
      rejected: { label: "Closed", color: "#6b7280", bg: "#f3f4f6" },
    }),
    []
  );

  const loadTickets = useCallback(async () => {
    if (!user?.id || !token) return;

    try {
      const apiUrl = resolveApiUrl();
      const normalizedUrl = Platform.OS === "android" ? apiUrl.replace("localhost", "10.0.2.2") : apiUrl;

      const res = await fetch(`${normalizedUrl}/students/tickets/list`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok) {
        Alert.alert("Error", payload.error || "Failed to load tickets");
        return;
      }

      const rows = (payload.tickets || []) as TicketItem[];
      setTickets(rows);

      const signedMap: Record<string, string[]> = {};
      for (const ticket of rows) {
        if (!ticket.proof_urls?.length) {
          signedMap[ticket.id] = [];
          continue;
        }

        const signedUrls: string[] = [];
        for (const proofPath of ticket.proof_urls) {
          const { data: signed, error: signedError } = await supabase.storage
            .from("attendance-proofs")
            .createSignedUrl(proofPath, 300);

          if (!signedError && signed?.signedUrl) {
            signedUrls.push(signed.signedUrl);
          }
        }
        signedMap[ticket.id] = signedUrls;
      }

      setProofMap(signedMap);
    } catch {
      Alert.alert("Connection Error", "Cannot reach API server. Ensure web backend is running on port 3000.");
    }
  }, [token, user?.id]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function onRefresh() {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  }

  async function closeTicket(ticketId: string) {
    if (!token) return;

    const performClose = async () => {
      try {
        const apiUrl = resolveApiUrl();
        const normalizedUrl = Platform.OS === "android" ? apiUrl.replace("localhost", "10.0.2.2") : apiUrl;

        const res = await fetch(`${normalizedUrl}/students/tickets/close`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ticketId }),
        });

        const payload = await res.json();
        if (!res.ok) {
          Alert.alert("Error", payload.error || "Failed to close ticket");
          return;
        }

        Alert.alert("Closed", "Ticket closed successfully.");
        await loadTickets();
      } catch {
        Alert.alert("Connection Error", "Unable to close ticket right now. Please try again.");
      }
    };

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" ? window.confirm("Do you want to close this ticket?") : false;
      if (confirmed) {
        await performClose();
      }
      return;
    }

    Alert.alert("Close Ticket", "Do you want to close this ticket?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: () => {
          void performClose();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {tickets.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="ticket-outline" size={46} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Tickets</Text>
          <Text style={styles.emptyDesc}>You have not raised any attendance tickets yet.</Text>
        </View>
      ) : (
        tickets.map((ticket) => {
          const cfg = statusConfig[ticket.status];
          return (
            <View key={ticket.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {ticket.status === "pending" && (
                  <TouchableOpacity style={styles.closeBtn} onPress={() => closeTicket(ticket.id)}>
                    <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                    <Text style={styles.closeBtnText}>Close Ticket</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.desc}>{ticket.description}</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Class:</Text>
                <Text style={styles.infoValue}>{ticket.class_name || "Unknown class"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Course Code:</Text>
                <Text style={styles.infoValue}>{ticket.class_code || "N/A"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Faculty:</Text>
                <Text style={styles.infoValue}>{ticket.faculty_name || "Not assigned"}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Created:</Text>
                <Text style={styles.metaValue}>{formatDateTime(ticket.created_at)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Last Update:</Text>
                <Text style={styles.metaValue}>{formatDateTime(ticket.updated_at)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Closed:</Text>
                <Text style={styles.metaValue}>{formatDateTime(ticket.resolved_at)}</Text>
              </View>

              {!!ticket.teacher_notes && (
                <View style={styles.noteWrap}>
                  <Text style={styles.noteLabel}>Resolution Note</Text>
                  <Text style={styles.noteText}>{ticket.teacher_notes}</Text>
                </View>
              )}

              {(proofMap[ticket.id] || []).length > 0 && (
                <>
                  <Text style={styles.proofLabel}>Uploaded Proofs</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(proofMap[ticket.id] || []).map((url, idx) => (
                      <TouchableOpacity
                        key={`${ticket.id}-${idx}`}
                        onPress={() => {
                          setPreviewImageUrl(url);
                          setPreviewVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: url }} style={styles.proofImage} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          );
        })
      )}

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewVisible(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: { padding: 16, paddingBottom: 28 },
  emptyWrap: { marginTop: 80, alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#374151", marginTop: 10 },
  emptyDesc: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 6 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "700" },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  closeBtnText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },
  desc: { marginTop: 10, fontSize: 14, color: "#1f2937", lineHeight: 20 },
  infoRow: { flexDirection: "row", marginTop: 6 },
  infoLabel: { width: 92, fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  infoValue: { flex: 1, fontSize: 12, color: "#374151", fontWeight: "700" },
  metaRow: { flexDirection: "row", marginTop: 6 },
  metaLabel: { width: 92, fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  metaValue: { flex: 1, fontSize: 12, color: "#374151", fontWeight: "600" },
  noteWrap: { marginTop: 10, backgroundColor: "#f9fafb", borderRadius: 8, padding: 10 },
  noteLabel: { fontSize: 11, color: "#6b7280", fontWeight: "700", marginBottom: 4 },
  noteText: { fontSize: 13, color: "#374151" },
  proofLabel: { marginTop: 12, marginBottom: 8, fontSize: 12, fontWeight: "700", color: "#6b7280" },
  proofImage: { width: 96, height: 96, borderRadius: 10, marginRight: 8, backgroundColor: "#f3f4f6" },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  previewClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: "100%",
    height: "80%",
    borderRadius: 12,
  },
});
