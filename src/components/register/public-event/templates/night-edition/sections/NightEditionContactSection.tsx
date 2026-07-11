"use client";

import type { ReactNode } from "react";

import { ExternalLink, Globe, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { PublicEventEnquiryForm } from "../../../PublicEventEnquiryForm";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { contactWebsiteHref } from "@/components/register/public-event/sections/shared/utils";
import { cn } from "@/lib/utils";

import { SectionHeader } from "../../../sections/shared/SectionHeader";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  eventId: string;
};

type ChannelCardProps = {
  icon: ReactNode;
  label: string;
  children: React.ReactNode;
};

function ChannelCard({ icon, label, children }: ChannelCardProps) {
  return (
    <div className="pe-contact-card pe-panel-surface group flex h-full flex-col rounded-2xl p-5 transition hover:border-[color-mix(in_srgb,var(--pe-primary)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--pe-surface-container)_85%,transparent)]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--pe-primary)]/12 text-[color:var(--pe-primary)] transition group-hover:bg-[color:var(--pe-primary)]/18">
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--pe-on-surface-variant)]">{label}</p>
      <div className="mt-2 text-sm font-medium leading-relaxed text-[var(--pe-on-surface)]">{children}</div>
    </div>
  );
}

/** `#contact` — channels bento + enquiry form */
export function NightEditionContactSection({ summary, experience, theme, eventId }: Props) {
  const c = experience.contact;
  const section = resolvePublicEventSectionHeader("contact", experience, { variant: "night-edition" });
  const mapsHref =
    summary.location.latitude != null && summary.location.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${summary.location.latitude},${summary.location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.location.address)}`;
  const websiteLabel = c?.website?.trim().replace(/^https?:\/\//i, "") ?? "";
  const hasChannels = Boolean(
    c?.email?.trim() || c?.phone?.trim() || c?.website?.trim() || summary.locationLine?.trim()
  );

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.contact}
      className="pe-section-contact relative scroll-mt-24 overflow-hidden px-5 py-20 md:px-16 md:py-24"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--pe-primary)]/40 to-transparent" />

      <div className="relative z-10 mx-auto max-w-[var(--pe-container-max,1280px)]">
        <SectionHeader
          theme={theme}
          variant="night-edition"
          badge={section.badge ?? "Get in touch"}
          title={c?.heading?.trim() || section.title}
          description={section.description ?? "Questions about registration, travel, or accessibility? Reach the team directly."}
          gradientTitle={false}
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-12 lg:gap-8">
          {hasChannels ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 xl:grid-cols-2">
              {c?.email?.trim() ? (
                <ChannelCard icon={<Mail className="h-5 w-5" />} label="Email">
                  <a href={`mailto:${c.email.trim()}`} className="break-all transition hover:text-[color:var(--pe-primary)]">
                    {c.email.trim()}
                  </a>
                </ChannelCard>
              ) : null}
              {c?.phone?.trim() ? (
                <ChannelCard icon={<Phone className="h-5 w-5" />} label="Phone">
                  <a href={`tel:${c.phone.trim().replace(/\s/g, "")}`} className="transition hover:text-[color:var(--pe-primary)]">
                    {c.phone.trim()}
                  </a>
                </ChannelCard>
              ) : null}
              {c?.website?.trim() ? (
                <ChannelCard icon={<Globe className="h-5 w-5" />} label="Website">
                  <a
                    href={contactWebsiteHref(c.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 break-all transition hover:text-[color:var(--pe-primary)]"
                  >
                    {websiteLabel}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  </a>
                </ChannelCard>
              ) : null}
              {summary.locationLine?.trim() ? (
                <ChannelCard icon={<MapPin className="h-5 w-5" />} label="Venue">
                  <p>{summary.locationLine}</p>
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--pe-primary)] hover:underline"
                  >
                    Directions
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </ChannelCard>
              ) : null}
            </div>
          ) : null}

          <div className={cn("pe-contact-form-panel pe-panel-surface", hasChannels ? "lg:col-span-7" : "lg:col-span-12")}>
            <div className="flex items-start gap-3 border-b border-[var(--pe-outline-variant)]/20 pb-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pe-primary)]/12 text-[color:var(--pe-primary)]">
                <MessageSquare className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--pe-on-surface)]">Send a message</h3>
                {c?.contactName?.trim() ? (
                  <p className="mt-1 text-sm text-[var(--pe-on-surface-variant)]">
                    Contact person: <span className="font-medium text-[var(--pe-on-surface)]">{c.contactName.trim()}</span>
                  </p>
                ) : null}
              </div>
            </div>
            {c?.note?.trim() ? (
              <p className="mt-4 rounded-lg pe-panel-surface-inner px-4 py-3 text-sm leading-relaxed text-[var(--pe-on-surface-variant)]">
                {c.note.trim()}
              </p>
            ) : null}
            <div className="mt-6">
              <PublicEventEnquiryForm
                eventId={eventId}
                disabled={!c?.email?.trim()}
                disabledReason="The organizer has not published a contact email yet."
                variant="night-edition"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
