"use client";

import { Plus, Trash2 } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { PUBLIC_EVENT_HERO_STYLE_LABELS, PUBLIC_EVENT_HERO_STYLES } from "@/lib/public-event/heroStyles";
import {
  SPEAKER_GRID_COLUMNS,
  SPEAKER_HOVER_STYLE_LABELS,
  SPEAKER_HOVER_STYLES,
  SPEAKER_LAYOUT_MODES
} from "@/lib/public-event/speakersDisplay";
import { cn } from "@/lib/utils";

import { ImageUrlField } from "./ImageUrlField";
import { CountryContinentPicker } from "./CountryContinentPicker";
import { HexColorPickerField } from "./HexColorPickerField";
import {
  SPEAKER_TEXT_COLOR_DEFAULTS,
  speakerDisplayColorKey,
  type SpeakerTextColorKey
} from "@/lib/public-event/speakerTextColors";

type Props = {
  payload: PublicEventExperiencePayload;
  readOnly: boolean;
  onChange: (next: PublicEventExperiencePayload) => void;
  uploadBusy: string | null;
  onUploadCarouselImage: (file: File) => Promise<string | null>;
  onUploadFlagImage: (file: File) => Promise<string | null>;
  fieldClass: string;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PublicEventHeroOverviewFields({
  payload,
  readOnly,
  onChange,
  uploadBusy,
  onUploadCarouselImage,
  onUploadFlagImage,
  fieldClass
}: Props) {
  const hero = payload.hero ?? {};
  const highlights = payload.overviewHighlights ?? {
    mode: "default",
    carouselItems: [],
    countryFlags: [],
    selectedCountryCodes: []
  };
  const theme = payload.themeCustomization ?? {};

  const setHero = (patch: Partial<typeof hero>) =>
    onChange({ ...payload, hero: { ...hero, ...patch } });

  const HERO_COLOR_DEFAULTS = {
    titleColor: "#ffffff",
    titleAccentColor: "#ce2e34",
    titleGradientFrom: "#0040e0",
    titleGradientTo: "#1e40af",
    subtitleColor: "#ffffff",
    backgroundColor: "#0f172a",
    backgroundGradientFrom: "#0f172a",
    backgroundGradientTo: "#1e3a8a",
    overlayColor: "#1e3a8a",
    overlayGradientFrom: "#2e5bff",
    overlayGradientTo: "#0f172a"
  } as const;

  const colorField = (label: string, key: keyof typeof hero, defaultColor: string) => (
    <HexColorPickerField
      label={label}
      value={(hero[key] as string | null | undefined) ?? null}
      defaultColor={defaultColor}
      disabled={readOnly}
      onChange={(next) => setHero({ [key]: next } as Partial<typeof hero>)}
    />
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <h3 className="text-sm font-bold text-zinc-900">Hero layout</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Choose how the top hero section renders on the public page. Colors follow your event brand settings.
        </p>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Hero style
        </label>
        <select
          className={cn(fieldClass, "mt-1")}
          disabled={readOnly}
          value={hero.style ?? ""}
          onChange={(e) =>
            onChange({
              ...payload,
              hero: {
                ...hero,
                style: e.target.value ? (e.target.value as (typeof PUBLIC_EVENT_HERO_STYLES)[number]) : null
              }
            })
          }
        >
          <option value="">Template default</option>
          {PUBLIC_EVENT_HERO_STYLES.map((style) => (
            <option key={style} value={style}>
              {PUBLIC_EVENT_HERO_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
        {hero.style === "video_countdown" || hero.style === "split_multimedia" ? (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hero video URL</label>
              <input
                className={cn(fieldClass, "mt-1")}
                placeholder="https://… (MP4, WebM, or YouTube)"
                value={hero.videoUrl ?? ""}
                disabled={readOnly}
                onChange={(e) => setHero({ videoUrl: e.target.value.trim() || null })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Video playback</label>
              <select
                className={cn(fieldClass, "mt-1")}
                disabled={readOnly}
                value={hero.videoPlayback ?? "click"}
                onChange={(e) =>
                  setHero({ videoPlayback: e.target.value as "autoplay" | "click" })
                }
              >
                <option value="click">Click to play</option>
                <option value="autoplay">Autoplay (muted loop)</option>
              </select>
            </div>
          </div>
        ) : null}
        {hero.style === "split_multimedia" ? (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Split media type</label>
              <select
                className={cn(fieldClass, "mt-1")}
                disabled={readOnly}
                value={hero.splitMediaType ?? "image"}
                onChange={(e) =>
                  setHero({ splitMediaType: e.target.value as "image" | "video" })
                }
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
            {(hero.splitMediaType ?? "image") === "image" ? (
              <ImageUrlField
                label="Split panel image (optional — defaults to banner)"
                value={hero.splitImageUrl ?? ""}
                disabled={readOnly}
                uploadBusy={uploadBusy === "split_image"}
                onChange={(url) => setHero({ splitImageUrl: url || null })}
                onUpload={async (file) => onUploadCarouselImage(file)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <h3 className="text-sm font-bold text-zinc-900">Hero title & subtitle</h3>
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={hero.showSubtitle === true}
            disabled={readOnly}
            onChange={(e) => setHero({ showSubtitle: e.target.checked })}
          />
          Show subtitle under the title
        </label>
        {hero.showSubtitle ? (
          <textarea
            rows={3}
            className={cn(fieldClass, "mt-2")}
            placeholder="Custom hero subtitle (leave blank to use first line of event description)"
            value={hero.subtitle ?? ""}
            disabled={readOnly}
            onChange={(e) => setHero({ subtitle: e.target.value })}
          />
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={hero.showOrgBadge !== false}
            disabled={readOnly}
            onChange={(e) => setHero({ showOrgBadge: e.target.checked })}
          />
          Show organization name above the title
        </label>
        {(hero.style === "conference" || !hero.style) && (
          <>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={hero.showConferenceTagline !== false}
                disabled={readOnly}
                onChange={(e) => setHero({ showConferenceTagline: e.target.checked })}
              />
              Show intro line under the title (uncheck to hide completely)
            </label>
            {hero.showConferenceTagline !== false && !hero.showSubtitle ? (
              <textarea
                rows={2}
                className={cn(fieldClass, "mt-2")}
                placeholder='Custom intro text. Leave blank to hide, or uncheck the box above.'
                value={hero.conferenceTagline ?? ""}
                disabled={readOnly}
                onChange={(e) => setHero({ conferenceTagline: e.target.value })}
              />
            ) : null}
          </>
        )}
        {colorField("Subtitle & body text color", "subtitleColor", HERO_COLOR_DEFAULTS.subtitleColor)}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Title size</label>
            <select
              className={cn(fieldClass, "mt-1")}
              disabled={readOnly}
              value={hero.titleFontSize ?? "auto"}
              onChange={(e) =>
                setHero({
                  titleFontSize: e.target.value as "auto" | "sm" | "md" | "lg" | "xl"
                })
              }
            >
              <option value="auto">Auto (responsive)</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra large</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Title font</label>
            <select
              className={cn(fieldClass, "mt-1")}
              disabled={readOnly}
              value={hero.titleFontFamily ?? "auto"}
              onChange={(e) =>
                setHero({
                  titleFontFamily: e.target.value as "auto" | "display" | "body" | "headline" | "mono"
                })
              }
            >
              <option value="auto">Template default</option>
              <option value="headline">Headline (Sora)</option>
              <option value="display">Display (Manrope)</option>
              <option value="body">Body (Inter)</option>
              <option value="mono">Monospace</option>
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-zinc-800 sm:col-span-2">
            <input
              type="checkbox"
              checked={hero.titleUseAccentWord !== false}
              disabled={readOnly}
              onChange={(e) => setHero({ titleUseAccentWord: e.target.checked })}
            />
            Highlight last word of title
          </label>
          {colorField("Title color", "titleColor", HERO_COLOR_DEFAULTS.titleColor)}
          {colorField("Title accent color", "titleAccentColor", HERO_COLOR_DEFAULTS.titleAccentColor)}
          {colorField("Title gradient from", "titleGradientFrom", HERO_COLOR_DEFAULTS.titleGradientFrom)}
          {colorField("Title gradient to", "titleGradientTo", HERO_COLOR_DEFAULTS.titleGradientTo)}
        </div>
      </div>

      {(hero.style === "no_image" ||
        hero.style === "gradient_overlay" ||
        hero.style === "brand_overlay") && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <h3 className="text-sm font-bold text-zinc-900">Hero colors & overlay</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Optional hex colors (#RRGGBB). Leave blank to use your event brand theme.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {hero.style === "no_image" ? (
              <>
                {colorField("Background color", "backgroundColor", HERO_COLOR_DEFAULTS.backgroundColor)}
                {colorField("Background gradient from", "backgroundGradientFrom", HERO_COLOR_DEFAULTS.backgroundGradientFrom)}
                {colorField("Background gradient to", "backgroundGradientTo", HERO_COLOR_DEFAULTS.backgroundGradientTo)}
              </>
            ) : null}
            {(hero.style === "gradient_overlay" || hero.style === "brand_overlay") && (
              <>
                {colorField("Overlay color", "overlayColor", HERO_COLOR_DEFAULTS.overlayColor)}
                {colorField("Overlay gradient from", "overlayGradientFrom", HERO_COLOR_DEFAULTS.overlayGradientFrom)}
                {colorField("Overlay gradient to", "overlayGradientTo", HERO_COLOR_DEFAULTS.overlayGradientTo)}
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <h3 className="text-sm font-bold text-zinc-900">Overview highlight block</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Replace the default icon bullets with a carousel or attending-nations flag list (e.g. UNCITRAL).
        </p>
        <select
          className={cn(fieldClass, "mt-3")}
          disabled={readOnly}
          value={highlights.mode}
          onChange={(e) =>
            onChange({
              ...payload,
              overviewHighlights: {
                ...highlights,
                mode: e.target.value as typeof highlights.mode
              }
            })
          }
        >
          <option value="default">Default icon highlights</option>
          <option value="carousel">Image carousel</option>
          <option value="country_flags">Country attendance list</option>
          <option value="none">Hidden</option>
        </select>

        {highlights.mode === "carousel" ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-700">Carousel slides</p>
              <button
                type="button"
                disabled={readOnly}
                className="text-xs font-semibold text-zinc-900 underline"
                onClick={() =>
                  onChange({
                    ...payload,
                    overviewHighlights: {
                      ...highlights,
                      carouselItems: [
                        ...highlights.carouselItems,
                        { id: uid("ovc"), title: "Slide title", imageUrl: null, href: null }
                      ]
                    }
                  })
                }
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Add slide
              </button>
            </div>
            {highlights.carouselItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                <input
                  className={fieldClass}
                  placeholder="Title"
                  value={item.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange({
                      ...payload,
                      overviewHighlights: {
                        ...highlights,
                        carouselItems: highlights.carouselItems.map((x) =>
                          x.id === item.id ? { ...x, title: e.target.value } : x
                        )
                      }
                    })
                  }
                />
                <input
                  className={cn(fieldClass, "mt-2")}
                  placeholder="Link (optional)"
                  value={item.href ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange({
                      ...payload,
                      overviewHighlights: {
                        ...highlights,
                        carouselItems: highlights.carouselItems.map((x) =>
                          x.id === item.id ? { ...x, href: e.target.value.trim() || null } : x
                        )
                      }
                    })
                  }
                />
                <div className="mt-2">
                  <ImageUrlField
                    label="Image"
                    value={item.imageUrl ?? ""}
                    disabled={readOnly}
                    uploadBusy={uploadBusy === `carousel:${item.id}`}
                    onChange={(url) =>
                      onChange({
                        ...payload,
                        overviewHighlights: {
                          ...highlights,
                          carouselItems: highlights.carouselItems.map((x) =>
                            x.id === item.id ? { ...x, imageUrl: url || null } : x
                          )
                        }
                      })
                    }
                    onUpload={async (file) => onUploadCarouselImage(file)}
                  />
                </div>
                <button
                  type="button"
                  disabled={readOnly}
                  className="mt-2 text-xs font-semibold text-red-700"
                  onClick={() =>
                    onChange({
                      ...payload,
                      overviewHighlights: {
                        ...highlights,
                        carouselItems: highlights.carouselItems.filter((x) => x.id !== item.id)
                      }
                    })
                  }
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {highlights.mode === "country_flags" ? (
          <CountryContinentPicker
            selectedCodes={highlights.selectedCountryCodes ?? []}
            readOnly={readOnly}
            onChange={(codes) =>
              onChange({
                ...payload,
                overviewHighlights: { ...highlights, selectedCountryCodes: codes }
              })
            }
          />
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <h3 className="text-sm font-bold text-zinc-900">Page theme & footer</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Section bands</label>
            <select
              className={cn(fieldClass, "mt-1")}
              disabled={readOnly}
              value={theme.sectionBandPattern ?? "zebra"}
              onChange={(e) =>
                onChange({
                  ...payload,
                  themeCustomization: {
                    ...theme,
                    sectionBandPattern: e.target.value as typeof theme.sectionBandPattern
                  }
                })
              }
            >
              <option value="zebra">Zebra (alternating)</option>
              <option value="all_base">All same (base)</option>
              <option value="all_alt">All same (alternate)</option>
              <option value="minimal">Minimal (flat)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Section contrast</label>
            <select
              className={cn(fieldClass, "mt-1")}
              disabled={readOnly}
              value={theme.sectionContrast ?? "subtle"}
              onChange={(e) =>
                onChange({
                  ...payload,
                  themeCustomization: {
                    ...theme,
                    sectionContrast: e.target.value as typeof theme.sectionContrast
                  }
                })
              }
            >
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="bold">Bold</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Footer style</label>
            <select
              className={cn(fieldClass, "mt-1")}
              disabled={readOnly}
              value={theme.footerVariant ?? "default"}
              onChange={(e) =>
                onChange({
                  ...payload,
                  themeCustomization: {
                    ...theme,
                    footerVariant: e.target.value as typeof theme.footerVariant
                  }
                })
              }
            >
              <option value="default">Default</option>
              <option value="minimal">Minimal</option>
              <option value="centered">Centered</option>
              <option value="brand_bar">Brand accent bar</option>
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={theme.footerShowPoweredBy !== false}
              disabled={readOnly}
              onChange={(e) =>
                onChange({
                  ...payload,
                  themeCustomization: { ...theme, footerShowPoweredBy: e.target.checked }
                })
              }
            />
            Show “Powered by Eventflow”
          </label>
        </div>
        <textarea
          rows={2}
          className={cn(fieldClass, "mt-3")}
          placeholder="Custom footer text (optional)"
          value={theme.footerCustomText ?? ""}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              ...payload,
              themeCustomization: { ...theme, footerCustomText: e.target.value.trim() || null }
            })
          }
        />
      </div>
    </div>
  );
}

export function PublicEventSpeakersDisplayFields({
  payload,
  readOnly,
  onChange,
  fieldClass
}: {
  payload: PublicEventExperiencePayload;
  readOnly: boolean;
  onChange: (next: PublicEventExperiencePayload) => void;
  fieldClass: string;
}) {
  const display = payload.speakersDisplay ?? { layout: "grid", columns: 3, hoverStyle: "zoom" };

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <h3 className="text-sm font-bold text-zinc-900">Speaker grid display</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Layout</label>
          <select
            className={cn(fieldClass, "mt-1")}
            disabled={readOnly}
            value={display.layout}
            onChange={(e) =>
              onChange({
                ...payload,
                speakersDisplay: {
                  ...display,
                  layout: e.target.value as (typeof SPEAKER_LAYOUT_MODES)[number]
                }
              })
            }
          >
            <option value="grid">Responsive grid</option>
            <option value="kinetic">Kinetic gallery (Night Edition)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Columns</label>
          <select
            className={cn(fieldClass, "mt-1")}
            disabled={readOnly || display.layout === "kinetic"}
            value={String(display.columns)}
            onChange={(e) =>
              onChange({
                ...payload,
                speakersDisplay: {
                  ...display,
                  columns: Number(e.target.value) as (typeof SPEAKER_GRID_COLUMNS)[number]
                }
              })
            }
          >
            {SPEAKER_GRID_COLUMNS.map((n) => (
              <option key={n} value={n}>
                {n} per row
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Photo hover</label>
          <select
            className={cn(fieldClass, "mt-1")}
            disabled={readOnly}
            value={display.hoverStyle}
            onChange={(e) =>
              onChange({
                ...payload,
                speakersDisplay: {
                  ...display,
                  hoverStyle: e.target.value as (typeof SPEAKER_HOVER_STYLES)[number]
                }
              })
            }
          >
            {SPEAKER_HOVER_STYLES.map((style) => (
              <option key={style} value={style}>
                {SPEAKER_HOVER_STYLE_LABELS[style]}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["Name", "name"],
              ["Title / role", "title"],
              ["Company badge", "company"],
              ["Bio excerpt", "bio"],
              ["Social links", "social"]
            ] as const satisfies [string, Exclude<SpeakerTextColorKey, "kineticTitle">][]
          ).map(([label, key]) => (
            <HexColorPickerField
              key={key}
              label={label}
              value={display[speakerDisplayColorKey(key)] ?? null}
              defaultColor={SPEAKER_TEXT_COLOR_DEFAULTS[key]}
              disabled={readOnly}
              onChange={(next) =>
                onChange({
                  ...payload,
                  speakersDisplay: {
                    ...display,
                    [speakerDisplayColorKey(key)]: next
                  }
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
