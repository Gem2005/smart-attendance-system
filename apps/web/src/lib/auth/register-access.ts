import crypto from "crypto";

export const TEACHER_SIGNUP_ACCESS_COOKIE = "teacher_signup_access";
export const TEACHER_SIGNUP_ACCESS_TTL_SECONDS = 15 * 60;

const SIGNUP_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function getSignupKey(): string {
  const key = process.env.TEACHER_SIGNUP_ACCESS_KEY?.trim();
  if (!key || !SIGNUP_KEY_PATTERN.test(key)) {
    throw new Error(
      "TEACHER_SIGNUP_ACCESS_KEY must be a 64-character hex string"
    );
  }
  return key.toLowerCase();
}

function signPayload(payload: string): string {
  const key = getSignupKey();
  return crypto
    .createHmac("sha256", Buffer.from(key, "hex"))
    .update(payload)
    .digest("hex");
}

export function assertTeacherSignupKeyConfigured(): void {
  getSignupKey();
}

export function verifyTeacherSignupKey(candidate: string): boolean {
  try {
    const expected = Buffer.from(getSignupKey(), "hex");
    const normalized = candidate.trim().toLowerCase();
    if (!SIGNUP_KEY_PATTERN.test(normalized)) {
      return false;
    }
    const provided = Buffer.from(normalized, "hex");
    if (expected.length !== provided.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export function createTeacherSignupAccessToken(now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TEACHER_SIGNUP_ACCESS_TTL_SECONDS;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${exp}.${nonce}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function isTeacherSignupAccessTokenValid(
  token: string | undefined,
  now = Date.now()
): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [expText, nonce, signature] = parts;
  if (!expText || !nonce || !signature) {
    return false;
  }

  if (!/^\d+$/.test(expText)) {
    return false;
  }

  if (!/^[0-9a-f]{24}$/i.test(nonce) || !/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }

  const exp = Number(expText);
  if (!Number.isFinite(exp)) {
    return false;
  }

  if (Math.floor(now / 1000) > exp) {
    return false;
  }

  try {
    const payload = `${expText}.${nonce}`;
    const expected = signPayload(payload);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export function getTeacherSignupCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEACHER_SIGNUP_ACCESS_TTL_SECONDS,
  };
}