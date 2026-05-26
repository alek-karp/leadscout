export const CITY_COORDS: Record<string, { latitude: string; longitude: string }> = {
  Vancouver:    { latitude: "49.2827", longitude: "-123.1207" },
  Toronto:      { latitude: "43.6532", longitude: "-79.3832" },
  Calgary:      { latitude: "51.0447", longitude: "-114.0719" },
  Edmonton:     { latitude: "53.5461", longitude: "-113.4938" },
  Ottawa:       { latitude: "45.4215", longitude: "-75.6972" },
  Montreal:     { latitude: "45.5017", longitude: "-73.5673" },
  Winnipeg:     { latitude: "49.8951", longitude: "-97.1384" },
  "Quebec City": { latitude: "46.8139", longitude: "-71.2080" },
  Hamilton:     { latitude: "43.2557", longitude: "-79.8711" },
  Kitchener:    { latitude: "43.4516", longitude: "-80.4925" },
  London:       { latitude: "42.9849", longitude: "-81.2453" },
  Halifax:      { latitude: "44.6488", longitude: "-63.5752" },
  Victoria:     { latitude: "48.4284", longitude: "-123.3656" },
  Saskatoon:    { latitude: "52.1332", longitude: "-106.6700" },
  Regina:       { latitude: "50.4452", longitude: "-104.6189" },
};

export const CANADIAN_CITIES = [
  "Vancouver",
  // "Toronto",
  // "Calgary",
  // "Edmonton",
  // "Ottawa",
  // "Montreal",
  // "Winnipeg",
  // "Quebec City",
  // "Hamilton",
  // "Kitchener",
  // "London",
  // "Halifax",
  // "Victoria",
  // "Saskatoon",
  // "Regina",
];

export const QUERY_TEMPLATES = [
  "therapy clinic {city}",
  "counselling clinic {city}",
  "psychology clinic {city}",
];
