"use client";

import { Check, Eye, EyeOff, Plus, Save, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  savePublicEventExperience,
  uploadPublicEventAsset
} from "@/lib/actions/publicEventExperience.actions";
import type {
  PublicEventExperiencePayload,
  PublicEventSectionKey
} from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

import { AgendaItemRowEditor } from "./public-event-editor/AgendaItemRowEditor";
import {
  PublicEventHeroOverviewFields,
  PublicEventSpeakersDisplayFields
} from "./public-event-editor/PublicEventHeroOverviewFields";
import { ImageUrlField } from "./public-event-editor/ImageUrlField";
import { PublicEventSectionHeaderFields } from "./public-event-editor/PublicEventSectionHeaderFields";
import { PublicEventMarketingContentEditor } from "./PublicEventMarketingContentEditor";

type Props = {
  eventId: string;
  readOnly: boolean;
  initial: PublicEventExperiencePayload;
  programDays: Array<{ dayIndex: number; startsAt: string }>;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const STEPS = [
  "Overview",
  "Program",
  "Venue ops",
  "Speakers",
  "Spotlight",
  "Partners",
  "News",
  "Gallery",
  "Pricing",
  "Resources",
  "FAQ",
  "Contact"
] as const;

const MARKETING_STEP_BY_INDEX: Record<number, "spotlight" | "partners" | "news" | "gallery" | "pricing"> = {
  4: "spotlight",
  5: "partners",
  6: "news",
  7: "gallery",
  8: "pricing"
};

/**
 * Section visibility toggles surfaced at the top of the editor. The order
 * mirrors the public page's navigation. Each entry maps a toggle to the
 * matching nav link + body section in {@link PublicEventSummitExperience} and
 * its dark twin. `election` only takes effect when the event has a poll
 * configured; we still surface it so organizers can pre-hide it.
 */
const VISIBILITY_SECTIONS: ReadonlyArray<{
  key: PublicEventSectionKey;
  label: string;
  hint: string;
}> = [
  { key: "overview", label: "Overview", hint: "About this program, registration note, sidebar image, and add to calendar." },
  { key: "spotlight", label: "Spotlight", hint: "Host city/country hero, stats, and culture carousel." },
  { key: "countdown", label: "Countdown", hint: "Full-width countdown band with event dates." },
  { key: "program", label: "Program", hint: "Agenda timeline (single day or per day)." },
  { key: "venueOps", label: "Venue ops", hint: "Parking, accessibility, Wi‑Fi, and maps for on-site attendees." },
  { key: "speakers", label: "Speakers", hint: "Program faculty / speaker grid with social links." },
  { key: "partners", label: "Partners", hint: "Partner logo strip." },
  { key: "news", label: "News & media", hint: "Carousel of articles, press, and YouTube videos." },
  { key: "gallery", label: "Gallery", hint: "Photo mosaic gallery with lightbox." },
  { key: "resources", label: "Resources", hint: "Downloadable resources and generated agenda PDF." },
  { key: "pricing", label: "Pricing", hint: "Registration tiers and pass comparison." },
  { key: "election", label: "Election", hint: "Live ballot section (only renders when a poll exists)." },
  { key: "faq", label: "FAQ", hint: "Accordion Q&A — appears in navigation when items are added." },
  { key: "contact", label: "Contact", hint: "Organizer contact details and enquiry form." }
];

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });
}

