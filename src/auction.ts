import { formatBid, type Denomination } from "./bidding";

export type Wind = "N" | "E" | "S" | "W";

export type AuctionCall = { wind: Wind; text: string };

const ORDER: Wind[] = ["N", "E", "S", "W"];

function nextWind(last: Wind): Wind {
  const i = ORDER.indexOf(last);
  return ORDER[(i + 1) % 4]!;
}

export function upcomingWind(history: AuctionCall[]): Wind {
  if (history.length === 0) return "N";
  return nextWind(history[history.length - 1]!.wind);
}

/** NS vs EW */
export function partnershipSide(w: Wind): 0 | 1 {
  return w === "N" || w === "S" ? 0 : 1;
}

/** Append one call for whoever is next to speak (N, E, S, W in rotation). */
export function appendCall(history: AuctionCall[], text: string): AuctionCall[] {
  const h = history.slice();
  h.push({ wind: upcomingWind(history), text });
  return h;
}

/** Drop the last call, if any (same sequence as “go back” one step). */
export function undoLastCall(history: AuctionCall[]): AuctionCall[] {
  if (history.length === 0) return history;
  return history.slice(0, -1);
}

/** Append a strain bid for the next player (same as `appendCall` with `formatBid`). */
export function appendBid(history: AuctionCall[], level: number, denom: Denomination): AuctionCall[] {
  return appendCall(history, formatBid(level, denom));
}

export function auctionRows(history: AuctionCall[], minRows = 1): string[][] {
  const rows = Math.max(minRows, Math.ceil(history.length / 4) || 1);
  const out: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      row.push(idx < history.length ? history[idx]!.text : "—");
    }
    out.push(row);
  }
  return out;
}
