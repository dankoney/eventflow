"use client";

import { FileText, Image as ImageIcon, Loader2, Plus, Trash2, Upload, UserPlus2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  createPollCandidate,
  createPollPosition,
  deletePollCandidate,
  deletePollPosition,
  updatePollCandidate,
  updatePollPosition
} from "@/lib/actions/poll.actions";

type CandidateView = {
  candidateId: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
  bio: string | null;
  resourceUrl: string | null;
  resourceName: string | null;
  votes: number;
};

type PositionView = {
  positionId: string;
  title: string;
  isUnopposed: boolean;
  totalVotes: number;
  candidates: CandidateView[];
};

type PollPositionsManagerProps = {
  eventId: string;
  positions: PositionView[];
};

/**
 * Admin CRUD surface for positions + candidates. Photo + resource uploads route through
 * authenticated API endpoints under `/api/uploads/poll-candidate-*` and store the file
 * under `/public/uploads/poll-candidates/`. The URLs are persisted on the candidate row.
 * Vote-locked positions surface a destructive-actions-disabled note rather than a
 * misleading delete affordance.
 */
export function PollPositionsManager({ eventId, positions }: PollPositionsManagerProps) {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Positions & candidates</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Add the positions guests will vote on, then publish each candidate&rsquo;s profile photo,
            current role, biography, and supporting document (CV / manifesto). A position with one
            candidate becomes a confidence vote (Yes / No / Abstain) on the public ballot.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {positions.map((position) => (
          <PositionCard key={position.positionId} eventId={eventId} position={position} />
        ))}
      </div>

      <AddPositionForm eventId={eventId} />
    </section>
  );
}

