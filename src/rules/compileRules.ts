import { normalizeRuleKey } from "./auctionKey";
import { expandTemplatePattern } from "./expandTemplate";
import { parseStructuredStrain, parseWhere } from "./structuredMatch";
import type {
  CompiledRules,
  OrderedRuleEntry,
  StepWho,
  StructuredCompiled,
  StructuredStepYaml,
} from "./types";

type YamlRule = Record<string, unknown>;

function collectPatterns(row: YamlRule): string[] {
  if (!Array.isArray(row.patterns)) return [];
  return row.patterns
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function compileStructuredRule(row: Record<string, unknown>): StructuredCompiled | null {
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
    const whoRaw =
      typeof step.who === "string" ? step.who.trim().toLowerCase() : undefined;
    const who: StepWho | undefined =
      whoRaw === "us" || whoRaw === "them" ? (whoRaw as StepWho) : undefined;
    steps.push({ level: step.level, strain, where, who });
  }

  const meaning = typeof row.meaning === "string" ? row.meaning : "";
  if (!meaning.trim()) return null;

  return { steps, meaning: meaning.trim() };
}

/** Parse YAML document `{ rules: [...] }` into ordered matchers (same order as the file). */
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
    const fmt =
      typeof row.format === "string" ? row.format.trim().toLowerCase() : "";
    const meaning = typeof row.meaning === "string" ? row.meaning.trim() : "";

    if (typeof row.pattern === "string" && (row.pattern as string).trim()) {
      console.warn(
        "[biddingRules] deprecated `pattern`; use `patterns` (YAML list) instead",
        row,
      );
    }

    if (!meaning) {
      console.warn("[biddingRules] skipped rule without meaning", row);
      continue;
    }

    const hasSeq = Array.isArray(row.sequence) && row.sequence.length > 0;
    const patterns = collectPatterns(row);
    const hasPatterns = patterns.length > 0;

    if (hasSeq && hasPatterns) {
      console.warn(
        "[biddingRules] rule has both sequence and patterns; use format: structured | explicit | template",
        row,
      );
    }

    if (fmt === "structured" || (hasSeq && !hasPatterns)) {
      const compiled = compileStructuredRule(row);
      if (compiled) {
        orderedRules.push({ kind: "structured", rule: compiled });
      } else {
        console.warn("[biddingRules] invalid structured rule", row);
      }
      continue;
    }

    if (hasPatterns) {
      if (fmt === "template") {
        const matchKeys = new Set<string>();
        for (const p of patterns) {
          try {
            for (const k of expandTemplatePattern(p)) {
              matchKeys.add(normalizeRuleKey(k));
            }
          } catch (e) {
            console.warn("[biddingRules] template compile error", p, e);
          }
        }
        if (matchKeys.size === 0) {
          console.warn("[biddingRules] template rule produced no keys", row);
          continue;
        }
        orderedRules.push({ kind: "string", matchKeys, meaning });
        continue;
      }

      if (fmt === "explicit") {
        orderedRules.push({
          kind: "string",
          matchKeys: new Set(patterns.map((p) => normalizeRuleKey(p))),
          meaning,
        });
        continue;
      }

      console.warn(
        "[biddingRules] with `patterns`, set format: explicit | template",
        row,
      );
      continue;
    }

    console.warn("[biddingRules] unknown rule shape (need sequence or patterns)", row);
  }

  return { orderedRules };
}
