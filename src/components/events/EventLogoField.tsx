"use client";

import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { EventFormValues } from "@/components/events/eventFormSchema";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type LogoMode = "none" | "url" | "upload";

function inferMode(url: string | undefined): LogoMode {
  const t = url?.trim() ?? "";
  if (!t) return "none";
  if (t.startsWith("/uploads/")) return "upload";
  return "url";
}

export type EventLogoFieldProps = {
  form: UseFormReturn<EventFormValues>;
  compact?: boolean;
};

export function EventLogoField({ form, compact = false }: EventLogoFieldProps) {
  const brandLogoUrl = form.watch("brandLogoUrl");
  const [mode, setMode] = useState<LogoMode>(() => inferMode(brandLogoUrl));
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setMode(inferMode(brandLogoUrl));
  }, [brandLogoUrl]);

  useEffect(() => {
    setImageBroken(false);
  }, [brandLogoUrl]);

  const setLogo = useCallback(
    (value: string) => {
      form.setValue("brandLogoUrl", value, { shouldValidate: true, shouldDirty: true });
    },
    [form]
  );

  const onModeChange = useCallback(
    (next: LogoMode) => {
      setMode(next);
      setUploadError(null);
      if (next === "none") {
        setLogo("");
      }
      if (next === "url" && brandLogoUrl?.startsWith("/uploads/")) {
        setLogo("");
      }
      if (next === "upload" && brandLogoUrl && !brandLogoUrl.startsWith("/uploads/")) {
        setLogo("");
      }
    },
    [brandLogoUrl, setLogo]
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
      const res = await fetch("/api/uploads/event-logo", {
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
        setLogo(data.url);
      }
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {!compact ? <p className="text-xs text-slate-500">Optional. Shown on the registration page.</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {(
          [
            ["none", "No logo"],
            ["url", "https link"],
            ["upload", "Upload file"]
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
              name="logoMode"
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
          <Input
            id="brandLogoUrl"
            type="url"
            placeholder="https://…"
            className="mt-0.5"
            {...form.register("brandLogoUrl")}
          />
          {form.formState.errors.brandLogoUrl ? (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.brandLogoUrl.message}</p>
          ) : null}
          {brandLogoUrl?.trim() && !form.formState.errors.brandLogoUrl && !imageBroken ? (
            <div className="mt-2 flex items-start gap-3">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoUrl.trim()}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => setImageBroken(true)}
                />
              </div>
            </div>
          ) : null}
          {brandLogoUrl?.trim() && imageBroken ? (
            <p className="mt-1 text-xs text-amber-700">Could not load image. Check the URL and https.</p>
          ) : null}
        </div>
      ) : null}

      {mode === "upload" ? (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="text-sm"
            disabled={uploadBusy}
            onChange={(e) => void onFileChange(e)}
          />
          {uploadBusy ? <p className="text-xs text-slate-500">Uploading…</p> : null}
          {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
          {brandLogoUrl?.startsWith("/uploads/") && !imageBroken ? (
            <div className="flex items-start gap-3">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => setImageBroken(true)}
                />
              </div>
            </div>
          ) : null}
          {brandLogoUrl?.startsWith("/uploads/") && imageBroken ? (
            <p className="text-xs text-amber-700">Preview could not load. Re-upload or use a link.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
