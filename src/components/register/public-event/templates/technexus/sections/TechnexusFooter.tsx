"use client";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  footerExtra?: string | null;
  footerBandClass: string;
  themeCustomization?: PublicEventExperiencePayload["themeCustomization"];
};

export function TechnexusFooter({ summary, footerExtra, footerBandClass, themeCustomization }: Props) {
  const logo = summary.headerLogo?.trim();
  const year = new Date().getFullYear();
  const variant = themeCustomization?.footerVariant ?? "default";
  const customText = themeCustomization?.footerCustomText?.trim();
  const showPoweredBy = themeCustomization?.footerShowPoweredBy !== false;

  const defaultCopy = `Hosted by ${summary.orgName}.${footerExtra ? ` ${footerExtra}` : ""}${showPoweredBy ? " Powered by Eventflow." : ""}`;
  const footerCopy = customText || defaultCopy;

  return (
    <footer
      className={cn(
        footerBandClass,
        "tn-footer-hero border-t border-[var(--pe-footer-border)] py-12",
        variant === "brand_bar" && "tn-footer--brand-bar",
        variant === "minimal" && "tn-footer--minimal py-8",
        variant === "centered" && "tn-footer--centered"
      )}
    >
      <div
        className={cn(
          "tn-section-inner gap-6",
          variant === "centered"
            ? "flex flex-col items-center text-center"
            : "flex flex-col items-center justify-between md:flex-row"
        )}
      >
        <div className={cn("flex flex-col gap-3", variant === "centered" ? "items-center" : "md:items-start")}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={summary.orgName} className="h-10 max-w-[200px] object-contain" />
          ) : (
            <div className="font-semibold text-[var(--pe-on-surface)]">{summary.orgName}</div>
          )}
          <p className="text-xs text-[var(--pe-on-surface-variant)]">
            © {year} {summary.name}
          </p>
        </div>
        <p
          className={cn(
            "max-w-md text-sm text-[var(--pe-on-surface-variant)]",
            variant === "centered" ? "text-center" : "text-center md:text-right"
          )}
        >
          {footerCopy}
        </p>
      </div>
    </footer>
  );
}
