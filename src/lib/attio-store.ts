import type { LeadRow } from "../agents/score.ts";
import { CITY_COORDS } from "./cities.ts";

const ATTIO_API = "https://api.attio.com/v2";

function getHeaders() {
  const key = process.env.ATTIO_API_KEY;
  if (!key) throw new Error("ATTIO_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export interface ExistingLead {
  domain: string;
  phone: string;
  name: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

export async function getExistingLeads(): Promise<ExistingLead[]> {
  const leads: ExistingLead[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const res = await fetch(`${ATTIO_API}/objects/companies/records/query`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        limit,
        offset,
        sorts: [],
        filters: {},
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Attio query failed: ${res.status} ${err}`);
    }

    const json = (await res.json()) as {
      data: Array<{
        values: {
          name?: Array<{ value: string }>;
          domains?: Array<{ domain: string }>;
          phone_numbers?: Array<{ original_phone_number: string }>;
        };
      }>;
    };

    for (const record of json.data) {
      const name = record.values.name?.[0]?.value ?? "";
      const domain = record.values.domains?.[0]?.domain ?? "";
      const phone = (record.values.phone_numbers?.[0]?.original_phone_number ?? "").replace(/\D/g, "");
      leads.push({ name, domain, phone });
    }

    if (json.data.length < limit) break;
    offset += limit;
  }

  return leads;
}

export async function appendLead(lead: LeadRow): Promise<void> {
  const domain = extractDomain(lead.website);

  const values: Record<string, unknown> = {
    name: [{ value: lead.clinicName }],
  };

  if (domain) {
    values.domains = [{ domain }];
  }

  // Standard Attio company attributes
  if (lead.linkedin) values.linkedin = [{ value: lead.linkedin }];
  if (lead.instagram) values.instagram = [{ value: lead.instagram }];

  // Custom attributes
  if (lead.phone) {
    const e164 = lead.phone.startsWith("+") ? lead.phone : `+1${lead.phone.replace(/\D/g, "")}`;
    values.phone_number = [{ original_phone_number: e164 }];
  }
  if (lead.email) values.email = [{ value: lead.email }];

  if (lead.city) {
    const coords = CITY_COORDS[lead.city];
    values.primary_location = [{
      line_1: "", line_2: "", line_3: "", line_4: "",
      locality: lead.city,
      region: "", postcode: "",
      country_code: "CA",
      ...(coords ?? { latitude: "0", longitude: "0" }),
    }];
  }

  const res = await fetch(`${ATTIO_API}/objects/companies/records?matching_attribute=domains`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ data: { values } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Attio upsert failed for "${lead.clinicName}": ${res.status} ${err}`);
  }
}

// No-op — Attio doesn't need header initialization
export async function ensureHeaders(): Promise<void> {}
