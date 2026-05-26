import type { LeadRow } from "../agents/score.ts";

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
  if (lead.linkedin) values.linkedin_url = [{ value: lead.linkedin }];
  if (lead.instagram) values.twitter_handle = [{ value: lead.instagram }]; // closest built-in for social

  // Custom attributes — these must exist in your Attio workspace
  // Create them at: Settings → Objects → Companies → Attributes
  const customFields: Record<string, string> = {
    owner_name: lead.ownerName,
    owner_role: lead.ownerRole,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    estimated_size: lead.estimatedSize,
    size_confidence: lead.confidence,
    size_classification: lead.classification,
    contact_page: lead.contactPage,
    booking_platform: lead.bookingPlatform,
    lead_status: lead.leadStatus,
    date_added: lead.dateAdded,
  };

  for (const [slug, value] of Object.entries(customFields)) {
    if (value) values[slug] = [{ value }];
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
