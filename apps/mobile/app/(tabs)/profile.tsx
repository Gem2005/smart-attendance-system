import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";

interface StudentProfile {
  full_name: string;
  email: string;
  roll_number: string;
  phone: string | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [classCount, setClassCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: student } = await supabase
        .from("students")
        .select("full_name, email, roll_number, phone")
        .eq("id", user!.id)
        .single();

      if (student) setProfile(student);

      const { count } = await supabase
        .from("class_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("student_id", user!.id);

      setClassCount(count ?? 0);
    }

    load();
  }, [user]);

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <Text style={styles.name}>{profile?.full_name ?? "..."}</Text>
        <Text style={styles.email}>{profile?.email ?? user?.email}</Text>
      </View>

      <View style={styles.infoSection}>
        <InfoRow icon="id-card-outline" label="Roll Number" value={profile?.roll_number ?? "-"} />
        <InfoRow icon="call-outline" label="Phone" value={profile?.phone ?? "Not set"} />
        <InfoRow icon="school-outline" label="Enrolled Classes" value={classCount.toString()} />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#f44336" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#666" />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    backgroundColor: "#2f95dc",
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  email: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 12,
    padding: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fce4ec",
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f44336",
  },
});
