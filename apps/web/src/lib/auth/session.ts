import { SignJWT, jwtVerify } from "jose";

// To make RLS policies (`auth.uid()`) work correctly without using Supabase Auth,
// we sign our own JWT using the Supabase project's JWT Secret.
// Go to Supabase Dashboard -> Project Settings -> API -> JWT Secret.
function getJwtSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing SUPABASE_JWT_SECRET in environment variables.");
  }
  return new TextEncoder().encode(secret);
}

// Extract the Supabase project ref from the URL for the JWT issuer.
// PostgREST validates iss against this format for auth.uid() to work.
function getSupabaseIssuer(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in environment variables.");
  }
  // Extract project ref from "https://<ref>.supabase.co"
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (match) {
    return `https://${match[1]}.supabase.co/auth/v1`;
  }
  // Fallback for self-hosted or non-standard URLs
  return `${url}/auth/v1`;
}

interface JWTPayload {
  sub: string;      // The user ID, auth.uid() in Supabase RLS will read this
  role: string;     // Usually 'authenticated'
  email?: string;
  app_metadata: {
    role: "student" | "teacher";
  };
}

export async function createSessionJwt(payload: JWTPayload): Promise<string> {
  const alg = "HS256";
  
  const jwt = await new SignJWT({
      ...payload,
      aud: "authenticated",
  })
    .setProtectedHeader({ alg, typ: "JWT" })
    .setIssuedAt()
    .setIssuer(getSupabaseIssuer())
    .setExpirationTime("7d") // Valid for 7 days
    .sign(getJwtSecret());

  return jwt;
}

export async function verifySessionJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JWTPayload & { exp: number };
  } catch {
    return null;
  }
}
