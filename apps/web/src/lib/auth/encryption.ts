import crypto from "crypto";

// AES-256 requires a 32-byte (256-bit) key.
// In production, define an ENCRYPTION_KEY environment variable.
const CIPHER_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; 

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "default_local_only_key_32_bytes_"; 
  if (secret.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 caracters long.");
  }
  return Buffer.from(secret);
}

/**
 * Encrypts a plain text password using AES-256-GCM.
 */
export function encryptPassword(text: string): string {
  if (!text) return text;
  
  // Initialization Vector
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // GCM Auth Tag
  const authTag = cipher.getAuthTag().toString("hex");

  // Output format: iv:encryptedData:authTag
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/**
 * Decrypts a previously encrypted password back to plain text.
 */
export function decryptPassword(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format. Expected iv:encrypted:authTag");
  }

  const [ivHex, encryptedHex, authTagHex] = parts;

  const decipher = crypto.createDecipheriv(
    CIPHER_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Validates a plain text attempt against the encrypted stored password.
 */
export function verifyPassword(plainTextAttempt: string, storedEncryptedText: string): boolean {
  try {
    const decryptedStored = decryptPassword(storedEncryptedText);
    return decryptedStored === plainTextAttempt;
  } catch {
    // Fails on decryption issues or tampering
    return false;
  }
}
