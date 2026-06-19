// Service catalog, sizes, and pricing — ported 1:1 from app.py.
// Not user-editable in the original app, so it lives in code.

export type Service = { label: string; price: number; minutes: number; desc: string };
export type Size = { label: string; surcharge: number };

export const SERVICES: Record<string, Service> = {
  full: {
    label: "Full Detail — Interior & Exterior",
    price: 249,
    minutes: 90,
    desc: "Complete interior deep clean plus full exterior wash & finish.",
  },
  interior: {
    label: "Interior Detail",
    price: 149,
    minutes: 60,
    desc: "Seats, carpets, surfaces, and glass cleaned inside out.",
  },
  exterior: {
    label: "Exterior Detail",
    price: 99,
    minutes: 30,
    desc: "Hand wash, decontamination, and a flawless exterior finish.",
  },
};

export const GRID_MINUTES = 30;

export const SIZES: Record<string, Size> = {
  small: { label: "Small — coupe / sedan", surcharge: 0 },
  medium: { label: "Medium — SUV / crossover", surcharge: 25 },
  large: { label: "Large — truck / van / 3-row", surcharge: 50 },
  bike: { label: "Bike / Motorcycle", surcharge: 0 },
};

export const BIKE_PRICE = 79;

export const SERVICE_CARDS = [
  {
    icon: "interior",
    title: "Interior",
    items: ["Stain removal", "Pet hair removal", "Sticky buttons & surfaces", "Full interior clean"],
  },
  {
    icon: "exterior",
    title: "Exterior",
    items: ["Pre-wash", "Hand wash", "Bug spot removal", "Finishing"],
  },
  {
    icon: "ceramic",
    title: "Bikes & Motorcycles",
    items: ["Pre-wash", "Hand wash", "Bug spot removal", "Sticky buttons", "Finishing"],
  },
];

/** Authoritative server-side price. Returns number or null if invalid. */
export function priceFor(service: string, size: string): number | null {
  if (size === "bike") return service === "full" ? BIKE_PRICE : null;
  if (!(service in SERVICES) || !(size in SIZES)) return null;
  return SERVICES[service].price + SIZES[size].surcharge;
}

/** Display label — bikes just say 'Full Detail'. */
export function serviceLabel(service: string, size?: string): string {
  if (size === "bike") return "Full Detail";
  return SERVICES[service]?.label ?? service;
}

export function serviceMinutes(service: string): number {
  return SERVICES[service]?.minutes ?? 60;
}

/** "$249" or "$24.50" — matches Flask _money(). */
export function money(n: number): string {
  const r = Math.round(Number(n) * 100) / 100;
  return r === Math.trunc(r) ? `$${Math.trunc(r)}` : `$${r.toFixed(2)}`;
}
