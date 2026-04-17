import type { Denomination } from "../bidding";
import type { StrainCall, StructuredCompiled, StructuredStrain, StructuredWhere } from "./types";

function strainMatches(
  denom: Denomination,
  strain: StructuredStrain,
): boolean {
  switch (strain) {
    case "any":
      return true;
    case "major":
      return denom === "heart" || denom === "spade";
    case "minor":
      return denom === "club" || denom === "diamond";
    default:
      return denom === strain;
  }
}

function stepMatches(
  bid: StrainCall,
  step: StructuredCompiled["steps"][0],
  prior: StrainCall[],
): boolean {
  if (bid.level !== step.level) return false;
  if (!strainMatches(bid.denom, step.strain)) return false;

  if (step.where === "new_suit") {
    const shown = new Set(prior.map((p) => p.denom));
    if (shown.has(bid.denom)) return false;
  }
  return true;
}

export function structuredRuleMatches(rule: StructuredCompiled, calls: StrainCall[]): boolean {
  if (calls.length !== rule.steps.length) return false;
  for (let i = 0; i < calls.length; i++) {
    const prior = calls.slice(0, i);
    if (!stepMatches(calls[i]!, rule.steps[i]!, prior)) return false;
  }
  return true;
}

export function parseStructuredStrain(s: string): StructuredStrain | null {
  const v = s.trim().toLowerCase();
  if (v === "major" || v === "minor" || v === "any") return v;
  if (v === "club" || v === "diamond" || v === "heart" || v === "spade" || v === "nt") {
    return v as Denomination;
  }
  return null;
}

export function parseWhere(s: string | undefined): StructuredWhere | undefined {
  if (!s) return undefined;
  if (s === "new_suit") return "new_suit";
  return undefined;
}
