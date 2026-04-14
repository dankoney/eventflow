"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/Input";
import { searchGuestsForCheckIn } from "@/lib/actions/checkin.actions";
import { cn } from "@/lib/utils";

type CheckInSearchProps = {
  eventId: string;
  onPickGuest: (guestId: string) => void;
  disabled?: boolean;
};

export function CheckInSearch({ eventId, onPickGuest, disabled }: CheckInSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setError(null);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await searchGuestsForCheckIn({ eventId, query: query.trim() });
    setLoading(false);
    if (!res.success) {
      setResults([]);
      setError(res.error ?? "Search failed");
      return;
    }
    setResults(res.data?.guests ?? []);
  }, [eventId, query]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runSearch();
    }, 350);
    return () => window.clearTimeout(t);
  }, [runSearch]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Manual search</h3>
      <p className="mt-1 text-sm text-slate-600">Find a guest by name or email, then check them in.</p>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Type at least 2 characters…"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? <p className="mt-2 text-sm text-slate-500">Searching…</p> : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
        {results.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-left text-sm transition",
                "hover:border-slate-200 hover:bg-slate-50",
                disabled && "pointer-events-none opacity-50"
              )}
              onClick={() => onPickGuest(g.id)}
            >
              <span className="font-medium text-slate-900">{g.name}</span>
              <span className="ml-2 truncate text-slate-600">{g.email}</span>
            </button>
          </li>
        ))}
      </ul>

      {!loading && query.trim().length >= 2 && results.length === 0 && !error ? (
        <p className="mt-2 text-sm text-slate-500">No guests match this search.</p>
      ) : null}
    </div>
  );
}
