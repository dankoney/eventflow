import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

import { speakerInitials } from "../../../sections/shared/utils";

type Props = {
  speakers: PublicEventExperiencePayload["speakers"];
  accent: "primary" | "secondary";
  className?: string;
};

/** Overlapping speaker avatars for agenda session cards. */
export function AgendaSpeakerStack({ speakers, accent, className }: Props) {
  if (speakers.length === 0) return null;

  const ring =
    accent === "secondary"
      ? "ring-[color:var(--pe-surface-container)]"
      : "ring-[color:var(--pe-surface-container)]";

  return (
    <div className={cn("flex items-center", className)} aria-label="Session speakers">
      {speakers.map((sp, i) => {
        const img = sp.imageUrl?.trim();
        return (
          <span
            key={sp.id}
            className={cn(
              "relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--pe-surface-container)] bg-[var(--pe-surface-container-high)] ring-2",
              ring,
              i > 0 && "-ml-3"
            )}
            style={{ zIndex: speakers.length - i }}
            title={sp.name}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[var(--pe-on-surface-variant)]">
                {speakerInitials(sp.name)}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
