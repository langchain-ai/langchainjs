import { describe, expect, test } from "vitest";

import {
  MarkdownListOutputParser,
  NumberedListOutputParser,
} from "../list.js";

const serializedId = (parser: unknown) =>
  (parser as { toJSON(): { id?: string[] } }).toJSON().id;

describe("list parser serialization identity", () => {
  test("a markdown list parser serializes as itself", () => {
    expect(serializedId(new MarkdownListOutputParser())?.at(-1)).toBe(
      "MarkdownListOutputParser"
    );
  });

  test("the two list parsers keep distinct serialized identities", () => {
    expect(serializedId(new MarkdownListOutputParser())).not.toEqual(
      serializedId(new NumberedListOutputParser())
    );
  });

  test("the two list parsers read different markers", async () => {
    expect(await new MarkdownListOutputParser().parse("- foo\n- bar")).toEqual([
      "foo",
      "bar",
    ]);
    expect(await new NumberedListOutputParser().parse("- foo\n- bar")).toEqual(
      []
    );
  });
});
