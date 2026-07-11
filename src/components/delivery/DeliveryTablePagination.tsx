"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export const DELIVERY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type DeliveryPageSize = (typeof DELIVERY_PAGE_SIZE_OPTIONS)[number];

export function useDeliveryPagination<T>(
  items: T[],
  /** When any dependency changes, reset to page 1 (e.g. filters, search, tab). */
  resetDeps: ReadonlyArray<unknown> = []
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DeliveryPageSize>(10);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit reset when filters/search change
  }, resetDeps);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize) || 1),
    [items.length, pageSize]
  );

  const activePage = Math.min(page, pageCount);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedItems = useMemo(
    () => items.slice((activePage - 1) * pageSize, activePage * pageSize),
    [items, activePage, pageSize]
  );

  const rangeStart = items.length === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const rangeEnd = items.length === 0 ? 0 : Math.min(activePage * pageSize, items.length);

  return {
    pagedItems,
    page: activePage,
    pageCount,
    pageSize,
    setPage,
    setPageSize,
    total: items.length,
    rangeStart,
    rangeEnd
  };
}

type DeliveryTablePaginationProps = {
  page: number;
  pageCount: number;
  pageSize: DeliveryPageSize;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: DeliveryPageSize) => void;
  className?: string;
};

export function DeliveryTablePagination({
  page,
  pageCount,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  className
}: DeliveryTablePaginationProps) {
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap text-xs sm:text-sm">
          Page {page} of {pageCount} · {rangeStart}–{rangeEnd} of {total}
        </span>
        <label className="flex items-center gap-1.5 text-xs sm:text-sm">
          <span className="text-zinc-500">Rows per page</span>
          <select
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs sm:text-sm"
            value={pageSize}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (DELIVERY_PAGE_SIZE_OPTIONS.includes(n as DeliveryPageSize)) {
                onPageSizeChange(n as DeliveryPageSize);
                onPageChange(1);
              }
            }}
          >
            {DELIVERY_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition",
            page <= 1
              ? "cursor-not-allowed border-zinc-200 text-zinc-400"
              : "border-zinc-200 text-zinc-800 hover:bg-white"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition",
            page >= pageCount
              ? "cursor-not-allowed border-zinc-200 text-zinc-400"
              : "border-zinc-200 text-zinc-800 hover:bg-white"
          )}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
