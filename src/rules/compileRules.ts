import { expandTemplatePattern } from "./expandTemplate";
import { parseStructuredStrain, parseWhere } from "./structuredMatch";
import type {
  CompiledRules,
  StructuredCompiled,
  StructuredStepYaml,
} from "./types";

type YamlRule = Record<string, unknown>;

function num(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function compileStructuredRule(
  row: Record<string, unknown>,
  priority: number,
): StructuredCompiled | null {
  const seq = row.sequence;
  if (!Array.isArray(seq) || seq.length === 0) return null;

  const steps: StructuredCompiled["steps"] = [];
  for (const raw of seq) {
    if (!raw || typeof raw !== "object") return null;
    const step = raw as StructuredStepYaml;
    if (typeof step.level !== "number" || step.level < 1 || step.level > 7) {
      return null;
    }
    const strain = parseStructuredStrain(String(step.strain ?? ""));
    if (!strain) return null;
    const where = parseWhere(typeof step.where === "string" ? step.where : undefined);
    steps.push({ level: step.level, strain, where });
  }

  const meaning = typeof row.meaning === "string" ? row.meaning : "";
  if (!meaning.trim()) return null;

  const weight =
    priority * 10_000 + steps.length * 100 + 50 /* tie-break vs plain string */;

  return { steps, meaning: meaning.trim(), weight };
}

function mergeStringRule(
  map: Map<string, { meaning: string; weight: number }>,
  key: string,
  meaning: string,
  weight: number,
): void {
  const prev = map.get(key);
  if (!prev || weight > prev.weight) {
    map.set(key, { meaning: meaning.trim(), weight });
  }
}

function ruleWeight(priority: number, keyLen: number, parts: number): number {
  return priority * 10_000 + parts * 100 + keyLen;
}

/** Parse YAML document `{ rules: [...] }` into compiled matchers. */
export function compileRulesFromUnknown(doc: unknown): CompiledRules {
  const stringRules = new Map<string, { meaning: string; weight: number }>();
  const structuredRules: StructuredCompiled[] = [];

  if (!doc || typeof doc !== "object") {
    return { stringRules, structuredRules };
  }

  const rules = (doc as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) {
    return { stringRules, structuredRules };
  }

  for (const raw of rules) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as YamlRule;
    const fmt =
      typeof row.format === "string" ? row.format.trim().toLowerCase() : "";
    const priority = num(row.priority, 0);
    const meaning = typeof row.meaning === "string" ? row.meaning.trim() : "";

    if (!meaning) {
      console.warn("[biddingRules] skipped rule without meaning", row);
      continue;
    }

    const hasSeq = Array.isArray(row.sequence) && row.sequence.length > 0;
    const hasPatterns = Array.isArray(row.patterns) && row.patterns.length > 0;
    const hasPattern =
      typeof row.pattern === "string" && (row.pattern as string).trim().length > 0;

    if (hasSeq && (hasPatterns || hasPattern)) {
      console.warn(
        "[biddingRules] rule has both sequence and pattern(s); use format: structured | explicit | template",
        row,
      );
    }

    if (fmt === "structured" || (hasSeq && !hasPatterns && !hasPattern)) {
      const compiled = compileStructuredRule(row, priority);
      if (compiled) {
        structuredRules.push(compiled);
      } else {
        console.warn("[biddingRules] invalid structured rule", row);
      }
      continue;
    }

    if (fmt === "explicit" || hasPatterns) {
      let patterns: string[] = [];
      if (Array.isArray(row.patterns)) {
        patterns = row.patterns
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (fmt === "explicit" && typeof row.pattern === "string") {
        patterns = [(row.pattern as string).trim()].filter(Boolean);
      }
      if (patterns.length === 0) {
        if (fmt === "explicit") {
          console.warn("[biddingRules] explicit rule has no patterns", row);
        }
        continue;
      }
      for (const key of patterns) {
        const parts = key.split("-").length;
        const w = ruleWeight(priority, key.length, parts);
        mergeStringRule(stringRules, key, meaning, w);
      }
      continue;
    }

    if (fmt === "template" || hasPattern) {
      const pattern =
        typeof row.pattern === "string" ? (row.pattern as string).trim() : "";
      if (!pattern) {
        console.warn("[biddingRules] template rule missing pattern", row);
        continue;
      }
      try {
        const keys = expandTemplatePattern(pattern);
        const parts = keys[0]?.split("-").length ?? 0;
        for (const key of keys) {
          const w = ruleWeight(priority, key.length, parts);
          mergeStringRule(stringRules, key, meaning, w);
        }
      } catch (e) {
        console.warn("[biddingRules] template compile error", pattern, e);
      }
      continue;
    }

    console.warn("[biddingRules] unknown rule shape", row);
  }

  structuredRules.sort((a, b) => b.weight - a.weight);
  return { stringRules, structuredRules };
}
