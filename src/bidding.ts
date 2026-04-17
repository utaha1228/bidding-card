/** Denominations in ascending bridge order (lowest to highest strain). */
export const DENOMINATIONS = ["club", "diamond", "heart", "spade", "nt"] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

const SUIT_SYMBOL: Record<Exclude<Denomination, "nt">, string> = {
  club: "♣",
  diamond: "♦",
  heart: "♥",
  spade: "♠",
};

/** Display like "1♣" or "7NT" (ASCII strain letters for screen readers via aria-label). */
export function formatBid(level: number, denom: Denomination): string {
  if (denom === "nt") return `${level}NT`;
  return `${level}${SUIT_SYMBOL[denom]}`;
}

export function bidAriaLabel(level: number, denom: Denomination): string {
  const names: Record<Denomination, string> = {
    club: "clubs",
    diamond: "diamonds",
    heart: "hearts",
    spade: "spades",
    nt: "no trump",
  };
  return `${level} ${names[denom]}`;
}

export function allBids(): { level: number; denom: Denomination }[] {
  const out: { level: number; denom: Denomination }[] = [];
  for (let level = 1; level <= 7; level++) {
    for (const denom of DENOMINATIONS) {
      out.push({ level, denom });
    }
  }
  return out;
}

/** Map a call label (from `formatBid` or `"Pass"`) to a strain for styling. */
export function strainFromCallText(text: string): Denomination | "pass" | null {
  if (text === "Pass") return "pass";
  if (text.endsWith("NT")) return "nt";
  for (const denom of DENOMINATIONS) {
    if (denom === "nt") continue;
    if (text.includes(SUIT_SYMBOL[denom])) return denom;
  }
  return null;
}

/** Parse labels produced by `formatBid`; returns null for Pass or unrecognized text. */
export function parseBidLabel(text: string): { level: number; denom: Denomination } | null {
  if (text === "Pass") return null;
  const nt = text.match(/^([1-7])NT$/);
  if (nt) {
    const level = Number(nt[1]);
    return { level, denom: "nt" };
  }
  const m = text.match(/^([1-7])([♣♦♥♠])$/);
  if (!m) return null;
  const sym = m[2]!;
  const map: Record<string, Denomination> = {
    "♣": "club",
    "♦": "diamond",
    "♥": "heart",
    "♠": "spade",
  };
  const denom = map[sym];
  if (!denom) return null;
  return { level: Number(m[1]), denom };
}

/** Total order from 1♣ (0) through 7NT (34). */
export function bidRank(level: number, denom: Denomination): number {
  return (level - 1) * 5 + DENOMINATIONS.indexOf(denom);
}
