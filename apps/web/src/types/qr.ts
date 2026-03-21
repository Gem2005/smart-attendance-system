export interface QRPayload {
  sid: string;
  cid: string;
  iat: number;
  exp: number;
  hmac: string;
}