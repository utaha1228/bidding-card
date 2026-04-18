import type { AuctionCall } from "../auction";
import { partnershipSide } from "../auction";
import { formatBid, parseBidLabel } from "../bidding";

/** Partnership index treated as “us” in rule keys (0 = North–South, 1 = East–West). */
export const RULE_KEY_OUR_PARTNERSHIP_SIDE = 0 as const;

function isUsWind(wind: AuctionCall["wind"]): boolean {
  return partnershipSide(wind) === RULE_KEY_OUR_PARTNERSHIP_SIDE;
}

/**
 * Build the auction rule key from table history (chronological).
 * — Our pass: P; opponent pass: (P)
 * — Our strain: 1C, 2NT, …; opponent strain: (1H), …
 * — Double / redouble: X / XX for us, (X) / (XX) for them
 */
export function buildAuctionRuleKey(history: AuctionCall[]): string {
  const parts: string[] = [];
  for (const c of history) {
    if (c.text === "Pass") {
      parts.push(isUsWind(c.wind) ? "P" : "(P)");
      continue;
    }
    if (c.text === "Double") {
      parts.push(isUsWind(c.wind) ? "X" : "(X)");
      continue;
    }
    if (c.text === "Redouble") {
      parts.push(isUsWind(c.wind) ? "XX" : "(XX)");
      continue;
    }
    const p = parseBidLabel(c.text);
    if (!p) continue;
    const t = formatBid(p.level, p.denom);
    parts.push(isUsWind(c.wind) ? t : `(${t})`);
  }
  return parts.join("-");
}

/** Uppercase SHDC; normalize notrump to `…NT` (including mistaken `…N`). */
function canonStrainToken(t: string): string {
  const parenSuit = t.match(/^\(([1-7])([shdcSHDC])\)$/);
  if (parenSuit) return `(${parenSuit[1]}${parenSuit[2].toUpperCase()})`;
  const bareSuit = t.match(/^([1-7])([shdcSHDC])$/);
  if (bareSuit) return `${bareSuit[1]}${bareSuit[2].toUpperCase()}`;

  const parenNt = t.match(/^\(([1-7])NT?\)$/i);
  if (parenNt) return `(${parenNt[1]}NT)`;
  const bareNt = t.match(/^([1-7])NT?$/i);
  if (bareNt) return `${bareNt[1]}NT`;

  return t;
}

/** Strip optional opponent passes `(P)`; canonicalize strain tokens for matching. */
export function normalizeRuleKey(key: string): string {
  return key
    .split("-")
    .map((t) => t.trim())
    .filter((t) => t !== "" && t !== "(P)" && t !== "(p)")
    .map(canonStrainToken)
    .join("-");
}

/**
 * After normalization: remove one leading our-pass token `P` if present.
 * Used when no rule matches a `P-…` key so matching can retry as if that pass were not part of the agreement.
 */
export function stripLeadingOurPassOnce(key: string): string | null {
  const parts = key.split("-").map((t) => t.trim()).filter((t) => t !== "");
  if (parts.length === 0 || parts[0] !== "P") return null;
  const rest = parts.slice(1);
  return rest.length ? rest.join("-") : "";
}
