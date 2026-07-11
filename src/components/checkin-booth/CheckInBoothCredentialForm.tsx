"use client";

import { ChevronLeft, QrCode } from "lucide-react";
import { useState, type FormEvent } from "react";

import { BoothPhoneNumberField } from "@/components/checkin-booth/BoothPhoneNumberField";
import {
  kioskBackButtonClass,
  kioskCardClass,
  kioskInputClass,
  kioskLabelClass,
  kioskPrimaryButtonClass
} from "@/components/checkin-booth/kioskClasses";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DEFAULT_PHONE_DIAL } from "@/lib/register/phoneDialOptions";
import { cn } from "@/lib/utils";

type CheckInBoothCredentialFormProps = {
  busy: boolean;
  error: string | null;
  rejectMessage: string | null;
  onBack: () => void;
  onOpenQrScan: () => void;
  onSubmitEmail: (email: string) => void;
  onSubmitPhone: (phoneDialCode: string, phoneNational: string) => void;
};

export function CheckInBoothCredentialForm({
  busy,
  error,
  rejectMessage,
  onBack,
  onOpenQrScan,
  onSubmitEmail,
  onSubmitPhone
}: CheckInBoothCredentialFormProps) {
  const [email, setEmail] = useState("");
  const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_PHONE_DIAL);
  const [phoneNational, setPhoneNational] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhoneError(null);
    onSubmitEmail(email.trim());
  }

  function handlePhoneSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhoneError(null);
    if (!phoneNational.trim()) {
      setPhoneError("Mobile number is required.");
      return;
    }
    onSubmitPhone(phoneDialCode, phoneNational.trim());
  }

  return (
    <div className="mx-auto w-full space-y-6">
      <button type="button" onClick={onBack} className={kioskBackButtonClass}>
        <ChevronLeft className="h-6 w-6" aria-hidden />
        Back
      </button>

      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0040e0]">Pre-registered</p>
        <h2 className="mt-2 text-2xl font-bold text-[#151c27] sm:text-3xl">Find your registration</h2>
        <p className="mx-auto mt-2 max-w-3xl text-base leading-relaxed text-[#434656]">
          Check in with email, mobile, or scan the QR code from your confirmation email.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
        <form onSubmit={handleEmailSubmit} className={kioskCardClass}>
          <div>
            <h3 className="text-xl font-semibold text-[#151c27]">Email</h3>
            <p className="mt-1 text-sm text-[#434656]">Registration email address</p>
          </div>
          <div>
            <label className={kioskLabelClass}>Email</label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={kioskInputClass}
              disabled={busy}
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className={cn(kioskPrimaryButtonClass, "mt-auto bg-[#0040e0] hover:bg-[#0035be]")}
          >
            {busy ? "Checking…" : "Check in with email"}
          </Button>
        </form>

        <form onSubmit={handlePhoneSubmit} className={kioskCardClass}>
          <div>
            <h3 className="text-xl font-semibold text-[#151c27]">Mobile</h3>
            <p className="mt-1 text-sm text-[#434656]">Number on your registration</p>
          </div>
          <BoothPhoneNumberField
            dialCode={phoneDialCode}
            national={phoneNational}
            onDialCodeChange={setPhoneDialCode}
            onNationalChange={setPhoneNational}
            error={phoneError ?? undefined}
            disabled={busy}
            layout="stack"
          />
          <Button
            type="submit"
            disabled={busy}
            className={cn(kioskPrimaryButtonClass, "mt-auto bg-[#0040e0] hover:bg-[#0035be]")}
          >
            {busy ? "Checking…" : "Check in with mobile"}
          </Button>
        </form>

        <button
          type="button"
          disabled={busy}
          onClick={onOpenQrScan}
          className={cn(
            kioskCardClass,
            "group min-h-[18rem] cursor-pointer transition hover:border-[#0040e0] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#0040e0]/30 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <div className="shrink-0 text-center">
            <h3 className="text-xl font-semibold text-[#151c27]">Scan QR code</h3>
            <p className="mt-1 text-sm text-[#434656]">From your registration confirmation email</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-4">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#dde1ff] shadow-inner transition group-hover:scale-105 group-hover:bg-[#d0d8ff] group-active:scale-95">
              <QrCode className="h-20 w-20 text-[#0040e0]" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="mt-5 text-base font-semibold text-[#0040e0]">Tap to open camera</p>
          </div>
        </button>
      </div>

      {rejectMessage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-base text-amber-950">
          {rejectMessage}
        </p>
      ) : null}
      {error ? <p className="text-center text-base text-red-600">{error}</p> : null}
    </div>
  );
}
