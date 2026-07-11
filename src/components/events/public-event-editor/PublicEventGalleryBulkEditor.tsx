"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

type Props = {
  payload: PublicEventExperiencePayload;
  setPayload: Dispatch<SetStateAction<PublicEventExperiencePayload>>;
  readOnly: boolean;
  uploadPageImage: (fieldId: string, file: File) => Promise<string | null>;
  uid: (prefix: string) => string;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function PublicEventGalleryBulkEditor({
  payload,
  setPayload,
  readOnly,
  uploadPageImage,
  uid
}: Props) {
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const atLimit = payload.galleryItems.length >= 48;

  async function onMultiUpload(files: FileList | null) {
    if (!files?.length || readOnly || atLimit) return;
    setBulkBusy(true);
    setBulkNotice(null);
    const added: PublicEventExperiencePayload["galleryItems"] = [];
    let failed = 0;

    for (const file of Array.from(files)) {
      if (payload.galleryItems.length + added.length >= 48) break;
      const url = await uploadPageImage(`gallery_bulk_${uid("up")}`, file);
      if (url) {
        added.push({ id: uid("gl"), imageUrl: url, caption: null });
      } else {
        failed += 1;
      }
    }

    if (added.length > 0) {
      setPayload((p) => ({ ...p, galleryItems: [...p.galleryItems, ...added] }));
    }
    setBulkNotice(
      added.length > 0
        ? `Added ${added.length} photo${added.length === 1 ? "" : "s"}${failed ? ` (${failed} failed).` : "."}`
        : failed > 0
          ? "Upload failed. Check file type and try again."
          : null
    );
    setBulkBusy(false);
  }

  function addUrlsFromText() {
    if (readOnly || atLimit) return;
    const lines = bulkUrls
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const valid = lines.filter(isValidHttpUrl);
    const invalid = lines.length - valid.length;
    const room = 48 - payload.galleryItems.length;
    const toAdd = valid.slice(0, room).map((imageUrl) => ({
      id: uid("gl"),
      imageUrl,
      caption: null as string | null
    }));

    if (toAdd.length > 0) {
      setPayload((p) => ({ ...p, galleryItems: [...p.galleryItems, ...toAdd] }));
      setBulkUrls("");
    }

    const parts: string[] = [];
    if (toAdd.length > 0) parts.push(`Added ${toAdd.length} URL${toAdd.length === 1 ? "" : "s"}.`);
    if (invalid > 0) parts.push(`${invalid} invalid (use https://…).`);
    if (valid.length > room) parts.push(`Only ${room} slot${room === 1 ? "" : "s"} left (max 48).`);
    setBulkNotice(parts.join(" ") || null);
  }

  function updateCaption(id: string, caption: string) {
    setPayload((p) => ({
      ...p,
      galleryItems: p.galleryItems.map((x) => (x.id === id ? { ...x, caption: caption || null } : x))
    }));
  }

  function removeItem(id: string) {
    setPayload((p) => ({ ...p, galleryItems: p.galleryItems.filter((x) => x.id !== id) }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <p className="text-sm font-semibold text-zinc-900">Add multiple photos</p>
        <p className="mt-1 text-sm text-zinc-600">
          Upload many images at once or paste URLs (one per line). Changes apply when you save — no need to add
          photos one by one.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <label
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50",
              (readOnly || atLimit || bulkBusy) && "cursor-not-allowed opacity-60"
            )}
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {bulkBusy ? "Uploading…" : "Upload images"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              disabled={readOnly || atLimit || bulkBusy}
              onChange={(e) => {
                void onMultiUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <span className="self-center text-xs text-zinc-500">
            {payload.galleryItems.length} / 48 photos
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Image URLs</p>
          <textarea
            rows={4}
            className={areaClass}
            placeholder={"https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg"}
            value={bulkUrls}
            disabled={readOnly || atLimit}
            onChange={(e) => setBulkUrls(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            className="border-zinc-200"
            disabled={readOnly || atLimit || !bulkUrls.trim()}
            onClick={addUrlsFromText}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add URLs
          </Button>
        </div>

        {bulkNotice ? (
          <p className="mt-3 text-sm font-medium text-zinc-700" role="status">
            {bulkNotice}
          </p>
        ) : null}
      </div>

      {payload.galleryItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {payload.galleryItems.map((row) => (
            <div key={row.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="relative aspect-square bg-zinc-100">
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-400">No image</div>
                )}
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 rounded-md bg-white/95 p-1.5 text-zinc-700 shadow hover:bg-white"
                  disabled={readOnly}
                  aria-label="Remove photo"
                  onClick={() => removeItem(row.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                className={cn(fieldClass, "rounded-none border-0 border-t border-zinc-200 text-xs")}
                placeholder="Caption (optional)"
                value={row.caption ?? ""}
                disabled={readOnly}
                onChange={(e) => updateCaption(row.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No gallery photos yet. Upload or add URLs above.</p>
      )}
    </div>
  );
}
