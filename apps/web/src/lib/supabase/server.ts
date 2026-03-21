import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { verifySessionJwt } from "@/lib/auth/session";

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sas-auth-token")?.value;
  if (!token) return null;
  const payload = await verifySessionJwt(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    user_metadata: { role: payload.app_metadata?.role },
    app_metadata: payload.app_metadata,
  };
}

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sas-auth-token")?.value;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
