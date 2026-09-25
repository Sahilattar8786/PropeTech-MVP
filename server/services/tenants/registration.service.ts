import { normalizePhone } from "@/lib/phone";
import type { OnboardingInput, RegisterInput } from "@/lib/validation/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { connectDB } from "@/server/db/connect";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { Broker, Subscription, Tenant, User, type IUser } from "@/server/models";
import { trackEvent } from "@/server/services/analytics/track";
import { createTrialSubscription } from "@/server/services/subscriptions/subscription.service";
import { generateUniqueBrokerSlug, propertyIdPrefixFrom } from "./broker.service";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  tenantId?: string;
  role: IUser["role"];
  platformRole?: "admin";
}

function toAuthUser(user: IUser): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    image: user.image,
    tenantId: user.tenantId ? String(user.tenantId) : undefined,
    role: user.role,
    platformRole: user.platformRole ?? (isAdminEmail(user.email) ? "admin" : undefined),
  };
}

function isAdminEmail(email: string) {
  return env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/**
 * Register → Create User → Create Tenant → Create Broker Profile → Generate Broker Slug → Subscription.
 * Writes are compensated on failure (standalone MongoDB has no multi-document transactions).
 */
async function createWorkspace(user: IUser, profile: { businessName: string; whatsappNumber: string; city: string }) {
  const whatsappNumber = normalizePhone(profile.whatsappNumber);
  if (!whatsappNumber) throw new AppError("VALIDATION", "Invalid WhatsApp number", { whatsappNumber: "Invalid WhatsApp number" });

  const tenant = await Tenant.create({ name: profile.businessName, ownerId: user._id });
  try {
    const slug = await generateUniqueBrokerSlug(profile.businessName);
    await Broker.create({
      tenantId: tenant._id,
      slug,
      businessName: profile.businessName,
      contactName: user.name,
      whatsappNumber,
      email: user.email,
      city: profile.city,
      propertyIdPrefix: propertyIdPrefixFrom(profile.businessName),
      whatsapp: { senderNumbers: [] },
    });
    await createTrialSubscription(String(tenant._id));
    await User.updateOne({ _id: user._id }, { $set: { tenantId: tenant._id, role: "owner" } });
    trackEvent("signup_completed", { tenantId: String(tenant._id), userId: String(user._id), properties: { city: profile.city } });
    return { tenantId: String(tenant._id), slug };
  } catch (error) {
    await Promise.allSettled([
      Broker.deleteOne({ tenantId: tenant._id }),
      Subscription.deleteOne({ tenantId: tenant._id }),
      Tenant.deleteOne({ _id: tenant._id }),
    ]);
    throw error;
  }
}

export async function registerBroker(input: RegisterInput) {
  await connectDB();
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) {
    throw new AppError("CONFLICT", "An account with this email already exists", { email: "An account with this email already exists" });
  }
  const user = await User.create({ name: input.name, email, passwordHash: await hashPassword(input.password), role: "owner" });
  try {
    return await createWorkspace(user, input);
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
}

/** Google sign-ups land on /onboarding to create their broker workspace. */
export async function completeOnboarding(userId: string, input: OnboardingInput) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw new AppError("UNAUTHORIZED", "Please sign in again");
  if (user.tenantId) return { tenantId: String(user.tenantId) };
  return createWorkspace(user, input);
}

let dummyHash: Promise<string> | undefined;

export async function authenticateWithPassword(email: string, password: string): Promise<AuthUser | null> {
  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user?.passwordHash) {
    // Equalise timing with the success path to avoid account enumeration.
    dummyHash ??= hashPassword("timing-equaliser");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  user.lastLoginAt = new Date();
  await user.save();
  return toAuthUser(user);
}

/** Finds or creates the user for a verified Google identity, linking by email. */
export async function upsertGoogleUser(profile: { email: string; name?: string | null; image?: string | null; googleId: string }): Promise<AuthUser> {
  await connectDB();
  const email = profile.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: profile.googleId }, { email }] });
  if (!user) {
    user = await User.create({ email, name: profile.name || email.split("@")[0], image: profile.image ?? undefined, googleId: profile.googleId, role: "owner" });
  } else {
    user.googleId ??= profile.googleId;
    if (!user.image && profile.image) user.image = profile.image;
    user.lastLoginAt = new Date();
    await user.save();
  }
  return toAuthUser(user);
}

export async function getAuthUser(userId: string): Promise<AuthUser | null> {
  try {
    await connectDB();
    const user = await User.findById(userId).lean<IUser>();
    return user ? toAuthUser(user) : null;
  } catch (error) {
    logger.error("getAuthUser failed", error);
    return null;
  }
}
