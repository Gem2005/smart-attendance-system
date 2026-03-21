import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";

const STUDENT_EMAIL_DOMAIN = "students.attendance.local";

function formatLoginError(error: any): string {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "");

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message) || /invalid credentials/i.test(message)) {
    return "Invalid login credentials. Use your roll number as both ID and password on first login, or ask your teacher to create your account.";
  }

  if (code === "over_request_rate_limit" || /too many requests/i.test(message)) {
    return "Too many login attempts. Please wait a minute and try again.";
  }

  return message || "Unable to sign in. Please try again.";
}

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      Alert.alert("Error", "Please enter your roll number/email and password");
      return;
    }

    setLoading(true);
    try {
      // We handle generic identifier in the new custom /auth/student-login endpoint
      await signIn(identifier.trim(), password);
    } catch (error: any) {
      Alert.alert("Login Failed", formatLoginError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        {/* Logo & Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="finger-print" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Smart Attendance</Text>
          <Text style={styles.subtitle}>
            Sign in with your roll number or email
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Roll Number / Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="id-card-outline"
                size={20}
                color="#8e8ea0"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. CS2024001 or email"
                placeholderTextColor="#8e8ea0"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="default"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#8e8ea0"
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor="#8e8ea0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#8e8ea0"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>


        </View>

        {/* Footer hint */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={16} color="#9ca3af" />
          <Text style={styles.footerText}>
            First-time login? Your password is your roll number.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#4f46e5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    boxShadow: "0 6 12 0 rgba(79, 70, 229, 0.35)",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1a1a2e",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    height: 54,
    boxShadow: "0 1 3 0 rgba(0, 0, 0, 0.04)",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a2e",
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    boxShadow: "0 4 8 0 rgba(79, 70, 229, 0.3)",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 13,
    color: "#9ca3af",
  },
});
