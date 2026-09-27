/**
 * Platform admin: billing maths (pure) and the admin services (integration).
 * The integration part needs a local MongoDB (DATABASE_URL in vitest.config.mts) and is skipped without one.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addMonths,
  financialYear,
  invoiceNumber,
  paymentPeriod,
  renewalState,
  startOfISTDay,
  summarizeMrr,
  toISTDateInput,
} from "@/lib/domain/billing";
import type { PlatformAdmin, TenantContext } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { AppError } from "@/server/lib/errors";
import { AuditLog, Broker, Domain, Invoice, Subscription, User } from "@/server/models";
import { listAuditLog, setWorkspaceSuspended } from "@/server/services/admin/admin.service";
import { changeInvoiceStatus, getRevenueOverview, listSubscriptions, recordPayment, updateSubscription } from "@/server/services/admin/billing-admin.service";
import { completeDomainRemoval, listDomainRequests, markDomainConfigured, rejectDomain } from "@/server/services/admin/domain-admin.service";
import { addDomain, listDomains, removeDomain, resolveCustomDomain, verifyDomain } from "@/server/services/domains/domain.service";
import { changePlan } from "@/server/services/subscriptions/subscription.service";
import { getPublicBrokerBySlug } from "@/server/services/tenants/broker.service";
import { registerBroker } from "@/server/services/tenants/registration.service";
import { isTenantSuspended } from "@/server/services/tenants/tenant-status.service";

const ist = (iso: string) => new Date(`${iso}+05:30`);

describe("billing maths", () => {
  it("counts only billed, non-complimentary paid plans towards MRR", () => {
    const summary = summarizeMrr([
      { plan: "pro", status: "active" },
      { plan: "business", status: "past_due", priceOverride: 2999 },
      { plan: "pro", status: "trialing" },
      { plan: "business", status: "active", priceOverride: 0 },
      { plan: "free", status: "active" },
    ]);
    expect(summary.mrr).toBe(1499 + 2999);
    expect(summary.arr).toBe((1499 + 2999) * 12);
    expect(summary.paying).toBe(2);
    expect(summary.byPlan.business).toEqual({ count: 1, mrr: 2999 });
  });

  it("flags renewals that are overdue or due within the window", () => {
    const now = ist("2026-09-27T12:00:00");
    expect(renewalState({ plan: "pro", status: "active", currentPeriodEnd: ist("2026-09-20T00:00:00") }, now)).toBe("overdue");
    expect(renewalState({ plan: "pro", status: "active", currentPeriodEnd: ist("2026-10-01T00:00:00") }, now)).toBe("due_soon");
    expect(renewalState({ plan: "pro", status: "active", currentPeriodEnd: ist("2026-11-01T00:00:00") }, now)).toBeNull();
    expect(renewalState({ plan: "pro", status: "active", priceOverride: 0, currentPeriodEnd: ist("2026-09-20T00:00:00") }, now)).toBeNull();
  });

  it("adds calendar months in IST and clamps to the end of the month", () => {
    expect(toISTDateInput(addMonths(startOfISTDay("2027-01-31"), 1))).toBe("2027-02-28");
    expect(toISTDateInput(addMonths(startOfISTDay("2028-01-31"), 1))).toBe("2028-02-29");
    // IST midnight is the previous day in UTC — the result must still be the 1st.
    expect(toISTDateInput(addMonths(startOfISTDay("2026-03-01"), 1))).toBe("2026-04-01");
    expect(toISTDateInput(addMonths(startOfISTDay("2026-11-15"), 3))).toBe("2027-02-15");
  });

  it("extends a same-plan renewal from the current period end, otherwise starts on the payment date", () => {
    const paidAt = startOfISTDay("2026-09-27");
    const currentEnd = startOfISTDay("2026-10-05");
    const renewal = paymentPeriod({ plan: "pro", status: "active", currentPeriodEnd: currentEnd }, { plan: "pro", months: 1, paidAt });
    expect(renewal.start).toEqual(currentEnd);
    expect(toISTDateInput(renewal.end)).toBe("2026-11-05");

    const upgrade = paymentPeriod({ plan: "pro", status: "active", currentPeriodEnd: currentEnd }, { plan: "business", months: 12, paidAt });
    expect(upgrade.start).toEqual(paidAt);
    expect(toISTDateInput(upgrade.end)).toBe("2027-09-27");

    const fromTrial = paymentPeriod({ plan: "pro", status: "trialing", currentPeriodEnd: null }, { plan: "pro", months: 1, paidAt });
    expect(fromTrial.start).toEqual(paidAt);
  });

  it("numbers invoices per Indian financial year (IST)", () => {
    expect(financialYear(ist("2027-03-31T23:00:00"))).toBe("2026-27");
    expect(financialYear(ist("2027-04-01T00:30:00"))).toBe("2027-28");
    expect(invoiceNumber({ livemode: true, fy: "2026-27", seq: 42 })).toBe("PF/2026-27/0042");
    expect(invoiceNumber({ livemode: false, fy: "2026-27", seq: 7 })).toBe("TEST/2026-27/0007");
  });
});

/* ─────────────────────────── Integration ─────────────────────────── */

