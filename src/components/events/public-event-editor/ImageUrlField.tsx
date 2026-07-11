"use client";

import { ExternalLink, FolderOpen, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { MediaLibraryModal } from "@/components/media/MediaLibraryModal";
import { Button } from "@/components/ui/Button";
import type { MediaAssetListItem, MediaLibraryFilter } from "@/lib/media/types";
import { uploadMediaAssetClient } from "@/lib/media/uploadClient";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

type Props = {
  label?: string;
  hint?: string;
  placeholder?: string;
  value: string;
  disabled?: boolean;
  uploadBusy?: boolean;
  className?: string;
  /** Filter assets in the library picker. Defaults to images. */
  libraryFilter?: MediaLibraryFilter;
  /** Allow selecting multiple assets from the library picker. */
  libraryMultiple?: boolean;
  accept?: string;
  onChange: (url: string) => void;
  onLibrarySelectMany?: (assets: MediaAssetListItem[]) => void;
  /** Optional legacy upload handler; API upload is tried first. */
  onUpload?: (file: File) => Promise<string | null>;
};

function defaultAccept(filter: MediaLibraryFilter): string {
  if (filter === "video") return "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";
  if (filter === "document") return ".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip";
  if (filter === "all") return "image/*,video/mp4,video/webm,.pdf,.doc,.docx,.ppt,.pptx,.txt,.zip";
  return "image/jpeg,image/png,image/webp";
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

export function ImageUrlField({
  label,
  hint,
  placeholder = "https://… or upload",
  value,
  disabled,
  uploadBusy = false,
  className,
  libraryFilter = "image",
  libraryMultiple = false,
  accept,
  onChange,
  onLibrarySelectMany,
  onUpload
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; percent: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const busy = uploadBusy || localBusy;
  const fileAccept = accept ?? defaultAccept(libraryFilter);

  async function handleFile(file: File) {
    setUploadError(null);
    setLocalBusy(true);
    setUploadProgress({ fileName: file.name, percent: 0 });

    try {
      const res = await uploadMediaAssetClient(file, (progress) => setUploadProgress(progress));
      if (res.success && res.data) {
        onChange(res.data.publicUrl);
        return;
      }

      if (onUpload) {
        const url = await onUpload(file);
        if (url) {
          onChange(url);
          return;
        }
      }

      setUploadError(res.success === false ? res.error : "Upload failed. Try again or pick from the library.");
    } catch {
      setUploadError("Upload failed. Try again or pick from the library.");
    } finally {
      setLocalBusy(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className={cn("relative", className)}>
      {label ? <p className="mb-1 text-xs font-semibold text-zinc-600">{label}</p> : null}
      {hint ? <p className="mb-2 text-xs text-zinc-500">{hint}</p> : null}
      <div className="flex gap-2">
        <input
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          disabled={disabled || busy}
          onChange={(e) => {
            setUploadError(null);
            onChange(e.target.value);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 border-zinc-200 px-3"
          disabled={disabled || busy}
          title="Browse media library"
          onClick={() => setLibraryOpen(true)}
        >
          <FolderOpen className="h-4 w-4" aria-hidden />
          <span className="sr-only">Browse library</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 border-zinc-200 px-3"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          <span className="sr-only">Upload file</span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={fileAccept}
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void handleFile(file);
          }}
        />
      </div>

      {uploadProgress ? (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-800">Uploading…</p>
              <p className="truncate text-[11px] text-zinc-500">{uploadProgress.fileName}</p>
            </div>
            <span className="text-xs font-medium tabular-nums text-zinc-600">
              {uploadProgress.percent > 0 ? `${uploadProgress.percent}%` : "…"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-zinc-800 transition-all duration-200"
              style={{ width: `${Math.max(uploadProgress.percent, 4)}%` }}
            />
          </div>
        </div>
      ) : null}

      {!uploadProgress && busy ? <p className="mt-2 text-xs font-medium text-zinc-600">Uploading…</p> : null}
      {uploadError ? <p className="mt-2 text-xs font-medium text-red-600">{uploadError}</p> : null}

      {value ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          {isVideoUrl(value) ? (
            <video src={value} className="max-h-36 w-full object-contain" muted playsInline controls preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-36 w-full object-contain" />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-3 py-2">
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 max-w-full items-center gap-1 truncate text-xs font-medium text-zinc-700 hover:text-zinc-900"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{value}</span>
            </a>
            <Button
              type="button"
              variant="secondary"
              className="h-8 shrink-0 border-zinc-200 px-2 text-xs"
              disabled={disabled || busy}
              onClick={() => {
                setUploadError(null);
                onChange("");
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : null}

      <MediaLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mode="picker"
        filter={libraryFilter}
        multiple={libraryMultiple}
        title="Choose from library"
        onSelect={(asset) => onChange(asset.publicUrl)}
        onSelectMany={onLibrarySelectMany}
      />
    </div>
  );
}
