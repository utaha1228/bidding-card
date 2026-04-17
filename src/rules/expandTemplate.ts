import { formatBid, type Denomination } from "../bidding";

const MAJORS: Denomination[] = ["heart", "spade"];
const MINORS: Denomination[] = ["club", "diamond"];

type ParsedPart =
  | { kind: "lit"; level: number; denom: Denomination }
  | { kind: "slot"; level: number; slot: "M" | "m" | "N" };

type SlotBind = Partial<Record<"M" | "m" | "N", Denomination>>;

const SYM: Record<string, Denomination> = {
  "♣": "club",
  "♦": "diamond",
  "♥": "heart",
  "♠": "spade",
};

function parsePart(raw: string): ParsedPart {
  const s = raw.trim();
  const m = s.match(/^([1-7])(NT|♣|♦|♥|♠|M|m|N)$/);
  if (!m) {
    throw new Error(`Invalid template segment "${raw}"`);
  }
  const level = Number(m[1]);
  const sym = m[2]!;
  if (sym === "M" || sym === "m" || sym === "N") {
    return { kind: "slot", level, slot: sym };
  }
  if (sym === "NT") {
    return { kind: "lit", level, denom: "nt" };
  }
  const denom = SYM[sym];
  if (!denom) throw new Error(`Bad symbol in "${raw}"`);
  return { kind: "lit", level, denom };
}

function buildKey(parts: ParsedPart[], bind: SlotBind): string {
  return parts
    .map((p) => {
      if (p.kind === "lit") return formatBid(p.level, p.denom);
      const d = bind[p.slot];
      if (!d) throw new Error(`Missing binding for slot ${p.slot}`);
      return formatBid(p.level, d);
    })
    .join("-");
}

function* iterBindings(parts: ParsedPart[]): Generator<SlotBind> {
  const needM = parts.some((p) => p.kind === "slot" && p.slot === "M");
  const needm = parts.some((p) => p.kind === "slot" && p.slot === "m");
  const needN = parts.some((p) => p.kind === "slot" && p.slot === "N");

  if (needM && !needm && !needN) {
    for (const M of MAJORS) yield { M };
    return;
  }
  if (needm && !needM && !needN) {
    for (const m of MINORS) yield { m };
    return;
  }
  if (needM && needm && !needN) {
    for (const M of MAJORS) {
      for (const m of MINORS) {
        yield { M, m };
      }
    }
    return;
  }
  if (needM && needN && !needm) {
    for (const M of MAJORS) {
      for (const N of MAJORS) {
        if (N === M) continue;
        yield { M, N };
      }
    }
    return;
  }
  if (needM && needm && needN) {
    for (const M of MAJORS) {
      for (const N of MAJORS) {
        if (N === M) continue;
        for (const m of MINORS) {
          yield { M, N, m };
        }
      }
    }
    return;
  }

  throw new Error(
    "Unsupported slot combination (supported: M; m; M+m; M+N; M+m+N)",
  );
}

/** Expand `format: template` pattern into exact auction keys. */
export function expandTemplatePattern(pattern: string): string[] {
  const parts = pattern.split("-").map((p) => parsePart(p));
  const hasSlot = parts.some((p) => p.kind === "slot");
  if (!hasSlot) {
    return [
      parts
        .map((p) => {
          if (p.kind !== "lit") throw new Error("Mixed template without slots");
          return formatBid(p.level, p.denom);
        })
        .join("-"),
    ];
  }
  const keys = new Set<string>();
  for (const bind of iterBindings(parts)) {
    keys.add(buildKey(parts, bind));
  }
  return [...keys];
}
