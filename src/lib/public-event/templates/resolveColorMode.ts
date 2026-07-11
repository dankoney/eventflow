import { AttendeeTheme, PublicPageTemplate } from "@prisma/client";

export type SummitColorMode = "light" | "dark";

/**
 * Resolves light/dark for Template 1 (Summit). Template 2 (Night Edition) always uses its
 * built-in dark MD3 palette; this still drives registration form surfaces and SYSTEM preference.
 */
export function resolveSummitColorMode(theme: AttendeeTheme): SummitColorMode {
  if (theme === AttendeeTheme.DARK) return "dark";
  if (theme === AttendeeTheme.LIGHT) return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** Server-safe: no `window`; SYSTEM defaults to light unless you pass a hint. */
export function resolveSummitColorModeServer(
  theme: AttendeeTheme,
  prefersDark = false
): SummitColorMode {
  if (theme === AttendeeTheme.DARK) return "dark";
  if (theme === AttendeeTheme.LIGHT) return "light";
  return prefersDark ? "dark" : "light";
}

export function registrationFormUsesDark(
  template: PublicPageTemplate,
  theme: AttendeeTheme,
  colorMode: SummitColorMode
): boolean {
  if (template === PublicPageTemplate.NIGHT_EDITION) return true;
  if (template === PublicPageTemplate.TECH_NEXUS) return colorMode === "dark";
  return colorMode === "dark";
}

/** Server Components: resolve registration form dark styling without `window`. */
export function publicRegistrationFormDark(
  template: PublicPageTemplate,
  theme: AttendeeTheme,
  prefersDark = false
): boolean {
  return registrationFormUsesDark(
    template,
    theme,
    resolveSummitColorModeServer(theme, prefersDark)
  );
}