function PositionCard({
  eventId,
  position
}: {
  eventId: string;
  position: PositionView;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(position.title);
  const [renamePending, startRename] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  void eventId;

  const isVoteLocked = position.totalVotes > 0;

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || title.trim() === position.title) return;
    startRename(async () => {
      const res = await updatePollPosition({ positionId: position.positionId, title: title.trim() });
      if (!res.success) setError(res.error ?? "Could not rename this position.");
      else router.refresh();
    });
  }

  function handleDelete() {
    if (isVoteLocked) return;
    if (!window.confirm(`Delete "${position.title}" and its candidates?`)) return;
    setError(null);
    startDelete(async () => {
      const res = await deletePollPosition({ positionId: position.positionId });
      if (!res.success) setError(res.error ?? "Could not delete this position.");
      else router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-md text-base font-semibold"
            aria-label={`Title of position ${position.title}`}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={renamePending || !title.trim() || title.trim() === position.title}
            className="inline-flex items-center gap-2"
          >
            {renamePending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </form>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold uppercase tracking-wider text-zinc-700">
            {position.totalVotes} votes
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isVoteLocked || deletePending}
            title={
              isVoteLocked
                ? "Votes already cast. Close the poll instead of deleting."
                : "Delete position"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Delete
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        {position.candidates.length === 0
          ? "Add at least one candidate to publish this position."
          : position.isUnopposed
            ? "Unopposed · voters cast a confidence vote (Yes / No / Abstain)."
            : `${position.candidates.length} candidates — voters pick one.`}
      </p>

      <div className="mt-4 space-y-2">
        {position.candidates.map((candidate) => (
          <CandidateRow
            key={candidate.candidateId}
            candidate={candidate}
            voteLocked={isVoteLocked}
          />
        ))}
      </div>

      <div className="mt-4">
        <AddCandidateForm positionId={position.positionId} voteLocked={isVoteLocked} />
      </div>

      {error ? (
        <div className="mt-4">
          <WorkspaceNotice variant="error">{error}</WorkspaceNotice>
        </div>
      ) : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  voteLocked
}: {
  candidate: CandidateView;
  voteLocked: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(candidate.name);
  const [role, setRole] = useState(candidate.role ?? "");
  const [bio, setBio] = useState(candidate.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(candidate.photoUrl ?? "");
  const [resourceUrl, setResourceUrl] = useState(candidate.resourceUrl ?? "");
  const [resourceName, setResourceName] = useState(candidate.resourceName ?? "");
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Candidate name is required.");
      return;
    }
    startSave(async () => {
      const res = await updatePollCandidate({
        candidateId: candidate.candidateId,
        name: name.trim(),
        role: role.trim() || null,
        bio: bio.trim() || null,
        photoUrl: photoUrl.trim() || null,
        resourceUrl: resourceUrl.trim() || null,
        resourceName: resourceName.trim() || null
      });
      if (!res.success) {
        setError(res.error ?? "Could not save the candidate.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (voteLocked) return;
    if (!window.confirm(`Remove ${candidate.name} from the ballot?`)) return;
    setError(null);
    startDelete(async () => {
      const res = await deletePollCandidate({ candidateId: candidate.candidateId });
      if (!res.success) setError(res.error ?? "Could not remove this candidate.");
      else router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
        <CandidateAvatar photoUrl={candidate.photoUrl} name={candidate.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{candidate.name}</p>
          {candidate.role?.trim() ? (
            <p className="truncate text-[11px] text-zinc-600">{candidate.role}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            <span>
              {candidate.votes} vote{candidate.votes === 1 ? "" : "s"}
            </span>
            {candidate.resourceUrl?.trim() ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                <FileText className="h-3 w-3" aria-hidden /> doc attached
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setName(candidate.name);
              setRole(candidate.role ?? "");
              setBio(candidate.bio ?? "");
              setPhotoUrl(candidate.photoUrl ?? "");
              setResourceUrl(candidate.resourceUrl ?? "");
              setResourceName(candidate.resourceName ?? "");
              setEditing(true);
            }}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={voteLocked || deletePending}
            title={
              voteLocked ? "Votes already cast. Close the poll instead of deleting." : "Remove"
            }
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Candidate name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aisha Mensah"
            maxLength={160}
            required
          />
        </FieldLabel>
        <FieldLabel label="Current role / title">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Director of Global Strategy"
            maxLength={160}
          />
        </FieldLabel>
      </div>

      <CandidatePhotoField value={photoUrl} onChange={setPhotoUrl} />

      <FieldLabel label="Biography" hint="Plain text. Shown on the public candidate profile.">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Background, qualifications, vision — a few sentences voters can read at a glance."
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25"
        />
      </FieldLabel>

      <CandidateResourceField
        value={resourceUrl}
        onChange={setResourceUrl}
        name={resourceName}
        onNameChange={setResourceName}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={savePending} className="inline-flex items-center gap-2">
          {savePending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save candidate
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </form>
  );
}

function FieldLabel({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
        <span>
          {label}
          {required ? <span className="text-rose-600"> *</span> : null}
        </span>
        {hint ? <span className="text-[10px] font-medium normal-case tracking-normal text-zinc-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function CandidateAvatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (photoUrl?.trim()) {
    return (
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700">
      {initials || "?"}
    </span>
  );
}

function CandidatePhotoField({
  value,
  onChange
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/uploads/poll-candidate-photo", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Upload failed");
        return;
      }
      if (data.url) {
        setBroken(false);
        onChange(data.url);
      }
    } catch {
      setErr("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldLabel label="Candidate photo" hint="JPG, PNG, WebP, or GIF — up to 4MB">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          {value.trim() && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.trim()}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-zinc-400">
              <ImageIcon className="h-5 w-5" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50">
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              {busy ? "Uploading…" : value.startsWith("/uploads/") ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={busy}
                onChange={(e) => void onFileChange(e)}
              />
            </label>
            {value.trim() ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setBroken(false);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Clear
              </button>
            ) : null}
          </div>
          <Input
            value={value}
            onChange={(e) => {
              setBroken(false);
              onChange(e.target.value);
            }}
            placeholder="…or paste an https URL"
            maxLength={2048}
            className="text-xs"
          />
          {err ? <p className="text-xs text-rose-700">{err}</p> : null}
          {value.trim() && broken ? (
            <p className="text-[11px] text-amber-700">Preview failed — check the URL.</p>
          ) : null}
        </div>
      </div>
    </FieldLabel>
  );
}

function CandidateResourceField({
  value,
  onChange,
  name,
  onNameChange
}: {
  value: string;
  onChange: (next: string) => void;
  name: string;
  onNameChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/uploads/poll-candidate-resource", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      const data = (await res.json()) as { url?: string; originalName?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Upload failed");
        return;
      }
      if (data.url) {
        onChange(data.url);
        if (!name.trim() && data.originalName) {
          onNameChange(data.originalName);
        }
      }
    } catch {
      setErr("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldLabel label="Supporting document" hint="Manifesto / CV / bio · PDF, DOC, PPT, JPG, PNG · up to 10MB">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50">
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-3.5 w-3.5" aria-hidden />
            )}
            {busy ? "Uploading…" : value.startsWith("/uploads/") ? "Replace document" : "Upload document"}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png"
              className="hidden"
              disabled={busy}
              onChange={(e) => void onFileChange(e)}
            />
          </label>
          {value.trim() ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Preview
            </a>
          ) : null}
          {value.trim() ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                onNameChange("");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> Remove
            </button>
          ) : null}
        </div>
        {value.trim() ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="…or paste an https URL"
              maxLength={2048}
              className="text-xs"
            />
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Display label (e.g. Manifesto.pdf)"
              maxLength={160}
              className="text-xs"
            />
          </div>
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an https URL"
            maxLength={2048}
            className="text-xs"
          />
        )}
        {err ? <p className="text-xs text-rose-700">{err}</p> : null}
      </div>
    </FieldLabel>
  );
}

function AddPositionForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createPollPosition({ eventId, title: title.trim() });
      if (!res.success) {
        setError(res.error ?? "Could not add this position.");
        return;
      }
      setTitle("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4 sm:flex-row sm:items-center"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a position (e.g. President)"
        maxLength={160}
        className="flex-1"
      />
      <Button type="submit" disabled={pending || !title.trim()} className="inline-flex items-center gap-2 sm:w-auto">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        Add position
      </Button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </form>
  );
}

function AddCandidateForm({
  positionId,
  voteLocked
}: {
  positionId: string;
  voteLocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (voteLocked) {
    return (
      <p className="text-xs text-zinc-500">
        Candidates are locked once votes have been cast. Close this poll and start fresh if you need
        to amend the ballot.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
      >
        <UserPlus2 className="h-3.5 w-3.5" aria-hidden />
        Add candidate
      </button>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Candidate name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createPollCandidate({
        positionId,
        name: name.trim(),
        role: role.trim() || null,
        photoUrl: photoUrl.trim() || null,
        bio: bio.trim() || null,
        resourceUrl: resourceUrl.trim() || null,
        resourceName: resourceName.trim() || null
      });
      if (!res.success) {
        setError(res.error ?? "Could not add this candidate.");
        return;
      }
      setOpen(false);
      setName("");
      setRole("");
      setPhotoUrl("");
      setBio("");
      setResourceUrl("");
      setResourceName("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Candidate name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aisha Mensah"
            maxLength={160}
            required
          />
        </FieldLabel>
        <FieldLabel label="Current role / title">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Director of Global Strategy"
            maxLength={160}
          />
        </FieldLabel>
      </div>

      <CandidatePhotoField value={photoUrl} onChange={setPhotoUrl} />

      <FieldLabel label="Biography" hint="Plain text. Shown on the public candidate profile.">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Background, qualifications, vision — a few sentences voters can read at a glance."
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25"
        />
      </FieldLabel>

      <CandidateResourceField
        value={resourceUrl}
        onChange={setResourceUrl}
        name={resourceName}
        onNameChange={setResourceName}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} className="inline-flex items-center gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          Add candidate
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </form>
  );
}
