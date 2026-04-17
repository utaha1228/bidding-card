import { sequenceKey } from "./sequenceKey";
import { structuredRuleMatches } from "./structuredMatch";
import type { CompiledRules, StrainCall } from "./types";

/** Pick best meaning: all structured + exact string rules that match; highest weight wins. */
export function resolveMeaning(calls: StrainCall[], compiled: CompiledRules): string | null {
  if (calls.length === 0) return null;

  const key = sequenceKey(calls);
  let best: { meaning: string; weight: number } | null = null;

  for (const sr of compiled.structuredRules) {
    if (structuredRuleMatches(sr, calls)) {
      const cand = { meaning: sr.meaning, weight: sr.weight };
      if (!best || cand.weight > best.weight) best = cand;
    }
  }

  const strHit = compiled.stringRules.get(key);
  if (strHit) {
    const cand = { meaning: strHit.meaning, weight: strHit.weight };
    if (!best || cand.weight > best.weight) best = cand;
  }

  return best?.meaning ?? null;
}
