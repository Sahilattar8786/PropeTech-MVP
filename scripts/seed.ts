/**
 * Development seed: creates a demo broker workspace by running the real services
 * (registration → AI pipeline → publish → collection). Not used by the app itself.
 *   npm run seed
 */
import sharp from "sharp";
import { connectDB } from "@/server/db/connect";
import { User } from "@/server/models";
import type { TenantContext } from "@/server/auth/context";
import { addPropertiesToCollection, createCollection } from "@/server/services/collections/collection.service";
import { storeUploadedImage } from "@/server/services/media/media.service";
import { createDraftFromText, publishProperty } from "@/server/services/properties/property.service";
import { registerBroker } from "@/server/services/tenants/registration.service";
import { propertyToFormValues } from "@/lib/validation/property";

const EMAIL = process.env.SEED_EMAIL ?? "demo@propflow.local";
const PASSWORD = process.env.SEED_PASSWORD ?? "demo12345";

const LISTINGS = [
  { text: "New Property\n3 BHK flat in Whitefield\n1800 sqft\n₹1.5 Cr\nSemi furnished\n2 parking\nGym, swimming pool, clubhouse", tones: ["#dfe9e3", "#9fb8ab"], publish: true },
  { text: "4 BHK villa for sale on Sarjapur Road, 3200 sqft, 3.2 cr, fully furnished, 3 car parking, private garden", tones: ["#f3eee6", "#c7b198"], publish: true },
  { text: "Office space for rent on ORR Bellandur, 2400 sqft, 1.8 lakh per month, 4 parking, power backup, lift", tones: ["#e9edf2", "#aab4c3"], publish: true },
  { text: "2bhk apartment in HSR Layout for rent 45k/month 1100 sqft semi furnished 1 parking", tones: ["#e6efe8", "#b5c9bd"], publish: false },
];

async function photo(light: string, mid: string, label: string): Promise<Buffer> {
  const windows = Array.from({ length: 30 }, (_, k) => `<rect x="${470 + (k % 5) * 64}" y="${190 + Math.floor(k / 5) * 84}" width="42" height="52" rx="4" fill="#fff" opacity="${0.65 + (k % 3) * 0.1}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="${light}"/><circle cx="1260" cy="240" r="120" fill="#f4d9a8" opacity=".8"/><rect x="120" y="520" width="260" height="680" fill="${mid}" opacity=".6"/><rect x="1160" y="470" width="300" height="730" fill="${mid}" opacity=".6"/><rect x="440" y="150" width="360" height="1050" rx="6" fill="${mid}"/>${windows}<rect y="1130" width="1600" height="70" fill="#5f7f72" opacity=".7"/><text x="60" y="1090" font-size="44" font-family="Helvetica" fill="#334155" opacity=".6">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function main() {
  await connectDB();
  if (await User.exists({ email: EMAIL })) {
    console.log(`Seed user ${EMAIL} already exists — nothing to do.`);
    process.exit(0);
  }
  const { tenantId, slug } = await registerBroker({
    name: "Asha Menon",
    businessName: "Demo Realty",
    email: EMAIL,
    whatsappNumber: "+91 90000 00001",
    city: "Bangalore",
    password: PASSWORD,
    confirmPassword: PASSWORD,
  });
  const user = await User.findOne({ email: EMAIL });
  const ctx: TenantContext = { tenantId, userId: String(user!._id), role: "owner", email: EMAIL, name: "Asha Menon" };

  const published: string[] = [];
  for (const [i, listing] of LISTINGS.entries()) {
    const images = [];
    for (let n = 0; n < 3; n++) images.push((await storeUploadedImage(tenantId, await photo(listing.tones[0]!, listing.tones[1]!, `Photo ${n + 1}`))).url);
    const draft = await createDraftFromText(ctx, { text: listing.text, images });
    if (listing.publish) {
      await publishProperty(ctx, draft.id, propertyToFormValues(draft));
      published.push(draft.id);
    }
    console.log(`  ${i + 1}. ${draft.title}${listing.publish ? " (published)" : " (draft)"}`);
  }
  const collection = await createCollection(ctx, { name: "Bangalore Picks", slug: "", description: "A shortlist of our best current listings." });
  await addPropertiesToCollection(ctx, collection.id, published);

  console.log(`\nSeeded workspace "${slug}". Sign in with ${EMAIL} / ${PASSWORD}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
