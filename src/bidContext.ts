import type { AuctionCall, Wind } from "./auction";
import { partnershipSide, upcomingWind } from "./auction";
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

export function lastStrainCallWithWind(
  history: AuctionCall[],
): { level: number; denom: Denomination; wind: Wind; index: number } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const parsed = parseBidLabel(history[i]!.text);
    if (parsed) {
      return { ...parsed, wind: history[i]!.wind, index: i };
    }
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

export function isPassLegal(_history: AuctionCall[]): boolean {
  return true;
}

export function isDoubleLegal(history: AuctionCall[]): boolean {
  const strain = lastStrainCallWithWind(history);
  if (!strain) return false;
  const P = upcomingWind(history);
  if (partnershipSide(P) === partnershipSide(strain.wind)) return false;

  const tail = history.slice(strain.index + 1);
  if (tail.some((c) => c.text === "Redouble")) return false;
  if (tail.some((c) => c.text === "Double" && partnershipSide(c.wind) === partnershipSide(P))) {
    return false;
  }

  const last = history[history.length - 1]!;
  if (last.text === "Double" || last.text === "Redouble") return false;
  return true;
}

export function isRedoubleLegal(history: AuctionCall[]): boolean {
  const strain = lastStrainCallWithWind(history);
  if (!strain) return false;
  const last = history[history.length - 1]!;
  if (last.text !== "Double") return false;
  if (partnershipSide(last.wind) === partnershipSide(strain.wind)) return false;

  const tail = history.slice(strain.index + 1);
  if (tail.some((c) => c.text === "Redouble")) return false;

  const P = upcomingWind(history);
  return partnershipSide(P) === partnershipSide(strain.wind);
}

export function isCallLegal(history: AuctionCall[], text: string): boolean {
  if (text === "Pass") return isPassLegal(history);
  if (text === "Double") return isDoubleLegal(history);
  if (text === "Redouble") return isRedoubleLegal(history);
  const p = parseBidLabel(text);
  if (!p) return false;
  return isBidLegal(history, p.level, p.denom);
}

/** Non-strain calls that are legal for the next player (for UI lists). */
export function legalNonStrainCalls(history: AuctionCall[]): ("Pass" | "Double" | "Redouble")[] {
  const out: ("Pass" | "Double" | "Redouble")[] = [];
  if (isPassLegal(history)) out.push("Pass");
  if (isDoubleLegal(history)) out.push("Double");
  if (isRedoubleLegal(history)) out.push("Redouble");
  return out;
}
