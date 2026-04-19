import type { Denomination } from "../bidding";

const MAJORS: Denomination[] = ["heart", "spade"];
const MINORS: Denomination[] = ["club", "diamond"];
const SUITS4: Denomination[] = ["club", "diamond", "heart", "spade"];

export type Side = "us" | "them";

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

export type AuctionAtom =
  | { kind: "pass" }
  | { kind: "double" }
  | { kind: "redouble" }
  | { kind: "strain"; level: number; denom: Denomination };

export type PatAtom =
  | { kind: "pass" }
  | { kind: "double" }
  | { kind: "redouble" }
  | { kind: "strain_lit"; level: number; denom: Denomination }
  | { kind: "slot"; level: number; slot: "M" | "m" | "oM" | "om" | "X" | "Y" | "Z" }
  /** Any suit (not NT) at this level, e.g. `1?`, `2?`. */
  | { kind: "wild"; level: number }
  /** Any suit at this level not yet shown in the auction (suits only; NT does not count as a suit here). */
  | { kind: "new_suit"; level: number };

export type AuctionParsed = { side: Side; atom: AuctionAtom };
export type PatternParsed = { side: Side; atom: PatAtom };

function unwrap(raw: string): { side: Side; inner: string } {
  const t = raw.trim();
  if (t.startsWith("(") && t.endsWith(")")) {
    return { side: "them", inner: t.slice(1, -1).trim() };
  }
  return { side: "us", inner: t.trim() };
}

