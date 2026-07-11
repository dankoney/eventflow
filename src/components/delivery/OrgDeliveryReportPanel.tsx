"use client";

import { AlertTriangle, Download, Mail, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DeliveryCleanupFilterBar, DeliveryLogFilterBar } from "@/components/delivery/DeliveryFilterBar";
import { DeliveryMessageModal } from "@/components/delivery/DeliveryMessageModal";
import {
  DeliveryTablePagination,
  useDeliveryPagination
} from "@/components/delivery/DeliveryTablePagination";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DELIVERY_ERROR_LABELS } from "@/lib/delivery/errorCodes";
import { deliveryRowDetailLabel } from "@/lib/delivery/display";
import type { DataQualitySeverity } from "@/lib/delivery/dataQuality";
import type { OrgDeliveryReport } from "@/lib/delivery/orgDeliveryReport";
import {
  collectDeliveryKindOptions,
  collectEventOptions,
  DEFAULT_CLEANUP_FILTERS,
  DEFAULT_LOG_FILTERS,
  filterAndSortCleanupGuests,
  filterAndSortDeliveryLog,
  type CleanupFilterState,
  type DeliveryLogFilterState
} from "@/lib/delivery/tableFilters";
import { cn, formatDate } from "@/lib/utils";

type ReportTab = "events" | "log" | "cleanup";

const SEVERITY_STYLES: Record<DataQualitySeverity, string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  error: "border-orange-300 bg-orange-50 text-orange-950",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-900"
};

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  SKIPPED: "bg-zinc-200 text-zinc-700"
};

function QualityTagBadge({ label, severity }: { label: string; severity: DataQualitySeverity }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        SEVERITY_STYLES[severity]
      )}
    >
      {label}
    </span>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-700"
      )}
    >
      {status}
    </span>
  );
}

type OrgDeliveryReportPanelProps = {
  report: OrgDeliveryReport;
};

