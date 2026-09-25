import { getAIProvider } from "./provider";
import type { PropertyAIInput, PropertyAIOutput } from "./types";

const MAX_INPUT_CHARS = 4000;

/** Step 1 — raw WhatsApp text → structured facts (untrusted until validated). */
export async function extractPropertyFacts(input: PropertyAIInput): Promise<PropertyAIOutput> {
  const text = input.text.replace(/‎|‏/g, "").trim().slice(0, MAX_INPUT_CHARS);
  return getAIProvider().extractProperty({ ...input, text });
}
