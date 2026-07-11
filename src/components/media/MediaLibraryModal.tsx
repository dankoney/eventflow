"use client";

import { Grid3X3, List, Loader2, Search, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { deleteMediaAsset, listMediaAssets, renameMediaAsset } from "@/lib/actions/mediaLibrary.actions";
import { acceptForMediaFilter, validateFileForUpload } from "@/lib/media/mime";
import type {
  MediaAssetListItem,
  MediaDateFilter,
  MediaLibraryFilter,
  MediaLibrarySort,
  MediaLibraryViewMode
} from "@/lib/media/types";
import { assetMatchesFilter } from "@/lib/media/types";
import { uploadMediaAssetClient } from "@/lib/media/uploadClient";
import { cn } from "@/lib/utils";

import { MediaLibraryAssetCard } from "./MediaLibraryAssetCard";

type UploadState = {
  fileName: string;
  percent: number;
  current: number;
  total: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mode?: "picker" | "manage";
  filter?: MediaLibraryFilter;
  multiple?: boolean;
  onSelect?: (asset: MediaAssetListItem) => void;
  onSelectMany?: (assets: MediaAssetListItem[]) => void;
  title?: string;
};

export function MediaLibraryModal({
  open,
  onClose,
  mode = "picker",
  filter = "all",
  multiple = false,
  onSelect,
  onSelectMany,
  title = "Media library"
}: Props) {
  const uploadInputId = useId();
  const [assets, setAssets] = useState<MediaAssetListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<MediaLibraryFilter>(filter);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<MediaLibrarySort>("date-desc");
  const [dateFilter, setDateFilter] = useState<MediaDateFilter>("all");
  const [viewMode, setViewMode] = useState<MediaLibraryViewMode>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const ignoreBackdropUntilRef = useRef(0);
  const uploadingRef = useRef(false);

  const uploading = uploadState !== null;
  const pickerMulti = mode === "picker" && multiple;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listMediaAssets(activeFilter, {
      search: debouncedSearch || undefined,
      sort,
      dateFilter
    });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not load media.");
      return;
    }
    setAssets(res.data);
  }, [activeFilter, debouncedSearch, sort, dateFilter]);

  useEffect(() => {
    if (!open) return;
    setActiveFilter(filter);
    setError(null);
    setSuccess(null);
    setRenamingId(null);
    setUploadState(null);
    setSelectedIds(new Set());
    uploadingRef.current = false;
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const selectableAssets = assets.filter((a) => mode !== "picker" || assetMatchesFilter(a, filter));
  const allSelectableSelected =
    selectableAssets.length > 0 && selectableAssets.every((a) => selectedIds.has(a.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableAssets.map((a) => a.id)));
  }

  function openFilePicker() {
    ignoreBackdropUntilRef.current = Date.now() + 800;
    document.getElementById(uploadInputId)?.click();
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length || uploadingRef.current) return;

    uploadingRef.current = true;
    setError(null);
    setSuccess(null);
    let lastUploaded: MediaAssetListItem | null = null;
    let uploadedCount = 0;

    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        const check = validateFileForUpload(file, "all");
        if (!check.ok) {
          setError(check.error);
          continue;
        }

        setUploadState({ fileName: file.name, percent: 0, current: i + 1, total: list.length });

        const res = await uploadMediaAssetClient(file, ({ fileName, percent }) => {
          setUploadState({ fileName, percent, current: i + 1, total: list.length });
        });

        if (!res.success) {
          setError(res.error ?? "Upload failed.");
          return;
        }

        lastUploaded = res.data;
        uploadedCount += 1;
      }
    } finally {
      uploadingRef.current = false;
      setUploadState(null);
    }

    await load();

    if (uploadedCount > 0) {
      setSuccess(
        uploadedCount === 1 && lastUploaded
          ? `Uploaded “${lastUploaded.title}”.`
          : `Uploaded ${uploadedCount} files.`
      );
      if (lastUploaded) setSelectedIds(new Set([lastUploaded.id]));
    }
  }

  async function handleDelete(asset: MediaAssetListItem) {
    if (!confirm(`Delete “${asset.title}” permanently?`)) return;
    setDeletingId(asset.id);
    const res = await deleteMediaAsset(asset.id);
    setDeletingId(null);
    if (!res.success) {
      setError(res.error ?? "Delete failed.");
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(asset.id);
      return next;
    });
    setSuccess(`Deleted “${asset.title}”.`);
    await load();
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length || !confirm(`Delete ${ids.length} selected items permanently?`)) return;
    for (const id of ids) await deleteMediaAsset(id);
    setSelectedIds(new Set());
    setSuccess(`Deleted ${ids.length} items.`);
    await load();
  }

  async function saveRename(assetId: string) {
    const title = renameValue.trim();
    if (!title) return;
    const res = await renameMediaAsset({ assetId, title });
    if (!res.success) {
      setError(res.error ?? "Rename failed.");
      return;
    }
    setRenamingId(null);
    setSuccess("Asset renamed.");
    await load();
  }

  function applySelection() {
    const chosen = assets.filter((a) => selectedIds.has(a.id) && assetMatchesFilter(a, filter));
    if (!chosen.length) return;
    if (pickerMulti && onSelectMany) {
      onSelectMany(chosen);
      onClose();
      return;
    }
    if (onSelect && chosen[0]) {
      onSelect(chosen[0]);
      onClose();
    }
  }

  function tryClose() {
    if (uploading || Date.now() < ignoreBackdropUntilRef.current) return;
    onClose();
  }

  if (!open) return null;

  const cardProps = (asset: MediaAssetListItem) => ({
    asset,
    viewMode,
    selected: selectedIds.has(asset.id),
    selectable: mode === "manage" || assetMatchesFilter(asset, filter),
    isRenaming: renamingId === asset.id,
    renameValue,
    isDeleting: deletingId === asset.id,
    onToggleSelect: () => toggleSelected(asset.id),
    onRenameChange: setRenameValue,
    onStartRename: () => {
      setRenamingId(asset.id);
      setRenameValue(asset.title);
    },
    onSaveRename: () => void saveRename(asset.id),
    onCancelRename: () => setRenamingId(null),
    onDelete: () => void handleDelete(asset)
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onMouseDown={tryClose} />
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
            <p className="text-xs text-zinc-500">Search, filter, upload, and manage workspace media.</p>
          </div>
          <button type="button" onClick={tryClose} disabled={uploading} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-zinc-100 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "image", "video", "document"] as const).map((f) => (
              <button
                key={f}
                type="button"
                disabled={uploading}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  activeFilter === f ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                {f === "all" ? "All media" : f === "image" ? "Images" : f === "video" ? "Videos" : "Documents"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search media…"
                className="h-9 w-full rounded-lg border border-zinc-300 pl-9 pr-3 text-sm outline-none focus:border-zinc-900"
              />
            </div>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as MediaDateFilter)} className="h-9 rounded-lg border border-zinc-300 px-2 text-xs">
              <option value="all">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="365d">Last year</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as MediaLibrarySort)} className="h-9 rounded-lg border border-zinc-300 px-2 text-xs">
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="title-asc">Title A–Z</option>
              <option value="title-desc">Title Z–A</option>
              <option value="size-desc">Largest first</option>
              <option value="size-asc">Smallest first</option>
            </select>
            <div className="flex rounded-lg border border-zinc-300 p-0.5">
              <button type="button" onClick={() => setViewMode("grid")} className={cn("rounded-md p-1.5", viewMode === "grid" ? "bg-zinc-900 text-white" : "text-zinc-600")}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setViewMode("list")} className={cn("rounded-md p-1.5", viewMode === "list" ? "bg-zinc-900 text-white" : "text-zinc-600")}>
                <List className="h-4 w-4" />
              </button>
            </div>
            <label htmlFor={uploadInputId} className={cn("inline-flex h-9 cursor-pointer items-center rounded-md bg-slate-100 px-3 text-sm font-medium", uploading && "opacity-50")}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Upload files
            </label>
            <input
              id={uploadInputId}
              type="file"
              multiple
              className="sr-only"
              accept={acceptForMediaFilter("all")}
              onChange={(e) => {
                const files = e.target.files;
                e.target.value = "";
                ignoreBackdropUntilRef.current = Date.now() + 800;
                if (files?.length) void handleFiles(files);
              }}
            />
          </div>
        </div>

        <div className="relative min-h-[300px] flex-1 overflow-y-auto p-5" onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files); }} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}>
          {loading && !uploading ? (
            <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : assets.length === 0 && !uploading ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 text-center">
              <p className="text-sm font-medium text-zinc-700">No media items found</p>
              <Button type="button" className="mt-4" onClick={openFilePicker}>Upload files</Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((asset) => (
                <MediaLibraryAssetCard key={asset.id} {...cardProps(asset)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map((asset) => (
                <MediaLibraryAssetCard key={asset.id} {...cardProps(asset)} />
              ))}
            </div>
          )}
          {uploadState ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold">Uploading ({uploadState.current}/{uploadState.total})…</p>
                    <p className="truncate text-xs text-zinc-500">{uploadState.fileName}</p>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${Math.max(uploadState.percent, 4)}%` }} />
                </div>
                <p className="mt-2 text-center text-xs tabular-nums">{uploadState.percent > 0 ? `${uploadState.percent}%` : "Starting…"}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={allSelectableSelected} onChange={toggleSelectAll} disabled={!selectableAssets.length} />
              Select all
            </label>
            <span>{selectedIds.size} selected · {assets.length} shown</span>
            {selectedIds.size > 0 ? (
              <button type="button" className="font-medium text-red-600" onClick={() => void handleBulkDelete()}>Delete selected</button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={tryClose} disabled={uploading}>Cancel</Button>
            {mode === "picker" ? (
              <Button type="button" disabled={!selectedIds.size || uploading} onClick={applySelection}>
                {pickerMulti ? `Add selected (${selectedIds.size})` : "Use selected"}
              </Button>
            ) : null}
          </div>
        </div>

        {success ? <p className="border-t border-emerald-100 bg-emerald-50 px-5 py-2 text-xs text-emerald-800">{success}</p> : null}
        {error ? <p className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