export function OrgDeliveryReportPanel({ report }: OrgDeliveryReportPanelProps) {
  const [tab, setTab] = useState<ReportTab>("events");
  const [search, setSearch] = useState("");
  const [logFilters, setLogFilters] = useState<DeliveryLogFilterState>(DEFAULT_LOG_FILTERS);
  const [cleanupFilters, setCleanupFilters] = useState<CleanupFilterState>(DEFAULT_CLEANUP_FILTERS);
  const [selectedRow, setSelectedRow] = useState<{ rowId: string; eventId: string } | null>(null);

  const kindOptions = useMemo(
    () => collectDeliveryKindOptions(report.recentDeliveries),
    [report.recentDeliveries]
  );
  const eventOptions = useMemo(
    () => collectEventOptions(report.recentDeliveries),
    [report.recentDeliveries]
  );

  const filteredDeliveries = useMemo(
    () =>
      filterAndSortDeliveryLog(report.recentDeliveries, search, logFilters, (row) => [
        row.eventName
      ]),
    [report.recentDeliveries, search, logFilters]
  );

  const filteredCleanup = useMemo(
    () =>
      filterAndSortCleanupGuests(report.cleanupGuests, search, cleanupFilters, (g) => [
        g.eventName
      ]),
    [report.cleanupGuests, search, cleanupFilters]
  );

  const [eventsOnlyFilter, setEventsOnlyFilter] = useState(false);

  const filteredEvents = useMemo(() => {
    const base = eventsOnlyFilter ? report.eventsByIssues : report.events;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => e.eventName.toLowerCase().includes(q));
  }, [report.events, report.eventsByIssues, eventsOnlyFilter, search]);

  const eventsPagination = useDeliveryPagination(filteredEvents, [search, eventsOnlyFilter, tab]);
  const logPagination = useDeliveryPagination(filteredDeliveries, [search, logFilters, tab]);
  const cleanupPagination = useDeliveryPagination(filteredCleanup, [search, cleanupFilters, tab]);

  const { summary } = report;

  return (
    <section className="space-y-6">
      <DeliveryMessageModal
        open={selectedRow !== null}
        rowId={selectedRow?.rowId ?? null}
        eventId={selectedRow?.eventId ?? ""}
        onClose={() => setSelectedRow(null)}
      />
      {summary.criticalIssues > 0 || summary.failed > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Organization delivery alerts</p>
              <p className="mt-1 text-amber-900/90">
                {summary.failed > 0 ? `${summary.failed} failed attempt${summary.failed === 1 ? "" : "s"} across ${summary.eventCount} event${summary.eventCount === 1 ? "" : "s"}. ` : ""}
                {summary.guestsNeedingCleanup > 0
                  ? `${summary.guestsNeedingCleanup} guest${summary.guestsNeedingCleanup === 1 ? "" : "s"} may need contact data cleanup.`
                  : "Review events with delivery issues below."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href="/api/deliveries.csv"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Delivered</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.sent}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {summary.emailSent} email · {summary.smsSent} SMS
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Failed</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{summary.failed}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {summary.emailFailed} email · {summary.smsFailed} SMS
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Skipped</p>
          <p className="mt-1 text-2xl font-bold text-zinc-800">{summary.skipped}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Missing or invalid contact data</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Needs cleanup</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{summary.guestsNeedingCleanup}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {summary.criticalIssues > 0 ? `${summary.criticalIssues} critical` : `${summary.eventCount} events in scope`}
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["events", `Events (${report.events.length})`],
              ["log", `Delivery log (${report.recentDeliveries.length})`],
              ["cleanup", `Data cleanup (${report.cleanupGuests.length})`]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                tab === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {tab === "events" ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-zinc-700">
                All events in your scope. Delivery counts reflect your guest access.
              </p>
              {report.eventsByIssues.length > 0 &&
              report.eventsByIssues.length < report.events.length ? (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-950 shadow-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    {report.eventsByIssues.length} event
                    {report.eventsByIssues.length === 1 ? "" : "s"} with delivery issues
                  </span>
                  <button
                    type="button"
                    onClick={() => setEventsOnlyFilter(true)}
                    className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
                  >
                    Show issues only
                  </button>
                </p>
              ) : report.eventsByIssues.length === 0 ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  No delivery issues across your events.
                </p>
              ) : null}
            </div>
            <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-sm">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={eventsOnlyFilter}
                onChange={(e) => setEventsOnlyFilter(e.target.checked)}
              />
              <span className="text-zinc-700">Issues only</span>
            </label>
          </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Failed</th>
                  <th className="px-4 py-3">Skipped</th>
                  <th className="px-4 py-3">Cleanup</th>
                  <th className="px-4 py-3">Critical</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                      {eventsOnlyFilter
                        ? "No events with delivery issues in your scope."
                        : "No events in your scope."}
                    </td>
                  </tr>
                ) : (
                  eventsPagination.pagedItems.map((e) => (
                    <tr key={e.eventId} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-medium text-zinc-900">{e.eventName}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(e.eventDate)}</td>
                      <td className="px-4 py-3 tabular-nums text-red-700">{e.failed}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700">{e.skipped}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-700">{e.guestsNeedingCleanup}</td>
                      <td className="px-4 py-3 tabular-nums">{e.criticalIssues}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/events/${e.eventId}/deliveries`}
                          className="text-xs font-semibold text-indigo-700 hover:underline"
                        >
                          View report
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DeliveryTablePagination
            page={eventsPagination.page}
            pageCount={eventsPagination.pageCount}
            pageSize={eventsPagination.pageSize}
            total={eventsPagination.total}
            rangeStart={eventsPagination.rangeStart}
            rangeEnd={eventsPagination.rangeEnd}
            onPageChange={eventsPagination.setPage}
            onPageSizeChange={eventsPagination.setPageSize}
          />
        </div>
        </div>
      ) : null}

      {tab === "log" ? (
        <div className="space-y-3">
          <DeliveryLogFilterBar
            filters={logFilters}
            onChange={setLogFilters}
            kindOptions={kindOptions}
            eventOptions={eventOptions}
            resultCount={filteredDeliveries.length}
            totalCount={report.recentDeliveries.length}
          />
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                        No delivery attempts match your filters.
                      </td>
                    </tr>
                  ) : (
                    logPagination.pagedItems.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-zinc-100 align-top transition hover:bg-indigo-50/50"
                        onClick={() => setSelectedRow({ rowId: row.id, eventId: row.eventId })}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedRow({ rowId: row.id, eventId: row.eventId });
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                          {formatDate(row.at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/events/${row.eventId}/deliveries`}
                            className="font-medium text-indigo-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.eventName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/events/${row.eventId}/guests?guest=${row.guestId}`}
                            className="font-medium text-zinc-900 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.guestName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{row.kindLabel}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-zinc-700">
                            {row.channel === "EMAIL" ? (
                              <Mail className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {row.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <DeliveryStatusBadge status={row.status} />
                        </td>
                        <td className="max-w-xs px-4 py-3 text-xs text-zinc-600">
                          {row.status === "FAILED" || row.status === "SKIPPED" ? (
                            row.errorCode ? (
                              <span className="font-medium text-red-700">
                                {DELIVERY_ERROR_LABELS[row.errorCode]}
                              </span>
                            ) : (
                              (row.errorDetail ?? "—")
                            )
                          ) : (
                            <span className="font-medium text-indigo-700">
                              {deliveryRowDetailLabel(row)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DeliveryTablePagination
              page={logPagination.page}
              pageCount={logPagination.pageCount}
              pageSize={logPagination.pageSize}
              total={logPagination.total}
              rangeStart={logPagination.rangeStart}
              rangeEnd={logPagination.rangeEnd}
              onPageChange={logPagination.setPage}
              onPageSizeChange={logPagination.setPageSize}
            />
          </div>
        </div>
      ) : null}

      {tab === "cleanup" ? (
        <div className="space-y-3">
          <DeliveryCleanupFilterBar
            filters={cleanupFilters}
            onChange={setCleanupFilters}
            resultCount={filteredCleanup.length}
            totalCount={report.cleanupGuests.length}
          />
          <div className="overflow-hidden rounded-xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Alerts</th>
                  <th className="px-4 py-3">Failures</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCleanup.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                      No data quality issues detected for guests in scope.
                    </td>
                  </tr>
                ) : (
                  cleanupPagination.pagedItems.map((g) => (
                    <tr key={`${g.eventId}:${g.guestId}`} className="border-t border-zinc-100 align-top">
                      <td className="px-4 py-3 text-xs text-zinc-600">{g.eventName}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{g.guestName}</p>
                        {g.company ? <p className="text-xs text-zinc-500">{g.company}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        <p>{g.email ?? "—"}</p>
                        <p className="mt-0.5">{g.phone ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-md flex-wrap gap-1">
                          {g.tags.map((t) => (
                            <span key={t.id} title={t.hint}>
                              <QualityTagBadge label={t.label} severity={t.severity} />
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700">{g.failedAttempts}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/events/${g.eventId}/guests?guest=${g.guestId}`}
                          className="text-xs font-semibold text-indigo-700 hover:underline"
                        >
                          Edit guest
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DeliveryTablePagination
            page={cleanupPagination.page}
            pageCount={cleanupPagination.pageCount}
            pageSize={cleanupPagination.pageSize}
            total={cleanupPagination.total}
            rangeStart={cleanupPagination.rangeStart}
            rangeEnd={cleanupPagination.rangeEnd}
            onPageChange={cleanupPagination.setPage}
            onPageSizeChange={cleanupPagination.setPageSize}
          />
          </div>
        </div>
      ) : null}
    </section>
  );
}
