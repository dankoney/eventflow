/** Server-side Google Places (legacy JSON) helpers — use org or env API key. */

export type PlacePrediction = { placeId: string; description: string };

export type PlaceDetailsResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city: string | null;
  googlePlaceId: string;
};

function extractCity(components: { long_name: string; short_name: string; types: string[] }[]): string | null {
  const order = ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1"];
  for (const t of order) {
    const c = components.find((x) => x.types.includes(t));
    if (c?.long_name) return c.long_name;
  }
  return null;
}

export async function fetchPlaceAutocomplete(
  apiKey: string,
  input: string
): Promise<{ ok: true; predictions: PlacePrediction[] } | { ok: false; error: string }> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return { ok: true, predictions: [] };

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", trimmed);
  url.searchParams.set("types", "geocode");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return { ok: false, error: `Places HTTP ${res.status}` };
  }
  const data = (await res.json()) as {
    status: string;
    predictions?: { place_id: string; description: string }[];
    error_message?: string;
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return {
      ok: false,
      error: data.error_message ?? `Places status ${data.status}`
    };
  }

  const predictions = (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description
  }));
  return { ok: true, predictions };
}

export async function fetchPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<{ ok: true; details: PlaceDetailsResult } | { ok: false; error: string }> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "place_id,formatted_address,geometry,address_component"
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return { ok: false, error: `Place details HTTP ${res.status}` };
  }
  const data = (await res.json()) as {
    status: string;
    result?: {
      place_id: string;
      formatted_address: string;
      geometry?: { location?: { lat: number; lng: number } };
      address_components?: { long_name: string; short_name: string; types: string[] }[];
    };
    error_message?: string;
  };

  if (data.status !== "OK" || !data.result) {
    return {
      ok: false,
      error: data.error_message ?? `Place details status ${data.status}`
    };
  }

  const loc = data.result.geometry?.location;
  if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
    return { ok: false, error: "Place has no coordinates" };
  }

  const city = extractCity(data.result.address_components ?? []);

  return {
    ok: true,
    details: {
      googlePlaceId: data.result.place_id,
      formattedAddress: data.result.formatted_address,
      latitude: loc.lat,
      longitude: loc.lng,
      city
    }
  };
}
