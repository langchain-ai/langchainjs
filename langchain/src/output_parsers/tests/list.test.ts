import { test, expect } from "@jest/globals";

import { CommaSeparatedListOutputParser } from "../list.js";

test("CommaSeparatedListOutputParser", () => {
  const parser = new CommaSeparatedListOutputParser();

  expect(parser.parse("hello, bye")).toEqual(["hello", "bye"]);

  expect(parser.parse("hello,bye")).toEqual(["hello", "bye"]);

  expect(parser.parse("hello")).toEqual(["hello"]);
});
