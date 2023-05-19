import { test, expect } from "@jest/globals";

import {
  CommaSeparatedListOutputParser,
  CustomListOutputParser,
} from "../list.js";

import { OutputParserException } from "../../schema/output_parser.js";

test("CommaSeparatedListOutputParser", async () => {
  const parser = new CommaSeparatedListOutputParser();

  expect(await parser.parse("hello, bye")).toEqual(["hello", "bye"]);

  expect(await parser.parse("hello,bye")).toEqual(["hello", "bye"]);

  expect(await parser.parse("hello")).toEqual(["hello"]);
});

test("CustomListOutputParser", async () => {
  const parser1 = new CustomListOutputParser({ length: 3, separator: ";" });

  expect(await parser1.parse("a; b;c")).toEqual(["a", "b", "c"]);

  await expect(() => parser1.parse("a; b c")).rejects.toThrow(
    OutputParserException
  );

  await expect(() => parser1.parse("a; b; c; d")).rejects.toThrow(
    OutputParserException
  );

  const parser2 = new CustomListOutputParser({ separator: "\n" });

  expect(await parser2.parse("a\nb\nc\nd")).toEqual(["a", "b", "c", "d"]);

  const parser3 = new CustomListOutputParser({ length: 8 });

  expect(await parser3.parse("a,b,c,d,e,f,g,h")).toEqual([
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
  ]);
});
