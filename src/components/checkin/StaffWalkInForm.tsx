"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BoothPhoneNumberField } from "@/components/checkin-booth/BoothPhoneNumberField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { registerStaffWalkInAndCheckIn } from "@/lib/actions/checkin.actions";
import { PHONE_DIAL_OPTIONS } from "@/lib/register/phoneDialOptions";

type StaffWalkInFormProps = {
  eventId: string;
  emailMandatory: boolean;
  disabled?: boolean;
};

export function StaffWalkInForm({ eventId, emailMandatory, disabled }: StaffWalkInFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDialCode, setPhoneDialCode] = useState(PHONE_DIAL_OPTIONS[0]?.value ?? "233");
  const [phoneNational, setPhoneNational] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await registerStaffWalkInAndCheckIn({
      eventId,
      name,
      email: email.trim() || undefined,
      phoneDialCode,
      phoneNational,
      company: company.trim() || undefined
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not register walk-in.");
      return;
    }
    setName("");
    setEmail("");
    setPhoneNational("");
    setCompany("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-4">
        <p className="text-sm font-medium text-indigo-950">Walk-in not on the list?</p>
        <p className="mt-1 text-sm text-indigo-900/80">
          Register someone who arrived without a prior registration. You can view their contact details only during
          this login session.
        </p>
        <Button
          type="button"
          className="mt-3"
          variant="secondary"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          Register walk-in
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-semibold text-zinc-900">Register walk-in</p>
      <p className="mt-1 text-xs text-zinc-600">
        Creates a new attendee, checks them in, and leaves them unassigned until marketing assigns a sales rep.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Full name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={busy || disabled} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            Email{emailMandatory ? "" : " (optional)"}
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={emailMandatory}
            disabled={busy || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Company (optional)</span>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} disabled={busy || disabled} />
        </label>
        <div className="sm:col-span-2">
          <BoothPhoneNumberField
            dialCode={phoneDialCode}
            national={phoneNational}
            onDialCodeChange={setPhoneDialCode}
            onNationalChange={setPhoneNational}
            disabled={busy || disabled}
            layout="row"
            compact
            hideHint
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || disabled}>
          {busy ? "Registering…" : "Register & check in"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
