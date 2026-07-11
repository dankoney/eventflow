"use client";

import { Download, FileText, Globe, Mail, Phone, User } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { cn } from "@/lib/utils";

import { PublicEventEnquiryForm } from "../../PublicEventEnquiryForm";
import { contactWebsiteHref, hasAttendeeContact, resourceHref, resourceIcon } from "./summitSectionUtils";

type Props = {
  summary: { eventId: string };
  experience: PublicEventExperiencePayload;
  showResourcesSection: boolean;
  showContactSection: boolean;
  hasProgram: boolean;
  onDownloadAgendaPdf: () => void;
  enquiryEmailConfigured: boolean;
};

/** Template 1 dark — combined resources + contact row */
export function SummitResourcesContactSection({
  summary,
  experience,
  showResourcesSection,
  showContactSection,
  hasProgram,
  onDownloadAgendaPdf,
  enquiryEmailConfigured
}: Props) {
  const hasContact = hasAttendeeContact(experience.contact);

  if (!showResourcesSection && !showContactSection) return null;

  return (
    <section
      id={showResourcesSection ? PUBLIC_EVENT_SECTION_IDS.resources : PUBLIC_EVENT_SECTION_IDS.contact}
      className="mb-20 rounded-xl border-t border-white/10 bg-zinc-900/30 px-6 py-12 sm:px-10 lg:mb-24 lg:px-12 lg:py-16"
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {showResourcesSection ? (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">Attendee resources</h2>
              <p className="mt-3 text-sm text-zinc-400">
                Download session materials, the official summit guide, and reference papers.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {hasProgram ? (
                <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-zinc-950/40 p-5 transition hover:border-[color:var(--accent)]/40">
                  <FileText className="h-9 w-9 text-[color:var(--accent)]" aria-hidden />
                  <div>
                    <h4 className="text-base font-semibold text-zinc-50">Detailed PDF schedule</h4>
                    <p className="mb-3 mt-0.5 text-xs text-zinc-400">PDF</p>
                    <button
                      type="button"
                      onClick={onDownloadAgendaPdf}
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[color:var(--accent)] transition hover:underline"
                    >
                      Download
                      <Download className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
              {experience.resources.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-zinc-950/40 p-5 transition hover:border-[color:var(--accent)]/40"
                >
                  {resourceIcon(r.kind, "summit-dark")}
                  <div>
                    <h4 className="text-base font-semibold text-zinc-50">{r.title}</h4>
                    <p className="mb-3 mt-0.5 text-xs text-zinc-400">
                      {r.kind}
                      {r.meta ? ` · ${r.meta}` : ""}
                    </p>
                    <a
                      href={resourceHref(r)}
                      target={/^https?:\/\//i.test(resourceHref(r)) ? "_blank" : undefined}
                      rel={/^https?:\/\//i.test(resourceHref(r)) ? "noopener noreferrer" : undefined}
                      download={r.fileUrl ? true : undefined}
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[color:var(--accent)] transition hover:underline"
                    >
                      Download
                      <Download className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showContactSection ? (
          <div
            id={showResourcesSection ? PUBLIC_EVENT_SECTION_IDS.contact : undefined}
            className={cn(
              "rounded-xl border border-white/10 bg-zinc-900/60 p-8 shadow-sm",
              showResourcesSection && "scroll-mt-24"
            )}
          >
            <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">Get in touch</h2>
            <p className="mt-3 text-sm text-zinc-400">
              Have questions about registration, accessibility, or travel? Reach the organizing team using the details
              here, or send a message with the form.
            </p>

            {hasContact ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
                <div className="grid gap-x-6 gap-y-4 rounded-xl border border-white/10 bg-zinc-950/40 p-4 sm:grid-cols-2">
                  {experience.contact?.contactName?.trim() ? (
                    <div className="flex items-start gap-3">
                      <User className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Primary contact</p>
                        <p className="text-sm font-medium text-zinc-100">{experience.contact.contactName}</p>
                      </div>
                    </div>
                  ) : null}
                  {experience.contact?.email?.trim() ? (
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email</p>
                        <a
                          href={`mailto:${experience.contact.email.trim()}`}
                          className="block truncate text-sm font-medium text-[color:var(--accent)] hover:underline"
                        >
                          {experience.contact.email.trim()}
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {experience.contact?.phone?.trim() ? (
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Phone</p>
                        <a
                          href={`tel:${experience.contact.phone.replace(/\s+/g, "")}`}
                          className="block truncate text-sm font-medium text-[color:var(--accent)] hover:underline"
                        >
                          {experience.contact.phone.trim()}
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {experience.contact?.website?.trim() ? (
                    <div className="flex items-start gap-3">
                      <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Website</p>
                        <a
                          href={contactWebsiteHref(experience.contact.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm font-medium text-[color:var(--accent)] hover:underline"
                        >
                          {experience.contact.website.replace(/^https?:\/\//i, "")}
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>

                {experience.contact?.note?.trim() ? (
                  <p className="text-sm leading-relaxed text-zinc-400">{experience.contact.note}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 border-t border-white/10 pt-6">
              <h3 className="text-base font-semibold text-zinc-50">Send an enquiry</h3>
              <p className="mt-1 text-xs text-zinc-400">
                We route messages to the organizer email on file when configured.
              </p>
              <div className="mt-5">
                <PublicEventEnquiryForm
                  eventId={summary.eventId}
                  disabled={!enquiryEmailConfigured}
                  disabledReason="The organizer has not published a contact email yet, so enquiries cannot be routed from this page."
                  dark
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
