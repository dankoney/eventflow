"use client";

import { FolderOpen, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { listMediaAssets } from "@/lib/actions/mediaLibrary.actions";
import type { MediaAssetListItem } from "@/lib/media/types";

import { MediaLibraryModal } from "./MediaLibraryModal";

type Props = {
  onOpenUpload?: () => void;
};

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibraryHub({ onOpenUpload }: Props) {
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMediaAssets("all");
    setLoading(false);
    if (res.success && res.data) setAssets(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-900">
            <FolderOpen className="h-6 w-6" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight">Media library</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Central storage for images, videos, and documents. Upload once and reuse across events, public pages,
            and spotlight backgrounds.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="border-zinc-200" onClick={() => setManageOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Upload & manage
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading assets…</p>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="font-medium text-zinc-800">Your library is empty</p>
          <p className="mt-1 text-sm text-zinc-500">Upload images and videos to reuse across the platform.</p>
          <Button type="button" className="mt-4" onClick={() => (onOpenUpload ? onOpenUpload() : setManageOpen(true))}>
            Upload files
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="aspect-square bg-zinc-100">
                {asset.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" />
                ) : asset.kind === "VIDEO" ? (
                  <video src={asset.publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-bold uppercase text-zinc-500">
                    Doc
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold text-zinc-900">{asset.title}</p>
                <p className="text-[10px] text-zinc-500">{formatBytes(asset.sizeBytes)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <MediaLibraryModal
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          void load();
        }}
        mode="manage"
        filter="all"
        multiple
        title="Manage media"
      />
    </div>
  );
}
