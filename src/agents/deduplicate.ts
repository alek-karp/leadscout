import Fuse from "fuse.js";
import type { ExistingLead } from "../lib/csv-store.ts";
import type { DiscoveredClinic } from "../lib/exa-discover.ts";

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isDuplicate(clinic: DiscoveredClinic, existing: ExistingLead[]): boolean {
  const domain = normalizeDomain(clinic.website);
  const phone = normalizePhone(clinic.phone);

  // Exact domain match
  if (domain && existing.some((e) => e.domain === domain)) return true;

  // Exact phone match (10+ digits)
  if (phone.length >= 10 && existing.some((e) => e.phone === phone)) return true;

  // Fuzzy name match
  if (clinic.name) {
    const fuse = new Fuse(existing, { keys: ["name"], threshold: 0.15 });
    const matches = fuse.search(clinic.name);
    if (matches.length > 0) return true;
  }

  return false;
}
