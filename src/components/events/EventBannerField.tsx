"use client";

import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { EventFormValues } from "@/components/events/eventFormSchema";
import { Input } from "@/components/ui/Input";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { cn } from "@/lib/utils";

type BannerMode = "none" | "url" | "upload";

function inferMode(url: string | undefined): BannerMode {
  const t = url?.trim() ?? "";
  if (!t) return "none";
  if (t.startsWith("/uploads/")) return "upload";
  return "url";
}

export type EventBannerFieldProps = {
  form: UseFormReturn<EventFormValues>;
  /** Shorter help text (e.g. blueprint wizard). */
  compact?: boolean;
};

export function EventBannerField({ form, compact = false }: EventBannerFieldProps) {
  const bannerImageUrl = form.watch("bannerImageUrl");
  const name = form.watch("name") ?? "";
  const [mode, setMode] = useState<BannerMode>(() => inferMode(bannerImageUrl));
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setMode(inferMode(bannerImageUrl));
  }, [bannerImageUrl]);

  useEffect(() => {
    setImageBroken(false);
  }, [bannerImageUrl]);

  const setBanner = useCallback(
    (value: string) => {
      form.setValue("bannerImageUrl", value, { shouldValidate: true, shouldDirty: true });
    },
    [form]
  );

  const onModeChange = useCallback(
    (next: BannerMode) => {
      setMode(next);
      setUploadError(null);
      if (next === "none") {
        setBanner("");
      }
      if (next === "url" && bannerImageUrl?.startsWith("/uploads/")) {
        setBanner("");
      }
      if (next === "upload" && bannerImageUrl && !bannerImageUrl.startsWith("/uploads/")) {
        setBanner("");
      }
    },
    [bannerImageUrl, setBanner]
  );

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/uploads/event-banner", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      if (data.url) {
        setMode("upload");
        setBanner(data.url);
      }
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  const preview = publicEventTitleClasses(name.trim() || "Your program name");

  return (
    <div className="space-y-3">
      {compact ? (
        <p className="text-xs text-slate-500">Wide image, https link, or no image (title hero).</p>
      ) : (
        <p className="text-xs leading-relaxed text-slate-600">
          Choose a wide banner image, paste an <strong className="font-medium text-slate-800">https</strong> link, or use{" "}
          <strong className="font-medium text-slate-800">no image</strong>—the public page will show your program name in
          a styled hero. Title size on the public page adjusts for long names.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {(
          [
            ["none", "No image (title hero)"],
            ["url", "Image URL"],
            ["upload", "Upload image"]
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm",
              mode === value
                ? "border-slate-900 bg-white ring-2 ring-slate-900/10"
                : "border-slate-300/80 bg-white"
            )}
          >
            <input
              type="radio"
              name="bannerMode"
              className="h-4 w-4"
              checked={mode === value}
              onChange={() => onModeChange(value)}
            />
            {label}
          </label>
        ))}
      </div>

      {mode === "url" ? (
        <div>
          <label htmlFor="bannerImageUrl" className="mb-1 block text-sm font-medium text-slate-700">
            Banner image URL (21:9 recommended)
          </label>
          <Input
            id="bannerImageUrl"
            type="url"
            placeholder="https://cdn.example.com/hero.jpg"
            {...form.register("bannerImageUrl")}
          />
          {form.formState.errors.bannerImageUrl ? (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.bannerImageUrl.message}</p>
          ) : null}
          {bannerImageUrl?.trim() && !form.formState.errors.bannerImageUrl && !imageBroken ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerImageUrl.trim()}
                alt="Banner preview"
                className="max-h-48 w-full object-contain"
                onError={() => setImageBroken(true)}
              />
            </div>
          ) : null}
          {bannerImageUrl?.trim() && imageBroken ? (
            <p className="mt-2 text-xs text-amber-700">
              The image URL could not be loaded. Check that it is public and uses https.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "upload" ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Image file (JPG, PNG, or WebP, max 4MB)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
            disabled={uploadBusy}
            onChange={(e) => void onFileChange(e)}
          />
          {uploadBusy ? <p className="text-xs text-slate-500">Uploading…</p> : null}
          {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
          {bannerImageUrl?.startsWith("/uploads/") && !imageBroken ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-600">
                Current file: <code className="rounded bg-slate-100 px-1">{bannerImageUrl}</code>
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerImageUrl}
                  alt="Uploaded banner preview"
                  className="max-h-48 w-full object-contain"
                  onError={() => setImageBroken(true)}
                />
              </div>
            </div>
          ) : null}
          {bannerImageUrl?.startsWith("/uploads/") && imageBroken ? (
            <p className="text-xs text-amber-700">
              Preview could not load this file. If it persists after save, check server permissions for{" "}
              <code className="rounded bg-slate-100 px-0.5">public/uploads</code> or contact support.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "none" ? (
        <p className="text-xs text-slate-500">
          Banner image cleared. The registration experience will use a typographic hero with your program name.
        </p>
      ) : null}

      {mode === "none" && (name || "").trim().length > 0 ? (
        <div
          className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-800 via-slate-900 to-black p-5 text-white"
          style={{ minHeight: 120 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Preview (no image)</p>
          <h3 className={cn("mt-2 max-w-4xl text-balance text-white drop-shadow", preview.title)}>
            {(name || "").trim() || "Program name"}
          </h3>
          {preview.isLong ? (
            <p className="mt-2 text-xs text-zinc-400">Long names use a smaller type scale on the public page.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
