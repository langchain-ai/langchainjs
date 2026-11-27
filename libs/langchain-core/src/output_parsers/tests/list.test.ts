import { test, expect } from "vitest";
import {
  CommaSeparatedListOutputParser,
  ListOutputParser,
  MarkdownListOutputParser,
  NumberedListOutputParser,
} from "../list.js";

async function* chunks(parts: string[]) {
  for (const part of parts) yield part;
}

async function streamWith(parser: ListOutputParser, parts: string[]) {
  const out: string[][] = [];
  for await (const piece of parser.transform(chunks(parts), {})) {
    out.push(piece);
  }
  return out;
}

const numbered = "1. alpha\n2. beta\n3. gamma\n";

test("NumberedListOutputParser streams every item a single chunk completes", async () => {
  const parser = new NumberedListOutputParser();
  expect(await parser.parse(numbered)).toEqual(["alpha", "beta", "gamma"]);
  expect(await streamWith(parser, [numbered])).toEqual([
    ["alpha"],
    ["beta"],
    ["gamma"],
  ]);
});

test("NumberedListOutputParser streams items split across chunks", async () => {
  const parser = new NumberedListOutputParser();
  const parts = numbered.match(/[^\n]*\n|[^\n]+/g) ?? [];
  expect(await streamWith(parser, parts)).toEqual([
    ["alpha"],
    ["beta"],
    ["gamma"],
  ]);
});

test("MarkdownListOutputParser streams every item a single chunk completes", async () => {
  const parser = new MarkdownListOutputParser();
  const text = "- one\n- two\n- three\n";
  expect(await parser.parse(text)).toEqual(["one", "two", "three"]);
  expect(await streamWith(parser, [text])).toEqual([
    ["one"],
    ["two"],
    ["three"],
  ]);
});

test("CommaSeparatedListOutputParser yields each value once", async () => {
  const parser = new CommaSeparatedListOutputParser();
  expect(await streamWith(parser, ["red, green", ", blue"])).toEqual([
    ["red"],
    ["green"],
    ["blue"],
  ]);
});
