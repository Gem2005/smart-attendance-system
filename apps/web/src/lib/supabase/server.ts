import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import type { Database } from "@/types/database";
import { verifySessionJwt } from "@/lib/auth/session";

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function resolveAuthToken(): Promise<string | null> {
  const headerStore = await headers();
  const bearerToken = extractBearerToken(headerStore.get("authorization"));
  if (bearerToken) return bearerToken;

  const cookieStore = await cookies();
  return cookieStore.get("sas-auth-token")?.value ?? null;
}

export async function getUser() {
  const token = await resolveAuthToken();
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
  const token = await resolveAuthToken();

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
