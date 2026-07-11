"use client";

import { Building2 } from "lucide-react";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  footerExtra?: string | null;
};

export function NightEditionFooter({ summary, footerExtra }: Props) {
  const logo = summary.headerLogo?.trim();
  const year = new Date().getFullYear();

  return (
    <footer className="pe-footer relative border-t border-white/5 bg-[var(--pe-surface-container-lowest)]">
      <div className="pe-footer-accent" aria-hidden />
      <div className="px-5 py-12 md:px-16 md:py-14">
        <div className="mx-auto flex max-w-[var(--pe-container-max,1280px)] flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-center gap-3 md:items-start">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={summary.orgName}
                className="h-10 max-w-[200px] object-contain object-left md:h-12"
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Building2 className="h-4 w-4 text-[color:var(--pe-primary)]" aria-hidden />
                </span>
                <p className="text-base font-bold text-[var(--pe-on-surface)]">{summary.orgName}</p>
              </div>
            )}
            <p className="text-center text-xs text-[var(--pe-on-surface-variant)] md:text-left">
              © {year} {summary.name}
            </p>
            <p className="max-w-md text-center text-sm text-[var(--pe-on-surface-variant)] md:text-left">
              {summary.periodLabel}
              {summary.locationLine ? ` · ${summary.locationLine}` : ""}
            </p>
          </div>

          <div className="text-center md:text-right">
            <p className="text-sm text-[var(--pe-on-surface-variant)]">
              Hosted by {summary.orgName}.
              {footerExtra ? ` ${footerExtra}` : ""}
            </p>
            <p className="mt-2 text-xs text-[var(--pe-on-surface-variant)]/45">Powered by Eventflow</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
