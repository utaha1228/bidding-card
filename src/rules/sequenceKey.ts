import { formatBid } from "../bidding";
import type { StrainCall } from "./types";

export function sequenceKey(calls: StrainCall[]): string {
  return calls.map((c) => formatBid(c.level, c.denom)).join("-");
}
