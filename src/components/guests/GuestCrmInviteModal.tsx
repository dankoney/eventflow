"use client";

import { Building2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { inviteOrgContactsToEvent } from "@/lib/actions/guest.actions";
import type { OrgContactGuestInvitePickRow } from "@/lib/db/orgContact";
import { cn } from "@/lib/utils";

type CrmGroupOption = { id: string; name: string };

type GuestCrmInviteModalProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: OrgContactGuestInvitePickRow[];
  groups: CrmGroupOption[];
  onInvited: () => void;
};

export function GuestCrmInviteModal({
  eventId,
  open,
  onOpenChange,
  contacts,
  groups,
  onInvited
}: GuestCrmInviteModalProps) {
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (groupId && !c.groupIds.includes(groupId)) return false;
      if (!qq) return true;
      const hay = [c.name, c.email, c.company ?? "", c.department ?? "", c.jobTitle ?? ""].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [contacts, q, groupId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((c) => c.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function submit() {
    if (selected.size === 0) return;
    setBusy(true);
    setResult(null);
    setErrors([]);
    const res = await inviteOrgContactsToEvent({ eventId, contactIds: [...selected] });
    setBusy(false);
    if (!res.success || !res.data) {
      setResult(res.error ?? "Invite failed");
      return;
    }
    const { invited, skipped, errors: errList } = res.data;
    setErrors(errList);
    setResult(`Added ${invited} guest(s).${skipped ? ` Skipped ${skipped}.` : ""}`);
    setSelected(new Set());
    onInvited();
  }

  function handleClose() {
    setQ("");
    setGroupId("");
    setSelected(new Set());
    setResult(null);
    setErrors([]);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      title="Invite from CRM"
      subtitle="Only contacts with a valid work email and international mobile format (for example +14155552671) are listed — both are required to send invitations. They are added with the same name, email, and phone as in the CRM."
      onClose={handleClose}
      size="xl"
      headerTone="dark"
    >
      <div className="space-y-4">
        {contacts.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            No CRM contacts in your organization yet.{" "}
            <Link href="/crm" className="font-semibold text-zinc-900 underline">
              Open CRM
            </Link>{" "}
            to import or add contacts.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search name, email, company…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-2 border-zinc-300 pl-9"
            />
          </div>
          <select
            className="h-10 min-w-[10rem] rounded-lg border-2 border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">All contacts</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-zinc-700">{selected.size} selected</span>
          <button type="button" className="text-zinc-800 underline" onClick={selectAllFiltered}>
            Select all in list ({filtered.length})
          </button>
          <button type="button" className="text-zinc-600 underline" onClick={clearSelection}>
            Clear
          </button>
        </div>

        <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-zinc-200">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">No contacts match this filter.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer gap-3 px-3 py-2.5 transition hover:bg-zinc-50",
                      selected.has(c.id) && "bg-zinc-100/80"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-zinc-300"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-zinc-900">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-600">{c.email}</span>
                      {(c.company || c.department) ? (
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {[c.company, c.department].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {result ? <p className="text-sm font-medium text-zinc-800">{result}</p> : null}
        {errors.length > 0 ? (
          <ul className="list-inside list-disc text-xs text-amber-900">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" className="border-zinc-200" onClick={handleClose}>
            Close
          </Button>
          <Button
            type="button"
            className="bg-zinc-900 font-semibold text-white hover:bg-zinc-800"
            disabled={busy || selected.size === 0}
            onClick={() => void submit()}
          >
            {busy ? "Inviting…" : `Invite ${selected.size} contact(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
