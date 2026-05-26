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

interface FetchResult {
  text: string;
  emails: string[];
  phones: string[];
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
// Matches NA and international formats: +1 800 555-1234, (555) 867-5309, +44 20 7946 0958, etc.
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?:\s*(?:ext|x|ext\.)\s*\d{1,5})?|\+\d{1,3}[-.\s]\d{1,4}[-.\s]\d{3,4}[-.\s]\d{3,4}/g;
const OBFUSCATED_EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+\s*(?:\[at\]|\bat\b|@)\s*[a-zA-Z0-9.\-]+\s*(?:\[dot\]|\bdot\b|\.)\s*[a-zA-Z]{2,}/gi;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function deobfuscateEmail(raw: string): string {
  return raw.replace(/\s*\[at\]\s*|\s+at\s+/i, "@").replace(/\s*\[dot\]\s*|\s+dot\s+/gi, ".").replace(/\s/g, "");
}

function collectEmails(text: string, into: string[], seen: Set<string>) {
  for (const match of text.matchAll(EMAIL_REGEX)) {
    const e = match[0].toLowerCase();
    if (!seen.has(e)) { seen.add(e); into.push(match[0]); }
  }
  for (const match of text.matchAll(OBFUSCATED_EMAIL_REGEX)) {
    const e = deobfuscateEmail(match[0]).toLowerCase();
    if (!seen.has(e)) { seen.add(e); into.push(deobfuscateEmail(match[0])); }
  }
}

function collectPhones(text: string, into: string[], seen: Set<string>) {
  for (const match of text.matchAll(PHONE_REGEX)) {
    const normalized = normalizePhone(match[0]);
    if (normalized.length >= 10 && !seen.has(normalized)) {
      seen.add(normalized);
      into.push(match[0].trim());
    }
  }
}

function extractFromHtml(html: string): FetchResult {
  const $ = cheerio.load(html);

  const emails: string[] = [];
  const phones: string[] = [];
  const emailSeen = new Set<string>();
  const phoneSeen = new Set<string>();

  $("a[href^='mailto:']").each((_, el) => {
    const raw = $(el).attr("href")?.replace("mailto:", "").split("?")[0].trim() ?? "";
    const e = raw.toLowerCase();
    if (raw && !emailSeen.has(e)) { emailSeen.add(e); emails.push(raw); }
  });
  $("a[href^='tel:']").each((_, el) => {
    const raw = $(el).attr("href")?.replace("tel:", "").trim() ?? "";
    const normalized = normalizePhone(raw);
    if (normalized.length >= 10 && !phoneSeen.has(normalized)) { phoneSeen.add(normalized); phones.push(raw); }
  });

  // Extract JSON-LD structured data before stripping scripts
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (entry.email) collectEmails(entry.email, emails, emailSeen);
        if (entry.telephone) collectPhones(entry.telephone, phones, phoneSeen);
      }
    } catch {}
  });

  $("script, style, nav, [role=banner]").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  collectEmails(text, emails, emailSeen);
  collectPhones(text, phones, phoneSeen);

  return { text, emails, phones };
}

function extractFromText(text: string): Pick<FetchResult, "emails" | "phones"> {
  const emails: string[] = [];
  const phones: string[] = [];
  collectEmails(text, emails, new Set());
  collectPhones(text, phones, new Set());
  return { emails, phones };
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

function extractLinks(html: string, baseUrl: string): string[] {
  try {
    const $ = cheerio.load(html);
    const origin = new URL(baseUrl).origin;
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!href.startsWith("http") && !href.startsWith("/")) return;
      try {
        const abs = new URL(href, origin).href;
        if (abs.startsWith(origin) && !links.includes(abs)) links.push(abs);
      } catch {}
    });
    return links;
  } catch {
    return [];
  }
}

async function discoverSubpages(html: string, baseUrl: string): Promise<string[]> {
  const links = extractLinks(html, baseUrl);
  if (links.length === 0) return [];

  const prompt = `You are helping scrape a therapy clinic website to find contact info and owner/team details.

Here are all the internal links found on the homepage:
${links.slice(0, 80).join("\n")}

Return a JSON object with one field:
- urls: array of up to 3 URLs most likely to contain contact information, phone numbers, email addresses, or owner/team names

Only include URLs from the list above. Return an empty array if none seem relevant.`;

  try {
    const { urls } = await generateJSON<{ urls: string[] }>(prompt);
    return Array.isArray(urls) ? urls.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export async function enrichClinic(clinic: DiscoveredClinic): Promise<EnrichmentResult> {
  if (!clinic.website) {
    return { ownerName: "", ownerRole: "", email: "", phone: "", contactPage: "", instagram: "", linkedin: "", bookingPlatform: "", pageText: "" };
  }

  const baseUrl = clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`;

  // Always fetch raw HTML — mailto:/tel: hrefs aren't present in Exa's plain text
  let homepageHtml = "";
  try {
    const res = await fetch(baseUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });
    if (res.ok) homepageHtml = await res.text();
  } catch {}

  const subpages = await discoverSubpages(homepageHtml, baseUrl);

  const homepageFetch: FetchResult = homepageHtml
    ? extractFromHtml(homepageHtml)
    : { text: clinic.exaPageText ?? "", ...extractFromText(clinic.exaPageText ?? "") };
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
