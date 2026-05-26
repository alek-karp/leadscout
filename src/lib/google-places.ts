export interface DiscoveredClinic {
  name: string;
  website: string;
  phone: string;
  address: string;
  city: string;
  sourceQuery: string;
}

export async function searchPlaces(query: string, city: string): Promise<DiscoveredClinic[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set");

  const textQuery = query.replace("{city}", city);
  const url = `https://places.googleapis.com/v1/places:searchText`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery, languageCode: "en" }),
  });

  if (!response.ok) {
    throw new Error(`Places API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { places?: Array<{
    displayName?: { text?: string };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    formattedAddress?: string;
  }> };

  return (data.places ?? []).map((p) => ({
    name: p.displayName?.text ?? "",
    website: p.websiteUri ?? "",
    phone: p.nationalPhoneNumber ?? "",
    address: p.formattedAddress ?? "",
    city,
    sourceQuery: textQuery,
  }));
}
