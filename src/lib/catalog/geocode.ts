export type VerifiedPlace = {
  id: string;
  title: string;
  detail: string;
  addressLine1: string;
  district: string;
  latitude: string;
  longitude: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  county?: string;
  state_district?: string;
  country?: string;
};

type NominatimHit = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

function clip(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function coordinate(value: string | undefined, limit: number) {
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > limit) return null;
  return number.toFixed(6);
}

function placeTitle(address: NominatimAddress, displayName: string) {
  return clip(address.road || address.suburb || address.neighbourhood || address.city || address.town || address.village || displayName.split(",")[0] || "Verified place", 80);
}

function addressLine(address: NominatimAddress, title: string) {
  const street = clip([address.house_number, address.road].filter(Boolean).join(" "), 200);
  const line = street || title;
  return line.length >= 3 ? line : clip(`${line} area`, 200);
}

function districtLine(address: NominatimAddress, locality: string) {
  const district = clip(address.state || address.county || address.state_district || address.city || address.town || address.village || locality, 80);
  return district.length >= 2 ? district : "Area";
}

function detailLine(address: NominatimAddress, title: string) {
  const parts = [address.suburb, address.city || address.town || address.village || address.municipality, address.state || address.county, address.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part) && part.toLowerCase() !== title.toLowerCase());
  return [...new Set(parts)].slice(0, 3).join(", ");
}

export function placesFromNominatim(payload: unknown, locality: string): VerifiedPlace[] {
  if (!Array.isArray(payload)) return [];
  const places: VerifiedPlace[] = [];
  const seen = new Set<string>();
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const hit = item as NominatimHit;
    const latitude = coordinate(hit.lat, 90);
    const longitude = coordinate(hit.lon, 180);
    if (!latitude || !longitude) continue;
    const key = `${latitude},${longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const address = hit.address ?? {};
    const title = placeTitle(address, hit.display_name ?? "");
    places.push({
      id: String(hit.place_id ?? key),
      title,
      detail: detailLine(address, title),
      addressLine1: addressLine(address, title),
      district: districtLine(address, locality),
      latitude,
      longitude,
    });
    if (places.length === 5) break;
  }
  return places;
}

export async function searchPlaces(query: { name: string; locality: string; countryCode: string }): Promise<{ ok: true; places: VerifiedPlace[] } | { ok: false; message: string }> {
  const country = query.countryCode.trim().toLowerCase();
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    q: `${query.name}, ${query.locality}`,
  });
  if (/^[a-z]{2}$/.test(country)) params.set("countrycodes", country);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CareCircleMindTogether/1.0 (admin location verification)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, message: "The map service could not check that place. Try again in a moment." };
    const places = placesFromNominatim(await response.json(), query.locality);
    if (places.length === 0) return { ok: false, message: "No place matched that name and city. Check the spelling and try again." };
    return { ok: true, places };
  } catch {
    return { ok: false, message: "The map service could not be reached. Try again in a moment." };
  }
}
