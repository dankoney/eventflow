export function isPublicEventExperienceEnabled() {
  const raw =
    process.env.NEXT_PUBLIC_EVENT_PUBLIC_EXPERIENCE_V1 ??
    process.env.EVENT_PUBLIC_EXPERIENCE_V1 ??
    "";
  return raw === "1" || raw.toLowerCase() === "true";
}

