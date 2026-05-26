import Exa from "exa-js";

const apiKey = process.env.EXA_API_KEY;
if (!apiKey) throw new Error("EXA_API_KEY is not set");

const exa = new Exa(apiKey);

export interface DiscoveredClinic {
  name: string;
  website: string;
  phone: string;
  address: string;
  city: string;
  sourceQuery: string;
}

export async function searchClinics(queryTemplate: string, city: string): Promise<DiscoveredClinic[]> {
  const query = queryTemplate.replace("{city}", city);

  const results = await exa.search(query, {
    type: "auto",
    numResults: 30,
    contents: { highlights: true },
  });

  return results.results
    .filter((r) => r.url)
    .map((r) => ({
      name: r.title ?? "",
      website: r.url,
      phone: "",
      address: "",
      city,
      sourceQuery: query,
    }));
}
