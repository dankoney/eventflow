"use client";

import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type {
  PublicEventAgendaItem,
  PublicEventAgendaTag,
  PublicEventAgendaTagTone,
  PublicEventExperiencePayload
} from "@/lib/public-event/experience";
import { createDefaultAgendaItem } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const TAG_PRESETS: Array<{ label: string; tone: PublicEventAgendaTagTone }> = [
  { label: "Keynote", tone: "tertiary" },
  { label: "Panel Discussion", tone: "secondary" },
  { label: "Masterclass", tone: "primary" },
  { label: "Session", tone: "neutral" }
];

type Props = {
  rows: PublicEventAgendaItem[];
  setRows: (rows: PublicEventAgendaItem[]) => void;
  speakers: PublicEventExperiencePayload["speakers"];
  readOnly: boolean;
  uid: (prefix: string) => string;
};

function updateRow(rows: PublicEventAgendaItem[], id: string, patch: Partial<PublicEventAgendaItem>) {
  return rows.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

export function AgendaItemRowEditor({ rows, setRows, speakers, readOnly, uid }: Props) {
  function addRow() {
    setRows([...rows, createDefaultAgendaItem(uid("ag"))]);
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const isBreak = row.rowKind === "break";
        const tagDraftId = `tag-${row.id}`;

        return (
          <div
            key={row.id}
            className={cn(
              "space-y-3 rounded-lg border p-3",
              isBreak ? "border-amber-200 bg-amber-50/40" : "border-zinc-200 bg-white"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {isBreak ? "Break row" : "Session row"}
              </p>
              <Button
                type="button"
                variant="danger"
                className="h-8 px-2"
                disabled={readOnly}
                onClick={() => setRows(rows.filter((x) => x.id !== row.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
              <input
                className={fieldClass}
                placeholder="09:00"
                value={row.time}
                disabled={readOnly}
                onChange={(e) => setRows(updateRow(rows, row.id, { time: e.target.value }))}
              />
              <input
                className={fieldClass}
                placeholder={isBreak ? "Lunch, dinner, networking…" : "Session title"}
                value={row.title}
                disabled={readOnly}
                onChange={(e) => setRows(updateRow(rows, row.id, { title: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setRows(updateRow(rows, row.id, { rowKind: "session" }))}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold",
                  !isBreak ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                )}
              >
                Session
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setRows(updateRow(rows, row.id, { rowKind: "break" }))}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold",
                  isBreak ? "bg-amber-700 text-white" : "bg-zinc-100 text-zinc-700"
                )}
              >
                Break (compact row)
              </button>
            </div>

            <input
              className={fieldClass}
              placeholder="Room / stage (optional)"
              value={row.venueLabel ?? ""}
              disabled={readOnly}
              onChange={(e) =>
                setRows(updateRow(rows, row.id, { venueLabel: e.target.value || null }))
              }
            />

            {!isBreak ? (
              <>
                <textarea
                  rows={2}
                  className={areaClass}
                  placeholder="Description (optional)"
                  value={row.detail ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    setRows(updateRow(rows, row.id, { detail: e.target.value || null }))
                  }
                />

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-600">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          if (row.tags.some((t) => t.label === preset.label)) return;
                          setRows(
                            updateRow(rows, row.id, {
                              tags: [...row.tags, preset].slice(0, 6)
                            })
                          );
                        }}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-zinc-400"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.tags.map((tag) => (
                      <span
                        key={`${row.id}-${tag.label}`}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 pl-2.5 pr-1 py-0.5 text-xs"
                      >
                        <select
                          className="max-w-[5.5rem] border-0 bg-transparent py-0 text-[10px] font-semibold uppercase text-zinc-500"
                          value={tag.tone}
                          disabled={readOnly}
                          onChange={(e) => {
                            const tone = e.target.value as PublicEventAgendaTagTone;
                            setRows(
                              updateRow(rows, row.id, {
                                tags: row.tags.map((t) =>
                                  t.label === tag.label ? { ...t, tone } : t
                                )
                              })
                            );
                          }}
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                          <option value="tertiary">Tertiary</option>
                          <option value="neutral">Neutral</option>
                        </select>
                        {tag.label}
                        <button
                          type="button"
                          disabled={readOnly}
                          className="rounded-full p-0.5 text-zinc-400 hover:text-zinc-900"
                          onClick={() =>
                            setRows(
                              updateRow(rows, row.id, {
                                tags: row.tags.filter((t) => t.label !== tag.label)
                              })
                            )
                          }
                          aria-label={`Remove tag ${tag.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <TagAddRow
                    rowId={row.id}
                    draftId={tagDraftId}
                    readOnly={readOnly}
                    onAdd={(tag: PublicEventAgendaTag) => {
                      if (row.tags.some((t) => t.label.toLowerCase() === tag.label.toLowerCase())) return;
                      setRows(updateRow(rows, row.id, { tags: [...row.tags, tag].slice(0, 6) }));
                    }}
                  />
                </div>

                {speakers.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-600">Speakers (avatar stack)</p>
                    <ul className="flex flex-wrap gap-2">
                      {speakers.map((sp) => {
                        const checked = row.speakerIds.includes(sp.id);
                        const label = sp.name.trim() || "Unnamed speaker";
                        return (
                          <li key={sp.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                                readOnly && "cursor-not-allowed opacity-60",
                                checked
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-emerald-600"
                                checked={checked}
                                disabled={readOnly}
                                onChange={(e) => {
                                  const nextIds = e.target.checked
                                    ? [...row.speakerIds, sp.id].slice(0, 6)
                                    : row.speakerIds.filter((id) => id !== sp.id);
                                  setRows(updateRow(rows, row.id, { speakerIds: nextIds }));
                                }}
                              />
                              {label}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Add speakers in the Speakers step to link avatars to sessions.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-amber-800/90">
                Break rows use a compact layout with a utensil icon on the public page.
              </p>
            )}
          </div>
        );
      })}

      <Button type="button" variant="secondary" className="border-zinc-200" disabled={readOnly} onClick={addRow}>
        <Plus className="mr-1.5 h-4 w-4" /> Add item
      </Button>
    </div>
  );
}

function TagAddRow({
  readOnly,
  onAdd
}: {
  rowId: string;
  draftId: string;
  readOnly: boolean;
  onAdd: (tag: PublicEventAgendaTag) => void;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("tagLabel") as HTMLInputElement;
        const label = input.value.trim();
        if (!label) return;
        onAdd({ label, tone: "neutral" });
        input.value = "";
      }}
    >
      <input
        name="tagLabel"
        className={fieldClass}
        placeholder="Custom tag label"
        disabled={readOnly}
      />
      <Button type="submit" variant="secondary" className="shrink-0 border-zinc-200" disabled={readOnly}>
        Add tag
      </Button>
    </form>
  );
}
