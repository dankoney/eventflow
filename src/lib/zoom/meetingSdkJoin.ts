/** Maps Zoom Meeting SDK embedded join failures to actionable messages. */

export type ZoomMeetingSdkJoinErrorInfo = {
  message: string;
  hints: string[];
};

function asRecord(err: unknown): Record<string, unknown> | null {
  if (err && typeof err === "object") return err as Record<string, unknown>;
  return null;
}

export function formatZoomMeetingSdkJoinError(
  err: unknown,
  context?: { oauthClientId?: string | null; meetingSdkClientId?: string | null }
): ZoomMeetingSdkJoinErrorInfo {
  const rec = asRecord(err);
  const reason = typeof rec?.reason === "string" ? rec.reason : null;
  const errorCode = typeof rec?.errorCode === "number" ? rec.errorCode : null;
  const type = typeof rec?.type === "string" ? rec.type : null;

  const parts: string[] = [];
  if (reason) parts.push(reason);
  else if (err instanceof Error) parts.push(err.message);
  else if (typeof err === "string") parts.push(err);
  else parts.push("Failed to join meeting");

  if (errorCode != null) parts.push(`(code ${errorCode})`);
  if (type) parts.push(`[${type}]`);

  const message = parts.join(" ");
  const hints: string[] = [];

  const lower = message.toLowerCase();
  const oauthId = context?.oauthClientId?.trim();
  const sdkId = context?.meetingSdkClientId?.trim();
  const credsMismatch =
    oauthId && sdkId && oauthId.length > 0 && sdkId.length > 0 && oauthId !== sdkId;

  if (
    lower.includes("signature") ||
    errorCode === 3712 ||
    lower.includes("invalid sdk")
  ) {
    hints.push(
      "Use the Meeting SDK app Client ID and Client Secret from Zoom Marketplace → your General app → Meeting SDK credentials (not the Server-to-Server OAuth app unless it is the same app)."
    );
    hints.push(
      "Save them under Settings → Integrations → Zoom → Meeting SDK, or set ZOOM_MEETING_SDK_KEY and ZOOM_MEETING_SDK_SECRET on the server."
    );
  }

  if (credsMismatch) {
    hints.push(
      "Your Server-to-Server OAuth Client ID and Meeting SDK Client ID differ. Host launch needs the ZAK from the OAuth app that created the meeting, while the JWT must be signed with the Meeting SDK app — use one General app with both features, or ensure both apps are on the same Zoom account."
    );
  }

  if (lower.includes("zak") || lower.includes("obf") || lower.includes("on behalf")) {
    hints.push(
      "Host join requires a valid ZAK for the Zoom host user (ZOOM_HOST_USER_ID). The Server-to-Server app needs the user:read:token or user:read:token:admin scope."
    );
    hints.push(
      "Since March 2026, meetings hosted outside your Meeting SDK app account also need an OBF token and an authorized participant already in the meeting. Use Open in Zoom app as a fallback."
    );
  }

  if (lower.includes("password") || lower.includes("passcode")) {
    hints.push("Verify the event passcode matches Zoom (refresh credentials on the event if needed).");
  }

  if (hints.length === 0) {
    hints.push(
      "Confirm Meeting SDK Client ID/Secret in Settings → Integrations → Zoom (Meeting SDK section)."
    );
    hints.push(
      "Ensure Server-to-Server OAuth (same or linked app) has user:read:token scope and ZOOM_HOST_USER_ID matches the webinar host."
    );
    hints.push('Use "Open in Zoom app" on the event page if browser host launch is blocked.');
  }

  return { message, hints };
}
