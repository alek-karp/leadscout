import * as cheerio from "cheerio";
import { generateJSON } from "../lib/gemini.ts";
import type { DiscoveredClinic } from "../lib/exa-discover.ts";

export interface EnrichmentResult {
  ownerName: string;
  ownerRole: string;
  email: string;
  phone: string;
  contactPage: string;
  instagram: string;
  linkedin: string;
  bookingPlatform: string;
  pageText: string;
}

const PAGE_SLUGS = ["about", "team", "contact", "staff", "our-team", "about-us", "meet-the-team"];
const CONTACT_SLUGS = ["contact", "contact-us", "reach-us", "get-in-touch", "connect", "location", "locations"];

interface FetchResult {
  text: string;
  emails: string[];
  phones: string[];
}

function extractFromHtml(html: string): FetchResult {
  const $ = cheerio.load(html);

  const emails: string[] = [];
  const phones: string[] = [];
  $("a[href^='mailto:']").each((_, el) => {
    const email = $(el).attr("href")?.replace("mailto:", "").split("?")[0].trim();
    if (email && !emails.includes(email)) emails.push(email);
  });
  $("a[href^='tel:']").each((_, el) => {
    const phone = $(el).attr("href")?.replace("tel:", "").trim();
    if (phone && !phones.includes(phone)) phones.push(phone);
  });

  $("script, style, nav, [role=banner]").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  // Regex fallback for plain-text contacts not wrapped in mailto/tel links
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
  for (const match of text.matchAll(emailRegex)) {
    if (!emails.includes(match[0])) emails.push(match[0]);
  }
  for (const match of text.matchAll(phoneRegex)) {
    const normalized = match[0].trim();
    if (!phones.includes(normalized)) phones.push(normalized);
  }

  return { text, emails, phones };
}

async function fetchPage(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });
    if (!res.ok) {
      console.warn(`    fetch ${url} → ${res.status}`);
      return { text: "", emails: [], phones: [] };
    }
    return extractFromHtml(await res.text());
  } catch (err) {
    console.warn(`    fetch ${url} → ${err}`);
    return { text: "", emails: [], phones: [] };
  }
}

function discoverSubpagesFromHtml(html: string, baseUrl: string): string[] {
  try {
    const $ = cheerio.load(html);
    const origin = new URL(baseUrl).origin;
    const found: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const lower = href.toLowerCase();
      if (PAGE_SLUGS.some((slug) => lower.includes(slug))) {
        try {
          const abs = new URL(href, origin).href;
          if (!found.includes(abs)) found.push(abs);
        } catch {}
      }
    });

    // Always probe common contact slugs directly in case they're not in the nav
    for (const slug of CONTACT_SLUGS) {
      const url = `${origin}/${slug}`;
      if (!found.includes(url)) found.push(url);
    }

    return found.slice(0, 6);
  } catch {
    return [];
  }
}

export async function enrichClinic(clinic: DiscoveredClinic): Promise<EnrichmentResult> {
  if (!clinic.website) {
    return { ownerName: "", ownerRole: "", email: "", phone: "", contactPage: "", instagram: "", linkedin: "", bookingPlatform: "", pageText: "" };
  }

  const baseUrl = clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`;

  // Fetch homepage HTML for link discovery (skip if Exa already gave us text)
  let homepageHtml = "";
  if (!clinic.exaPageText) {
    try {
      const res = await fetch(baseUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
      });
      if (res.ok) homepageHtml = await res.text();
    } catch {}
  }

  const subpages = discoverSubpagesFromHtml(homepageHtml, baseUrl);

  const homepageFetch: FetchResult = homepageHtml
    ? extractFromHtml(homepageHtml)
    : { text: clinic.exaPageText, emails: [], phones: [] };
  const subpagesFetches = await Promise.all(subpages.map(fetchPage));
  const pages = [homepageFetch, ...subpagesFetches];
  const combinedText = pages.map((p) => p.text).join("\n\n").slice(0, 16000);

  // Collect all hard-linked emails/phones directly from HTML — more reliable than LLM extraction
  const allEmails = [...new Set(pages.flatMap((p) => p.emails))];
  const allPhones = [...new Set(pages.flatMap((p) => p.phones))];

  const prompt = `You are analyzing the website of a therapy clinic called "${clinic.name}".

Extract the following information from the page text below. Return a JSON object with these exact fields:
- ownerName: full name of the owner, founder, director, or practice manager (string, empty if not found)
- ownerRole: their title/role (string, empty if not found)
- email: contact email address (string, empty if not found)
- phone: phone number (string, empty if not found)
- contactPage: URL of the contact page if visible in the text (string, empty if not found)
- instagram: Instagram handle or URL (string, empty if not found)
- linkedin: LinkedIn URL (string, empty if not found)
- bookingPlatform: name of booking platform if mentioned e.g. Jane, Psychology Today, SimplePractice (string, empty if not found)

Page text:
${combinedText}`;

  try {
    const extracted = await generateJSON<Omit<EnrichmentResult, "pageText">>(prompt);
    // Hard-linked contacts take priority over LLM-extracted ones
    return {
      ...extracted,
      email: allEmails[0] || extracted.email,
      phone: allPhones[0] || extracted.phone,
      pageText: combinedText,
    };
  } catch (err) {
    console.warn(`    Gemini extraction failed: ${err}`);
    return { ownerName: "", ownerRole: "", email: allEmails[0] || "", phone: allPhones[0] || "", contactPage: "", instagram: "", linkedin: "", bookingPlatform: "", pageText: combinedText };
  }
}
