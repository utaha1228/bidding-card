import type { AuctionCall } from "./auction";
import { allBids, bidRank, parseBidLabel, type Denomination } from "./bidding";

export function lastContractFromAuction(
  history: AuctionCall[],
): { level: number; denom: Denomination } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const parsed = parseBidLabel(history[i]!.text);
    if (parsed) return parsed;
  }
  return null;
}

export function legalBidsAfter(history: AuctionCall[]): { level: number; denom: Denomination }[] {
  const last = lastContractFromAuction(history);
  const bids = allBids();
  if (!last) return bids;
  const floor = bidRank(last.level, last.denom);
  return bids.filter((b) => bidRank(b.level, b.denom) > floor);
}

export function isBidLegal(history: AuctionCall[], level: number, denom: Denomination): boolean {
  return legalBidsAfter(history).some((b) => b.level === level && b.denom === denom);
}
