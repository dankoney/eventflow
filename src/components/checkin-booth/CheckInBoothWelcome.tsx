import { QrCode, UserPlus } from "lucide-react";

type CheckInBoothWelcomeProps = {
  eventName: string;
  logoUrl: string | null;
  orgName: string;
  allowWalkIn: boolean;
  onPreRegistered: () => void;
  onWalkIn: () => void;
};

const choiceCardClass =
  "group flex min-h-[11rem] flex-col items-center justify-center gap-4 rounded-2xl border border-[#c4c5d9] bg-white p-10 transition hover:border-[#0040e0] hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-4 focus:ring-[#0040e0]/40 focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export function CheckInBoothWelcome({
  eventName,
  logoUrl,
  orgName,
  allowWalkIn,
  onPreRegistered,
  onWalkIn
}: CheckInBoothWelcomeProps) {
  return (
    <div className="flex flex-col items-center gap-12 text-center">
      <div className="flex flex-col items-center gap-8">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- event/org logos are arbitrary URLs
          <img src={logoUrl} alt="" className="h-24 w-24 rounded-lg object-contain sm:h-28 sm:w-28" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-[#2e5bff] text-3xl font-bold text-white sm:h-28 sm:w-28 sm:text-4xl">
            {orgName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#434656]">{orgName}</p>
          <h1 className="text-4xl font-bold tracking-tight text-[#151c27] sm:text-5xl lg:text-6xl">
            Welcome to {eventName}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[#434656] sm:text-xl">Please select an option to begin</p>
        </div>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        <button type="button" onClick={onPreRegistered} className={choiceCardClass}>
          <div className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-[#dde1ff] transition group-hover:scale-105">
            <QrCode className="h-10 w-10 text-[#0040e0]" aria-hidden />
          </div>
          <span className="text-2xl font-semibold text-[#151c27]">I&apos;m pre-registered</span>
          <span className="max-w-xs text-base text-[#434656]">Email, mobile, or QR scan</span>
        </button>

        <button type="button" onClick={onWalkIn} disabled={!allowWalkIn} className={choiceCardClass}>
          <div className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-[#e2e8f8] transition group-hover:scale-105 group-disabled:group-hover:scale-100">
            <UserPlus className="h-10 w-10 text-[#434656]" aria-hidden />
          </div>
          <span className="text-2xl font-semibold text-[#151c27]">Walk-in check-in</span>
          <span className="max-w-xs text-base text-[#434656]">
            {allowWalkIn
              ? "Register and check in on-site in one step"
              : "Walk-ins are disabled for this event"}
          </span>
        </button>
      </div>
    </div>
  );
}
