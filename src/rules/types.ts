import type { Denomination } from "../bidding";

export type StrainCall = { level: number; denom: Denomination };

export type StructuredStrain =
  | Denomination
  | "major"
  | "minor"
  | "any";

export type StructuredWhere = "new_suit";

export type StructuredStepYaml = {
  level: number;
  strain: string;
  where?: string;
};

export type StructuredCompiled = {
  steps: {
    level: number;
    strain: StructuredStrain;
    where?: StructuredWhere;
  }[];
  meaning: string;
  weight: number;
};

export type CompiledRules = {
  stringRules: Map<string, { meaning: string; weight: number }>;
  structuredRules: StructuredCompiled[];
};