let available = true;
let admin: PlatformAdmin;
let owner: TenantContext;
let other: TenantContext;

async function makeTenant(tag: string): Promise<TenantContext> {
  const email = `${tag}-${Date.now()}@admin.test`;
  const { tenantId } = await registerBroker({
    name: `${tag} Owner`,
    businessName: `${tag} Estates`,
    email,
    whatsappNumber: `+91 9${Math.floor(100000000 + Math.random() * 899999999)}`,
    city: "Pune",
    password: "secret123",
    confirmPassword: "secret123",
  });
  const user = await User.findOne({ email });
  return { tenantId, userId: String(user!._id), role: "owner", email, name: `${tag} Owner` };
}

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
};

const today = () => toISTDateInput(new Date());
const inDays = (days: number) => toISTDateInput(new Date(Date.now() + days * 86_400_000));

beforeAll(async () => {
  // Own database: test files run in parallel and each drops its database.
  process.env.DATABASE_URL = process.env.DATABASE_URL?.replace(/\/propflow-test$/, "/propflow-admin-test");
  try {
    await connectDB();
  } catch {
    available = false;
    return;
  }
  if (mongoose.connection.name !== "propflow-admin-test") throw new Error(`Refusing to drop ${mongoose.connection.name}`);
  await mongoose.connection.dropDatabase();
  const staff = await User.create({ name: "Staff", email: `staff-${Date.now()}@propflow.test`, role: "owner", platformRole: "admin" });
  admin = { userId: String(staff._id), email: staff.email, name: staff.name };
  owner = await makeTenant("ganesh");
  other = await makeTenant("kavya");
}, 30_000);

