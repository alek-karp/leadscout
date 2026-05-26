import type { EnrichmentResult } from "./enrich.ts";
import type { SizeEstimate } from "./estimate-size.ts";
import type { DiscoveredClinic } from "../lib/google-places.ts";

export type LeadStatus = "Ready to contact" | "Needs review" | "Skip";

export interface LeadRow {
  clinicName: string;
  website: string;
  ownerName: string;
  ownerRole: string;
  email: string;
  phone: string;
  city: string;
  estimatedSize: string;
  confidence: string;
  classification: string;
  contactPage: string;
  instagram: string;
  linkedin: string;
  bookingPlatform: string;
  dateAdded: string;
  leadStatus: LeadStatus;
}

export function scoreLead(
  clinic: DiscoveredClinic,
  enrichment: EnrichmentResult,
  size: SizeEstimate,
): LeadRow {
  const hasOwner = enrichment.ownerName.trim().length > 0;
  const hasContact = enrichment.email.trim().length > 0 || clinic.phone.trim().length > 0 || enrichment.contactPage.trim().length > 0;
  const isGroup = size.classification === "group";

  let leadStatus: LeadStatus;

  if (isGroup && hasOwner && hasContact) {
    leadStatus = "Ready to contact";
  } else if (hasOwner || hasContact) {
    leadStatus = "Needs review";
  } else {
    leadStatus = "Skip";
  }

  return {
    clinicName: clinic.name,
    website: clinic.website,
    ownerName: enrichment.ownerName,
    ownerRole: enrichment.ownerRole,
    email: enrichment.email,
    phone: clinic.phone,
    city: clinic.city,
    estimatedSize: size.estimatedSize,
    confidence: size.confidence,
    classification: size.classification,
    contactPage: enrichment.contactPage,
    instagram: enrichment.instagram,
    linkedin: enrichment.linkedin,
    bookingPlatform: enrichment.bookingPlatform,
    dateAdded: new Date().toISOString().split("T")[0]!,
    leadStatus,
  };
}
