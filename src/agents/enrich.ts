import * as cheerio from "cheerio";
import { generateJSON } from "../lib/gemini.ts";
import type { DiscoveredClinic } from "../lib/google-places.ts";

export interface EnrichmentResult {
  ownerName: string;
  ownerRole: string;
  email: string;
  contactPage: string;
  instagram: string;
  linkedin: string;
  bookingPlatform: string;
  pageText: string;
}

const PAGE_SLUGS = ["about", "team", "contact", "staff", "our-team", "about-us", "meet-the-team"];

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, [role=banner]").remove();
    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
  } catch {
    return "";
  }
}

async function discoverSubpages(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(baseUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const base = new URL(baseUrl).origin;
    const found: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const lower = href.toLowerCase();
      if (PAGE_SLUGS.some((slug) => lower.includes(slug))) {
        try {
          const abs = new URL(href, base).href;
          if (!found.includes(abs)) found.push(abs);
        } catch {}
      }
    });

    return found.slice(0, 4);
  } catch {
    return [];
  }
}

export async function enrichClinic(clinic: DiscoveredClinic): Promise<EnrichmentResult> {
  if (!clinic.website) {
    return { ownerName: "", ownerRole: "", email: "", contactPage: "", instagram: "", linkedin: "", bookingPlatform: "", pageText: "" };
  }

  const baseUrl = clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`;
  const subpages = await discoverSubpages(baseUrl);

  const texts = await Promise.all([baseUrl, ...subpages].map(fetchText));
  const combinedText = texts.join("\n\n").slice(0, 16000);

  const prompt = `You are analyzing the website of a therapy clinic called "${clinic.name}".

Extract the following information from the page text below. Return a JSON object with these exact fields:
- ownerName: full name of the owner, founder, director, or practice manager (string, empty if not found)
- ownerRole: their title/role (string, empty if not found)
- email: contact email address (string, empty if not found)
- contactPage: URL of the contact page if visible in the text (string, empty if not found)
- instagram: Instagram handle or URL (string, empty if not found)
- linkedin: LinkedIn URL (string, empty if not found)
- bookingPlatform: name of booking platform if mentioned e.g. Jane, Psychology Today, SimplePractice (string, empty if not found)

Page text:
${combinedText}`;

  try {
    const extracted = await generateJSON<Omit<EnrichmentResult, "pageText">>(prompt);
    return { ...extracted, pageText: combinedText };
  } catch {
    return { ownerName: "", ownerRole: "", email: "", contactPage: "", instagram: "", linkedin: "", bookingPlatform: "", pageText: combinedText };
  }
}
