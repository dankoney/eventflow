"use client";

import type { ResourceLinkRow } from "@/lib/event-wizard/resourceLinks";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ResourcesFormProps = {
  rows: ResourceLinkRow[];
  onChange: (rows: ResourceLinkRow[]) => void;
};

export function ResourcesForm({ rows, onChange }: ResourcesFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Add links to slide decks, PDFs (hosted URL), pre-reads, or stakeholder briefs. Guests can receive these after
        invite — storage here is references only.
      </p>
      <ul className="space-y-3">
        {rows.map((row, i) => (
          <li key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={row.title}
                placeholder="Title"
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, title: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                value={row.url}
                placeholder="https://…"
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, url: e.target.value };
                  onChange(next);
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 text-xs"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...rows, { title: "", url: "" }])}
        disabled={rows.length >= 20}
      >
        Add material link
      </Button>
    </div>
  );
}
