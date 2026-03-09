export interface QRPayload {
  /** attendance_session id */
  sid: string;
  /** class id */
  cid: string;
  /** issued-at unix timestamp (seconds) */
  iat: number;
  /** expires unix timestamp (seconds) */
  exp: number;
  /** HMAC-SHA256 hex signature */
  hmac: string;
}
