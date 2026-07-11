"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { ImageUrlField } from "@/components/events/public-event-editor/ImageUrlField";
import { SpotlightVideoPlaylistEditor } from "@/components/events/public-event-editor/SpotlightVideoPlaylistEditor";
import { Button } from "@/components/ui/Button";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

type SpotlightTab = "content" | "media" | "stats" | "carousel";

const TABS: { id: SpotlightTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "media", label: "Media" },
  { id: "stats", label: "Stats" },
  { id: "carousel", label: "Carousel" }
];

type Props = {
  spotlight: NonNullable<PublicEventExperiencePayload["spotlight"]>;
  setPayload: Dispatch<SetStateAction<PublicEventExperiencePayload>>;
  readOnly: boolean;
  uploadPageImage: (fieldId: string, file: File) => Promise<string | null>;
  busyKey: (id: string) => boolean;
  uid: (prefix: string) => string;
};

export function SpotlightSectionEditor({
  spotlight,
  setPayload,
  readOnly,
  uploadPageImage,
  busyKey,
  uid
}: Props) {
  const [tab, setTab] = useState<SpotlightTab>("content");

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Host destination block: background media, headline stats, and culture carousel. Shown on the public page after
        Overview when the Spotlight section is visible.
      </p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Spotlight editor sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === t.id
                ? "bg-zinc-900 text-white ring-2 ring-zinc-400/90"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={fieldClass}
              placeholder="Badge (e.g. Host Spotlight)"
              value={spotlight.badge ?? ""}
              disabled={readOnly}
              onChange={(e) => setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, badge: e.target.value } }))}
            />
          </div>
          <input
            className={fieldClass}
            placeholder="Section title"
            value={spotlight.title ?? ""}
            disabled={readOnly}
            onChange={(e) => setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, title: e.target.value } }))}
          />
          <textarea
            rows={3}
            className={areaClass}
            placeholder="Description"
            value={spotlight.description ?? ""}
            disabled={readOnly}
            onChange={(e) =>
              setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, description: e.target.value } }))
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={fieldClass}
              placeholder="CTA label"
              value={spotlight.ctaLabel ?? ""}
              disabled={readOnly}
              onChange={(e) => setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, ctaLabel: e.target.value } }))}
            />
            <input
              className={fieldClass}
              placeholder="CTA link URL"
              value={spotlight.ctaHref ?? ""}
              disabled={readOnly}
              onChange={(e) => setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, ctaHref: e.target.value } }))}
            />
          </div>
        </div>
      ) : null}

      {tab === "media" ? (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          <ImageUrlField
            label="Background image"
            value={spotlight.backgroundImageUrl ?? ""}
            disabled={readOnly}
            uploadBusy={busyKey("spotlight-bg")}
            onChange={(url) => setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, backgroundImageUrl: url } }))}
            onUpload={(file) => uploadPageImage("spotlight-bg", file)}
          />
          <SpotlightVideoPlaylistEditor
            value={spotlight.backgroundVideoUrl}
            disabled={readOnly}
            uploadBusy={busyKey("spotlight-video")}
            onChange={(url) => setPayload((p) => ({ ...p, spotlight: { ...p.spotlight, backgroundVideoUrl: url } }))}
            onUpload={(file) => uploadPageImage("spotlight-video", file)}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={spotlight.backgroundVideoAutoplay !== false}
              disabled={readOnly}
              onChange={(e) =>
                setPayload((p) => ({
                  ...p,
                  spotlight: { ...p.spotlight, backgroundVideoAutoplay: e.target.checked }
                }))
              }
            />
            Autoplay video muted in a loop when the page loads
          </label>
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900">Headline stats</p>
            <Button
              type="button"
              variant="secondary"
              className="border-zinc-200"
              disabled={readOnly || (spotlight.stats?.length ?? 0) >= 6}
              onClick={() =>
                setPayload((p) => ({
                  ...p,
                  spotlight: { ...p.spotlight, stats: [...(p.spotlight?.stats ?? []), { value: "", label: "" }] }
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add stat
            </Button>
          </div>
          <div className="space-y-2">
            {(spotlight.stats ?? []).map((stat, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={fieldClass}
                  placeholder="42"
                  value={stat.value}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => {
                      const stats = [...(p.spotlight?.stats ?? [])];
                      stats[i] = { ...stats[i], value: e.target.value };
                      return { ...p, spotlight: { ...p.spotlight, stats } };
                    })
                  }
                />
                <input
                  className={fieldClass}
                  placeholder="Label"
                  value={stat.label}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => {
                      const stats = [...(p.spotlight?.stats ?? [])];
                      stats[i] = { ...stats[i], label: e.target.value };
                      return { ...p, spotlight: { ...p.spotlight, stats } };
                    })
                  }
                />
                <Button
                  type="button"
                  variant="danger"
                  disabled={readOnly}
                  onClick={() =>
                    setPayload((p) => ({
                      ...p,
                      spotlight: { ...p.spotlight, stats: (p.spotlight?.stats ?? []).filter((_, j) => j !== i) }
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(spotlight.stats ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No stats yet. Add up to six value/label pairs.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "carousel" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900">Culture carousel</p>
            <Button
              type="button"
              variant="secondary"
              className="border-zinc-200"
              disabled={readOnly || (spotlight.carouselItems?.length ?? 0) >= 12}
              onClick={() =>
                setPayload((p) => ({
                  ...p,
                  spotlight: {
                    ...p.spotlight,
                    carouselItems: [
                      ...(p.spotlight?.carouselItems ?? []),
                      { id: uid("sc"), title: "", imageUrl: null, href: null }
                    ]
                  }
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add card
            </Button>
          </div>
          <div className="space-y-3">
            {(spotlight.carouselItems ?? []).map((card) => (
              <div key={card.id} className="rounded-lg border border-zinc-200 p-3">
                <input
                  className={cn(fieldClass, "mb-2")}
                  placeholder="Card title"
                  value={card.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      spotlight: {
                        ...p.spotlight,
                        carouselItems: (p.spotlight?.carouselItems ?? []).map((c) =>
                          c.id === card.id ? { ...c, title: e.target.value } : c
                        )
                      }
                    }))
                  }
                />
                <ImageUrlField
                  label="Card image (upload or URL)"
                  value={card.imageUrl ?? ""}
                  disabled={readOnly}
                  uploadBusy={busyKey(card.id)}
                  onChange={(url) =>
                    setPayload((p) => ({
                      ...p,
                      spotlight: {
                        ...p.spotlight,
                        carouselItems: (p.spotlight?.carouselItems ?? []).map((c) =>
                          c.id === card.id ? { ...c, imageUrl: url } : c
                        )
                      }
                    }))
                  }
                  onUpload={(file) => uploadPageImage(card.id, file)}
                />
                <input
                  className={cn(fieldClass, "mt-2")}
                  placeholder="Learn more link (optional)"
                  value={card.href ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPayload((p) => ({
                      ...p,
                      spotlight: {
                        ...p.spotlight,
                        carouselItems: (p.spotlight?.carouselItems ?? []).map((c) =>
                          c.id === card.id ? { ...c, href: e.target.value } : c
                        )
                      }
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
                        spotlight: {
                          ...p.spotlight,
                          carouselItems: (p.spotlight?.carouselItems ?? []).filter((c) => c.id !== card.id)
                        }
                      }))
                    }
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
            {(spotlight.carouselItems ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No carousel cards yet. Add up to twelve culture highlights.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
