import { parse } from "yaml";
import rulesYaml from "./biddingRules.yaml?raw";
import { compileRulesFromUnknown } from "./rules/compileRules";
import { resolveMeaning } from "./rules/resolveMeaning";
import type { CompiledRules, StrainCall } from "./rules/types";
import { formatBid, type Denomination } from "./bidding";

type Key = `${number}-${Denomination}`;

/** Built-in fallback when no YAML rule matches the full sequence. */
const OPENING_NOTES: Partial<Record<Key, string>> = {
  "1-club":
    "Usually shows length in clubs (often 3+ at the one-level in SAYC) and opening values; may be stronger or artificial in other systems.",
  "1-diamond":
    "Usually shows length in diamonds with opening values; often 4+ cards unless you play short-diamond treatments.",
  "1-heart":
    "Five-card (or longer) major with opening strength in standard American methods unless you agree otherwise.",
  "1-spade":
    "Five-card (or longer) spades with opening values; spades rank above hearts when both majors are possible.",
  "1-nt":
    "Balanced hand in a narrow high-card range (commonly 15–17) in SAYC; ranges differ by partnership.",
  "2-nt":
    "Often a balanced invite or game force in a defined range (e.g. 20–21); confirm your local agreement.",
  "3-nt":
    "Often gambling or 25–27 balanced depending on partnership; always confirm house rules.",
};

function strainWord(denom: Denomination): string {
  if (denom === "nt") return "notrump";
  const w: Record<Exclude<Denomination, "nt">, string> = {
    club: "clubs",
    diamond: "diamonds",
    heart: "hearts",
    spade: "spades",
  };
  return w[denom];
}

function defaultMeaning(level: number, denom: Denomination): string {
  if (denom === "nt") {
    return `${formatBid(level, denom)}: natural notrump at this level unless your notes say otherwise; strength and shape depend on the auction so far.`;
  }
  return `${formatBid(level, denom)}: usually a natural strain in ${strainWord(denom)}; length and strength depend on earlier calls and your system card.`;
}

function fallbackSingleBid(level: number, denom: Denomination): string {
  const key = `${level}-${denom}` as Key;
  return OPENING_NOTES[key] ?? defaultMeaning(level, denom);
}

let compiled: CompiledRules | null = null;

function getCompiled(): CompiledRules {
  if (!compiled) {
    const doc = parse(rulesYaml);
    compiled = compileRulesFromUnknown(doc);
  }
  return compiled;
}

/** Meaning for the full strain sequence (e.g. current auction); YAML first, then single-bid fallback on last call. */
export function meaningForStrainCalls(calls: StrainCall[]): string {
  if (calls.length === 0) return "";
  const fromYaml = resolveMeaning(calls, getCompiled());
  if (fromYaml) return fromYaml;
  const last = calls[calls.length - 1]!;
  return fallbackSingleBid(last.level, last.denom);
}
