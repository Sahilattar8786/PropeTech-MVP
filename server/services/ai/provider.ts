import { env } from "@/server/lib/env";
import { OpenAIProvider } from "./openai.provider";
import { RulesProvider } from "./rules.provider";
import type { AIProvider } from "./types";

let provider: AIProvider | null = null;

/** Picks the configured provider. Defaults to OpenAI when an API key is present. */
export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const e = env();
  const choice = e.AI_PROVIDER ?? (e.AI_API_KEY ? "openai" : "rules");
  if (choice === "openai") {
    if (!e.AI_API_KEY) throw new Error("AI_PROVIDER=openai requires AI_API_KEY");
    provider = new OpenAIProvider(e.AI_API_KEY, e.AI_MODEL, e.AI_API_URL.replace(/\/+$/, ""));
  } else {
    provider = new RulesProvider();
  }
  return provider;
}

/** Test seam. */
export function setAIProvider(next: AIProvider | null) {
  provider = next;
}
