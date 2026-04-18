/** Mask email for display (e.g. j***@example.com). */
export function maskEmail(email: string): string {
  const t = email.trim().toLowerCase();
  const at = t.indexOf("@");
  if (at <= 0) return "***";
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  if (!domain) return "***";
  const show = local.slice(0, 1);
  return `${show}***@${domain}`;
}

/** Mask phone for display. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length <= 4) return "••••";
  return `••••${d.slice(-4)}`;
}
