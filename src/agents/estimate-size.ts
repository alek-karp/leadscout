import { generateJSON } from "../lib/gemini.ts";

export interface SizeEstimate {
  estimatedSize: string;
  confidence: string;
  classification: "solo" | "group";
}

export async function estimateClinicSize(clinicName: string, pageText: string): Promise<SizeEstimate> {
  if (!pageText) {
    return { estimatedSize: "Unknown", confidence: "low", classification: "solo" };
  }

  const prompt = `You are analyzing the website text of a therapy clinic called "${clinicName}" to estimate its size.

Look for:
- Therapist/counsellor profile cards or bios
- Staff listing pages
- References to "our team", "our practitioners", etc.
- Booking platform listings with multiple practitioners
- Language indicating solo vs group practice

Return a JSON object with:
- estimatedSize: approximate number of therapists as a string like "1", "2-5", "6-10", "10+" (string)
- confidence: "high", "medium", or "low" depending on how clear the evidence is (string)
- classification: "solo" if 1 therapist, "group" if 2 or more (string, must be exactly "solo" or "group")

Page text:
${pageText.slice(0, 12000)}`;

  try {
    return await generateJSON<SizeEstimate>(prompt);
  } catch {
    return { estimatedSize: "Unknown", confidence: "low", classification: "solo" };
  }
}