function suitLetterToDenom(ch: string): Denomination | null {
  switch (ch) {
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

/** Parse strain only: `1NT`, `1N`, `1H`, … (uppercase suits). */
export function parseStrainToken(inner: string): { level: number; denom: Denomination } | null {
  const nt = inner.match(/^([1-7])NT$/);
  if (nt) return { level: Number(nt[1]), denom: "nt" };
  const nOnly = inner.match(/^([1-7])N$/);
  if (nOnly) return { level: Number(nOnly[1]), denom: "nt" };
  const su = inner.match(/^([1-7])([SHDC])$/);
  if (su) {
    const d = suitLetterToDenom(su[2]!);
    if (d) return { level: Number(su[1]), denom: d };
  }
  return null;
}

function parseAuctionInner(inner: string): AuctionAtom | null {
  const u = inner.toUpperCase();
  if (u === "P") return { kind: "pass" };
  if (u === "XX") return { kind: "redouble" };
  if (u === "X") return { kind: "double" };
  const st = parseStrainToken(inner.trim());
  if (st) return { kind: "strain", level: st.level, denom: st.denom };
  return null;
}

function parsePatternInner(inner: string): PatAtom | null {
  const u = inner.toUpperCase();
  if (u === "P") return { kind: "pass" };
  if (u === "XX") return { kind: "redouble" };
  if (u === "X") return { kind: "double" };

  const oM = inner.match(/^([1-7])oM$/);
  if (oM) return { kind: "slot", level: Number(oM[1]), slot: "oM" };
  const om = inner.match(/^([1-7])om$/);
  if (om) return { kind: "slot", level: Number(om[1]), slot: "om" };

  const newSuit = inner.match(/^([1-7])A$/);
  if (newSuit) return { kind: "new_suit", level: Number(newSuit[1]) };

  const wild = inner.match(/^([1-7])\?$/);
  if (wild) return { kind: "wild", level: Number(wild[1]) };

  const nt = inner.match(/^([1-7])NT$/);
  if (nt) return { kind: "strain_lit", level: Number(nt[1]), denom: "nt" };
  const nOnly = inner.match(/^([1-7])N$/);
  if (nOnly) return { kind: "strain_lit", level: Number(nOnly[1]), denom: "nt" };

  const slotMm = inner.match(/^([1-7])([Mm])$/);
  if (slotMm) {
    const slot = slotMm[2] === "M" ? "M" : "m";
    return { kind: "slot", level: Number(slotMm[1]), slot };
  }

  const slotXyz = inner.match(/^([1-7])([XYZ])$/);
  if (slotXyz) {
    return {
      kind: "slot",
      level: Number(slotXyz[1]),
      slot: slotXyz[2] as "X" | "Y" | "Z",
    };
  }

  const su = inner.match(/^([1-7])([SHDC])$/);
  if (su) {
    const d = suitLetterToDenom(su[2]!);
    if (d) return { kind: "strain_lit", level: Number(su[1]), denom: d };
  }

  return null;
}

export function parseAuctionSegment(seg: string): AuctionParsed | null {
  const { side, inner } = unwrap(seg);
  const atom = parseAuctionInner(inner);
  if (!atom) return null;
  return { side, atom };
}

export function parsePatternSegment(seg: string): PatternParsed | null {
  const { side, inner } = unwrap(seg);
  const atom = parsePatternInner(inner);
  if (!atom) return null;
  return { side, atom };
}

type SlotBind = Partial<Record<"M" | "m" | "oM" | "om" | "X" | "Y" | "Z", Denomination>>;

function distinctSuitsOk(bind: SlotBind, slot: "X" | "Y" | "Z", d: Denomination): boolean {
  const others: ("X" | "Y" | "Z")[] = ["X", "Y", "Z"].filter((s) => s !== slot) as ("X" | "Y" | "Z")[];
  for (const o of others) {
    const v = bind[o];
    if (v !== undefined && v === d) return false;
  }
  return true;
}

/** Suits (C/D/H/S) that have appeared in strain bids before this index; NT is ignored. */
function suitsSeenBefore(auction: AuctionParsed[], idx: number): Set<Denomination> {
  const s = new Set<Denomination>();
  for (let j = 0; j < idx; j++) {
    const at = auction[j]!.atom;
    if (at.kind === "strain" && at.denom !== "nt") {
      s.add(at.denom);
    }
  }
  return s;
}

function matchStep(
  a: AuctionAtom,
  p: PatAtom,
  bind: SlotBind,
  auction: AuctionParsed[],
  idx: number,
): SlotBind[] {
  if (p.kind === "pass") {
    return a.kind === "pass" ? [bind] : [];
  }
  if (p.kind === "double") {
    return a.kind === "double" ? [bind] : [];
  }
  if (p.kind === "redouble") {
    return a.kind === "redouble" ? [bind] : [];
  }

  if (p.kind === "strain_lit") {
    if (a.kind !== "strain") return [];
    if (a.level !== p.level || a.denom !== p.denom) return [];
    return [bind];
  }

  if (p.kind === "wild") {
    if (a.kind !== "strain") return [];
    if (a.level !== p.level) return [];
    if (a.denom === "nt") return [];
    if (!SUITS4.includes(a.denom)) return [];
    return [bind];
  }

  if (p.kind === "new_suit") {
    if (a.kind !== "strain") return [];
    if (a.level !== p.level) return [];
    if (a.denom === "nt") return [];
    const seen = suitsSeenBefore(auction, idx);
    if (seen.has(a.denom)) return [];
    return [bind];
  }

  if (p.kind !== "slot" || a.kind !== "strain") return [];
  if (a.level !== p.level) return [];

  const d = a.denom;

  switch (p.slot) {
    case "M": {
      if (!MAJORS.includes(d)) return [];
      if (bind.M === undefined) return [{ ...bind, M: d }];
      return bind.M === d ? [bind] : [];
    }
    case "m": {
      if (!MINORS.includes(d)) return [];
      if (bind.m === undefined) return [{ ...bind, m: d }];
      return bind.m === d ? [bind] : [];
    }
    case "oM": {
      if (bind.M === undefined) return [];
      if (!MAJORS.includes(d) || d === bind.M) return [];
      if (bind.oM === undefined) return [{ ...bind, oM: d }];
      return bind.oM === d ? [bind] : [];
    }
    case "om": {
      if (bind.m === undefined) return [];
      if (!MINORS.includes(d) || d === bind.m) return [];
      if (bind.om === undefined) return [{ ...bind, om: d }];
      return bind.om === d ? [bind] : [];
    }
    case "X":
    case "Y":
    case "Z": {
      if (d === "nt") return [];
      if (bind[p.slot] === undefined) {
        if (!distinctSuitsOk(bind, p.slot, d)) return [];
        return [{ ...bind, [p.slot]: d }];
      }
      return bind[p.slot] === d ? [bind] : [];
    }
    default:
      return [];
  }
}

function dfs(
  auction: AuctionParsed[],
  pattern: PatternParsed[],
  i: number,
  bind: SlotBind,
): boolean {
  if (i === auction.length) return true;
  const A = auction[i]!;
  const P = pattern[i]!;
  if (A.side !== P.side) return false;
  const nextBinds = matchStep(A.atom, P.atom, bind, auction, i);
  for (const b of nextBinds) {
    if (dfs(auction, pattern, i + 1, b)) return true;
  }
  return false;
}

export type CompiledPatternVariant = { segments: PatternParsed[] };

export function compilePatternString(pattern: string): CompiledPatternVariant | null {
  const raw = splitAuctionPattern(pattern.trim());
  const segs: PatternParsed[] = [];
  for (const r of raw) {
    const p = parsePatternSegment(r);
    if (!p) return null;
    segs.push(p);
  }
  return { segments: segs };
}

/** Match precompiled pattern variant against a normalized auction key. */
export function compiledVariantMatchesKey(
  variant: CompiledPatternVariant,
  normalizedKey: string,
): boolean {
  const rawA = splitAuctionPattern(normalizedKey);
  if (rawA.length !== variant.segments.length) return false;
  const asegs: AuctionParsed[] = [];
  for (const r of rawA) {
    const p = parseAuctionSegment(r);
    if (!p) return false;
    asegs.push(p);
  }
  return dfs(asegs, variant.segments, 0, {});
}

/** Match a normalized auction key against one pattern string. */
export function auctionKeyMatchesPattern(normalizedKey: string, pattern: string): boolean {
  const v = compilePatternString(pattern);
  return v ? compiledVariantMatchesKey(v, normalizedKey) : false;
}
