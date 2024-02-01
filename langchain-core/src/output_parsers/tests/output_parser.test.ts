/* eslint-disable no-loop-func */
/* eslint-disable no-promise-executor-return */

import { test } from "@jest/globals";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
import { BytesOutputParser } from "../bytes.js";
import {
  CommaSeparatedListOutputParser,
  ListOutputParser,
  MarkdownListOutputParser,
  NumberedListOutputParser,
} from "../list.js";

test("BytesOutputParser", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm.pipe(new BytesOutputParser()).stream("Hi there!");
  const chunks = [];
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    chunks.push(decoder.decode(chunk));
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

async function acc(iter: AsyncGenerator<string[]>): Promise<string[][]> {
  const acc = [];
  for await (const chunk of iter) {
    acc.push(chunk);
  }
  return acc;
}

const listTestCases: [new () => ListOutputParser, string, string[]][] = [
  [CommaSeparatedListOutputParser, "a,b,c", ["a", "b", "c"]],
  [CommaSeparatedListOutputParser, "a,b,c,", ["a", "b", "c", ""]],
  [CommaSeparatedListOutputParser, "a", ["a"]],
  [NumberedListOutputParser, "1. a\n2. b\n3. c", ["a", "b", "c"]],
  [
    NumberedListOutputParser,
    "Items:\n\n1. apple\n\n2. banana\n\n3. cherry",
    ["apple", "banana", "cherry"],
  ],
  [
    NumberedListOutputParser,
    `Your response should be a numbered list with each item on a new line. For example: \n\n1. foo\n\n2. bar\n\n3. baz`,
    ["foo", "bar", "baz"],
  ],
  [NumberedListOutputParser, "No items in the list.", []],
  [MarkdownListOutputParser, "- a\n    - b\n- c", ["a", "b", "c"]],
  [
    MarkdownListOutputParser,
    "Items:\n\n- apple\n\n- banana\n\n- cherry",
    ["apple", "banana", "cherry"],
  ],
  [
    MarkdownListOutputParser,
    `Your response should be a numbered - not an item - list with each item on a new line. For example: \n\n- foo\n\n- bar\n\n- baz`,
    ["foo", "bar", "baz"],
  ],
  [MarkdownListOutputParser, "No items in the list.", []],
  [MarkdownListOutputParser, "* a\n    * b\n* c", ["a", "b", "c"]],
  [
    MarkdownListOutputParser,
    "Items:\n\n* apple\n\n* banana\n\n* cherry",
    ["apple", "banana", "cherry"],
  ],
  [
    MarkdownListOutputParser,
    `Your response should be a numbered list with each item on a new line. For example: \n\n* foo\n\n* bar\n\n* baz`,
    ["foo", "bar", "baz"],
  ],
  [MarkdownListOutputParser, "No items in the list.", []],
];

for (const [Parser, input, output] of listTestCases) {
  test(`${Parser.name} parses ${input} to ${output}`, async () => {
    async function* generator() {
      for (const char of input) {
        yield char;
      }
    }
    const parser = new Parser();
    const chunks = await acc(parser.transform(generator(), {}));
    expect(chunks).toEqual(output.map((x) => [x]));
    await expect(parser.parse(input)).resolves.toEqual(output);
  });
}
