"use client";

import { Globe, Mail, Phone, User } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolvePublicEventSectionHeader } from "@/lib/public-event/sectionHeaders";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import type { PublicEventThemeClasses } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import { PublicEventEnquiryForm } from "../../PublicEventEnquiryForm";
import type { PublicEventSiteSummary } from "../../siteSummary";
import { SectionHeader } from "../shared/SectionHeader";
import { SectionShell } from "../shared/SectionShell";
import { contactWebsiteHref, hasAttendeeContact } from "./summitSectionUtils";

type Props = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  theme: PublicEventThemeClasses;
  enquiryEmailConfigured: boolean;
};

/** Template 1 light — contact + enquiry form */
export function SummitContactSection({ summary, experience, theme, enquiryEmailConfigured }: Props) {
  const hasContact = hasAttendeeContact(experience.contact);
  const section = resolvePublicEventSectionHeader("contact", experience, { variant: "summit" });
  const contactImage = experience.contact?.imageUrl?.trim() || null;
  const subheading = experience.contact?.heading?.trim() || null;

  return (
    <SectionShell id={PUBLIC_EVENT_SECTION_IDS.contact} theme={theme} variant="default">
      <SectionHeader
        theme={theme}
        variant="professional-light"
        badge={section.badge}
        title={section.title}
        description={section.description}
        centered={false}
      />

      <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
        <div className={cn("space-y-8", contactImage ? "lg:col-span-7" : "lg:col-span-6")}>
          {subheading && subheading !== section.title ? (
            <p className="font-register-display text-lg font-semibold text-zinc-900">{subheading}</p>
          ) : null}

          {hasContact ? (
            <div className="space-y-5">
              <div className="grid gap-x-6 gap-y-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/80 sm:grid-cols-2">
                {experience.contact?.contactName?.trim() ? (
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Primary contact
                      </p>
                      <p className="text-sm font-medium text-zinc-900">{experience.contact.contactName}</p>
                    </div>
                  </div>
                ) : null}
                {experience.contact?.email?.trim() ? (
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Email</p>
                      <a
                        href={`mailto:${experience.contact.email.trim()}`}
                        className="block truncate text-sm font-medium text-accent hover:underline"
                      >
                        {experience.contact.email.trim()}
                      </a>
                    </div>
                  </div>
                ) : null}
                {experience.contact?.phone?.trim() ? (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Phone</p>
                      <a
                        href={`tel:${experience.contact.phone.replace(/\s+/g, "")}`}
                        className="block truncate text-sm font-medium text-accent hover:underline"
                      >
                        {experience.contact.phone.trim()}
                      </a>
                    </div>
                  </div>
                ) : null}
                {experience.contact?.website?.trim() ? (
                  <div className="flex items-start gap-3">
                    <Globe className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Website</p>
                      <a
                        href={contactWebsiteHref(experience.contact.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium text-accent hover:underline"
                      >
                        {experience.contact.website.replace(/^https?:\/\//i, "")}
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              {experience.contact?.note?.trim() ? (
                <p className="text-sm leading-relaxed text-on-surface-variant">{experience.contact.note}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {contactImage ? (
          <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-200/80 lg:col-span-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contactImage} alt="" className="aspect-[4/3] w-full object-cover lg:aspect-auto lg:min-h-[280px]" />
          </div>
        ) : null}

        <div className={cn("rounded-2xl bg-white p-8 ring-1 ring-zinc-200/80", contactImage ? "lg:col-span-12" : "lg:col-span-6")}>
          <h3 className="font-register-display text-xl font-semibold text-zinc-900">Send an enquiry</h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            We route messages to the organizer email on file when it is configured.
          </p>
          <div className="mt-6">
            <PublicEventEnquiryForm
              eventId={summary.eventId}
              disabled={!enquiryEmailConfigured}
              disabledReason="The organizer has not published a contact email yet, so enquiries cannot be routed from this page."
            />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
