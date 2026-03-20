import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(identifier: string, password: string) {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
    
    // Convert generic localhost to Android emulator localhost if on Android
    const isAndroid = Platform.OS === "android";
    const normalizedUrl = isAndroid ? API_URL.replace("localhost", "10.0.2.2") : API_URL;

    const res = await fetch(`${normalizedUrl}/auth/student-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    const { data: sessionData, error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.access_token, // Hack: pass same token as refresh to prevent ignore, or avoid reliance on event
    });

    if (error) throw error;
    
    // Explicitly update state just in case onAuthStateChange ignores the custom session
    setSession(sessionData?.session || { access_token: data.access_token, user: data.user } as any);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
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
