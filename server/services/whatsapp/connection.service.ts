import { randomInt } from "node:crypto";
import { normalizePhone } from "@/lib/phone";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Broker, type IBroker } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";
import { getWhatsAppProvider } from "./provider";

const CODE_TTL_MS = 30 * 60_000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export interface WhatsAppSettingsDTO {
  provider: "meta" | "sandbox";
  businessNumber: string;
  senderNumbers: string[];
  connectCode: string;
  connectCodeExpiresAt: string;
  connectedAt?: string;
  registeredNumber: string;
}

/**
 * Connecting WhatsApp: the broker sends "CONNECT <code>" from their phone to the
 * business number. The webhook matches the code and links that sender number to
 * the tenant — proving ownership of the number without SMS OTPs.
 */
export async function getWhatsAppSettings(ctx: TenantContext): Promise<WhatsAppSettingsDTO> {
  await connectDB();
  const broker = await Broker.findOne({ tenantId: ctx.tenantId });
  if (!broker) throw notFound("Broker profile");
  if (!broker.whatsapp?.connectCode || !broker.whatsapp.connectCodeExpiresAt || broker.whatsapp.connectCodeExpiresAt < new Date()) {
    broker.set("whatsapp.connectCode", newCode());
    broker.set("whatsapp.connectCodeExpiresAt", new Date(Date.now() + CODE_TTL_MS));
    await broker.save();
  }
  const provider = await getWhatsAppProvider();
  return {
    provider: provider.name,
    businessNumber: provider.businessNumber,
    senderNumbers: broker.whatsapp.senderNumbers ?? [],
    connectCode: broker.whatsapp.connectCode!,
    connectCodeExpiresAt: broker.whatsapp.connectCodeExpiresAt!.toISOString(),
    connectedAt: broker.whatsapp.connectedAt?.toISOString(),
    registeredNumber: broker.whatsappNumber,
  };
}

/** Called by the webhook when an unknown number sends "CONNECT <code>". */
export async function redeemConnectCode(code: string, from: string): Promise<IBroker | null> {
  await connectDB();
  const sender = normalizePhone(from);
  if (!sender) return null;
  const broker = await Broker.findOne({ "whatsapp.connectCode": code.toUpperCase(), "whatsapp.connectCodeExpiresAt": { $gt: new Date() } });
  if (!broker) return null;
  const takenElsewhere = await Broker.exists({ "whatsapp.senderNumbers": sender, tenantId: { $ne: broker.tenantId } });
  if (takenElsewhere) throw new AppError("CONFLICT", "This WhatsApp number is already connected to another account");
  await Broker.updateOne(
    { _id: broker._id },
    {
      $addToSet: { "whatsapp.senderNumbers": sender },
      $set: { "whatsapp.connectedAt": new Date() },
      $unset: { "whatsapp.connectCode": 1, "whatsapp.connectCodeExpiresAt": 1 },
    },
  );
  await audit({ tenantId: String(broker.tenantId) }, "whatsapp.number_connected", { type: "broker", id: String(broker._id) }, { number: sender });
  return broker.toObject();
}

export async function disconnectSenderNumber(ctx: TenantContext, number: string) {
  assertCan(ctx, "settings:write");
  await connectDB();
  await Broker.updateOne({ tenantId: ctx.tenantId }, { $pull: { "whatsapp.senderNumbers": number } });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "whatsapp.number_disconnected", { type: "broker" }, { number });
}

export async function findBrokerBySender(from: string): Promise<IBroker | null> {
  const sender = normalizePhone(from);
  if (!sender) return null;
  await connectDB();
  return Broker.findOne({ "whatsapp.senderNumbers": sender }).lean<IBroker>();
}
