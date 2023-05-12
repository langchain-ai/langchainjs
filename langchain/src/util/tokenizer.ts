import { toByteArray } from "base64-js";
import { cl100k_base } from "./tokenizer.cl100k_base.js";

class RanksMap {
  private readonly map = new Map<string, number>();

  private readonly textEncoder = new TextEncoder();

  constructor(bpeRanks: string) {
    const ranks = bpeRanks
      .split("\n")
      .filter(Boolean)
      .reduce<Record<string, number>>((memo, x) => {
        const [, offsetStr, ...tokens] = x.split(" ");
        const offset = Number.parseInt(offsetStr, 10);
        tokens.forEach((token, i) => {
          // eslint-disable-next-line no-param-reassign
          memo[token] = offset + i;
        });
        return memo;
      }, {});

    for (const [token, rank] of Object.entries(ranks)) {
      const byteStr = toByteArray(token).join(",");
      this.map.set(byteStr, rank);
    }
  }

  get(text: string | Uint8Array) {
    const bytes =
      typeof text === "string" ? this.textEncoder.encode(text) : text;

    const byteStr = bytes.join(",");
    return this.map.get(byteStr);
  }
}

function* getMatches(text: string, regexes: RegExp[]) {
  let start = 0;
  while (start < text.length) {
    let match: RegExpExecArray | null = null;

    for (const regex of regexes) {
      regex.lastIndex = start;
      match = regex.exec(text);
      if (match != null) break;
    }

    if (match == null) break;
    start += match[0].length;
    yield match[0];
  }
}

function bytePairMerge(
  piece: Uint8Array,
  ranks: RanksMap
): Array<{ start: number; end: number }> {
  const parts: Array<{ start: number; end: number }> = Array.from(
    { length: piece.length },
    (_, i) => ({ start: i, end: i + 1 })
  );

  while (parts.length > 1) {
    let minRank: [number, number] | null = null;

    for (let i = 0; i < parts.length - 1; i += 1) {
      const slice = piece.slice(parts[i].start, parts[i + 1].end);
      const rank = ranks.get(slice);
      if (rank == null) continue;

      if (minRank == null || rank < minRank[0]) {
        minRank = [rank, i];
      }
    }

    if (minRank != null) {
      const i = minRank[1];
      parts[i] = { start: parts[i].start, end: parts[i + 1].end };
      parts.splice(i + 1, 1);
    } else {
      break;
    }
  }
  return parts;
}

function bytePairEncode(piece: Uint8Array, ranks: RanksMap) {
  if (piece.length === 1) return [ranks.get(piece) as number];

  return bytePairMerge(piece, ranks)
    .map((p) => ranks.get(piece.slice(p.start, p.end)))
    .filter((x): x is number => x != null);
}

export function isLiteTokenizerApplicable(modelName: string) {
  return (
    modelName === "text-embedding-ada-002" ||
    modelName === "gpt-3.5-turbo" ||
    modelName === "gpt-3.5-turbo-0301" ||
    modelName === "gpt-4" ||
    modelName === "gpt-4-0314" ||
    modelName === "gpt-4-32k" ||
    modelName === "gpt-4-32k-0314"
  );
}

export class LiteTokenizer {
  public specialTokens: Record<string, number>;

  public patStr: string;

  public ranks: RanksMap;

  static escapeRegex = (str: string) =>
    str.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");

  constructor(
    ranks: {
      pat_str: string;
      special_tokens: Record<string, number>;
      bpe_ranks: string;
    } = cl100k_base
  ) {
    this.patStr = ranks.pat_str;
    this.specialTokens = ranks.special_tokens;
    this.ranks = new RanksMap(ranks.bpe_ranks);
  }

  getSpecialRegex = () =>
    new RegExp(
      Object.keys(this.specialTokens)
        .map((i) => LiteTokenizer.escapeRegex(i))
        .join("|"),
      "g"
    );

  getRegex = () => {
    const res: string[] = [];

    let lastSlice = 0;
    let bracketStack = 0;
    for (let i = 0; i < this.patStr.length; i += 1) {
      if (this.patStr[i] === "(") {
        bracketStack += 1;
      } else if (this.patStr[i] === ")") {
        bracketStack -= 1;
      } else if (this.patStr[i] === "|") {
        if (bracketStack === 0) {
          res.push(this.patStr.slice(lastSlice, i));
          lastSlice = i + 1;
        }
      }
    }

    return res.map((pattern) => {
      const modifierSpan = pattern.match(/^\(\?([a-z]):/);
      if (modifierSpan != null) {
        return new RegExp(
          pattern.replace(modifierSpan[0], "("),
          `${modifierSpan[1]}uy`
        );
      }

      return new RegExp(pattern, "uy");
    });
  };

  encode(text: string, allowedSpecial: "all" | Set<string> = "all") {
    const textEncoder = new TextEncoder();
    const regexes = this.getRegex();
    const specialRegex = this.getSpecialRegex();

    const ret: number[] = [];
    const allowedSpecialSet =
      allowedSpecial === "all"
        ? new Set(Object.keys(this.specialTokens))
        : allowedSpecial;

    let start = 0;
    while (start < text.length) {
      let nextSpecial: RegExpMatchArray | null = null;
      let startFind = start;

      while (startFind < text.length) {
        specialRegex.lastIndex = startFind;
        nextSpecial = specialRegex.exec(text);
        if (
          nextSpecial == null ||
          nextSpecial.index == null ||
          allowedSpecialSet.has(nextSpecial[0])
        ) {
          break;
        }
        startFind = nextSpecial.index + 1;
      }

      const end = nextSpecial?.index ?? text.length;
      for (const match of getMatches(text.substring(start, end), regexes)) {
        const piece = textEncoder.encode(match);
        const token = this.ranks.get(piece);

        if (token != null) {
          ret.push(token);
          continue;
        }

        ret.push(...bytePairEncode(piece, this.ranks));
      }

      if (nextSpecial == null || nextSpecial.index == null) break;
      const token = this.specialTokens[nextSpecial[0]];
      ret.push(token);
      start = nextSpecial.index + nextSpecial[0].length;
    }

    return ret;
  }
}
