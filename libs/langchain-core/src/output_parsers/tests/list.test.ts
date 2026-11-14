import { describe, expect, test } from "vitest";

import {
  MarkdownListOutputParser,
  NumberedListOutputParser,
} from "../list.js";

async function* streamChunks(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function parseStream(
  parser: NumberedListOutputParser | MarkdownListOutputParser,
  chunks: string[]
): Promise<string[]> {
  const out: string[] = [];
  for await (const part of parser.transform(streamChunks(chunks), {})) {
    out.push(...part);
  }
  return out;
}

describe("regex-backed list parsers while streaming", () => {
  test("keeps every numbered item in a single chunk", async () => {
    const parsed = await parseStream(new NumberedListOutputParser(), [
      "1. foo\n2. bar\n3. baz",
    ]);
    expect(parsed).toEqual(["foo", "bar", "baz"]);
  });

  test("keeps every numbered item across chunks", async () => {
    const parsed = await parseStream(new NumberedListOutputParser(), [
      "1. foo\n2. ",
      "bar\n3. baz\n4. qux",
    ]);
    expect(parsed).toEqual(["foo", "bar", "baz", "qux"]);
  });

  test("keeps every markdown item in a single chunk", async () => {
    const parsed = await parseStream(new MarkdownListOutputParser(), [
      "- foo\n- bar\n- baz",
    ]);
    expect(parsed).toEqual(["foo", "bar", "baz"]);
  });
});
