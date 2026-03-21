import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Module-level singleton cache keyed by token to prevent multiple GoTrueClient instances
const clientCache = new Map<string, SupabaseClient<Database>>();

export function createClient(customToken?: string) {
  let token: string | undefined = customToken;
  
  if (!token && typeof document !== "undefined") {
    const match = document.cookie.match(/(^|; )sas-auth-token=([^;]*)/);
    if (match) {
      token = match[2];
    }
  }

  const cacheKey = token ?? "__anon__";
  
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const client = createSupabaseClient<Database>(
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

  clientCache.set(cacheKey, client);
  return client;
}
