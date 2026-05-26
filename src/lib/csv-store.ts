import { existsSync } from "fs";
import type { LeadRow } from "../agents/score.ts";

const CSV_PATH = process.env.CSV_PATH ?? "leads.csv";

const HEADERS: (keyof LeadRow)[] = [
  "clinicName", "website", "ownerName", "ownerRole", "email", "phone",
  "city", "estimatedSize", "confidence", "classification", "contactPage",
  "instagram", "linkedin", "bookingPlatform", "dateAdded", "leadStatus",
];

const HEADER_LABELS = [
  "Clinic Name", "Website", "Owner Name", "Owner Role", "Email", "Phone",
  "City", "Est. Clinic Size", "Confidence", "Classification", "Contact Page",
  "Instagram", "LinkedIn", "Booking Platform", "Date Added", "Lead Status",
];

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(current); current = ""; }
      else current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export interface ExistingLead {
  domain: string;
  phone: string;
  name: string;
}

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

export async function getExistingLeads(): Promise<ExistingLead[]> {
  if (!existsSync(CSV_PATH)) return [];

  const text = await Bun.file(CSV_PATH).text();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  // Skip header row
  return lines.slice(1).map((line) => {
    const fields = parseCSVLine(line);
    return {
      name: fields[0] ?? "",
      domain: normalizeDomain(fields[1] ?? ""),
      phone: (fields[5] ?? "").replace(/\D/g, ""),
    };
  });
}

export async function appendLead(lead: LeadRow): Promise<void> {
  const row = HEADERS.map((key) => escapeField(String(lead[key] ?? ""))).join(",");

  if (!existsSync(CSV_PATH)) {
    const header = HEADER_LABELS.map(escapeField).join(",");
    await Bun.write(CSV_PATH, header + "\n" + row + "\n");
  } else {
    const existing = await Bun.file(CSV_PATH).text();
    await Bun.write(CSV_PATH, existing + row + "\n");
  }
}

export async function ensureHeaders(): Promise<void> {
  if (!existsSync(CSV_PATH)) {
    const header = HEADER_LABELS.map(escapeField).join(",");
    await Bun.write(CSV_PATH, header + "\n");
  }
}
