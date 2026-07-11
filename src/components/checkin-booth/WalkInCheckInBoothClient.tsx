"use client";

import { EventBlueprintTemplate } from "@prisma/client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { CheckInBoothAlreadyCheckedIn } from "@/components/checkin-booth/CheckInBoothAlreadyCheckedIn";
import { CheckInBoothCredentialForm } from "@/components/checkin-booth/CheckInBoothCredentialForm";
import { CheckInBoothGroupForm } from "@/components/checkin-booth/CheckInBoothGroupForm";
import { CheckInBoothQrFullscreen } from "@/components/checkin-booth/CheckInBoothQrFullscreen";
import { CheckInBoothShell } from "@/components/checkin-booth/CheckInBoothShell";
import { CheckInBoothSuccess } from "@/components/checkin-booth/CheckInBoothSuccess";
import type { BoothWalkInFormValues } from "@/components/checkin-booth/CheckInBoothWalkInForm";
import { CheckInBoothWalkInForm } from "@/components/checkin-booth/CheckInBoothWalkInForm";
import { CheckInBoothWelcome } from "@/components/checkin-booth/CheckInBoothWelcome";
import type { BoothCheckInChannel } from "@/components/checkin-booth/formatBoothCheckInTime";
import {
  boothCheckInByEmail,
  boothCheckInByPhoneLookup,
  boothCheckInByQr,
  boothCheckInParty,
  boothWalkInCheckIn,
  type BoothPartyMember
} from "@/lib/actions/walkInBooth.actions";
import type { RegistrationProfile } from "@/lib/event-wizard/registrationProfile";

type Phase = "welcome" | "preregistered" | "scan-qr" | "select-party" | "walkin" | "success" | "already-signed-in";

type WalkInPrefill = {
  email?: string;
  phone?: string;
};

type PartyContext = {
  groupName: string | null;
  primaryGuestId: string;
  members: BoothPartyMember[];
};

type WalkInCheckInBoothClientProps = {
  orgSlug: string;
  orgName: string;
  eventId: string;
  eventName: string;
  logoUrl: string | null;
  blueprintTemplate: EventBlueprintTemplate;
  registrationProfile: RegistrationProfile;
  allowFlashEntry: boolean;
  emailMandatoryForRegistration?: boolean;
};

const AUTO_RESET_MS = 8000;
const AUTO_RESET_ALREADY_MS = 12000;

