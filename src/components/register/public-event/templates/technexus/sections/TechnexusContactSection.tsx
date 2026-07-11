"use client";

import { Mail, Phone, User } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import { PublicEventEnquiryForm } from "../../../PublicEventEnquiryForm";
import { contactWebsiteHref, hasAttendeeContact } from "../../../sections/summit/summitSectionUtils";
import type { PublicEventSiteSummary } from "../../../siteSummary";

import { TechnexusSectionTitle } from "./TechnexusSectionTitle";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  eventId: string;
  enquiryEmailConfigured: boolean;
  sectionBandClass: string;
};

export function TechnexusContactSection({
  summary,
  experience,
  eventId,
  enquiryEmailConfigured,
  sectionBandClass
}: Props) {
  const section = resolvePublicEventSectionHeader("contact", experience, { variant: "technexus" });
  const c = experience.contact;
  const hasContact = hasAttendeeContact(c);
  const image = c?.imageUrl?.trim() || null;

  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.contact}
      className={cn("tn-section relative scroll-mt-24", sectionBandClass)}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--pe-primary)]/5 to-transparent" />
      <div className="tn-section-inner relative z-10">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <TechnexusSectionTitle title={section.title} accentLastWord />
            {section.description ? (
              <p className="mb-10 max-w-lg text-lg text-[var(--pe-on-surface-variant)]">{section.description}</p>
            ) : null}

            {image ? (
              <div className="mb-8 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="aspect-video w-full object-cover" />
              </div>
            ) : null}

            {hasContact ? (
              <div className="space-y-8">
                {c?.contactName?.trim() ? (
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--pe-primary)]/10">
                      <User className="h-6 w-6 text-[var(--pe-primary)]" aria-hidden />
                    </div>
                    <div>
                      <h4 className="mb-1 text-lg font-semibold text-[var(--pe-on-surface)]">Primary contact</h4>
                      <p className="text-[var(--pe-on-surface-variant)]">{c.contactName}</p>
                    </div>
                  </div>
                ) : null}
                {c?.email?.trim() ? (
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--pe-primary)]/10">
                      <Mail className="h-6 w-6 text-[var(--pe-primary)]" aria-hidden />
                    </div>
                    <div>
                      <h4 className="mb-1 text-lg font-semibold text-[var(--pe-on-surface)]">Email</h4>
                      <a href={`mailto:${c.email.trim()}`} className="text-[var(--pe-on-surface-variant)] hover:text-[var(--pe-primary)]">
                        {c.email.trim()}
                      </a>
                    </div>
                  </div>
                ) : null}
                {c?.phone?.trim() ? (
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--pe-primary)]/10">
                      <Phone className="h-6 w-6 text-[var(--pe-primary)]" aria-hidden />
                    </div>
                    <div>
                      <h4 className="mb-1 text-lg font-semibold text-[var(--pe-on-surface)]">Phone</h4>
                      <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="text-[var(--pe-on-surface-variant)] hover:text-[var(--pe-primary)]">
                        {c.phone.trim()}
                      </a>
                    </div>
                  </div>
                ) : null}
                {c?.website?.trim() ? (
                  <p>
                    <a
                      href={contactWebsiteHref(c.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--pe-primary)] hover:underline"
                    >
                      {c.website.replace(/^https?:\/\//i, "")}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="tn-glass-card relative overflow-hidden rounded-2xl p-8 md:p-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--pe-primary)]/20 blur-3xl" />
            <h3 className="relative mb-6 text-2xl font-semibold text-[var(--pe-on-surface)]">Send a message</h3>
            <PublicEventEnquiryForm
              eventId={eventId}
              disabled={!enquiryEmailConfigured}
              disabledReason="The organizer has not published a contact email yet."
              variant="technexus"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
