import crypto from "crypto";

import QRCode from "qrcode";

export function createGuestQrCode(eventId: string, email: string) {
  return crypto.createHash("sha256").update(`${eventId}:${email}:${Date.now()}`).digest("hex");
}

export function validateGuestQrCode(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}

/** PNG as base64 (no data URL prefix) for email attachments. */
export async function guestQrToPngBase64(qrPayload: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(qrPayload, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
    type: "image/png"
  });
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("QR generation failed");
  return base64;
}
