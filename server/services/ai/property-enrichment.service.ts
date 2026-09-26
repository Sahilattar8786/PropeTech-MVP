import { logger } from "@/server/lib/logger";
import { templateCopy } from "./copywriter";
import { validateCopy } from "./property-validation.service";
import { getAIProvider } from "./provider";
import type { PropertyCopy, PropertyFacts } from "./types";

export interface EnrichmentResult {
  copy: PropertyCopy;
  /** Which engine produced the final copy. */
  generator: "llm" | "template";
  warnings: string[];
}

/**
 * Step 3 — facts → title, description, highlights and SEO.
 * LLM copy is only accepted if it passes validation; otherwise we fall back to
 * deterministic, fact-only templates. Plans without AI enrichment get a basic title.
 */
export async function enrichProperty(facts: PropertyFacts, sourceText: string, opts: { enabled: boolean }): Promise<EnrichmentResult> {
  if (!opts.enabled) return { copy: templateCopy(facts, { enriched: false, sourceText }), generator: "template", warnings: [] };

  const provider = getAIProvider();
  if (provider.name === "rules") return { copy: templateCopy(facts, { enriched: true, sourceText }), generator: "template", warnings: [] };

  try {
    const output = await provider.enrichProperty({ text: sourceText, images: [], facts });
    if (output.copy) {
      const check = validateCopy(output.copy, facts, sourceText);
      if (check.ok) return { copy: output.copy, generator: "llm", warnings: [] };
      logger.warn("AI copy rejected by validation", { reason: check.reason });
      return {
        copy: templateCopy(facts, { enriched: true, sourceText }),
        generator: "template",
        warnings: ["AI-written description included unverified details, so a fact-only description was used instead."],
      };
    }
  } catch (error) {
    logger.warn("AI enrichment failed, using template copy", error);
  }
  return { copy: templateCopy(facts, { enriched: true, sourceText }), generator: "template", warnings: [] };
}
