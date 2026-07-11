"use client";

import { EventBlueprintTemplate } from "@prisma/client";
import { Building2, GraduationCap, LayoutTemplate, Users } from "lucide-react";

import { LAUNCHPAD_BLUEPRINTS } from "@/lib/event-wizard/blueprints";
import { cn } from "@/lib/utils";

const ICONS: Record<EventBlueprintTemplate, typeof LayoutTemplate> = {
  [EventBlueprintTemplate.BLANK]: LayoutTemplate,
  [EventBlueprintTemplate.CONFERENCE]: Building2,
  [EventBlueprintTemplate.INTERNAL_STAFF]: Users,
  [EventBlueprintTemplate.TRAINING_WORKSHOP]: GraduationCap
};

const ACCENT_RING: Record<string, string> = {
  slate: "ring-slate-300/80 hover:ring-slate-400",
  indigo: "ring-indigo-200/90 hover:ring-indigo-300",
  amber: "ring-amber-200/90 hover:ring-amber-300",
  emerald: "ring-emerald-200/90 hover:ring-emerald-300"
};

const ACCENT_GRAD: Record<string, string> = {
  slate: "from-slate-100 to-slate-50",
  indigo: "from-indigo-50 to-white",
  amber: "from-amber-50 to-white",
  emerald: "from-emerald-50 to-white"
};

type TemplateLaunchpadProps = {
  onSelect: (template: EventBlueprintTemplate) => void;
};

export function TemplateLaunchpad({ onSelect }: TemplateLaunchpadProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Blueprint-first</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Choose your program</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Start from an archetype aligned with how enterprise teams brief programs: goals, audience, and delivery mode
          are preset so you move faster with fewer gaps.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LAUNCHPAD_BLUEPRINTS.map((b) => {
          const Icon = ICONS[b.id];
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b.id)}
              className={cn(
                "group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 text-left shadow-sm transition",
                "ring-2 ring-transparent hover:-translate-y-0.5 hover:shadow-md",
                ACCENT_RING[b.accent]
              )}
            >
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-slate-800",
                  ACCENT_GRAD[b.accent]
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{b.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{b.subtitle}</p>
              <span className="mt-4 text-xs font-medium text-slate-500 transition group-hover:text-slate-800">
                Use this blueprint →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
