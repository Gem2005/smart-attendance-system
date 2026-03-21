import crypto from "crypto";
import type { QRPayload } from "@/types/qr";
import { QR_EXPIRY_SECONDS } from "@/lib/constants";

const getSecret = () => {
  const secret = process.env.QR_HMAC_SECRET;
  if (!secret) throw new Error("QR_HMAC_SECRET is not set");
  return secret;
};

/**
 * Generate HMAC-SHA256 signature for QR payload fields.
 */
function sign(sid: string, cid: string, iat: number, exp: number): string {
  const data = `${sid}:${cid}:${iat}:${exp}`;
  return crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("hex");
}

/**
 * Create a signed QR payload for an attendance session.
 */
export function createQRPayload(sessionId: string, classId: string): QRPayload {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + QR_EXPIRY_SECONDS;
  const hmac = sign(sessionId, classId, iat, exp);

  return { sid: sessionId, cid: classId, iat, exp, hmac };
}

/**
 * Verify a QR payload's HMAC signature and expiry.
 * Returns true if valid and not expired.
 */
export function verifyQRPayload(payload: QRPayload): boolean {
  const expectedHmac = sign(payload.sid, payload.cid, payload.iat, payload.exp);

  // Constant-time comparison to prevent timing attacks
  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(expectedHmac, "hex"),
    Buffer.from(payload.hmac, "hex")
  );

  const now = Math.floor(Date.now() / 1000);
  const isNotExpired = now <= payload.exp;

  return isValidSignature && isNotExpired;
}
