import type { MediaAssetKind } from "@prisma/client";

export type MediaAssetListItem = {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: MediaAssetKind;
  publicUrl: string;
  createdAt: string;
};

export type MediaLibraryFilter = "all" | "image" | "video" | "document";

export type MediaLibrarySort =
  | "date-desc"
  | "date-asc"
  | "title-asc"
  | "title-desc"
  | "size-desc"
  | "size-asc";

export type MediaDateFilter = "all" | "7d" | "30d" | "365d";

export type MediaLibraryQuery = {
  search?: string;
  sort?: MediaLibrarySort;
  dateFilter?: MediaDateFilter;
};

export type MediaLibraryViewMode = "grid" | "list";

export function mediaFilterToKind(filter: MediaLibraryFilter): MediaAssetKind | null {
  if (filter === "image") return "IMAGE";
  if (filter === "video") return "VIDEO";
  if (filter === "document") return "DOCUMENT";
  return null;
}

export function assetMatchesFilter(asset: MediaAssetListItem, filter: MediaLibraryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "image") return asset.kind === "IMAGE";
  if (filter === "video") return asset.kind === "VIDEO";
  return asset.kind === "DOCUMENT";
}
