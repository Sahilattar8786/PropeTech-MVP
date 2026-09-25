import { describe, expect, it } from "vitest";
import { canTransition, pipelineStateOf } from "@/lib/domain/property";
import { formatPrice } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { brokerSlugFromName, isValidBrokerSlug } from "@/lib/slug";
import { buildEnquiryMessage, buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { formToPatch, propertyToFormValues, publishBlockers } from "@/lib/validation/property";
import { hubSignature, signatureMatches, verifySubscription } from "@/server/services/whatsapp/provider";
import { parseWebhookPayload } from "@/server/services/whatsapp/whatsapp-webhook.service";
import { propertySlugBase } from "@/server/services/ai/copywriter";

describe("WhatsApp CTA (spec §26)", () => {
  it("builds the enquiry message and wa.me URL", () => {
    const message = buildEnquiryMessage(
      { contactName: "Rehan Khan", businessName: "Rehan Brokers" },
      {
        title: "Premium 3 BHK Apartment in Whitefield",
        location: { locality: "Whitefield", city: "Bangalore" },
        price: { amount: 15000000, currency: "INR" },
        listingType: "sale",
        bedrooms: 3,
        propertyType: "apartment",
        propertyId: "REH-1024",
      },
      "https://rehanbrokers.propflow.in/property/3bhk-whitefield",
    );
    expect(message).toBe(
      "Hi Rehan,\nI'm interested in:\nPremium 3 BHK Apartment in Whitefield\nWhitefield\n₹1.50 Cr\nProperty ID: REH-1024\nProperty Link:\nhttps://rehanbrokers.propflow.in/property/3bhk-whitefield",
    );
    const url = buildWhatsAppUrl("+91 98765 43210", message);
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1]!)).toBe(message);
  });
});

describe("formatting and identifiers", () => {
  it("formats Indian prices", () => {
    expect(formatPrice(15000000)).toBe("₹1.50 Cr");
    expect(formatPrice(20000000)).toBe("₹2 Cr");
    expect(formatPrice(8500000)).toBe("₹85 L");
    expect(formatPrice(45000, { perMonth: true })).toBe("₹45,000/month");
  });

  it("normalises phone numbers to WhatsApp format", () => {
    expect(normalizePhone("98765 43210")).toBe("919876543210");
    expect(normalizePhone("+91-98765-43210")).toBe("919876543210");
    expect(normalizePhone("09876543210")).toBe("919876543210");
    expect(normalizePhone("123")).toBeNull();
  });

  it("generates broker and property slugs", () => {
    expect(brokerSlugFromName("Rehan Brokers")).toBe("rehanbrokers");
    expect(isValidBrokerSlug("dashboard")).toBe(false);
    expect(propertySlugBase({ bedrooms: 3, propertyType: "apartment", location: { locality: "Whitefield", city: null, address: null, state: null, pincode: null } })).toBe("3bhk-whitefield");
    expect(propertySlugBase({ bedrooms: 4, propertyType: "villa", location: { locality: "Sarjapur Road", city: null, address: null, state: null, pincode: null } })).toBe("4bhk-villa-sarjapur-road");
  });
});

describe("property lifecycle", () => {
  it("enforces the status state machine", () => {
    expect(canTransition("draft", "active")).toBe(true);
    expect(canTransition("draft", "sold")).toBe(false);
    expect(canTransition("active", "reserved")).toBe(true);
    expect(canTransition("reserved", "sold")).toBe(true);
    expect(canTransition("active", "delisted")).toBe(true);
    expect(canTransition("sold", "reserved")).toBe(false);
  });

  it("derives inbox pipeline states", () => {
    expect(pipelineStateOf({ status: "draft", ingestion: { stage: "ai_processing" } })).toBe("ai_processing");
    expect(pipelineStateOf({ status: "draft", ingestion: { stage: "completed" } })).toBe("draft_ready");
    expect(pipelineStateOf({ status: "draft", ingestion: { stage: "completed" }, reviewedAt: new Date().toISOString() })).toBe("reviewed");
    expect(pipelineStateOf({ status: "active", ingestion: { stage: "completed" } })).toBe("published");
    expect(pipelineStateOf({ status: "draft", ingestion: { stage: "failed" } })).toBe("failed");
  });

  it("requires core fields before publishing", () => {
    expect(publishBlockers({ title: "3 BHK", propertyType: "apartment", listingType: undefined, location: undefined })).toEqual(["Sale or rent", "Location (locality or city)"]);
  });

  it("round-trips editor values", () => {
    const values = propertyToFormValues({
      id: "x", tenantId: "t", title: "3 BHK", propertyType: "apartment", listingType: "sale", status: "draft",
      price: { amount: 15000000, currency: "INR" }, area: { value: 1800, unit: "sqft" }, bedrooms: 3,
      amenities: [], highlights: [], images: [], videos: [], fieldSources: {}, collectionIds: [], views: 0, whatsappClicks: 0,
      createdAt: "", updatedAt: "",
    });
    expect(values.priceValue).toBe("1.5");
    expect(values.priceUnit).toBe("crore");
    expect(formToPatch(values).price?.amount).toBe(15000000);
  });
});

describe("WhatsApp webhook security", () => {
  it("verifies subscription handshake", () => {
    const params = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "42" });
    expect(verifySubscription(params, "abc")).toBe("42");
    expect(verifySubscription(params, "wrong")).toBeNull();
  });

  it("verifies X-Hub-Signature-256", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(signatureMatches(body, hubSignature(body, "s3cret"), "s3cret")).toBe(true);
    expect(signatureMatches(body, hubSignature(body, "other"), "s3cret")).toBe(false);
    expect(signatureMatches(body, null, "s3cret")).toBe(false);
  });

  it("parses Meta message payloads", () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ id: "1", changes: [{ field: "messages", value: { metadata: { phone_number_id: "p1", display_phone_number: "918000012345" }, messages: [{ from: "919876543210", id: "wamid.1", timestamp: "1700000000", type: "image", image: { id: "m1", mime_type: "image/jpeg", caption: "3bhk" } }] } }] }],
      }),
    );
    expect(payload.entry[0]!.changes[0]!.value.messages![0]!.image!.id).toBe("m1");
    expect(() => parseWebhookPayload("not json")).toThrow();
  });
});
