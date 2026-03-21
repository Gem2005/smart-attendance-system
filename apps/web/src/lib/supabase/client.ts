import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createClient(customToken?: string) {
  let token: string | undefined = customToken;
  
  if (!token && typeof document !== "undefined") {
    const match = document.cookie.match(/(^|; )sas-auth-token=([^;]*)/);
    if (match) {
      token = match[2];
    }
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );
}
