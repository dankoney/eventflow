import { Vote } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type RegisterPollCtaProps = {
  eventId: string;
  pollTitle: string;
  isDark: boolean;
  /** Optional hex brand color for accents */
  brandColor?: string;
};

/**
 * Shown on the public registration page while the poll window is open and the ballot
 * has at least one position — guests register here, then vote on `/events/[id]/poll`.
 */
export function RegisterPollCta({ eventId, pollTitle, isDark, brandColor }: RegisterPollCtaProps) {
  const href = `/events/${encodeURIComponent(eventId)}/poll`;
  return (
    <section
      className={cn(
        "mb-6 rounded-xl border p-5 shadow-sm sm:p-6",
        isDark ? "border-slate-600/80 bg-slate-900/70" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
              isDark ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-slate-50"
            )}
            style={
              brandColor
                ? { borderColor: `${brandColor}55`, backgroundColor: `${brandColor}14` }
                : undefined
            }
          >
            <Vote className={cn("h-5 w-5", isDark ? "text-sky-300" : "text-accent")} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", isDark ? "text-slate-400" : "text-slate-500")}>
              Live ballot
            </p>
            <h2
              className={cn(
                "mt-1 font-[Manrope,Inter,system-ui] text-lg font-extrabold tracking-tight sm:text-xl",
                isDark ? "text-slate-50" : "text-slate-900"
              )}
            >
              {pollTitle}
            </h2>
            <p className={cn("mt-1 text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
              Already registered? Cast your secure, anonymous ballot on the voting page.
            </p>
          </div>
        </div>
        <Link
          href={href}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg px-5 py-3 text-center text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90",
            isDark ? "bg-sky-500" : "bg-accent"
          )}
          style={!isDark && brandColor ? { backgroundColor: brandColor } : undefined}
        >
          Open ballot
        </Link>
      </div>
    </section>
  );
}
