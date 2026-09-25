/** Marketing sample content for product mockups on the landing page (not app data). */
export const sampleBroker = {
  name: "Rehan Properties",
  contact: "Rehan Khan",
  subdomain: "rehanbrokers",
  city: "Bangalore",
  tagline: "Residential & Commercial",
};

export const sampleListing = {
  id: "REH-1024",
  title: "Premium 3 BHK Apartment",
  locality: "Whitefield",
  city: "Bangalore",
  price: "₹1.50 Cr",
  area: "1,800 sq.ft.",
  bhk: "3 BHK",
  parking: "2 Parking",
  furnishing: "Semi Furnished",
  type: "Apartment",
  slug: "3bhk-whitefield",
  amenities: ["Gym", "Swimming Pool", "Clubhouse", "Power Backup", "24x7 Security", "Lift"],
};

export const sampleMessage = ["New Property", "3 BHK Apartment", "Whitefield", "1800 sqft", "₹1.50 Cr", "2 Parking", "Semi Furnished"];

export const processingSteps = [
  "Message received",
  "Images processed",
  "Property detected",
  "Location identified",
  "Price identified",
  "Property details structured",
];

export const dashboardMetrics = [
  { label: "Properties", value: "126" },
  { label: "Active", value: "84" },
  { label: "Sold", value: "31" },
  { label: "Views", value: "14.8K" },
  { label: "WhatsApp Leads", value: "284" },
];

export const dashboardRows = [
  { property: "3 BHK Whitefield", status: "active" as const, views: 824, leads: 42 },
  { property: "Villa Sarjapur", status: "active" as const, views: 532, leads: 28 },
  { property: "Office ORR", status: "sold" as const, views: 921, leads: 17 },
];

export const sampleCollections = [
  { name: "Whitefield Properties", count: 42, variant: "tower" as const, tone: 0 },
  { name: "Luxury Villas", count: 18, variant: "villa" as const, tone: 2 },
  { name: "Commercial Properties", count: 31, variant: "office" as const, tone: 1 },
  { name: "Plots Under ₹1 Crore", count: 26, variant: "plot" as const, tone: 0 },
];
