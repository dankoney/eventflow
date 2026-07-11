"use client";

import { cn } from "@/lib/utils";
import type { WizardStepId } from "@/lib/event-wizard/wizardSteps";
import { WIZARD_STEP_LABELS } from "@/lib/event-wizard/wizardSteps";

type WizardProgressProps = {
  steps: WizardStepId[];
  currentIndex: number;
  className?: string;
};

export function WizardProgress({ steps, currentIndex, className }: WizardProgressProps) {
  const current = steps[currentIndex];

  return (
    <div className={cn("rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-3 shadow-sm sm:p-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Blueprint</p>
      <div className="mt-2 flex min-w-0 items-center overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-3 [&::-webkit-scrollbar]:hidden">
        {steps.map((id, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={id} className="flex min-w-0 flex-1 items-center">
              {i > 0 ? (
                <div
                  className={cn("mx-0.5 h-0.5 min-w-3 flex-1 rounded-full", i <= currentIndex ? "bg-emerald-400" : "bg-slate-200")}
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                  done && "bg-emerald-500 text-white",
                  active && "bg-slate-900 text-white ring-2 ring-slate-900/15",
                  !done && !active && "bg-white text-slate-400 ring-1 ring-slate-200"
                )}
                title={WIZARD_STEP_LABELS[id]}
                aria-current={active ? "step" : undefined}
              >
                {done ? "✓" : i + 1}
              </div>
            </div>
          );
        })}
      </div>
      {current ? (
        <p className="mt-2 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900">
          {WIZARD_STEP_LABELS[current]}
        </p>
      ) : null}
    </div>
  );
}
