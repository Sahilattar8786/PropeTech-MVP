/**
 * Integration test: every tenant-owned read/write is scoped by tenantId.
 * Requires a local MongoDB (DATABASE_URL in vitest.config.mts); skipped if unavailable.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TenantContext } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { AppError } from "@/server/lib/errors";
import { Lead, Media, User } from "@/server/models";
import { setAIProvider } from "@/server/services/ai/provider";
import { RulesProvider } from "@/server/services/ai/rules.provider";
import { addPropertiesToCollection, createCollection, getCollectionWithProperties } from "@/server/services/collections/collection.service";
import { listLeads, updateLeadStatus } from "@/server/services/leads/lead.service";
import {
  changePropertyStatus,
  createDraftFromText,
  deleteProperty,
  getProperty,
  listProperties,
  publishProperty,
  updateProperty,
} from "@/server/services/properties/property.service";
import { getPublicProperty } from "@/server/services/properties/public-property.service";
import { registerBroker } from "@/server/services/tenants/registration.service";
import { propertyToFormValues } from "@/lib/validation/property";

let available = true;
let a: TenantContext;
let b: TenantContext;

async function makeTenant(tag: string): Promise<TenantContext> {
  const email = `${tag}-${Date.now()}@isolation.test`;
  const { tenantId } = await registerBroker({
    name: `${tag} Owner`,
    businessName: `${tag} Realty`,
    email,
    whatsappNumber: `+91 9${Math.floor(100000000 + Math.random() * 899999999)}`,
    city: "Bangalore",
    password: "secret123",
    confirmPassword: "secret123",
  });
  const user = await User.findOne({ email });
  return { tenantId, userId: String(user!._id), role: "owner", email, name: `${tag} Owner` };
}

const expectNotFound = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "NOT_FOUND");
};

beforeAll(async () => {
  setAIProvider(new RulesProvider());
  try {
    await connectDB();
    await mongoose.connection.dropDatabase();
  } catch {
    available = false;
    return;
  }
  a = await makeTenant("alpha");
  b = await makeTenant("beta");
}, 30_000);

afterAll(async () => {
  if (available) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("tenant isolation", () => {
  it("keeps properties, collections and leads private to their tenant", async (ctx) => {
    if (!available) ctx.skip();

    const draft = await createDraftFromText(a, { text: "3bhk flat in whitefield 1800 sqft 1.5 cr", images: [] });
    const { property } = await publishProperty(a, draft.id, propertyToFormValues(draft));
    expect(property.status).toBe("active");
    expect(property.propertyId).toMatch(/^ALP-\d+$/);

    // Tenant B cannot read, edit, change status or delete A's property.
    await expectNotFound(getProperty(b, property.id));
    await expectNotFound(updateProperty(b, property.id, propertyToFormValues(property)));
    await expectNotFound(changePropertyStatus(b, property.id, "sold"));
    await expectNotFound(deleteProperty(b, property.id));
    expect((await listProperties(b, { page: 1 })).items).toHaveLength(0);
    expect((await listProperties(a, { page: 1 })).items).toHaveLength(1);

    // Public lookups are scoped by the broker's tenant too.
    expect(await getPublicProperty(b.tenantId, property.slug!)).toBeNull();
    expect(await getPublicProperty(a.tenantId, property.slug!)).not.toBeNull();

    // B cannot add A's property to its own collection.
    const collection = await createCollection(b, { name: "Beta picks", slug: "", description: "" });
    await addPropertiesToCollection(b, collection.id, [property.id]);
    expect((await getCollectionWithProperties(b, collection.id)).properties).toHaveLength(0);
    await expectNotFound(getCollectionWithProperties(a, collection.id));

    // Leads: B can't see or update A's leads.
    const lead = await Lead.create({ tenantId: a.tenantId, propertyId: property.id, source: "property_page", interest: "test" });
    expect((await listLeads(b)).items).toHaveLength(0);
    await expectNotFound(updateLeadStatus(b, String(lead._id), "closed"));
    expect((await listLeads(a)).items).toHaveLength(1);
  });

  it("rejects attaching another tenant's uploaded images", async (ctx) => {
    if (!available) ctx.skip();
    const media = await Media.create({ tenantId: a.tenantId, key: "tenants/a/x.webp", url: "/media/tenants/a/x.webp", mimeType: "image/webp", size: 1, source: "upload" });
    await expect(createDraftFromText(b, { text: "2bhk in HSR Layout 80 lakh", images: [media.url] })).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === "FORBIDDEN",
    );
  });

  it("enforces RBAC for agents", async (ctx) => {
    if (!available) ctx.skip();
    const agent: TenantContext = { ...a, role: "agent" };
    const { items } = await listProperties(agent, { page: 1 });
    await expect(deleteProperty(agent, items[0]!.id)).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "FORBIDDEN");
  });
});
