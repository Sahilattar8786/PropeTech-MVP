/**
 * Minimal locality → city gazetteer for major Indian real-estate markets.
 * Used to (a) recognise localities in free text and (b) justify city/state
 * values: a city may only be filled when it is stated or unambiguously implied.
 */
export interface CityInfo {
  city: string;
  state: string;
  aliases: string[];
  localities: string[];
}

export const CITIES: CityInfo[] = [
  {
    city: "Bangalore",
    state: "Karnataka",
    aliases: ["bangalore", "bengaluru", "blr"],
    localities: [
      "Whitefield", "Sarjapur Road", "Sarjapur", "Koramangala", "Indiranagar", "HSR Layout", "Electronic City",
      "Marathahalli", "Hebbal", "Yelahanka", "JP Nagar", "Jayanagar", "BTM Layout", "Bellandur", "Hennur",
      "Devanahalli", "Kanakapura Road", "Bannerghatta Road", "Rajajinagar", "Malleshwaram", "Banashankari",
      "Old Airport Road", "Outer Ring Road", "KR Puram", "Mahadevapura", "Brookefield", "Kadugodi", "Varthur",
      "Panathur", "Thanisandra", "Hoodi", "Hosur Road", "Yeshwanthpur", "RT Nagar", "Frazer Town",
      "CV Raman Nagar", "Domlur", "Ulsoor", "MG Road", "Richmond Town", "Basavanagudi", "Kasavanahalli",
      "Harlur", "Kengeri", "Budigere Cross", "Hennur Road", "Bagalur", "Jakkur", "Kalyan Nagar", "HBR Layout",
    ],
  },
  {
    city: "Mumbai",
    state: "Maharashtra",
    aliases: ["mumbai", "bombay"],
    localities: [
      "Andheri", "Andheri West", "Andheri East", "Bandra", "Bandra West", "Powai", "Juhu", "Worli", "Lower Parel",
      "Goregaon", "Malad", "Kandivali", "Borivali", "Dadar", "Chembur", "Ghatkopar", "Mulund", "Colaba",
      "Santacruz", "Versova", "Khar", "Vile Parle", "Jogeshwari", "Prabhadevi", "Wadala", "Sion", "Kurla",
    ],
  },
  { city: "Thane", state: "Maharashtra", aliases: ["thane"], localities: ["Ghodbunder Road", "Majiwada", "Kolshet Road"] },
  { city: "Navi Mumbai", state: "Maharashtra", aliases: ["navi mumbai"], localities: ["Vashi", "Kharghar", "Panvel", "Nerul", "Airoli", "Belapur", "Ulwe"] },
  {
    city: "Pune",
    state: "Maharashtra",
    aliases: ["pune"],
    localities: [
      "Hinjewadi", "Kharadi", "Wakad", "Baner", "Aundh", "Viman Nagar", "Koregaon Park", "Hadapsar", "Magarpatta",
      "Kothrud", "Pimple Saudagar", "Wagholi", "Balewadi", "Undri", "Bavdhan", "Ravet", "Tathawade",
    ],
  },
  {
    city: "Hyderabad",
    state: "Telangana",
    aliases: ["hyderabad", "hyd", "secunderabad"],
    localities: [
      "Gachibowli", "HITEC City", "Hitech City", "Madhapur", "Kondapur", "Kukatpally", "Banjara Hills",
      "Jubilee Hills", "Manikonda", "Kokapet", "Miyapur", "Begumpet", "Financial District", "Narsingi",
      "Tellapur", "Nallagandla", "Puppalaguda", "Bachupally",
    ],
  },
  {
    city: "Chennai",
    state: "Tamil Nadu",
    aliases: ["chennai", "madras"],
    localities: [
      "OMR", "Velachery", "Adyar", "Anna Nagar", "T Nagar", "Porur", "Tambaram", "Sholinganallur", "Perungudi",
      "Nungambakkam", "Thoraipakkam", "Medavakkam", "Pallikaranai", "Mylapore", "ECR",
    ],
  },
  {
    city: "Delhi",
    state: "Delhi",
    aliases: ["delhi", "new delhi"],
    localities: [
      "Dwarka", "Vasant Kunj", "Saket", "Rohini", "Lajpat Nagar", "Greater Kailash", "Hauz Khas", "Janakpuri",
      "Defence Colony", "Karol Bagh", "Punjabi Bagh", "Mayur Vihar", "Chhatarpur",
    ],
  },
  {
    city: "Gurgaon",
    state: "Haryana",
    aliases: ["gurgaon", "gurugram", "ggn"],
    localities: [
      "Golf Course Road", "Golf Course Extension Road", "Sohna Road", "Cyber City", "Dwarka Expressway",
      "DLF Phase 1", "DLF Phase 2", "DLF Phase 3", "DLF Phase 4", "DLF Phase 5", "New Gurgaon", "MG Road Gurgaon",
    ],
  },
  { city: "Noida", state: "Uttar Pradesh", aliases: ["noida"], localities: ["Noida Extension", "Greater Noida West", "Noida Expressway"] },
  {
    city: "Kolkata",
    state: "West Bengal",
    aliases: ["kolkata", "calcutta"],
    localities: ["Salt Lake", "New Town", "Rajarhat", "Ballygunge", "Park Street", "Behala", "EM Bypass", "Tollygunge", "Alipore"],
  },
  {
    city: "Ahmedabad",
    state: "Gujarat",
    aliases: ["ahmedabad", "amdavad"],
    localities: ["SG Highway", "Satellite", "Bopal", "Prahlad Nagar", "Vastrapur", "Thaltej", "Gota", "Shela", "South Bopal"],
  },
];

