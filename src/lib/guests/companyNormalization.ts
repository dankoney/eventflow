/**
 * Normalize company names for grouping / matching (case, punctuation, apostrophes).
 * Does not fix typos — only collapses formatting differences from registration.
 */
export function normalizeCompanyKey(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variantScore(label: string, count: number): number {
  const allCaps = label === label.toUpperCase() && /[A-Z]/.test(label);
  const hasLower = /[a-z]/.test(label);
  const titleish = hasLower && !allCaps;
  return count * 1000 + (titleish ? 100 : allCaps ? 10 : 50) + Math.min(label.length, 60);
}

/** Pick the best human-readable label from spelling variants of the same company. */
export function pickCompanyDisplayLabel(variants: string[]): string {
  const counts = new Map<string, number>();
  for (const v of variants) {
    const t = v.trim().replace(/\s+/g, " ");
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) return "";
  return [...counts.entries()].sort((a, b) => {
    const scoreDiff = variantScore(b[0], b[1]) - variantScore(a[0], a[1]);
    if (scoreDiff !== 0) return scoreDiff;
    return a[0].localeCompare(b[0]);
  })[0][0];
}

export type CompanyFilterOption = {
  /** Stable normalized key — stored in segment filters. */
  key: string;
  label: string;
  count: number;
};

export function collectCompanyFilterOptions(
  rows: Array<{ company: string | null }>
): CompanyFilterOption[] {
  const groups = new Map<string, { variants: string[]; count: number }>();

  for (const row of rows) {
    const raw = row.company?.trim();
    if (!raw) continue;
    const key = normalizeCompanyKey(raw);
    if (!key) continue;
    const group = groups.get(key) ?? { variants: [], count: 0 };
    group.variants.push(raw);
    group.count += 1;
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, { variants, count }]) => ({
      key,
      label: pickCompanyDisplayLabel(variants),
      count
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Trim and collapse whitespace when saving company from forms. */
export function normalizeCompanyForStorage(company: string | null | undefined): string | null {
  const trimmed = company?.trim().replace(/\s+/g, " ");
  return trimmed || null;
}
