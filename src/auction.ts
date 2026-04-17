import { formatBid, type Denomination } from "./bidding";

export type Wind = "N" | "E" | "S" | "W";

export type AuctionCall = { wind: Wind; text: string };

const ORDER: Wind[] = ["N", "E", "S", "W"];

function nextWind(last: Wind): Wind {
  const i = ORDER.indexOf(last);
  return ORDER[(i + 1) % 4]!;
}

function upcomingWind(history: AuctionCall[]): Wind {
  if (history.length === 0) return "N";
  return nextWind(history[history.length - 1]!.wind);
}

/** North and South play clicked bids; East and West pass immediately after each. */
export function appendBid(history: AuctionCall[], level: number, denom: Denomination): AuctionCall[] {
  const next = upcomingWind(history);
  if (next !== "N" && next !== "S") {
    return history;
  }

  const h = history.slice();
  h.push({ wind: next, text: formatBid(level, denom) });
  const passFrom = upcomingWind(h);
  if (passFrom === "E" || passFrom === "W") {
    h.push({ wind: passFrom, text: "Pass" });
  }
  return h;
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
