import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "sas-auth-token";
const USER_KEY = "sas-auth-user";

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

export interface CustomSession {
  access_token: string;
  user: AuthUser;
}

interface AuthContextType {
  session: CustomSession | null;
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  token: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CustomSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from storage on startup
  useEffect(() => {
    async function restoreSession() {
      try {
        const [token, userJson] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        const storedToken = token[1];
        const storedUser = userJson[1];

        if (storedToken && storedUser) {
          setSession({
            access_token: storedToken,
            user: JSON.parse(storedUser),
          });
        }
      } catch {
        // Corrupted storage — ignore and treat as logged out
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function signIn(identifier: string, password: string) {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

    // Convert localhost to Android emulator address
    const isAndroid = Platform.OS === "android";
    const normalizedUrl = isAndroid
      ? API_URL.replace("localhost", "10.0.2.2")
      : API_URL;

    const res = await fetch(`${normalizedUrl}/auth/student-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    const newSession: CustomSession = {
      access_token: data.access_token,
      user: data.user,
    };

    // Persist to AsyncStorage
    await AsyncStorage.multiSet([
      [TOKEN_KEY, data.access_token],
      [USER_KEY, JSON.stringify(data.user)],
    ]);

    setSession(newSession);
  }

  async function signOut() {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        token: session?.access_token ?? null,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