export function PublicEventExperienceEditor({ eventId, readOnly, initial, programDays }: Props) {
  const [payload, setPayload] = useState<PublicEventExperiencePayload>(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; text: string } | null>(null);
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [activeDay, setActiveDay] = useState<number>(programDays[0]?.dayIndex ?? 1);
  const sectionComplete = {
    program:
      payload.programMode === "PER_DAY"
        ? payload.agendaByDay.some((d) => d.items.length > 0)
        : payload.agenda.length > 0,
    venue: Boolean(
      payload.venue?.wifiSsid?.trim() ||
        payload.venue?.wifiPassword?.trim() ||
        payload.venue?.wifiNote?.trim() ||
        payload.venue?.parkingInfo?.trim() ||
        payload.venue?.accessInfo?.trim()
    ),
    speakers: payload.speakers.length > 0,
    resources: payload.resources.length > 0,
    contact: Boolean(
      (payload.contact?.heading?.trim() ?? "") ||
        (payload.contact?.contactName?.trim() ?? "") ||
        (payload.contact?.email?.trim() ?? "") ||
        (payload.contact?.phone?.trim() ?? "") ||
        (payload.contact?.website?.trim() ?? "") ||
        (payload.contact?.note?.trim() ?? "")
    ),
    faq: payload.faqItems.length > 0
  };

  async function onSave() {
    if (readOnly) return;
    setBusy(true);
    setNotice(null);
    const res = await savePublicEventExperience(eventId, payload);
    setBusy(false);
    if (!res.success) {
      setNotice({ variant: "error", text: res.error ?? "Could not save public page content." });
      return;
    }
    setNotice({ variant: "success", text: "Public page content saved." });
  }

  async function uploadFile(
    kind: "speaker_image" | "resource_file" | "page_image",
    file: File,
    busyKey?: string
  ) {
    const key = busyKey ?? `${kind}:${file.name}`;
    setUploadBusy(key);
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await uploadPublicEventAsset(fd);
    setUploadBusy(null);
    if (!res.success || !res.data) {
      setNotice({ variant: "error", text: res.error ?? "Upload failed." });
      return null;
    }
    setNotice({ variant: "success", text: "Asset uploaded." });
    return res.data.url;
  }

  async function uploadPageImageForField(fieldId: string, file: File) {
    return uploadFile("page_image", file, `page_image:${fieldId}`);
  }

  function perDayRows(dayIndex: number) {
    return payload.agendaByDay.find((d) => d.dayIndex === dayIndex)?.items ?? [];
  }

  function setPerDayRows(dayIndex: number, items: PublicEventExperiencePayload["agenda"]) {
    setPayload((p) => {
      const existing = p.agendaByDay.find((d) => d.dayIndex === dayIndex);
      if (existing) {
        return {
          ...p,
          agendaByDay: p.agendaByDay.map((d) => (d.dayIndex === dayIndex ? { ...d, items } : d))
        };
      }
      return { ...p, agendaByDay: [...p.agendaByDay, { dayIndex, items }] };
    });
  }

  function renderAgendaRows(rows: PublicEventExperiencePayload["agenda"], setRows: (rows: PublicEventExperiencePayload["agenda"]) => void) {
    return (
      <AgendaItemRowEditor
        rows={rows}
        setRows={setRows}
        speakers={payload.speakers}
        readOnly={readOnly}
        uid={uid}
      />
    );
  }

  function setSectionVisibility(key: PublicEventSectionKey, visible: boolean) {
    setPayload((p) => ({
      ...p,
      sectionVisibility: { ...p.sectionVisibility, [key]: visible }
    }));
  }

  const hiddenCount = VISIBILITY_SECTIONS.filter((s) => !payload.sectionVisibility[s.key]).length;

  return (
    <section className="space-y-6">
      {notice ? (
        <WorkspaceNotice variant={notice.variant} onDismiss={() => setNotice(null)}>
          {notice.text}
        </WorkspaceNotice>
      ) : null}

      <div className="rounded-2xl border-2 border-zinc-900 bg-white p-4 shadow-[6px_6px_0_0_rgb(24_24_27)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Visible sections
            </p>
            <h2 className="mt-1 text-base font-bold tracking-tight text-zinc-900">
              Choose what appears on the public page
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Hide a section without clearing its fields. Toggles apply to both the top navigation
              and the matching body section on the public page.
            </p>
          </div>
          {hiddenCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              <EyeOff className="h-3.5 w-3.5" aria-hidden /> {hiddenCount} hidden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              <Eye className="h-3.5 w-3.5" aria-hidden /> All visible
            </span>
          )}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {VISIBILITY_SECTIONS.map((s) => {
            const isVisible = payload.sectionVisibility[s.key];
            return (
              <li key={s.key}>
                <label
                  className={cn(
                    "flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                    readOnly && "cursor-not-allowed opacity-60",
                    isVisible
                      ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
                      : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                    checked={isVisible}
                    disabled={readOnly}
                    onChange={(e) => setSectionVisibility(s.key, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-semibold",
                        isVisible ? "text-emerald-900" : "text-zinc-700"
                      )}
                    >
                      {s.label}
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          isVisible ? "bg-emerald-200/70 text-emerald-900" : "bg-zinc-200 text-zinc-600"
                        )}
                      >
                        {isVisible ? "Visible" : "Hidden"}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-zinc-600">{s.hint}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Note: hidden sections still keep their content — toggle a section back on at any time.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-zinc-900 bg-zinc-50 shadow-[6px_6px_0_0_rgb(24_24_27)]">
        <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Public experience wizard</p>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Public experience wizard steps">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  step === i
                    ? "bg-zinc-900 text-white ring-2 ring-zinc-400/90"
                    : i < step
                      ? "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-300/90"
                      : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-100 hover:text-zinc-800"
                )}
              >
                {i + 1}. {s}
              </button>
            ))}
          </div>
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">{STEPS[step]}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {step === 0
                ? "Intro copy, optional hero image, registration note, and add-to-calendar links for the overview block."
                : step === 1
                  ? "Build the public program timeline. For multi-day events you can set one agenda for all days or define a separate agenda per day."
                  : step === 2
                    ? "Publish venue operations details (Wi-Fi, parking, access and arrival notes)."
                    : step === 3
                      ? "Publish speaker profiles with title, company, bio, and optional headshot."
                      : step === 4
                        ? "Host spotlight: background media, stats, and culture carousel."
                        : step === 5
                          ? "Partner logos shown in a simple logo strip."
                          : step === 6
                            ? "News and media carousel with date picker and YouTube embeds."
                            : step === 7
                              ? "Photo mosaic gallery with lightbox (renders at the bottom of the public page)."
                              : step === 8
                                ? "Registration pricing tiers — one feature per line."
                                : step === 9
                                  ? "Attach attendee-facing resources via upload or external links."
                                  : step === 10
                                    ? "Frequently asked questions with optional section image."
                                    : "How attendees can reach the organizer: name, email, phone, and website."}
            </p>
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Sections</p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Public page sections">
                {(
                  [
                    { label: "Overview", stepIndex: 0, done: true },
                    { label: "Program", stepIndex: 1, done: sectionComplete.program },
                    { label: "Venue", stepIndex: 2, done: sectionComplete.venue },
                    { label: "Speakers", stepIndex: 3, done: sectionComplete.speakers },
                    { label: "Resources", stepIndex: 9, done: sectionComplete.resources },
                    { label: "Contact", stepIndex: 11, done: sectionComplete.contact }
                  ] as const
                ).map((x) => {
                  const isCurrent = step === x.stepIndex;
                  return (
                    <li key={x.label}>
                      <button
                        type="button"
                        onClick={() => setStep(x.stepIndex)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          x.done
                            ? "border-emerald-200/90 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/90"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
                          isCurrent && "ring-2 ring-zinc-900 ring-offset-2 ring-offset-white"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                            x.done ? "bg-emerald-600 text-white" : "border border-zinc-300 bg-zinc-100 text-zinc-400"
                          )}
                          aria-hidden
                        >
                          {x.done ? <Check className="h-3 w-3 stroke-[3]" /> : x.stepIndex + 1}
                        </span>
                        {x.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        <div className="space-y-5 bg-white px-4 py-5 sm:px-6 sm:py-6">
      {step === 0 ? (
      <div className="space-y-5">
      <PublicEventHeroOverviewFields
        payload={payload}
        readOnly={readOnly}
        onChange={setPayload}
        uploadBusy={uploadBusy}
        fieldClass={fieldClass}
        onUploadCarouselImage={async (file) => {
          setUploadBusy(`carousel:pending`);
          const url = await uploadFile("page_image", file);
          setUploadBusy(null);
          return url;
        }}
        onUploadFlagImage={async (file) => {
          setUploadBusy(`flag:pending`);
          const url = await uploadFile("page_image", file);
          setUploadBusy(null);
          return url;
        }}
      />
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <PublicEventSectionHeaderFields
          sectionKey="overview"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
          className="mb-4"
        />
        <h3 className="text-base font-bold tracking-tight text-zinc-900">Overview content</h3>
        <p className="mt-1 text-sm text-zinc-600">
          The main program description comes from your event record. Upload an optional wide image and customize the
          section heading below — clear the section description field to hide the intro paragraph under the title.
          Calendar links are generated automatically from event dates.
        </p>
        <div className="mt-4">
          <ImageUrlField
            label="Overview image (optional)"
            hint="Shown to the right of the overview text (portrait 3:4 or 4:5 recommended)."
            value={payload.overviewImageUrl ?? ""}
            disabled={readOnly}
            uploadBusy={uploadBusy === "page_image:overview_image"}
            onChange={(url) => setPayload((p) => ({ ...p, overviewImageUrl: url || null }))}
            onUpload={(file) => uploadPageImageForField("overview_image", file)}
          />
        </div>
      </div>
      </div>
      ) : null}

      {step === 1 ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h3 className="mb-3 text-base font-bold tracking-tight text-zinc-900">Program agenda</h3>
        <PublicEventSectionHeaderFields
          sectionKey="program"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
          className="mb-4"
        />
        {programDays.length > 1 ? (
          <div className="mb-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Program mode</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setPayload((p) => ({ ...p, programMode: "SAME_FOR_ALL_DAYS" }))}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold",
                  payload.programMode === "SAME_FOR_ALL_DAYS" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                )}
              >
                One program for all days
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setPayload((p) => ({ ...p, programMode: "PER_DAY" }))}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold",
                  payload.programMode === "PER_DAY" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                )}
              >
                Program per day
              </button>
            </div>
          </div>
        ) : null}

        {payload.programMode === "PER_DAY" && programDays.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {programDays.map((d) => (
              <button
                key={d.dayIndex}
                type="button"
                onClick={() => setActiveDay(d.dayIndex)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  activeDay === d.dayIndex ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                )}
              >
                Day {d.dayIndex} · {dateLabel(d.startsAt)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          {payload.programMode === "PER_DAY" && programDays.length > 1
            ? renderAgendaRows(perDayRows(activeDay), (rows) => setPerDayRows(activeDay, rows))
            : renderAgendaRows(payload.agenda, (rows) => setPayload((p) => ({ ...p, agenda: rows })))}
          {(payload.programMode === "PER_DAY" && programDays.length > 1 ? perDayRows(activeDay).length === 0 : payload.agenda.length === 0) ? (
            <p className="text-sm text-zinc-500">No agenda rows yet.</p>
          ) : null}
        </div>
      </div>
      ) : null}

      {step === 2 ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <PublicEventSectionHeaderFields
          sectionKey="venueOps"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
          className="mb-4"
        />
        <h3 className="text-base font-bold tracking-tight text-zinc-900">Venue operations</h3>
        <p className="mt-1 text-sm text-zinc-600">Shown on the public “Venue & access” tab when provided.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input
            className={fieldClass}
            placeholder="Wi-Fi SSID"
            value={payload.venue?.wifiSsid ?? ""}
            disabled={readOnly}
            onChange={(e) => setPayload((p) => ({ ...p, venue: { ...p.venue, wifiSsid: e.target.value } }))}
          />
          <input
            className={fieldClass}
            placeholder="Wi-Fi password"
            value={payload.venue?.wifiPassword ?? ""}
            disabled={readOnly}
            onChange={(e) => setPayload((p) => ({ ...p, venue: { ...p.venue, wifiPassword: e.target.value } }))}
          />
        </div>
        <textarea
          rows={2}
          className={cn(areaClass, "mt-2")}
          placeholder="Wi-Fi note (optional)"
          value={payload.venue?.wifiNote ?? ""}
          disabled={readOnly}
          onChange={(e) => setPayload((p) => ({ ...p, venue: { ...p.venue, wifiNote: e.target.value } }))}
        />
        <textarea
          rows={3}
          className={cn(areaClass, "mt-2")}
          placeholder="Parking and arrival instructions"
          value={payload.venue?.parkingInfo ?? ""}
          disabled={readOnly}
          onChange={(e) => setPayload((p) => ({ ...p, venue: { ...p.venue, parkingInfo: e.target.value } }))}
        />
        <textarea
          rows={3}
          className={cn(areaClass, "mt-2")}
          placeholder="Accessibility / special access notes"
          value={payload.venue?.accessInfo ?? ""}
          disabled={readOnly}
          onChange={(e) => setPayload((p) => ({ ...p, venue: { ...p.venue, accessInfo: e.target.value } }))}
        />
      </div>
      ) : null}

      {step === 3 ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <PublicEventSpeakersDisplayFields
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
          fieldClass={fieldClass}
        />
        <PublicEventSectionHeaderFields
          sectionKey="speakers"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
          className="mb-4"
        />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold tracking-tight text-zinc-900">Speakers</h3>
          <Button
            type="button"
            variant="secondary"
            className="border-zinc-200"
            disabled={readOnly}
            onClick={() =>
              setPayload((p) => ({
                ...p,
                speakers: [
                  ...p.speakers,
                  {
                    id: uid("sp"),
                    name: "",
                    title: "",
                    company: "",
                    bio: "",
                    imageUrl: null,
                    social: { linkedin: null, twitter: null, website: null }
                  }
                ]
              }))
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add speaker
          </Button>
        </div>
        <div className="space-y-4">
          {payload.speakers.map((row) => (
            <div key={row.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  placeholder="Name"
                  value={row.name}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.map((x) => (x.id === row.id ? { ...x, name: e.target.value } : x))
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Title"
                  value={row.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.map((x) => (x.id === row.id ? { ...x, title: e.target.value } : x))
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Company"
                  value={row.company}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.map((x) => (x.id === row.id ? { ...x, company: e.target.value } : x))
                    }))
                  }
                />
                <div className="flex items-center gap-2">
                  <label
                    className={cn(
                      "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700",
                      readOnly && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <Upload className="h-4 w-4" />
                    Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={readOnly}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadFile("speaker_image", f);
                        if (url) {
                          setPayload((p) => ({
                            ...p,
                            speakers: p.speakers.map((x) => (x.id === row.id ? { ...x, imageUrl: url } : x))
                          }));
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {uploadBusy ? <span className="text-xs text-zinc-500">Uploading…</span> : null}
                </div>
              </div>
              <textarea
                rows={4}
                className={cn(areaClass, "mt-2")}
                placeholder="Short bio"
                value={row.bio}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    speakers: p.speakers.map((x) => (x.id === row.id ? { ...x, bio: e.target.value } : x))
                  }))
                }
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  className={fieldClass}
                  placeholder="LinkedIn URL"
                  value={row.social?.linkedin ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.map((x) =>
                        x.id === row.id
                          ? { ...x, social: { ...x.social, linkedin: e.target.value.trim() || null } }
                          : x
                      )
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Website URL"
                  value={row.social?.website ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.map((x) =>
                        x.id === row.id
                          ? { ...x, social: { ...x.social, website: e.target.value.trim() || null } }
                          : x
                      )
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="X / Twitter URL"
                  value={row.social?.twitter ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.map((x) =>
                        x.id === row.id
                          ? { ...x, social: { ...x.social, twitter: e.target.value.trim() || null } }
                          : x
                      )
                    }))
                  }
                />
              </div>
              {row.imageUrl ? (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.imageUrl} alt="" className="h-16 w-16 rounded-lg border border-zinc-200 object-cover" />
                  <p className="truncate text-xs text-zinc-500">{row.imageUrl}</p>
                </div>
              ) : null}
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  disabled={readOnly}
                  onClick={() =>
                    setPayload((p) => ({
                      ...p,
                      speakers: p.speakers.filter((x) => x.id !== row.id)
                    }))
                  }
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}
          {payload.speakers.length === 0 ? <p className="text-sm text-zinc-500">No speakers yet.</p> : null}
        </div>
      </div>
      ) : null}

      {MARKETING_STEP_BY_INDEX[step] ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <PublicEventMarketingContentEditor
            step={MARKETING_STEP_BY_INDEX[step]}
            payload={payload}
            setPayload={setPayload}
            readOnly={readOnly}
            uploadPageImage={uploadPageImageForField}
            uploadBusyKey={uploadBusy}
            uid={uid}
          />
        </div>
      ) : null}

      {step === 10 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <PublicEventSectionHeaderFields
            sectionKey="faq"
            payload={payload}
            readOnly={readOnly}
            onChange={setPayload}
            className="mb-4"
          />
          <h3 className="text-base font-bold tracking-tight text-zinc-900">FAQ</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Questions and answers for the public FAQ section. Add at least one pair for the section to appear in the menu.
          </p>
          <div className="mt-4">
            <ImageUrlField
              label="Section image (optional)"
              hint="Shown beside the accordion on the public page."
              value={payload.faqImageUrl ?? ""}
              disabled={readOnly}
              uploadBusy={uploadBusy === "page_image:faq_image"}
              onChange={(url) => setPayload((p) => ({ ...p, faqImageUrl: url || null }))}
              onUpload={(file) => uploadPageImageForField("faq_image", file)}
            />
          </div>
          <div className="mb-3 mt-6 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-800">Questions</p>
            <Button
              type="button"
              variant="secondary"
              className="border-zinc-200"
              disabled={readOnly}
              onClick={() =>
                setPayload((p) => ({
                  ...p,
                  faqItems: [...p.faqItems, { id: uid("faq"), question: "", answer: "" }]
                }))
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add question
            </Button>
          </div>
          <div className="space-y-4">
            {payload.faqItems.map((row) => (
              <div key={row.id} className="rounded-lg border border-zinc-200 p-3">
                <input
                  className={fieldClass}
                  placeholder="Question"
                  value={row.question}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      faqItems: p.faqItems.map((x) =>
                        x.id === row.id ? { ...x, question: e.target.value } : x
                      )
                    }))
                  }
                />
                <textarea
                  rows={3}
                  className={cn(areaClass, "mt-2")}
                  placeholder="Answer"
                  value={row.answer}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      faqItems: p.faqItems.map((x) =>
                        x.id === row.id ? { ...x, answer: e.target.value } : x
                      )
                    }))
                  }
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={readOnly}
                    onClick={() =>
                      setPayload((p) => ({
                        ...p,
                        faqItems: p.faqItems.filter((x) => x.id !== row.id)
                      }))
                    }
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
            {payload.faqItems.length === 0 ? (
              <p className="text-sm text-zinc-500">No FAQ items yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 11 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <PublicEventSectionHeaderFields
            sectionKey="contact"
            payload={payload}
            readOnly={readOnly}
            onChange={setPayload}
            className="mb-4"
          />
          <h3 className="text-base font-bold tracking-tight text-zinc-900">Attendee contact</h3>
          <p className="mt-1 text-sm text-zinc-600">
            This block appears on the public event homepage and contact tab. Leave fields blank to hide.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className={fieldClass}
              placeholder="Section title (e.g. Questions?)"
              value={payload.contact?.heading ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  contact: { ...(p.contact ?? {}), heading: e.target.value }
                }))
              }
            />
            <input
              className={fieldClass}
              placeholder="Contact name or team"
              value={payload.contact?.contactName ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  contact: { ...(p.contact ?? {}), contactName: e.target.value }
                }))
              }
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={fieldClass}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email"
                value={payload.contact?.email ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    contact: { ...(p.contact ?? {}), email: e.target.value }
                  }))
                }
              />
              <input
                className={fieldClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Phone"
                value={payload.contact?.phone ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    contact: { ...(p.contact ?? {}), phone: e.target.value }
                  }))
                }
              />
            </div>
            <input
              className={fieldClass}
              type="url"
              inputMode="url"
              placeholder="https://… (website or help page)"
              value={payload.contact?.website ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  contact: { ...(p.contact ?? {}), website: e.target.value }
                }))
              }
            />
            <textarea
              rows={4}
              className={areaClass}
              placeholder="Short note (hours, who to message first, etc.)"
              value={payload.contact?.note ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  contact: { ...(p.contact ?? {}), note: e.target.value }
                }))
              }
            />
            <ImageUrlField
              label="Contact section image (optional)"
              hint="Shown on the public contact section; falls back to event banner if empty."
              value={payload.contact?.imageUrl ?? ""}
              disabled={readOnly}
              uploadBusy={uploadBusy === "page_image:contact_image"}
              onChange={(url) =>
                setPayload((p) => ({
                  ...p,
                  contact: { ...(p.contact ?? {}), imageUrl: url || undefined }
                }))
              }
              onUpload={(file) => uploadPageImageForField("contact_image", file)}
            />
          </div>
        </div>
      ) : null}


      {step === 9 ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <PublicEventSectionHeaderFields
          sectionKey="resources"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
          className="mb-4"
        />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold tracking-tight text-zinc-900">Resources</h3>
          <Button
            type="button"
            variant="secondary"
            className="border-zinc-200"
            disabled={readOnly}
            onClick={() =>
              setPayload((p) => ({
                ...p,
                resources: [
                  ...p.resources,
                  { id: uid("rs"), title: "", kind: "PDF", meta: "", summary: "", url: "", fileUrl: null }
                ]
              }))
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add resource
          </Button>
        </div>
        <div className="space-y-4">
          {payload.resources.map((row) => (
            <div key={row.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  placeholder="Title"
                  value={row.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      resources: p.resources.map((x) => (x.id === row.id ? { ...x, title: e.target.value } : x))
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Kind (PDF, ICS, DOCX...)"
                  value={row.kind}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      resources: p.resources.map((x) => (x.id === row.id ? { ...x, kind: e.target.value } : x))
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Meta (optional)"
                  value={row.meta ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      resources: p.resources.map((x) => (x.id === row.id ? { ...x, meta: e.target.value } : x))
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="External URL (optional)"
                  value={row.url ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      resources: p.resources.map((x) => (x.id === row.id ? { ...x, url: e.target.value } : x))
                    }))
                  }
                />
              </div>
              <textarea
                rows={2}
                className={cn(areaClass, "mt-2")}
                placeholder="Summary (optional)"
                value={row.summary ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    resources: p.resources.map((x) => (x.id === row.id ? { ...x, summary: e.target.value } : x))
                  }))
                }
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700",
                    readOnly && "cursor-not-allowed opacity-60"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload file
                  <input
                    type="file"
                    accept=".pdf,.docx,.ppt,.pptx,.zip,.txt,application/pdf,application/zip,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    className="hidden"
                    disabled={readOnly}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadFile("resource_file", f);
                      if (url) {
                        setPayload((p) => ({
                          ...p,
                          resources: p.resources.map((x) => (x.id === row.id ? { ...x, fileUrl: url } : x))
                        }));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {row.fileUrl ? <span className="truncate text-xs text-zinc-500">File: {row.fileUrl}</span> : null}
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  disabled={readOnly}
                  onClick={() =>
                    setPayload((p) => ({
                      ...p,
                      resources: p.resources.filter((x) => x.id !== row.id)
                    }))
                  }
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}
          {payload.resources.length === 0 ? <p className="text-sm text-zinc-500">No resources yet.</p> : null}
        </div>
      </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="secondary" className="border-zinc-200" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="secondary" className="border-zinc-200" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Continue
            </Button>
          ) : null}
        </div>
        <Button type="button" disabled={readOnly || busy} onClick={() => void onSave()}>
          <Save className="mr-1.5 h-4 w-4" />
          {busy ? "Saving…" : "Save section"}
        </Button>
      </div>
      </div>
      </div>
    </section>
  );
}

