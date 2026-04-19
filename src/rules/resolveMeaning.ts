import {
  buildAuctionRuleKey,
  normalizeRuleKey,
  stripLeadingOurPassOnce,
} from "./auctionKey";
import { compiledVariantMatchesKey } from "./patternMatch";
import type { AuctionCall } from "../auction";
import type { CompiledRules } from "./types";

/** All matching rule meanings, in YAML declaration order; duplicate texts appear once. */
export function resolveMeanings(history: AuctionCall[], compiled: CompiledRules): string[] {
  if (history.length === 0) return [];

  const baseKey = normalizeRuleKey(buildAuctionRuleKey(history));
  const out: string[] = [];
  const seen = new Set<string>();

  function collectForStringKey(keyStr: string): void {
    for (const entry of compiled.orderedRules) {
      const matched = entry.variants.some((v) => compiledVariantMatchesKey(v, keyStr));
      if (!matched) continue;

      if (seen.has(entry.meaning)) continue;
      seen.add(entry.meaning);
      out.push(entry.meaning);
    }
  }

  collectForStringKey(baseKey);

  if (out.length === 0) {
    const withoutLeadingPass = stripLeadingOurPassOnce(baseKey);
    if (withoutLeadingPass !== null && withoutLeadingPass !== baseKey) {
      collectForStringKey(withoutLeadingPass);
    }
  }

  return out;
}
