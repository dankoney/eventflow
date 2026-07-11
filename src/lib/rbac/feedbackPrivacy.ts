/**
 * Scrub free-text feedback responses before showing to sales reps.
 * Masks emails, phone numbers, and replaces unassigned guest names with "Respondent".
 */

const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;

function maskPhonesInText(text: string): string {
  return text.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 8) return match;
    return `+${digits.slice(0, 3)} ** *** ${digits.slice(-4)}`;
  });
}

export function scrubFeedbackText(
  text: string | null | undefined,
  options?: {
    /** Guest names the viewer is not allowed to identify — replaced with "Respondent". */
    redactNames?: string[];
  }
): string | null {
  if (!text?.trim()) return null;
  let out = text.trim();

  out = out.replace(EMAIL_RE, (email) => {
    const at = email.indexOf("@");
    if (at <= 0) return "***@***";
    return `${email[0]}***@${email.slice(at + 1)}`;
  });

  out = maskPhonesInText(out);

  for (const name of options?.redactNames ?? []) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "Respondent");
  }

  return out;
}

export function scrubFeedbackResponseForSalesRep(input: {
  comment: string | null;
  guestName: string | null;
  guestRepId: string | null;
  viewerUserId: string;
  answers?: Record<string, unknown> | null;
}): {
  comment: string | null;
  answers: Record<string, unknown> | null;
} {
  const redactNames: string[] = [];
  if (input.guestName && input.guestRepId !== input.viewerUserId) {
    redactNames.push(input.guestName);
  }

  const comment = scrubFeedbackText(input.comment, { redactNames });

  let answers: Record<string, unknown> | null = null;
  if (input.answers && typeof input.answers === "object") {
    answers = {};
    for (const [key, value] of Object.entries(input.answers)) {
      if (typeof value === "string") {
        answers[key] = scrubFeedbackText(value, { redactNames }) ?? "";
      } else {
        answers[key] = value;
      }
    }
  }

  return { comment, answers };
}
