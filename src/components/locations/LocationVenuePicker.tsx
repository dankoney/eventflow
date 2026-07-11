"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { EventFormValues, EventLocationOption } from "@/components/events/eventFormSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createLocation, searchLocationsForPicker } from "@/lib/actions/location.actions";
import { googlePlaceDetails, googlePlacesAutocomplete } from "@/lib/actions/places.actions";
import { uploadVenueFacilityImage } from "@/lib/actions/venueImage.actions";
import { cn } from "@/lib/utils";

type PickerHit = { id: string; name: string; address: string; capacity: number; city: string | null };

export type LocationVenuePickerProps = {
  form: UseFormReturn<EventFormValues>;
  locations: EventLocationOption[];
  hasGoogleMaps: boolean;
};

export function LocationVenuePicker({ form, locations, hasGoogleMaps }: LocationVenuePickerProps) {
  const router = useRouter();
  const locationId = form.watch("locationId");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PickerHit[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = locations.find((l) => l.id === locationId) ?? hits.find((h) => h.id === locationId);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    const res = await searchLocationsForPicker(q);
    setSearching(false);
    if (res.success && res.data) setHits(res.data);
    else setHits([]);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, runSearch]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setListOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pickLocation(hit: PickerHit) {
    form.setValue("locationId", hit.id, { shouldValidate: true, shouldDirty: true });
    form.setValue("capacity", hit.capacity, { shouldValidate: true });
    setQuery(hit.name);
    setListOpen(false);
  }

  return (
    <div ref={wrapRef} className="space-y-2">
      <label className="mb-1 block text-sm font-medium text-slate-700">Venue</label>
      <div className="relative">
        <Input
          value={listOpen || query ? query : selected ? `${selected.name} — ${selected.address}` : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setListOpen(true);
          }}
          onFocus={() => setListOpen(true)}
          placeholder="Search by venue name or city…"
          autoComplete="off"
          aria-expanded={listOpen}
          aria-controls="venue-search-results"
        />
        {listOpen ? (
          <div
            id="venue-search-results"
            className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {searching ? (
              <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No matches. Create a new venue below.</p>
            ) : (
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50",
                    h.id === locationId && "bg-slate-50"
                  )}
                  onClick={() => pickLocation(h)}
                >
                  <span className="font-medium text-slate-900">{h.name}</span>
                  <span className="text-xs text-slate-600">{h.address}</span>
                  {h.city ? <span className="text-[11px] text-slate-500">{h.city}</span> : null}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="text-xs" onClick={() => setSheetOpen(true)}>
          Create new venue
        </Button>
        <span className="text-xs text-slate-500">Opens in-panel without leaving this page.</span>
      </div>

      <input type="hidden" {...form.register("locationId")} />

      {form.formState.errors.locationId ? (
        <p className="text-sm text-red-600">{form.formState.errors.locationId.message}</p>
      ) : null}
      <p className="text-xs text-slate-500">Manage the full venue library under Settings → Locations.</p>

      {sheetOpen ? (
        <VenueCreateSheet
          hasGoogleMaps={hasGoogleMaps}
          onClose={() => setSheetOpen(false)}
          onCreated={(id, capacity) => {
            form.setValue("locationId", id, { shouldValidate: true, shouldDirty: true });
            form.setValue("capacity", capacity, { shouldValidate: true });
            setQuery("");
            setSheetOpen(false);
            void runSearch("");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

type SheetProps = {
  hasGoogleMaps: boolean;
  onClose: () => void;
  onCreated: (id: string, capacity: number) => void;
};

function VenueCreateSheet({ hasGoogleMaps, onClose, onCreated }: SheetProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(100);
  const [facilityImageUrl, setFacilityImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addrQuery, setAddrQuery] = useState("");
  const [predBusy, setPredBusy] = useState(false);
  const [predictions, setPredictions] = useState<{ placeId: string; description: string }[]>([]);

  useEffect(() => {
    if (!hasGoogleMaps || addrQuery.trim().length < 2) {
      setPredictions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setPredBusy(true);
        const res = await googlePlacesAutocomplete(addrQuery);
        setPredBusy(false);
        if (res.success && res.data) setPredictions(res.data);
        else setPredictions([]);
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [addrQuery, hasGoogleMaps]);

  async function applyPrediction(pid: string) {
    setPredBusy(true);
    const res = await googlePlaceDetails(pid);
    setPredBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not load place");
      return;
    }
    setAddress(res.data.formattedAddress);
    setCity(res.data.city);
    setLat(res.data.latitude);
    setLng(res.data.longitude);
    setPlaceId(res.data.googlePlaceId);
    if (!name.trim()) {
      const first = res.data.formattedAddress.split(",")[0]?.trim();
      if (first) setName(first);
    }
    setPredictions([]);
    setAddrQuery("");
    setError(null);
  }

  async function onDropFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadVenueFacilityImage(fd);
    if (!res.success || !res.data) {
      setError(res.error ?? "Upload failed");
      return;
    }
    setFacilityImageUrl(res.data.url);
  }

  async function submit() {
    setError(null);
    if (!name.trim() || !address.trim() || capacity < 1) {
      setError("Name, address, and capacity are required.");
      return;
    }
    setBusy(true);
    const res = await createLocation({
      name: name.trim(),
      address: address.trim(),
      capacity,
      city,
      latitude: lat,
      longitude: lng,
      googlePlaceId: placeId,
      facilityImageUrl
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not create venue");
      return;
    }
    onCreated(res.data.id, capacity);
  }

  const mapSrc =
    hasGoogleMaps && lat != null && lng != null
      ? `/api/venue-map-preview?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-l-xl sm:rounded-r-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">New venue</h2>
          <button
            type="button"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {hasGoogleMaps ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Address search (Google Places)</label>
              <Input
                value={addrQuery}
                onChange={(e) => setAddrQuery(e.target.value)}
                placeholder="Start typing an address…"
                autoComplete="off"
              />
              {predBusy ? <p className="mt-1 text-xs text-slate-500">Looking up…</p> : null}
              {predictions.length > 0 ? (
                <ul className="mt-2 max-h-40 overflow-auto rounded border border-slate-200 bg-slate-50 text-sm">
                  {predictions.map((p) => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-white"
                        onClick={() => void applyPrediction(p.placeId)}
                      >
                        {p.description}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Add a Google Maps API key under Settings → Integrations to enable address autocomplete and map preview. You
              can still enter the address manually.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Venue name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Convention Hall" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Formatted address</label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full street address"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Capacity</label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-700">Facility image</span>
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void onDropFile(f);
              }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/jpeg,image/png,image/webp";
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) void onDropFile(f);
                };
                input.click();
              }}
            >
              {facilityImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={facilityImageUrl} alt="" className="mb-2 max-h-32 rounded object-contain" />
                  <span className="text-xs">Click or drop to replace</span>
                </>
              ) : (
                <>
                  <span>Drag and drop a venue photo</span>
                  <span className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP · max 3 MB</span>
                </>
              )}
            </div>
          </div>

          {mapSrc ? (
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-700">Map preview</span>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mapSrc} alt="Venue location map" className="h-auto w-full object-cover" />
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Save venue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
