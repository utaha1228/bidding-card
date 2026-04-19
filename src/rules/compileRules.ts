import { compilePatternString } from "./patternMatch";
import type { CompiledRules, OrderedRuleEntry } from "./types";

type YamlRule = Record<string, unknown>;

function collectPatterns(row: YamlRule): string[] {
  if (!Array.isArray(row.patterns)) return [];
  return row.patterns
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse YAML `{ rules: [...] }` — each rule: `patterns` + `meaning` only. */
export function compileRulesFromUnknown(doc: unknown): CompiledRules {
  const orderedRules: OrderedRuleEntry[] = [];

  if (!doc || typeof doc !== "object") {
    return { orderedRules };
  }

  const rules = (doc as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) {
    return { orderedRules };
  }

  for (const raw of rules) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as YamlRule;
    const meaning = typeof row.meaning === "string" ? row.meaning.trim() : "";
    const patterns = collectPatterns(row);

    if (!meaning) {
      continue;
    }

    if (patterns.length === 0) {
      continue;
    }

    const variants = [];
    for (const p of patterns) {
      const compiled = compilePatternString(p);
      if (compiled) {
        variants.push(compiled);
      }
    }

    if (variants.length === 0) {
      continue;
    }

    orderedRules.push({ variants, meaning });
  }

  return { orderedRules };
}
