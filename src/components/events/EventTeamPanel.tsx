"use client";

import { Role } from "@prisma/client";
import { Shield, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  assignEventTeamMember,
  removeEventTeamMember,
  setRepPiiOverride
} from "@/lib/actions/eventTeam.actions";
import { isPiiOverrideActive, type PiiGrantDurationHours } from "@/lib/rbac/types";
import { cn, formatDate } from "@/lib/utils";

export type EventTeamMemberRow = {
  id: string;
  userId: string;
  role: Role;
  dataAccessOverride: boolean;
  toggleEnabledAt: string | null;
  toggleExpiresAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
  };
};

export type EventTeamCandidate = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

type EventTeamPanelProps = {
  eventId: string;
  eventEndDateIso: string;
  members: EventTeamMemberRow[];
  candidates: EventTeamCandidate[];
  canManageTeam: boolean;
  canTogglePii: boolean;
};

const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  MARKETING: "Marketing",
  SALES_REP: "Sales rep",
  STAFF: "Staff"
};

const GRANT_OPTIONS: Array<{ hours: PiiGrantDurationHours; label: string }> = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "72 hours (recommended)" },
  { hours: 168, label: "7 days" }
];

function displayName(user: { name: string | null; email: string }) {
  return user.name?.trim() || user.email;
}

