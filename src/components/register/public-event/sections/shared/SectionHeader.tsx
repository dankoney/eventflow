import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  theme: PublicEventThemeClasses;
  variant: PublicEventTemplateVariant;
  /** Eyebrow badge — inject from CMS, e.g. "Host Spotlight" */
  badge?: string | null;
  /** Main heading — inject from CMS; omit when null */
  title: string | null;
  /** Supporting copy — inject from CMS */
  description?: string | null;
  centered?: boolean;
  gradientTitle?: boolean;
  /** Template 1 uses plain headings without eyebrow pills. */
  showBadge?: boolean;
};

export function SectionHeader({
  theme,
  variant,
  badge,
  title,
  description,
  centered = true,
  gradientTitle = false,
  showBadge = true
}: SectionHeaderProps) {
  const isNight =
    variant === "night-edition" || variant === "technexus-dark" || variant === "technexus-light";
  const showEyebrow = showBadge && Boolean(badge?.trim()) && variant !== "professional-light";
  const showTitle = Boolean(title?.trim());
  return (
    <div className={cn(showTitle || description ? "mb-12 md:mb-16" : "mb-0", centered && "text-center")}>
      {showEyebrow ? <span className={cn(theme.badge, centered && "mb-6")}>{badge}</span> : null}
      {showTitle ? (
        <h2
          className={cn(
            gradientTitle && isNight ? theme.headingGradient : theme.heading,
            "text-3xl sm:text-4xl",
            centered && "mx-auto max-w-3xl"
          )}
        >
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className={cn(theme.body, "mt-4 max-w-2xl", centered && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
