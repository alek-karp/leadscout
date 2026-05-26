import { CANADIAN_CITIES, QUERY_TEMPLATES } from "./lib/cities.ts";
import { searchClinics } from "./lib/exa-discover.ts";
import { getExistingLeads, appendLead, ensureHeaders } from "./lib/attio-store.ts";
import { isDuplicate } from "./agents/deduplicate.ts";
import { enrichClinic } from "./agents/enrich.ts";
import { estimateClinicSize } from "./agents/estimate-size.ts";
import { scoreLead } from "./agents/score.ts";

async function run() {
  console.log(`[${new Date().toISOString()}] Pipeline started`);

  await ensureHeaders();

  let discovered = 0;
  let skipped = 0;
  let appended = 0;

  // Load existing leads once at the start
  const existing = await getExistingLeads();
  console.log(`Loaded ${existing.length} existing leads from sheet`);

  for (const city of CANADIAN_CITIES) {
    for (const queryTemplate of QUERY_TEMPLATES) {
      const query = queryTemplate.replace("{city}", city);
      console.log(`Searching: ${query}`);

      let places;
      try {
        places = await searchClinics(queryTemplate, city);
      } catch (err) {
        console.error(`  Places search failed: ${err}`);
        continue;
      }

      discovered += places.length;
      console.log(`  Found ${places.length} places`);

      for (const clinic of places) {
        if (isDuplicate(clinic, existing)) {
          skipped++;
          console.log(`  [SKIP] ${clinic.name} (duplicate)`);
          continue;
        }

        console.log(`  [ENRICH] ${clinic.name}`);

        const enrichment = await enrichClinic(clinic);
        const size = await estimateClinicSize(clinic.name, enrichment.pageText);
        const lead = scoreLead(clinic, enrichment, size);

        console.log(`    → ${lead.leadStatus} | owner: ${lead.ownerName || "none"} | size: ${lead.estimatedSize} (${lead.classification})`);

        await appendLead(lead);
        existing.push({
          name: clinic.name,
          domain: clinic.website ? new URL(clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`).hostname.replace(/^www\./, "") : "",
          phone: clinic.phone.replace(/\D/g, ""),
        });

        if (lead.leadStatus === "Skip") {
          skipped++;
        } else {
          appended++;
        }
      }
    }
  }

  console.log(`\n=== Pipeline complete ===`);
  console.log(`Discovered: ${discovered}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Appended:   ${appended}`);
  console.log(`[${new Date().toISOString()}] Done`);
}

run().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
