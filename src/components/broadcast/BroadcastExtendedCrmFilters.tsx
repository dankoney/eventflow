"use client";

import { CRM_KIND_OPTIONS } from "@/lib/crm/crmKindLabels";
import type { BroadcastCompanyOption } from "@/lib/db/emailBroadcast";
import type { GuestSegmentFilterInput } from "@/lib/guests/segmentFilters";
import { cn } from "@/lib/utils";

type BroadcastExtendedCrmFiltersProps = {
  value: GuestSegmentFilterInput;
  onChange: (next: GuestSegmentFilterInput) => void;
  companies: BroadcastCompanyOption[];
  emailDomains: string[];
  className?: string;
};

function toggleValue<T extends string>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function BroadcastExtendedCrmFilters({
  value,
  onChange,
  companies,
  emailDomains,
  className
}: BroadcastExtendedCrmFiltersProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">CRM type</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CRM_KIND_OPTIONS.map(({ value: kind, label }) => (
            <label key={kind} className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={(value.crmKinds ?? []).includes(kind)}
                onChange={() => onChange({ ...value, crmKinds: toggleValue(value.crmKinds, kind) })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {companies.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Company</p>
          <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
            {companies.slice(0, 40).map((company) => (
              <label key={company.key} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={(value.companies ?? []).includes(company.key)}
                  onChange={() =>
                    onChange({ ...value, companies: toggleValue(value.companies, company.key) })
                  }
                />
                <span className="min-w-0 truncate">{company.label}</span>
                <span className="shrink-0 text-xs text-zinc-400">({company.count})</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {emailDomains.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Email domain</p>
          <div className="mt-1.5 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {emailDomains.slice(0, 30).map((domain) => (
              <label key={domain} className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={(value.emailDomains ?? []).includes(domain)}
                  onChange={() =>
                    onChange({ ...value, emailDomains: toggleValue(value.emailDomains, domain) })
                  }
                />
                @{domain}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
