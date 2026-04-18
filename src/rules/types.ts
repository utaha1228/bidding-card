import type { Denomination } from "../bidding";

export type StrainCall = { level: number; denom: Denomination };

export type StructuredStrain =
  | Denomination
  | "major"
  | "minor"
  | "any";

export type StructuredWhere = "new_suit";

/** Optional: constrain which partnership made this strain bid (`us` = NS when rule keys use NS as “we”). */
export type StepWho = "us" | "them";

export type StructuredStepYaml = {
  level: number;
  strain: string;
  where?: string;
  who?: string;
};

export type StructuredCompiled = {
  steps: {
    level: number;
    strain: StructuredStrain;
    where?: StructuredWhere;
    who?: StepWho;
  }[];
  meaning: string;
};

/** One YAML rule in file order: string keys (explicit/template) or structured steps. */
export type OrderedRuleEntry =
  | { kind: "string"; matchKeys: Set<string>; meaning: string }
  | { kind: "structured"; rule: StructuredCompiled };

export type CompiledRules = {
  orderedRules: OrderedRuleEntry[];
};
