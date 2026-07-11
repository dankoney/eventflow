"use client";

import { type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ImageUrlField } from "@/components/events/public-event-editor/ImageUrlField";
import { SpotlightSectionEditor } from "@/components/events/public-event-editor/SpotlightSectionEditor";
import { PublicEventGalleryBulkEditor } from "@/components/events/public-event-editor/PublicEventGalleryBulkEditor";
import { PublicEventSectionHeaderFields } from "@/components/events/public-event-editor/PublicEventSectionHeaderFields";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

export type MarketingWizardStep = "spotlight" | "partners" | "news" | "gallery" | "pricing";

type Props = {
  step: MarketingWizardStep;
  payload: PublicEventExperiencePayload;
  setPayload: Dispatch<SetStateAction<PublicEventExperiencePayload>>;
  readOnly: boolean;
  uploadPageImage: (fieldId: string, file: File) => Promise<string | null>;
  uploadBusyKey: string | null;
  uid: (prefix: string) => string;
};

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PublicEventMarketingContentEditor({
  step,
  payload,
  setPayload,
  readOnly,
  uploadPageImage,
  uploadBusyKey,
  uid
}: Props) {
  const spotlight = payload.spotlight ?? {};
  const busyKey = (id: string) => uploadBusyKey === `page_image:${id}`;

  if (step === "spotlight") {
    return (
      <SpotlightSectionEditor
        spotlight={spotlight}
        setPayload={setPayload}
        readOnly={readOnly}
        uploadPageImage={uploadPageImage}
        busyKey={busyKey}
        uid={uid}
      />
    );
  }

  if (step === "partners") {
    return (
      <div className="space-y-4">
        <PublicEventSectionHeaderFields
          sectionKey="partners"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
        />
        <p className="text-sm text-zinc-600">Logo strip only — partner names are used for alt text when a logo is missing.</p>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            className="border-zinc-200"
            disabled={readOnly || payload.partners.length >= 24}
            onClick={() =>
              setPayload((p) => ({
                ...p,
                partners: [...p.partners, { id: uid("pt"), name: "", logoUrl: null, href: null }]
              }))
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add partner
          </Button>
        </div>
        <div className="space-y-3">
          {payload.partners.map((row) => (
            <div key={row.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  placeholder="Partner name (accessibility)"
                  value={row.name}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      partners: p.partners.map((x) => (x.id === row.id ? { ...x, name: e.target.value } : x))
                    }))
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Website (optional)"
                  value={row.href ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      partners: p.partners.map((x) => (x.id === row.id ? { ...x, href: e.target.value } : x))
                    }))
                  }
                />
              </div>
              <ImageUrlField
                className="mt-2"
                label="Logo (upload or URL)"
                value={row.logoUrl ?? ""}
                disabled={readOnly}
                uploadBusy={busyKey(row.id)}
                onChange={(url) =>
                  setPayload((p) => ({
                    ...p,
                    partners: p.partners.map((x) => (x.id === row.id ? { ...x, logoUrl: url } : x))
                  }))
                }
                onUpload={(file) => uploadPageImage(row.id, file)}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  disabled={readOnly}
                  onClick={() => setPayload((p) => ({ ...p, partners: p.partners.filter((x) => x.id !== row.id) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {payload.partners.length === 0 ? <p className="text-sm text-zinc-500">No partners yet.</p> : null}
        </div>
      </div>
    );
  }

  if (step === "news") {
    return (
      <div className="space-y-4">
        <PublicEventSectionHeaderFields
          sectionKey="news"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
        />
        <p className="text-sm text-zinc-600">
          Items appear in a horizontal carousel. For video items, paste a YouTube watch or share link (we embed it
          automatically).
        </p>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            className="border-zinc-200"
            disabled={readOnly || payload.newsItems.length >= 24}
            onClick={() => {
              const iso = todayIso();
              setPayload((p) => ({
                ...p,
                newsItems: [
                  ...p.newsItems,
                  {
                    id: uid("nw"),
                    title: "",
                    dateIso: iso,
                    dateLabel: formatDateLabel(iso),
                    excerpt: null,
                    imageUrl: null,
                    href: null,
                    mediaType: "article",
                    videoEmbedUrl: null
                  }
                ]
              }));
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add item
          </Button>
        </div>
        <div className="space-y-4">
          {payload.newsItems.map((row) => (
            <div key={row.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  placeholder="Headline"
                  value={row.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      newsItems: p.newsItems.map((x) => (x.id === row.id ? { ...x, title: e.target.value } : x))
                    }))
                  }
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Date</label>
                  <input
                    type="date"
                    className={fieldClass}
                    value={row.dateIso ?? ""}
                    disabled={readOnly}
                    onChange={(e) => {
                      const iso = e.target.value;
                      setPayload((p) => ({
                        ...p,
                        newsItems: p.newsItems.map((x) =>
                          x.id === row.id
                            ? { ...x, dateIso: iso || null, dateLabel: iso ? formatDateLabel(iso) : x.dateLabel }
                            : x
                        )
                      }));
                    }}
                  />
                </div>
                <select
                  className={fieldClass}
                  value={row.mediaType}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      newsItems: p.newsItems.map((x) =>
                        x.id === row.id ? { ...x, mediaType: e.target.value as "article" | "press" | "video" } : x
                      )
                    }))
                  }
                >
                  <option value="article">Article</option>
                  <option value="press">Press</option>
                  <option value="video">Video</option>
                </select>
                {row.mediaType !== "video" ? (
                  <ImageUrlField
                    label="Cover image"
                    value={row.imageUrl ?? ""}
                    disabled={readOnly}
                    uploadBusy={busyKey(row.id)}
                    onChange={(url) =>
                      setPayload((p) => ({
                        ...p,
                        newsItems: p.newsItems.map((x) => (x.id === row.id ? { ...x, imageUrl: url } : x))
                      }))
                    }
                    onUpload={(file) => uploadPageImage(row.id, file)}
                  />
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-600">YouTube link</label>
                    <input
                      className={fieldClass}
                      placeholder="https://www.youtube.com/watch?v=…"
                      value={row.videoEmbedUrl ?? ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        setPayload((p) => ({
                          ...p,
                          newsItems: p.newsItems.map((x) =>
                            x.id === row.id ? { ...x, videoEmbedUrl: e.target.value } : x
                          )
                        }))
                      }
                    />
                  </div>
                )}
                <input
                  className={cn(fieldClass, "sm:col-span-2")}
                  placeholder="Article URL (optional)"
                  value={row.href ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      newsItems: p.newsItems.map((x) => (x.id === row.id ? { ...x, href: e.target.value } : x))
                    }))
                  }
                />
              </div>
              <textarea
                rows={2}
                className={cn(areaClass, "mt-2")}
                placeholder="Excerpt (optional)"
                value={row.excerpt ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    newsItems: p.newsItems.map((x) => (x.id === row.id ? { ...x, excerpt: e.target.value } : x))
                  }))
                }
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  disabled={readOnly}
                  onClick={() => setPayload((p) => ({ ...p, newsItems: p.newsItems.filter((x) => x.id !== row.id) }))}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}
          {payload.newsItems.length === 0 ? <p className="text-sm text-zinc-500">No news items yet.</p> : null}
        </div>
      </div>
    );
  }

  if (step === "gallery") {
    return (
      <div className="space-y-4">
        <PublicEventSectionHeaderFields
          sectionKey="gallery"
          payload={payload}
          readOnly={readOnly}
          onChange={setPayload}
        />
        <PublicEventGalleryBulkEditor
          payload={payload}
          setPayload={setPayload}
          readOnly={readOnly}
          uploadPageImage={uploadPageImage}
          uid={uid}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PublicEventSectionHeaderFields
        sectionKey="pricing"
        payload={payload}
        readOnly={readOnly}
        onChange={setPayload}
      />
      <p className="text-sm text-zinc-600">Registration pass tiers. Enter one feature per line in the features box.</p>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          className="border-zinc-200"
          disabled={readOnly || payload.pricingTiers.length >= 8}
          onClick={() =>
            setPayload((p) => ({
              ...p,
              pricingTiers: [
                ...p.pricingTiers,
                {
                  id: uid("pr"),
                  name: "",
                  priceLabel: "",
                  description: null,
                  features: [],
                  highlighted: false,
                  ctaLabel: "Register",
                  ctaHref: null
                }
              ]
            }))
          }
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add tier
        </Button>
      </div>
      <div className="space-y-4">
        {payload.pricingTiers.map((tier) => (
          <div key={tier.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={fieldClass}
                placeholder="Tier name"
                value={tier.name}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    pricingTiers: p.pricingTiers.map((x) => (x.id === tier.id ? { ...x, name: e.target.value } : x))
                  }))
                }
              />
              <input
                className={fieldClass}
                placeholder="Price label (e.g. $499)"
                value={tier.priceLabel}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    pricingTiers: p.pricingTiers.map((x) => (x.id === tier.id ? { ...x, priceLabel: e.target.value } : x))
                  }))
                }
              />
            </div>
            <textarea
              rows={2}
              className={cn(areaClass, "mt-2")}
              placeholder="Short description"
              value={tier.description ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  pricingTiers: p.pricingTiers.map((x) => (x.id === tier.id ? { ...x, description: e.target.value } : x))
                }))
              }
            />
            <textarea
              rows={4}
              className={cn(areaClass, "mt-2 font-mono text-sm")}
              placeholder={"Feature one\nFeature two\nFeature three"}
              value={tier.features.join("\n")}
              disabled={readOnly}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  pricingTiers: p.pricingTiers.map((x) =>
                    x.id === tier.id ? { ...x, features: e.target.value.split("\n") } : x
                  )
                }))
              }
            />
            <p className="mt-1 text-xs text-zinc-500">Press Enter for a new line. Empty lines are removed when you save.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                className={fieldClass}
                placeholder="CTA label"
                value={tier.ctaLabel}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    pricingTiers: p.pricingTiers.map((x) => (x.id === tier.id ? { ...x, ctaLabel: e.target.value } : x))
                  }))
                }
              />
              <input
                className={fieldClass}
                placeholder="CTA link (optional)"
                value={tier.ctaHref ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    pricingTiers: p.pricingTiers.map((x) => (x.id === tier.id ? { ...x, ctaHref: e.target.value } : x))
                  }))
                }
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900"
                checked={tier.highlighted}
                disabled={readOnly}
                onChange={(e) =>
                  setPayload((p) => ({
                    ...p,
                    pricingTiers: p.pricingTiers.map((x) => (x.id === tier.id ? { ...x, highlighted: e.target.checked } : x))
                  }))
                }
              />
              Highlight this tier
            </label>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="danger"
                disabled={readOnly}
                onClick={() =>
                  setPayload((p) => ({ ...p, pricingTiers: p.pricingTiers.filter((x) => x.id !== tier.id) }))
                }
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
          </div>
        ))}
        {payload.pricingTiers.length === 0 ? <p className="text-sm text-zinc-500">No pricing tiers yet.</p> : null}
      </div>
    </div>
  );
}
