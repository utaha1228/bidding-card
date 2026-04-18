import { DENOMINATIONS, formatBid, type Denomination } from "../bidding";
import { normalizeRuleKey } from "./auctionKey";

const MAJORS: Denomination[] = ["heart", "spade"];
const MINORS: Denomination[] = ["club", "diamond"];
const SUITS4: Denomination[] = ["club", "diamond", "heart", "spade"];

export type StrainSlot = "M" | "m" | "oM" | "om" | "X" | "Y" | "Z";
type SlotBind = Partial<Record<StrainSlot, Denomination>>;

export type TemplatePart =
  | { side: "us" | "them"; kind: "pass" }
  | { side: "us" | "them"; kind: "double" }
  | { side: "us" | "them"; kind: "redouble" }
  | { side: "us" | "them"; kind: "strain_lit"; level: number; denom: Denomination }
  | { side: "us" | "them"; kind: "strain_slot"; level: number; slot: StrainSlot }
  | { side: "us" | "them"; kind: "strain_any"; level: number; wildIdx: number };

type WildBind = Map<number, Denomination>;

/** Split on `-` only when not inside parentheses. */
export function splitAuctionPattern(pattern: string): string[] {
  const segments: string[] = [];
  let cur = "";
  let depth = 0;
  for (const ch of pattern) {
    if (ch === "(") depth++;
    else if (ch === ")" && depth > 0) depth--;
    if (ch === "-" && depth === 0) {
      const t = cur.trim();
      if (t) segments.push(t);
      cur = "";
      continue;
    }
    cur += ch;
  }
  const last = cur.trim();
  if (last) segments.push(last);
  return segments;
}

function suitFromLetter(letter: string): Denomination | null {
  switch (letter.toUpperCase()) {
    case "S":
      return "spade";
    case "H":
      return "heart";
    case "D":
      return "diamond";
    case "C":
      return "club";
    default:
      return null;
  }
}

/**
 * Parse a strain segment body (no outer parens): level + oM / om / NT / N typo / ? / slots / SHDC.
 * Rule notation uses ASCII suits only; lowercase shdc is fine.
 */
function parseStrainBody(body: string, side: "us" | "them"): TemplatePart {
  const s = body.trim();

  const oM = s.match(/^([1-7])oM$/);
  if (oM) return { side, kind: "strain_slot", level: Number(oM[1]), slot: "oM" };
  const om = s.match(/^([1-7])om$/);
  if (om) return { side, kind: "strain_slot", level: Number(om[1]), slot: "om" };

  const ntLong = s.match(/^([1-7])NT$/i);
  if (ntLong) {
    return { side, kind: "strain_lit", level: Number(ntLong[1]), denom: "nt" };
  }
  const ntShort = s.match(/^([1-7])N$/);
  if (ntShort) {
    return { side, kind: "strain_lit", level: Number(ntShort[1]), denom: "nt" };
  }

  const wild = s.match(/^([1-7])\?$/);
  if (wild) {
    return { side, kind: "strain_any", level: Number(wild[1]), wildIdx: -1 };
  }

  const slotOrSuit = s.match(/^([1-7])([MmXxYyZzSHDCshdc])$/);
  if (!slotOrSuit) {
    throw new Error(`Invalid strain segment "${body}"`);
  }
  const level = Number(slotOrSuit[1]);
  const sym = slotOrSuit[2]!;
  const upper = sym.toUpperCase();

  if (upper === "M" || upper === "m") {
    return { side, kind: "strain_slot", level, slot: upper as "M" | "m" };
  }
  if (upper === "X" || upper === "Y" || upper === "Z") {
    return { side, kind: "strain_slot", level, slot: upper as "X" | "Y" | "Z" };
  }

  const denom = suitFromLetter(sym);
  if (!denom) throw new Error(`Bad suit letter in "${body}"`);
  return { side, kind: "strain_lit", level, denom };
}

