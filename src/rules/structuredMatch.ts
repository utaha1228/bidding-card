import type { AuctionCall } from "../auction";
import { partnershipSide } from "../auction";
import type { Denomination } from "../bidding";
import { parseBidLabel } from "../bidding";
import { RULE_KEY_OUR_PARTNERSHIP_SIDE } from "./auctionKey";
import type { StrainCall, StructuredCompiled, StructuredStrain, StructuredWhere } from "./types";

function strainMatches(denom: Denomination, strain: StructuredStrain): boolean {
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

function strainBidsWithWind(
  history: AuctionCall[],
): { level: number; denom: Denomination; wind: AuctionCall["wind"] }[] {
  const out: { level: number; denom: Denomination; wind: AuctionCall["wind"] }[] = [];
  for (const c of history) {
    const p = parseBidLabel(c.text);
    if (p) out.push({ ...p, wind: c.wind });
  }
  return out;
}

export function structuredRuleMatches(rule: StructuredCompiled, history: AuctionCall[]): boolean {
  const strains = strainBidsWithWind(history);
  if (strains.length !== rule.steps.length) return false;
  for (let i = 0; i < strains.length; i++) {
    const bid = strains[i]!;
    const step = rule.steps[i]!;
    if (step.who !== undefined) {
      const side =
        partnershipSide(bid.wind) === RULE_KEY_OUR_PARTNERSHIP_SIDE ? "us" : "them";
      if (side !== step.who) return false;
    }
    const priorStrains = strains.slice(0, i).map((s) => ({ level: s.level, denom: s.denom }));
    if (!stepMatches({ level: bid.level, denom: bid.denom }, step, priorStrains)) return false;
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