export function WalkInCheckInBoothClient({
  orgSlug,
  orgName,
  eventId,
  eventName,
  logoUrl,
  blueprintTemplate,
  registrationProfile,
  allowFlashEntry,
  emailMandatoryForRegistration = true
}: WalkInCheckInBoothClientProps) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [successName, setSuccessName] = useState("");
  const [successDetail, setSuccessDetail] = useState<string | null>(null);
  const [checkedInAt, setCheckedInAt] = useState("");
  const [checkInChannel, setCheckInChannel] = useState<BoothCheckInChannel>("email");
  const [walkInPrefill, setWalkInPrefill] = useState<WalkInPrefill>({});
  const [partyContext, setPartyContext] = useState<PartyContext | null>(null);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForNextGuest = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setPhase("welcome");
    setError(null);
    setQrError(null);
    setRejectMessage(null);
    setSuccessName("");
    setSuccessDetail(null);
    setCheckedInAt("");
    setWalkInPrefill({});
    setPartyContext(null);
    setBusy(false);
  }, []);

  const scheduleAutoReset = useCallback(
    (ms: number) => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        resetForNextGuest();
      }, ms);
    },
    [resetForNextGuest]
  );

  const showCheckInOutcome = useCallback(
    (
      guestName: string,
      at: string,
      channel: BoothCheckInChannel,
      already: boolean,
      detail?: string | null
    ) => {
      setSuccessName(guestName);
      setSuccessDetail(detail ?? null);
      setCheckedInAt(at);
      setCheckInChannel(channel);
      setPhase(already ? "already-signed-in" : "success");
      setError(null);
      setQrError(null);
      setRejectMessage(null);
      setPartyContext(null);
      scheduleAutoReset(already ? AUTO_RESET_ALREADY_MS : AUTO_RESET_MS);
    },
    [scheduleAutoReset]
  );

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  function applyLookupResult(
    res: Awaited<ReturnType<typeof boothCheckInByEmail>>,
    channel: BoothCheckInChannel
  ) {
    if (!res.success || !res.data) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (res.data.kind === "select_party") {
      setPartyContext({
        groupName: res.data.groupName,
        primaryGuestId: res.data.primaryGuestId,
        members: res.data.members
      });
      setPhase("select-party");
      return;
    }
    if (res.data.kind === "checked_in") {
      showCheckInOutcome(
        res.data.guestName,
        res.data.checkedInAt,
        channel,
        res.data.alreadyCheckedIn
      );
      return;
    }
    if (res.data.kind === "rejected") {
      setRejectMessage(res.data.message);
      return;
    }
    setWalkInPrefill({
      email: res.data.prefillEmail,
      phone: res.data.prefillPhone
    });
    setPhase("walkin");
  }

  async function handleEmailLookup(email: string) {
    setError(null);
    setRejectMessage(null);
    setQrError(null);
    setBusy(true);
    const res = await boothCheckInByEmail({ orgSlug, eventId, email });
    setBusy(false);
    applyLookupResult(res, "email");
  }

  async function handlePhoneLookup(phoneDialCode: string, phoneNational: string) {
    setError(null);
    setRejectMessage(null);
    setQrError(null);
    setBusy(true);
    const res = await boothCheckInByPhoneLookup({
      orgSlug,
      eventId,
      phoneDialCode,
      phoneNational
    });
    setBusy(false);
    applyLookupResult(res, "phone");
  }

  async function handleQrScan(qrPayload: string) {
    setError(null);
    setRejectMessage(null);
    setQrError(null);
    setBusy(true);
    const res = await boothCheckInByQr({ orgSlug, eventId, qrPayload });
    setBusy(false);
    if (!res.success || !res.data) {
      setQrError(res.error ?? "Could not check in with this QR code.");
      return;
    }
    applyLookupResult(res, "qr");
  }

  async function handlePartySubmit(guestIds: string[]) {
    if (!partyContext) return;
    setError(null);
    setBusy(true);
    const res = await boothCheckInParty({ orgSlug, eventId, guestIds });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not complete group check-in.");
      return;
    }

    const { checkedInNames, alreadyCheckedInNames, failed } = res.data;
    if (failed.length > 0) {
      setError(`${failed[0]?.name ?? "A guest"}: ${failed[0]?.error ?? "Check-in failed."}`);
      return;
    }

    const primaryName =
      checkedInNames[0] ??
      alreadyCheckedInNames[0] ??
      partyContext.members.find((m) => m.id === partyContext.primaryGuestId)?.name ??
      "Guest";

    if (checkedInNames.length === 0 && alreadyCheckedInNames.length > 0) {
      const member = partyContext.members.find((m) => m.id === partyContext.primaryGuestId);
      showCheckInOutcome(
        primaryName,
        member?.checkedInAt ?? new Date().toISOString(),
        "walkin",
        true
      );
      return;
    }

    const detail =
      checkedInNames.length > 1
        ? `Checked in: ${checkedInNames.join(", ")}`
        : alreadyCheckedInNames.length > 0
          ? `Also already signed in: ${alreadyCheckedInNames.join(", ")}`
          : null;

    showCheckInOutcome(primaryName, new Date().toISOString(), "walkin", false, detail);
  }

  async function handleWalkInSubmit(values: BoothWalkInFormValues & { phone: string }) {
    setError(null);
    setBusy(true);
    const res = await boothWalkInCheckIn({
      orgSlug,
      eventId,
      email: values.email?.trim() || undefined,
      name: values.fullName,
      phone: values.phone,
      company: values.company || undefined,
      jobTitle: values.jobTitle || undefined,
      staffEmployeeId: values.staffEmployeeId || undefined,
      department: values.department || undefined
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not complete check-in.");
      return;
    }
    showCheckInOutcome(res.data.guestName, res.data.checkedInAt, "walkin", res.data.alreadyCheckedIn);
  }

  let content: ReactNode;

  if (phase === "success") {
    content = (
      <CheckInBoothSuccess
        eventName={eventName}
        guestName={successName}
        checkedInAt={checkedInAt}
        detail={successDetail}
        onNextGuest={resetForNextGuest}
      />
    );
  } else if (phase === "already-signed-in") {
    content = (
      <CheckInBoothAlreadyCheckedIn
        eventName={eventName}
        guestName={successName}
        checkedInAt={checkedInAt}
        channel={checkInChannel}
        onNextGuest={resetForNextGuest}
      />
    );
  } else if (phase === "welcome") {
    content = (
      <CheckInBoothWelcome
        eventName={eventName}
        logoUrl={logoUrl}
        orgName={orgName}
        allowWalkIn={allowFlashEntry}
        onPreRegistered={() => {
          setError(null);
          setRejectMessage(null);
          setQrError(null);
          setPhase("preregistered");
        }}
        onWalkIn={() => {
          setError(null);
          setRejectMessage(null);
          setQrError(null);
          setWalkInPrefill({});
          setPhase("walkin");
        }}
      />
    );
  } else if (phase === "preregistered") {
    content = (
      <CheckInBoothCredentialForm
        busy={busy}
        error={error}
        rejectMessage={rejectMessage}
        onBack={() => {
          setError(null);
          setRejectMessage(null);
          setQrError(null);
          setPhase("welcome");
        }}
        onOpenQrScan={() => {
          setQrError(null);
          setPhase("scan-qr");
        }}
        onSubmitEmail={(value) => void handleEmailLookup(value)}
        onSubmitPhone={(dialCode, national) => void handlePhoneLookup(dialCode, national)}
      />
    );
  } else if (phase === "scan-qr") {
    content = (
      <CheckInBoothQrFullscreen
        busy={busy}
        scanError={qrError}
        onBack={() => {
          setQrError(null);
          setPhase("preregistered");
        }}
        onScan={(payload) => void handleQrScan(payload)}
      />
    );
  } else if (phase === "select-party" && partyContext) {
    content = (
      <CheckInBoothGroupForm
        groupName={partyContext.groupName}
        primaryGuestId={partyContext.primaryGuestId}
        members={partyContext.members}
        busy={busy}
        error={error}
        onBack={() => {
          setError(null);
          setPhase("preregistered");
        }}
        onSubmit={(ids) => void handlePartySubmit(ids)}
      />
    );
  } else {
    content = (
      <CheckInBoothWalkInForm
        blueprintTemplate={blueprintTemplate}
        registrationProfile={registrationProfile}
        emailMandatoryForRegistration={emailMandatoryForRegistration}
        prefillEmail={walkInPrefill.email}
        prefillPhone={walkInPrefill.phone}
        busy={busy}
        error={error}
        onBack={() => {
          setError(null);
          setPhase(walkInPrefill.email || walkInPrefill.phone ? "preregistered" : "welcome");
        }}
        onSubmit={(values) => void handleWalkInSubmit(values)}
      />
    );
  }

  const fitViewport = phase === "walkin" || phase === "scan-qr";
  const wideLayout = phase === "scan-qr";

  return (
    <CheckInBoothShell fitViewport={fitViewport} wide={wideLayout}>
      {content}
    </CheckInBoothShell>
  );
}
