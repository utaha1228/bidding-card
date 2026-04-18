import { parse } from "yaml";
import type { AuctionCall } from "./auction";
import rulesYaml from "./biddingRules.yaml?raw";
import { compileRulesFromUnknown } from "./rules/compileRules";
import { resolveMeanings } from "./rules/resolveMeaning";
import type { CompiledRules } from "./rules/types";

let compiled: CompiledRules | null = null;

function getCompiled(): CompiledRules {
  if (!compiled) {
    const doc = parse(rulesYaml);
    compiled = compileRulesFromUnknown(doc);
  }
  return compiled;
}

/** All meanings from `biddingRules.yaml` for this auction, in rule order; empty if none. */
export function meaningsForAuctionHistory(history: AuctionCall[]): string[] {
  if (history.length === 0) return [];
  return resolveMeanings(history, getCompiled());
}
