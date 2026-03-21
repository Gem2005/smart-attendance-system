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
    .setIssuer("smart-attendance-system")
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
