"use client";

type AccommodationFormProps = {
  value: string;
  onChange: (v: string) => void;
};

export function AccommodationForm({ value, onChange }: AccommodationFormProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Capture how attendees should plan travel and lodging. This is shown to your team on the event record and can
        inform registration follow-ups.
      </p>
      <div>
        <label htmlFor="accommodation" className="mb-1 block text-sm font-medium text-slate-700">
          Hotel preferences & travel notes
        </label>
        <textarea
          id="accommodation"
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Room block at Grand Hotel (code EVENT2026), airport shuttle at T2, arrival window…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 transition focus:ring-2"
        />
      </div>
    </div>
  );
}
