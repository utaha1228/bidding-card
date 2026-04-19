import type { Denomination } from "../bidding";
import type { CompiledPatternVariant } from "./patternMatch";

export type StrainCall = { level: number; denom: Denomination };

export type OrderedRuleEntry = {
  variants: CompiledPatternVariant[];
  meaning: string;
};

export type CompiledRules = {
  orderedRules: OrderedRuleEntry[];
};
