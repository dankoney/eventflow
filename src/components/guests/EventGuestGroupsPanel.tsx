"use client";

import { CirclePlus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import type { EventGuestGroupRow } from "@/lib/db/eventGuestGroups";
import {
  createEventGuestGroup,
  deleteEventGuestGroup,
  renameEventGuestGroup
} from "@/lib/actions/guestGroup.actions";
import { cn } from "@/lib/utils";

type EventGuestGroupsPanelProps = {
  eventId: string;
  groups: EventGuestGroupRow[];
  ungroupedCount: number;
};

const GROUP_FILTER_UNGROUPED = "__UNGROUPED__" as const;

function guestsHref(eventId: string, sp: URLSearchParams, updates: Record<string, string | null | undefined>) {
  const p = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v == null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `/events/${eventId}/guests?${s}` : `/events/${eventId}/guests`;
}

export function EventGuestGroupsPanel({ eventId, groups, ungroupedCount }: EventGuestGroupsPanelProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const activeGroup = sp.get("group");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setNotice(null);
    const res = await createEventGuestGroup({ eventId, name });
    setBusy(false);
    if (!res.success) {
      setNotice({ variant: "error", text: res.error });
      return;
    }
    setNewName("");
    setNotice({ variant: "success", text: "Group created." });
    refresh();
  }

  async function onRename(groupId: string) {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    const res = await renameEventGuestGroup({ eventId, groupId, name });
    setBusy(false);
    if (!res.success) {
      setNotice({ variant: "error", text: res.error });
      return;
    }
    setEditingId(null);
    setNotice({ variant: "success", text: "Group renamed." });
    refresh();
  }

  async function onDelete(groupId: string) {
    if (!window.confirm("Delete this group? Guests in it become ungrouped.")) return;
    setBusy(true);
    const res = await deleteEventGuestGroup({ eventId, groupId });
    setBusy(false);
    if (!res.success) {
      setNotice({ variant: "error", text: res.error });
      return;
    }
    if (activeGroup === groupId) {
      router.replace(guestsHref(eventId, new URLSearchParams(sp.toString()), { group: null }));
    }
    setNotice({ variant: "success", text: "Group deleted." });
    refresh();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-zinc-900">Groups</p>
      </div>
      {notice ? (
        <WorkspaceNotice className="mt-2" variant={notice.variant} onDismiss={() => setNotice(null)}>
          {notice.text}
        </WorkspaceNotice>
      ) : null}
      <form onSubmit={onCreate} className="mt-3 flex gap-2">
        <Input
          className="h-9 flex-1 text-sm"
          placeholder="New group name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-900 bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !newName.trim()}
          title="Add group"
          aria-label="Add group"
        >
          <CirclePlus className="h-4 w-4" aria-hidden />
        </button>
      </form>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          <Link
            href={guestsHref(eventId, new URLSearchParams(sp.toString()), { group: null })}
            scroll={false}
            className={cn(
              "flex items-center justify-between rounded-lg px-2 py-1.5 font-medium transition",
              !activeGroup
                ? "bg-zinc-900 text-white ring-1 ring-zinc-900"
                : "text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <span>All</span>
            <span className={cn("tabular-nums", !activeGroup ? "text-white/90" : "text-zinc-500")}>
              {ungroupedCount + groups.reduce((a, g) => a + g.guestCount, 0)}
            </span>
          </Link>
        </li>
        <li>
          <Link
            href={guestsHref(eventId, new URLSearchParams(sp.toString()), { group: GROUP_FILTER_UNGROUPED })}
            scroll={false}
            className={cn(
              "flex items-center justify-between rounded-lg px-2 py-1.5 font-medium transition",
              activeGroup === GROUP_FILTER_UNGROUPED
                ? "bg-zinc-900 text-white ring-1 ring-zinc-900"
                : "text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <span>Ungrouped</span>
            <span
              className={cn(
                "tabular-nums",
                activeGroup === GROUP_FILTER_UNGROUPED ? "text-white/90" : "text-zinc-500"
              )}
            >
              {ungroupedCount}
            </span>
          </Link>
        </li>
        {groups.map((g) => {
          const isActive = activeGroup === g.id;
          const isEditing = editingId === g.id;
          return (
            <li key={g.id} className="rounded-lg border border-transparent hover:border-zinc-100">
              {isEditing ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <Input
                    className="h-8 flex-1 text-sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    className="h-8 px-2 py-0 text-xs"
                    disabled={busy}
                    onClick={() => onRename(g.id)}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-2 py-0 text-xs"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 px-1 py-0.5">
                  <Link
                    href={guestsHref(eventId, new URLSearchParams(sp.toString()), { group: g.id })}
                    scroll={false}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1.5 font-medium transition",
                      isActive ? "bg-zinc-900 text-white ring-1 ring-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    <span className="truncate">{g.name}</span>
                    <span className={cn("shrink-0 tabular-nums", isActive ? "text-white/90" : "text-zinc-500")}>
                      {g.guestCount}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                    title="Rename"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(g.id);
                      setEditingName(g.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-700"
                    title="Delete group"
                    disabled={busy}
                    onClick={() => void onDelete(g.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
