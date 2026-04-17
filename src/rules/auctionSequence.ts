import type { AuctionCall } from "../auction";
import { parseBidLabel } from "../bidding";
import type { StrainCall } from "./types";

export function strainCallsFromAuction(history: AuctionCall[]): StrainCall[] {
  const out: StrainCall[] = [];
  for (const c of history) {
    const p = parseBidLabel(c.text);
    if (p) out.push(p);
  }
  return out;
}
