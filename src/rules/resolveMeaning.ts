import {
  buildAuctionRuleKey,
  normalizeRuleKey,
  stripLeadingOurPassOnce,
} from "./auctionKey";
import { structuredRuleMatches } from "./structuredMatch";
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
      if (entry.kind === "string") {
        if (!entry.matchKeys.has(keyStr)) continue;
      } else {
        if (!structuredRuleMatches(entry.rule, history)) continue;
      }

      const text = entry.kind === "string" ? entry.meaning : entry.rule.meaning;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push(text);
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