/** Common shorthand used by brokers. */
const LOCALITY_ALIASES: Record<string, string> = {
  orr: "Outer Ring Road",
  ecity: "Electronic City",
  "e-city": "Electronic City",
  "e city": "Electronic City",
  hsr: "HSR Layout",
  btm: "BTM Layout",
  "kr puram": "KR Puram",
  "k r puram": "KR Puram",
  "jp nagar": "JP Nagar",
  "j p nagar": "JP Nagar",
  "hitec city": "HITEC City",
  "hitech city": "HITEC City",
  gcr: "Golf Course Road",
};

export interface LocalityMatch {
  locality: string;
  cities: { city: string; state: string }[];
  index: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const flexible = (s: string) => escape(s.toLowerCase()).replace(/\s+/g, "[\\s-]*");

type Entry = { pattern: RegExp; locality: string; length: number };
let localityIndex: Entry[] | null = null;

function buildIndex(): Entry[] {
  const entries = new Map<string, Entry>();
  for (const c of CITIES) {
    for (const l of c.localities) {
      entries.set(l.toLowerCase(), { pattern: new RegExp(`\\b${flexible(l)}\\b`, "i"), locality: l, length: l.length });
    }
  }
  for (const [alias, locality] of Object.entries(LOCALITY_ALIASES)) {
    entries.set(alias, { pattern: new RegExp(`\\b${flexible(alias)}\\b`, "i"), locality, length: alias.length });
  }
  // Longest first so "Sarjapur Road" wins over "Sarjapur".
  return [...entries.values()].sort((a, b) => b.length - a.length);
}

export function citiesForLocality(locality: string): { city: string; state: string }[] {
  const needle = locality.toLowerCase();
  const canonical = LOCALITY_ALIASES[needle]?.toLowerCase() ?? needle;
  return CITIES.filter((c) => c.localities.some((l) => l.toLowerCase() === canonical)).map((c) => ({ city: c.city, state: c.state }));
}

export function findLocality(text: string): LocalityMatch | null {
  localityIndex ??= buildIndex();
  for (const entry of localityIndex) {
    const match = entry.pattern.exec(text);
    if (match) return { locality: entry.locality, cities: citiesForLocality(entry.locality), index: match.index };
  }
  return null;
}

export function findCity(text: string): { city: string; state: string } | null {
  for (const c of CITIES) {
    for (const alias of c.aliases) {
      if (new RegExp(`\\b${flexible(alias)}\\b`, "i").test(text)) return { city: c.city, state: c.state };
    }
  }
  return null;
}

export function canonicalCity(name: string): { city: string; state: string } | null {
  const needle = name.trim().toLowerCase();
  const found = CITIES.find((c) => c.city.toLowerCase() === needle || c.aliases.includes(needle));
  return found ? { city: found.city, state: found.state } : null;
}