export function EventTeamPanel({
  eventId,
  eventEndDateIso,
  members,
  candidates,
  canManageTeam,
  canTogglePii
}: EventTeamPanelProps) {
  const router = useRouter();
  const eventEndDate = new Date(eventEndDateIso);
  const postEventGrantMode = eventEndDate.getTime() + 2 * 60 * 60 * 1000 <= Date.now();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grantTargetUserId, setGrantTargetUserId] = useState<string | null>(null);
  const [grantDurationHours, setGrantDurationHours] = useState<PiiGrantDurationHours>(72);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const availableCandidates = useMemo(
    () => candidates.filter((c) => !memberIds.has(c.id)),
    [candidates, memberIds]
  );

  const selectedCandidate = availableCandidates.find((c) => c.id === selectedUserId);
  const grantTarget = members.find((m) => m.userId === grantTargetUserId);

  async function onAssign() {
    if (!selectedCandidate) return;
    setError(null);
    setBusy("assign");
    const res = await assignEventTeamMember({
      eventId,
      userId: selectedCandidate.id,
      role: selectedCandidate.role
    });
    setBusy(null);
    if (!res.success) {
      setError(res.error ?? "Could not add team member.");
      return;
    }
    setSelectedUserId("");
    router.refresh();
  }

  async function onRemove(userId: string) {
    setError(null);
    setBusy(`remove:${userId}`);
    const res = await removeEventTeamMember(eventId, userId);
    setBusy(null);
    if (!res.success) {
      setError(res.error ?? "Could not remove team member.");
      return;
    }
    router.refresh();
  }

  async function onRevokePii(userId: string) {
    setError(null);
    setBusy(`pii:${userId}`);
    const res = await setRepPiiOverride({ eventId, userId, enabled: false });
    setBusy(null);
    if (!res.success) {
      setError(res.error ?? "Could not revoke roster access.");
      return;
    }
    router.refresh();
  }

  async function onConfirmGrant() {
    if (!grantTargetUserId) return;
    setError(null);
    setBusy(`grant:${grantTargetUserId}`);
    const res = await setRepPiiOverride({
      eventId,
      userId: grantTargetUserId,
      enabled: true,
      grantDurationHours: postEventGrantMode ? grantDurationHours : undefined
    });
    setBusy(null);
    if (!res.success) {
      setError(res.error ?? "Could not grant roster access.");
      return;
    }
    setGrantTargetUserId(null);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Event team</p>
        <h2 className="mt-2 text-base font-semibold text-zinc-900">Team & data access</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Add people to this event&apos;s team so they can run check-in and kiosk tools. Sales reps on the team see
          masked contact details by default; marketing can grant temporary full-roster access when follow-up requires
          it.
        </p>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-6">
        {error ? (
          <WorkspaceNotice variant="error" onDismiss={() => setError(null)}>
            {error}
          </WorkspaceNotice>
        ) : null}

        {postEventGrantMode && canTogglePii ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-950">
            This event has ended. New roster-access grants use a rolling window from when you approve them (not the
            original event end time).
          </div>
        ) : null}

        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
            No one is on this team yet. Add staff for check-in and kiosk, or sales reps for guest relationships.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
            {members.map((member) => {
              const piiActive =
                member.role === Role.SALES_REP &&
                isPiiOverrideActive({
                  dataAccessOverride: member.dataAccessOverride,
                  toggleExpiresAt: member.toggleExpiresAt ? new Date(member.toggleExpiresAt) : null
                });
              const hadPriorGrant =
                member.role === Role.SALES_REP &&
                member.toggleExpiresAt &&
                !piiActive;

              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{displayName(member.user)}</p>
                    <p className="truncate text-sm text-zinc-500">{member.user.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {roleLabel[member.role]}
                      </span>
                      {member.role === Role.SALES_REP ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            piiActive
                              ? "bg-emerald-50 text-emerald-800"
                              : hadPriorGrant
                                ? "bg-amber-50 text-amber-800"
                                : "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {piiActive ? (
                            <Shield className="h-3 w-3" aria-hidden />
                          ) : (
                            <ShieldOff className="h-3 w-3" aria-hidden />
                          )}
                          {piiActive && member.toggleExpiresAt
                            ? `Full roster access until ${formatDate(new Date(member.toggleExpiresAt))}`
                            : hadPriorGrant
                              ? "Follow-up access expired"
                              : "Assigned guests only (default)"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {canTogglePii && member.role === Role.SALES_REP ? (
                      piiActive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 text-xs"
                          disabled={busy !== null}
                          onClick={() => void onRevokePii(member.userId)}
                        >
                          Revoke access
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 text-xs"
                          disabled={busy !== null}
                          onClick={() => {
                            setGrantDurationHours(72);
                            setGrantTargetUserId(member.userId);
                          }}
                        >
                          Grant roster access
                        </Button>
                      )
                    ) : null}
                    {canManageTeam ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 text-xs text-red-700 hover:bg-red-50"
                        disabled={busy !== null}
                        onClick={() => void onRemove(member.userId)}
                      >
                        <UserMinus className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canManageTeam ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 sm:p-4">
            <p className="text-sm font-medium text-zinc-900">Add to team</p>
            <p className="mt-1 text-xs text-zinc-600">
              Choose someone with a Sales rep or Staff workspace role. They must already have that role in your
              organization.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Team member</span>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                  value={selectedUserId}
                  disabled={busy !== null || availableCandidates.length === 0}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">
                    {availableCandidates.length === 0 ? "No eligible users left" : "Select a user…"}
                  </option>
                  {availableCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {displayName(c)} · {roleLabel[c.role]}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                className="h-10 shrink-0"
                disabled={!selectedCandidate || busy !== null}
                onClick={() => void onAssign()}
              >
                <UserPlus className="mr-2 inline h-4 w-4" aria-hidden />
                {busy === "assign" ? "Adding…" : "Add to team"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(grantTarget)}
        title="Grant full roster access"
        subtitle={
          grantTarget
            ? `Temporary access for ${displayName(grantTarget.user)} to view unmasked contact details across this event.`
            : undefined
        }
        onClose={() => setGrantTargetUserId(null)}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setGrantTargetUserId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void onConfirmGrant()}
            >
              {busy?.startsWith("grant:") ? "Granting…" : "Grant access"}
            </Button>
          </div>
        }
      >
        {postEventGrantMode ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              The event has ended. Choose how long this follow-up access should remain active.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Access duration</span>
              <select
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                value={grantDurationHours}
                onChange={(e) => setGrantDurationHours(Number(e.target.value) as PiiGrantDurationHours)}
              >
                {GRANT_OPTIONS.map((opt) => (
                  <option key={opt.hours} value={opt.hours}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Access will run until two hours after the event ends, unless you revoke it sooner.
          </p>
        )}
      </Modal>
    </section>
  );
}
