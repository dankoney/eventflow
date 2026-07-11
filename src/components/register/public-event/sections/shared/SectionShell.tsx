import type { ReactNode } from "react";

import type { PublicEventSectionId } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

type SectionShellProps = {
  /** Canonical section id — must match section registry in `sectionIds.ts`. */
  id: PublicEventSectionId;
  theme: PublicEventThemeClasses;
  variant?: "default" | "alt" | "bordered";
  className?: string;
  children: ReactNode;
};

/**
 * Standalone page section wrapper. Backend/CMS maps content blocks to these ids.
 */
export function SectionShell({
  id,
  theme,
  variant = "default",
  className,
  children
}: SectionShellProps) {
  const isTechnexus = theme.section.includes("tn-section");

  return (
    <section
      id={id}
      className={cn(
        theme.section,
        !isTechnexus && (variant === "alt" || variant === "bordered") && theme.sectionAlt,
        className
      )}
    >
      <div className={cn(isTechnexus ? "tn-section-inner w-full" : "pe-container w-full")}>
        {children}
      </div>
    </section>
  );
}
