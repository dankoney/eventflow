"use client";

import { ArrowRight, Vote } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { GuestWithEmailStatus } from "@/types";
import { cn } from "@/lib/utils";

type Poll = NonNullable<GuestWithEmailStatus["poll"]>;

type Props = {
  poll: Poll;
  dark?: boolean;
  onOpenInstructions: () => void;
};

export function PollEligibilityCard({ poll, dark = false, onOpenInstructions }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-4",
        dark ? "border-sky-500/30 bg-sky-500/10 text-sky-100" : "border-sky-200 bg-sky-50 text-sky-950"
      )}
    >
      <div className="flex items-start gap-3">
        <Vote className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">You can vote in &ldquo;{poll.title}&rdquo;</p>
          <p className={cn("mt-1 text-sm", dark ? "text-sky-200" : "text-sky-800")}>
            {poll.inWindow
              ? "The ballot is open now."
              : poll.upcoming
                ? "The ballot opens soon — save the link below."
                : "Review voting instructions before you go to the ballot page."}
          </p>
                    <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="text-sm" onClick={onOpenInstructions}>
              How to vote
            </Button>
            <a
              href={poll.ballotUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white",
                dark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-700 hover:bg-sky-800"
              )}
            >
              {poll.inWindow ? "Open ballot" : "Ballot page"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