function assignWildIndices(parts: TemplatePart[]): TemplatePart[] {
  let w = 0;
  return parts.map((p) => {
    if (p.kind === "strain_any" && p.wildIdx < 0) {
      return { ...p, wildIdx: w++ };
    }
    return p;
  });
}

export function parseTemplateSegment(segment: string): TemplatePart {
  let side: "us" | "them" = "us";
  let body = segment.trim();
  if (body.startsWith("(") && body.endsWith(")")) {
    side = "them";
    body = body.slice(1, -1).trim();
  }
  const u = body.toUpperCase();
  if (u === "P") return { side, kind: "pass" };
  if (u === "XX") return { side, kind: "redouble" };
  if (u === "X") return { side, kind: "double" };
  return parseStrainBody(body, side);
}

function buildToken(p: TemplatePart, bind: SlotBind, wild: WildBind): string {
  const wrap = (inner: string) => (p.side === "them" ? `(${inner})` : inner);
  switch (p.kind) {
    case "pass":
      return wrap("P");
    case "double":
      return wrap("X");
    case "redouble":
      return wrap("XX");
    case "strain_lit":
      return wrap(formatBid(p.level, p.denom));
    case "strain_slot": {
      const d = bind[p.slot];
      if (!d) throw new Error(`Missing binding for slot ${p.slot}`);
      return wrap(formatBid(p.level, d));
    }
    case "strain_any": {
      const d = wild.get(p.wildIdx);
      if (!d) throw new Error(`Missing wildcard binding for ? at index ${p.wildIdx}`);
      return wrap(formatBid(p.level, d));
    }
  }
}

function buildKey(parts: TemplatePart[], bind: SlotBind, wild: WildBind): string {
  return normalizeRuleKey(parts.map((p) => buildToken(p, bind, wild)).join("-"));
}

function orderXyzSlots(parts: TemplatePart[]): ("X" | "Y" | "Z")[] {
  const out: ("X" | "Y" | "Z")[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.kind !== "strain_slot") continue;
    if (p.slot !== "X" && p.slot !== "Y" && p.slot !== "Z") continue;
    if (seen.has(p.slot)) continue;
    seen.add(p.slot);
    out.push(p.slot);
  }
  return out;
}

function* assignDistinctXyz(used: ("X" | "Y" | "Z")[]): Generator<SlotBind> {
  if (used.length === 0) {
    yield {};
    return;
  }
  function* dfs(i: number, picked: Denomination[], bind: SlotBind): Generator<SlotBind> {
    if (i >= used.length) {
      yield { ...bind };
      return;
    }
    const slot = used[i]!;
    for (const d of SUITS4) {
      if (picked.includes(d)) continue;
      yield* dfs(i + 1, [...picked, d], { ...bind, [slot]: d });
    }
  }
  yield* dfs(0, [], {});
}

function otherMajor(M: Denomination): Denomination {
  return MAJORS.find((x) => x !== M)!;
}

function otherMinor(m: Denomination): Denomination {
  return MINORS.find((x) => x !== m)!;
}

/** Which M/m/oM/om slot combination a pattern uses (after validation). */
type MmProfile =
  | "none"
  | "M"
  | "m"
  | "M+m"
  | "M+oM"
  | "m+om"
  | "M+m+oM"
  | "M+m+om"
  | "M+m+oM+om";

function detectMmProfile(parts: TemplatePart[]): MmProfile {
  const needM = parts.some((p) => p.kind === "strain_slot" && p.slot === "M");
  const needm = parts.some((p) => p.kind === "strain_slot" && p.slot === "m");
  const needoM = parts.some((p) => p.kind === "strain_slot" && p.slot === "oM");
  const needom = parts.some((p) => p.kind === "strain_slot" && p.slot === "om");

  if (!needM && !needm && !needoM && !needom) return "none";
  if (needoM && !needM) throw new Error("oM requires M in the same pattern");
  if (needom && !needm) throw new Error("om requires m in the same pattern");

  if (needM && needm && needoM && needom) return "M+m+oM+om";
  if (needM && needm && needoM) return "M+m+oM";
  if (needM && needm && needom) return "M+m+om";
  if (needM && needoM) return "M+oM";
  if (needm && needom) return "m+om";
  if (needM && needm) return "M+m";
  if (needM) return "M";
  if (needm) return "m";

  throw new Error("Unsupported M/m/oM/om slot combination");
}

