import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";

interface StudentProfile {
  full_name: string;
  email: string | null;
  roll_number: string;
  phone: string | null;
}

export default function ProfileScreen() {
  const { user, token, signOut } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [classCount, setClassCount] = useState(0);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Set initial profile from user object if available
    if (user.full_name || user.roll_number) {
      setProfile({
        full_name: user.full_name ?? "...",
        email: user.email ?? null,
        roll_number: user.roll_number ?? "",
        phone: user.phone ?? null,
      });
    }

    async function load() {
      try {
        const { data: student, error } = await supabase
          .from("students")
          .select("full_name, email, roll_number, phone")
          .eq("id", user!.id)
          .single();

        if (student) {
          setProfile(student);
        } else if (error) {
          console.warn("Profile fetch error:", error.message);
        }

        const { count } = await supabase
          .from("class_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("student_id", user!.id);

        setClassCount(count ?? 0);
      } catch (err) {
        console.error("Failed to load profile details", err);
      }
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

  async function handlePasswordChange() {
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      const isAndroid = Platform.OS === "android";
      const normalizedUrl = isAndroid ? API_URL.replace('localhost', '10.0.2.2') : API_URL;

      const res = await fetch(`${normalizedUrl}/students/update-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      Alert.alert("Success", "Password changed successfully.");
      setShowPasswordChange(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setChangingPassword(false);
    }
  }

  const displayEmail = profile?.email?.endsWith("@students.attendance.local")
    ? null
    : profile?.email;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? "..."}</Text>
        <Text style={styles.rollBadge}>{profile?.roll_number ?? ""}</Text>
      </View>

      {/* Info cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.card}>
          <InfoRow icon="id-card" label="Roll Number" value={profile?.roll_number ?? "-"} />
          {displayEmail && (
            <InfoRow icon="mail" label="Email" value={displayEmail} />
          )}
          <InfoRow icon="call" label="Phone" value={profile?.phone ?? "Not set"} />
          <InfoRow icon="school" label="Enrolled Classes" value={classCount.toString()} last />
        </View>
      </View>

      {/* Password Change */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowPasswordChange(!showPasswordChange)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#eef2ff" }]}>
              <Ionicons name="lock-closed" size={18} color="#4f46e5" />
            </View>
            <Text style={styles.menuLabel}>Change Password</Text>
            <Ionicons
              name={showPasswordChange ? "chevron-up" : "chevron-forward"}
              size={18}
              color="#9ca3af"
            />
          </TouchableOpacity>

          {showPasswordChange && (
            <View style={styles.passwordSection}>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-open-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Ionicons name={showNew ? "eye-off" : "eye"} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons name={showConfirm ? "eye-off" : "eye"} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.changeBtn, changingPassword && { opacity: 0.7 }]}
                onPress={handlePasswordChange}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.changeBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={[styles.iconCircle, { backgroundColor: "#f0f0ff" }]}>  
        <Ionicons name={icon} size={16} color="#4f46e5" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  scroll: { paddingBottom: 32 },
  header: {
    backgroundColor: "#4f46e5",
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: "center",
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  rollBadge: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 2 8 0 rgba(0, 0, 0, 0.05)",
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginTop: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  passwordSection: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1a1a2e",
  },
  changeBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  changeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    boxShadow: "0 1 4 0 rgba(0, 0, 0, 0.03)",
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
});
