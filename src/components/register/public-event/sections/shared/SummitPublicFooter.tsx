import { Building2, Globe, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { contactWebsiteHref } from "../summit/summitSectionUtils";
import type { PublicEventSiteSummary } from "../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  footerExtra?: string | null;
  showContactSection: boolean;
  variant?: "professional-light" | "summit-dark";
};

export function SummitPublicFooter({
  summary,
  experience,
  footerExtra,
  showContactSection,
  variant = "professional-light"
}: Props) {
  const dark = variant === "summit-dark";
  const logo = summary.headerLogo?.trim();
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t py-10 md:py-12",
        dark ? "border-white/10 bg-zinc-950" : "border-outline-variant/30 bg-zinc-200/40"
      )}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-center gap-3 md:items-start">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={summary.orgName}
                className="h-10 max-w-[200px] object-contain object-left md:h-12"
              />
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2 text-lg font-bold tracking-tight",
                  dark ? "text-zinc-100" : "text-zinc-900"
                )}
              >
                <Building2 className="h-6 w-6 text-accent" aria-hidden />
                {summary.orgName}
              </div>
            )}
            <p className={cn("text-center text-xs md:text-left", dark ? "text-zinc-500" : "text-on-surface-variant")}>
              © {year} {summary.name}
            </p>
          </div>

          <p
            className={cn(
              "max-w-md text-center text-sm leading-relaxed md:text-right",
              dark ? "text-zinc-400" : "text-on-surface-variant"
            )}
          >
            Hosted by {summary.orgName}.
            {footerExtra ? ` ${footerExtra}` : ""} Powered by Eventflow.
          </p>

          <div className={cn("flex justify-center gap-4 md:justify-end", dark ? "text-zinc-500" : "text-on-surface-variant")}>
            {experience.contact?.website?.trim() ? (
              <a
                href={contactWebsiteHref(experience.contact.website)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("transition", dark ? "hover:text-zinc-200" : "hover:text-zinc-900")}
                aria-label="Website"
              >
                <Globe className="h-5 w-5" />
              </a>
            ) : null}
            {showContactSection ? (
              <a
                href="#contact"
                className={cn("transition", dark ? "hover:text-zinc-200" : "hover:text-zinc-900")}
                aria-label="Contact"
              >
                <HelpCircle className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