afterAll(async () => {
  if (available) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("admin billing", () => {
  it("records offline payments into a sequential ledger and activates the plan", async (ctx) => {
    if (!available) ctx.skip();
    const first = await recordPayment(admin, owner.tenantId, { plan: "pro", amount: "1499", months: "1", method: "upi", reference: "UTR123", paidAt: today(), notes: "" });
    expect(first.number).toMatch(/^PF\/\d{4}-\d{2}\/0001$/);
    let sub = await Subscription.findOne({ tenantId: owner.tenantId }).lean();
    expect(sub).toMatchObject({ plan: "pro", status: "active" });
    expect(sub!.trialEndsAt).toBeUndefined();

    // Renewing the same plan early extends from the current period end.
    const firstEnd = sub!.currentPeriodEnd!;
    const second = await recordPayment(admin, owner.tenantId, { plan: "pro", amount: "4497", months: "3", method: "bank_transfer", reference: "", paidAt: today(), notes: "" });
    expect(second.number).toMatch(/\/0002$/);
    sub = await Subscription.findOne({ tenantId: owner.tenantId }).lean();
    expect(toISTDateInput(sub!.currentPeriodEnd)).toBe(toISTDateInput(addMonths(firstEnd, 3)));

    const revenue = await getRevenueOverview();
    expect(revenue.collectedThisMonth).toBe(1499 + 4497);
    expect(revenue.mrr.mrr).toBe(1499);
    expect(await AuditLog.countDocuments({ tenantId: owner.tenantId, action: "admin.payment.recorded" })).toBe(2);
  });

  it("keeps test-mode checkouts out of revenue unless asked", async (ctx) => {
    if (!available) ctx.skip();
    await changePlan(other, "business");
    const invoice = await Invoice.findOne({ tenantId: other.tenantId }).lean();
    expect(invoice).toMatchObject({ provider: "mock", livemode: false, amount: 3999 });
    expect(invoice!.number).toMatch(/^TEST\//);

    const live = await getRevenueOverview();
    const withTest = await getRevenueOverview({ includeTest: true });
    expect(withTest.collectedThisMonth - live.collectedThisMonth).toBe(3999);
  });

  it("refunds and voids only from valid states", async (ctx) => {
    if (!available) ctx.skip();
    const invoice = await Invoice.findOne({ tenantId: owner.tenantId, amount: 4497 });
    const before = (await getRevenueOverview()).collectedThisMonth;
    await changeInvoiceStatus(admin, String(invoice!._id), { status: "refunded", note: "Customer asked" });
    expect((await getRevenueOverview()).collectedThisMonth).toBe(before - 4497);
    await expectCode(changeInvoiceStatus(admin, String(invoice!._id), { status: "void", note: "" }), "CONFLICT");
  });

  it("applies negotiated and complimentary prices, trials and downgrades", async (ctx) => {
    if (!available) ctx.skip();
    const base = { trialEndsAt: "", currentPeriodEnd: inDays(30), adminNotes: "Deal agreed on call" };
    await updateSubscription(admin, other.tenantId, { ...base, plan: "business", status: "active", priceOverride: "2999" });
    expect((await getRevenueOverview()).mrr.byPlan.business.mrr).toBe(2999);

    await updateSubscription(admin, other.tenantId, { ...base, plan: "business", status: "active", priceOverride: "0" });
    expect((await getRevenueOverview()).mrr.byPlan.business.count).toBe(0);

    await updateSubscription(admin, other.tenantId, { ...base, plan: "pro", status: "trialing", trialEndsAt: inDays(10), priceOverride: "" });
    expect((await listSubscriptions({ filter: "trialing" })).items.map((r) => r.tenantId)).toContain(other.tenantId);

    await updateSubscription(admin, other.tenantId, { ...base, plan: "free", status: "active", priceOverride: "500" });
    const sub = await Subscription.findOne({ tenantId: other.tenantId }).lean();
    expect(sub).toMatchObject({ plan: "free", status: "active", adminNotes: "Deal agreed on call" });
    expect(sub!.priceOverride).toBeUndefined();
    expect(sub!.currentPeriodEnd).toBeUndefined();
  });

  it("lists overdue paid subscriptions as renewals due", async (ctx) => {
    if (!available) ctx.skip();
    await updateSubscription(admin, owner.tenantId, { plan: "pro", status: "active", trialEndsAt: "", currentPeriodEnd: inDays(-2), priceOverride: "", adminNotes: "" });
    const { items, counts } = await listSubscriptions({ filter: "renewals" });
    expect(items.find((r) => r.tenantId === owner.tenantId)?.renewal).toBe("overdue");
    expect(counts.renewals).toBe(1);
  });
});

describe("admin domain requests", () => {
  it("only serves a domain once it is on hosting and DNS-verified, and tracks removal for ops", async (ctx) => {
    if (!available) ctx.skip();
    await updateSubscription(admin, owner.tenantId, { plan: "business", status: "active", trialEndsAt: "", currentPeriodEnd: inDays(30), priceOverride: "", adminNotes: "" });
    const added = await addDomain(owner, { hostname: "www.ganesh-estates.test" });
    expect(added.setupStatus).toBe("requested");
    expect((await listDomainRequests()).items.map((d) => d.hostname)).toContain("www.ganesh-estates.test");

    // DNS verified (simulated — tests can't publish TXT records), but not on hosting yet: links must not switch.
    await Domain.updateOne({ _id: added.id }, { $set: { status: "verified" } });
    const broker = () => Broker.findOne({ tenantId: owner.tenantId }).lean();
    expect((await broker())!.customDomain).toBeUndefined();

    await markDomainConfigured(admin, added.id);
    expect((await broker())!.customDomain).toBe("www.ganesh-estates.test");
    expect(await resolveCustomDomain("www.ganesh-estates.test")).toBe((await broker())!.slug);

    // Broker removes it: hidden from them and no longer served, but queued for ops to detach from hosting.
    await removeDomain(owner, added.id);
    expect(await listDomains(owner)).toHaveLength(0);
    expect(await resolveCustomDomain("www.ganesh-estates.test")).toBeNull();
    expect((await broker())!.customDomain).toBeUndefined();
    expect((await listDomainRequests({ filter: "removal_requested" })).items).toHaveLength(1);

    // Re-adding while it's still on hosting skips the setup step.
    const readded = await addDomain(owner, { hostname: "www.ganesh-estates.test" });
    expect(readded.setupStatus).toBe("configured");
    await removeDomain(owner, readded.id);
    await completeDomainRemoval(admin, readded.id);
    expect(await Domain.exists({ hostname: "www.ganesh-estates.test" })).toBeNull();
  });

  it("shows the rejection reason to the broker and blocks verification", async (ctx) => {
    if (!available) ctx.skip();
    const added = await addDomain(owner, { hostname: "www.not-theirs.test" });
    await rejectDomain(admin, added.id, "Domain belongs to another business");
    const [mine] = await listDomains(owner);
    expect(mine).toMatchObject({ setupStatus: "rejected", rejectionReason: "Domain belongs to another business" });
    await expectCode(verifyDomain(owner, added.id), "FORBIDDEN");
    await expectCode(markDomainConfigured(admin, added.id), "CONFLICT");
  });
});

describe("workspace suspension", () => {
  it("takes the public site offline and restores it on reactivation", async (ctx) => {
    if (!available) ctx.skip();
    const { slug } = (await Broker.findOne({ tenantId: other.tenantId }).lean())!;
    expect(await getPublicBrokerBySlug(slug)).not.toBeNull();

    await setWorkspaceSuspended(admin, other.tenantId, true, "Chargeback");
    expect(await isTenantSuspended(other.tenantId)).toBe(true);
    expect(await getPublicBrokerBySlug(slug)).toBeNull();
    await expectCode(setWorkspaceSuspended(admin, other.tenantId, true, "again"), "CONFLICT");

    await setWorkspaceSuspended(admin, other.tenantId, false);
    expect(await getPublicBrokerBySlug(slug)).not.toBeNull();

    const log = await listAuditLog({ scope: "admin" });
    expect(log.items.map((a) => a.action)).toEqual(expect.arrayContaining(["admin.workspace.suspended", "admin.workspace.reactivated"]));
    expect(log.items.every((a) => a.actor === admin.email)).toBe(true);
  });
});
