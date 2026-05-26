# LeadScout

Automated B2B lead discovery and enrichment pipeline for therapy clinics. Searches for clinics by city, scrapes their websites for contact info, and scores each lead based on clinic size and owner reachability.

## How it works

1. **Discover** — Exa searches for clinics across configured cities and query templates
2. **Enrich** — scrapes each clinic's website (homepage + contact/about pages) to extract owner name, email, phone, and booking platform
3. **Score** — classifies each lead as `Ready to contact`, `Needs review`, or `Skip`
4. **Output** — upserts results to Attio as Company records, skipping duplicates

## Setup

```bash
bun install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `EXA_API_KEY` | From [dashboard.exa.ai](https://dashboard.exa.ai) |
| `DEEPSEEK_API_KEY` | From [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| `ATTIO_API_KEY` | From [app.attio.com/settings/api-keys](https://app.attio.com/settings/api-keys) |

## Run

```bash
bun src/pipeline.ts          # 10 results per query (default)
bun src/pipeline.ts --num=25 # custom results per query
```

Results are upserted to Attio as Company records.
