"use client";

import { ArrowRight, Play } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";

type Props = {
  experience: PublicEventExperiencePayload;
};

/** `#news` — CMS: experience.newsItems[] */
export function NightEditionNewsSection({ experience }: Props) {
  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.news}
      className="scroll-mt-24 bg-[var(--pe-background)] px-5 py-24 md:px-16"
    >
      <div className="mx-auto max-w-[var(--pe-container-max,1280px)]">
        <div className="mb-16 flex flex-col items-center text-center">
          <span className="mb-6 rounded-full border border-[color:var(--pe-secondary)]/30 bg-[color:var(--pe-secondary)]/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[color:var(--pe-secondary)]">
            Updates
          </span>
          <h2 className="mb-6 pe-text-gradient text-3xl font-extrabold md:text-5xl">Summit news &amp; insights</h2>
          <p className="max-w-2xl text-lg text-[var(--pe-on-surface-variant)]">
            Stay updated with announcements, press releases, and featured stories.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {experience.newsItems.map((item) => (
            <article
              key={item.id}
              className="group flex h-full flex-col overflow-hidden rounded-xl pe-glass-panel transition-all duration-300 hover:border-[color:var(--pe-primary)]/40"
            >
              <div className="aspect-video w-full overflow-hidden">
                {item.mediaType === "video" && item.videoEmbedUrl ? (
                  <iframe title={item.title} src={item.videoEmbedUrl} className="h-full w-full border-0" allowFullScreen />
                ) : item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[var(--pe-surface-container)]">
                    <Play className="h-12 w-12 text-[color:var(--pe-primary)]" />
                  </div>
                )}
              </div>
              <div className="flex flex-grow flex-col p-8">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[color:var(--pe-primary)]">
                  {item.dateLabel}
                </p>
                <h3 className="mb-6 text-lg font-bold text-[var(--pe-on-surface)] transition-colors group-hover:text-[color:var(--pe-primary)]">
                  {item.title}
                </h3>
                {item.excerpt ? (
                  <p className="mb-4 flex-grow text-sm text-[var(--pe-on-surface-variant)]">{item.excerpt}</p>
                ) : null}
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[var(--pe-on-surface-variant)] hover:text-[color:var(--pe-primary)]"
                  >
                    Read full article
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
