/** Denominations in ascending bridge order (lowest to highest strain). */
export const DENOMINATIONS = ["club", "diamond", "heart", "spade", "nt"] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** Suit letters: S H D C = spades, hearts, diamonds, clubs (bridge major/minor order for majors). */
const SUIT_LETTER: Record<Exclude<Denomination, "nt">, string> = {
  spade: "S",
  heart: "H",
  diamond: "D",
  club: "C",
};

/** Display like "1C" or "7NT" (canonical); `parseBidLabel` also accepts `7N` as a typo. */
export function formatBid(level: number, denom: Denomination): string {
  if (denom === "nt") return `${level}NT`;
  return `${level}${SUIT_LETTER[denom]}`;
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

/** Map a call label to a strain (or pass / double / redouble) for styling. */
export function strainFromCallText(
  text: string,
): Denomination | "pass" | "double" | "redouble" | null {
  if (text === "Pass") return "pass";
  if (text === "Double") return "double";
  if (text === "Redouble") return "redouble";
  const p = parseBidLabel(text);
  if (p) return p.denom;
  return null;
}

/** Parse labels produced by `formatBid`; returns null for Pass or unrecognized text. */
export function parseBidLabel(text: string): { level: number; denom: Denomination } | null {
  if (text === "Pass") return null;
  const ntLong = text.match(/^([1-7])NT$/);
  if (ntLong) {
    const level = Number(ntLong[1]);
    return { level, denom: "nt" };
  }
  const ntShort = text.match(/^([1-7])N$/);
  if (ntShort) {
    const level = Number(ntShort[1]);
    return { level, denom: "nt" };
  }
  const suit = text.match(/^([1-7])([SHDC])$/);
  if (suit) {
    const map: Record<string, Denomination> = {
      S: "spade",
      H: "heart",
      D: "diamond",
      C: "club",
    };
    const denom = map[suit[2]!];
    if (denom) return { level: Number(suit[1]), denom };
  }
  return null;
}

/** Total order from 1C (0) through 7NT (34). */
export function bidRank(level: number, denom: Denomination): number {
  return (level - 1) * 5 + DENOMINATIONS.indexOf(denom);
}
