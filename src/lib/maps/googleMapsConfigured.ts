/** True when Places / Static map server calls can use org key or GOOGLE_MAPS_API_KEY. */
export function isGoogleMapsConfigured(organizationApiKey: string | null | undefined): boolean {
  const org = typeof organizationApiKey === "string" ? organizationApiKey.trim() : "";
  const env = (process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
  return org.length > 0 || env.length > 0;
}
