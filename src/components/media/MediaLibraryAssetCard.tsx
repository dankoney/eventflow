"use client";

import { ExternalLink, FileVideo, Film, ImageIcon, Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { MediaAssetListItem, MediaLibraryViewMode } from "@/lib/media/types";
import { cn } from "@/lib/utils";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function kindIcon(kind: MediaAssetListItem["kind"]) {
  if (kind === "VIDEO") return FileVideo;
  if (kind === "DOCUMENT") return Film;
  return ImageIcon;
}

export type AssetCardProps = {
  asset: MediaAssetListItem;
  viewMode: MediaLibraryViewMode;
  selected: boolean;
  selectable: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDeleting: boolean;
  onToggleSelect: () => void;
  onRenameChange: (v: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
};

export function MediaLibraryAssetCard({
  asset,
  viewMode,
  selected,
  selectable,
  isRenaming,
  renameValue,
  isDeleting,
  onToggleSelect,
  onRenameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete
}: AssetCardProps) {
  const Icon = kindIcon(asset.kind);

  const thumb =
    asset.kind === "IMAGE" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" />
    ) : asset.kind === "VIDEO" ? (
      <video src={asset.publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
    ) : (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-zinc-600">
        <Icon className="h-8 w-8 opacity-60" />
        <span className="text-[10px] font-bold uppercase tracking-wide">Document</span>
      </div>
    );

  const actions = (
    <div className="flex gap-1">
      <a
        href={asset.publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded p-1 text-zinc-500 hover:bg-zinc-200"
        title="Open"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <button type="button" className="rounded p-1 text-zinc-500 hover:bg-zinc-200" title="Rename" onClick={onStartRename}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 text-red-600 hover:bg-red-50"
        title="Delete"
        disabled={isDeleting}
        onClick={onDelete}
      >
        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-white p-2 transition",
          selected ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"
        )}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={onToggleSelect}
          className="shrink-0"
        />
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-200">{thumb}</div>
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex gap-1">
              <input
                className="h-8 min-w-0 flex-1 rounded border border-zinc-300 px-2 text-xs"
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveRename();
                  if (e.key === "Escape") onCancelRename();
                }}
              />
              <Button type="button" className="h-8 px-2 text-xs" onClick={onSaveRename}>
                Save
              </Button>
            </div>
          ) : (
            <p className="truncate text-sm font-semibold text-zinc-900">{asset.title}</p>
          )}
          <p className="text-[11px] text-zinc-500">
            {formatBytes(asset.sizeBytes)} · {formatDate(asset.createdAt)} ·{" "}
            {asset.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
          </p>
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border bg-zinc-50 transition",
        selected ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"
      )}
    >
      <div className="relative aspect-square bg-zinc-200">
        {thumb}
        <label className="absolute left-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-white/90 shadow">
          <input
            type="checkbox"
            checked={selected}
            disabled={!selectable}
            onChange={onToggleSelect}
            className="h-4 w-4"
          />
        </label>
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {actions}
        </div>
      </div>
      <div className="space-y-1 p-2.5">
        {isRenaming ? (
          <div className="flex gap-1">
            <input
              className="h-8 min-w-0 flex-1 rounded border border-zinc-300 px-2 text-xs"
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveRename();
                if (e.key === "Escape") onCancelRename();
              }}
            />
            <Button type="button" className="h-8 px-2 text-xs" onClick={onSaveRename}>
              Save
            </Button>
          </div>
        ) : (
          <p className="truncate text-xs font-semibold text-zinc-900">{asset.title}</p>
        )}
        <p className="text-[10px] text-zinc-500">
          {formatBytes(asset.sizeBytes)} · {formatDate(asset.createdAt)}
        </p>
      </div>
    </div>
  );
}
