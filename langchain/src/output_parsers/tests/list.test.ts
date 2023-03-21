import { test, expect } from "@jest/globals";

import { CommaSeparatedListOutputParser } from "../list.js";

test("CommaSeparatedListOutputParser", async () => {
  const parser = new CommaSeparatedListOutputParser();

  expect(await parser.parse("hello, bye")).toEqual(["hello", "bye"]);

  expect(await parser.parse("hello,bye")).toEqual(["hello", "bye"]);

  expect(await parser.parse("hello")).toEqual(["hello"]);
});
