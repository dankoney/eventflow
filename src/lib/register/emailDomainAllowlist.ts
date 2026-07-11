/** `domains` are hostnames without @, e.g. ["acme.com"]. */
export function emailMatchesAllowedDomains(email: string, domains: string[]): boolean {
  const norm = email.trim().toLowerCase();
  const at = norm.lastIndexOf("@");
  if (at < 1) return false;
  const host = norm.slice(at + 1);
  const list = domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

export function parseDomainListJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((d) => d.trim().toLowerCase());
}