function* enumMmBinds(profile: MmProfile): Generator<SlotBind> {
  switch (profile) {
    case "none":
      yield {};
      return;
    case "M":
      for (const M of MAJORS) yield { M };
      return;
    case "m":
      for (const m of MINORS) yield { m };
      return;
    case "M+m":
      for (const M of MAJORS) {
        for (const m of MINORS) yield { M, m };
      }
      return;
    case "M+oM":
      for (const M of MAJORS) yield { M, oM: otherMajor(M) };
      return;
    case "m+om":
      for (const m of MINORS) yield { m, om: otherMinor(m) };
      return;
    case "M+m+oM":
      for (const M of MAJORS) {
        const oM = otherMajor(M);
        for (const m of MINORS) yield { M, m, oM };
      }
      return;
    case "M+m+om":
      for (const M of MAJORS) {
        for (const m of MINORS) yield { M, m, om: otherMinor(m) };
      }
      return;
    case "M+m+oM+om":
      for (const M of MAJORS) {
        const oM = otherMajor(M);
        for (const m of MINORS) yield { M, m, oM, om: otherMinor(m) };
      }
      return;
  }
}

function* legacyBindings(parts: TemplatePart[]): Generator<SlotBind> {
  yield* enumMmBinds(detectMmProfile(parts));
}

function* assignWildMaps(parts: TemplatePart[]): Generator<WildBind> {
  const idxs = parts
    .map((p) => (p.kind === "strain_any" ? p.wildIdx : -1))
    .filter((w) => w >= 0);
  const unique = [...new Set(idxs)].sort((a, b) => a - b);
  if (unique.length === 0) {
    yield new Map();
    return;
  }
  function* dfs(k: number, mp: WildBind): Generator<WildBind> {
    if (k >= unique.length) {
      yield new Map(mp);
      return;
    }
    const wi = unique[k]!;
    for (const d of DENOMINATIONS) {
      yield* dfs(k + 1, new Map(mp).set(wi, d));
    }
  }
  yield* dfs(0, new Map());
}

function* iterBindings(parts: TemplatePart[]): Generator<{ bind: SlotBind; wild: WildBind }> {
  const xyzOrder = orderXyzSlots(parts);
  for (const lb of legacyBindings(parts)) {
    for (const xb of assignDistinctXyz(xyzOrder)) {
      const bind = { ...lb, ...xb };
      for (const wild of assignWildMaps(parts)) {
        yield { bind, wild };
      }
    }
  }
}

function needsExpand(parts: TemplatePart[]): boolean {
  return parts.some((p) => p.kind === "strain_slot" || p.kind === "strain_any");
}

/** Expand `format: template` into normalized rule keys (parentheses / X / XX as written). */
export function expandTemplatePattern(pattern: string): string[] {
  const trimmed = pattern.trim();
  const segments = splitAuctionPattern(trimmed);
  if (segments.length === 0) return [];
  const parts = assignWildIndices(segments.map(parseTemplateSegment));
  if (!needsExpand(parts)) {
    return [buildKey(parts, {}, new Map())];
  }
  const keys = new Set<string>();
  try {
    for (const { bind, wild } of iterBindings(parts)) {
      keys.add(buildKey(parts, bind, wild));
    }
  } catch (e) {
    throw new Error(`Template "${pattern}": ${(e as Error).message}`);
  }
  return [...keys];
}
