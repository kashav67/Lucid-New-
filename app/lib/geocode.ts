import { env } from "cloudflare:workers";

type Coords = { lat: number; lon: number };

const UA = "LucidDetailing/1.0";

/** Address -> coords via Photon (OSM), with a Nominatim fallback. */
export async function geocode(address: string): Promise<Coords | null> {
  address = (address || "").trim();
  if (!address) return null;
  try {
    const url = "https://photon.komoot.io/api/?" + new URLSearchParams({ q: address, limit: "1" });
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const data = (await r.json()) as any;
    const feats = data?.features;
    if (feats && feats.length) {
      const [lon, lat] = feats[0].geometry.coordinates;
      return { lat: Number(lat), lon: Number(lon) };
    }
  } catch {}
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({ format: "json", limit: "1", q: address });
    const r = await fetch(url, { headers: { "User-Agent": `${UA} (travel-fee tool)` } });
    const data = (await r.json()) as any;
    if (data && data.length) return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  } catch {}
  return null;
}

function haversineMiles(a: Coords, b: Coords): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(a.lat),
    lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat),
    dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Driving distance (miles) via OSRM, falling back to straight-line. */
async function drivingMiles(a: Coords, b: Coords): Promise<number> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const r = await fetch(url);
    const data = (await r.json()) as any;
    return data.routes[0].distance / 1609.344;
  } catch {
    return haversineMiles(a, b);
  }
}

// Cached shop coords (geocoded once per isolate).
let originCache: Coords | null | undefined;
async function originCoords(): Promise<Coords | null> {
  if (originCache === undefined) {
    originCache = (await geocode(env.BUSINESS_ADDRESS || "")) ?? null;
  }
  return originCache;
}

const travelRate = () => Number(env.TRAVEL_RATE || "1") || 1;

/** Returns { fee, miles } from the shop to `address`, or null if unavailable. */
export async function travelFeeFor(address: string): Promise<{ fee: number; miles: number } | null> {
  address = (address || "").trim();
  if (!address || !env.BUSINESS_ADDRESS) return null;
  const origin = await originCoords();
  const dest = await geocode(address);
  if (!origin || !dest) return null;
  const miles = await drivingMiles(origin, dest);
  return { fee: Math.round(miles * travelRate()), miles: Math.round(miles * 10) / 10 };
}

/** Geocode an address and compute travel fee in one shot (for booking save). */
export async function travelForDest(dest: Coords | null): Promise<{ fee: number; miles: number } | null> {
  const origin = await originCoords();
  if (!origin || !dest) return null;
  const miles = await drivingMiles(origin, dest);
  return { fee: Math.round(miles * travelRate()), miles: Math.round(miles * 10) / 10 };
}

/** Typeahead address suggestions via Photon. */
export async function addressSuggestions(q: string): Promise<string[]> {
  q = (q || "").trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: "6", lang: "en" });
  const o = await originCoords();
  if (o) {
    params.set("lat", String(o.lat));
    params.set("lon", String(o.lon));
  }
  let data: any;
  try {
    const r = await fetch("https://photon.komoot.io/api/?" + params, { headers: { "User-Agent": UA } });
    data = await r.json();
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const feat of data?.features || []) {
    const p = feat.properties || {};
    const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
    const loc = [p.city || p.county, p.state, p.postcode].filter(Boolean).join(", ");
    const label = [line1, loc].filter(Boolean).join(", ");
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

export { geocode as geocodeAddress };
