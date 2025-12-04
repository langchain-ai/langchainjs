import { expect, it } from "vitest";
import * as fs from "node:fs/promises";
import { strictParsePartialJson as parsePartialJson } from "../json.js";

function* generateSegments(rawJson: string) {
  for (let i = 1; i < rawJson.length; i += 1) {
    yield [rawJson.substring(0, i), i] as const;
  }
}

const expectPartialJson = (item: string) =>
  expect(parsePartialJson(item), `[${item}]`);

it("objects", () => {
  expectPartialJson("{").toEqual({});
  expectPartialJson("{}").toEqual({});
});

it("array", () => {
  expectPartialJson("[]").toEqual([]);

  expectPartialJson("[1").toEqual([1]);
  expectPartialJson("[t").toEqual([true]);

  expectPartialJson("[-").toEqual([-0]);

  expectPartialJson("[").toEqual([]);
  expectPartialJson("[n").toEqual([null]);
  expectPartialJson("[null").toEqual([null]);
  expectPartialJson("[null,").toEqual([null]);
  expectPartialJson("[null,t").toEqual([null, true]);
  expectPartialJson("[null,{").toEqual([null, {}]);
  expectPartialJson('[null,{"').toEqual([null, {}]);
  expectPartialJson('[null,{"a').toEqual([null, { a: undefined }]);
  expectPartialJson('[null,{"a"').toEqual([null, { a: undefined }]);
  expectPartialJson('[null,{"a":').toEqual([null, { a: undefined }]);
  expectPartialJson('[null,{"a":1').toEqual([null, { a: 1 }]);

  expect(() => expectPartialJson("[n,")).toThrow();
  expect(() => expectPartialJson("[null,}")).toThrow();
});

it("strings", () => {
  expectPartialJson('"').toBe("");
  expectPartialJson('"hello').toBe("hello");
  expectPartialJson('"hello"').toBe("hello");

  expectPartialJson(String.raw`"15\n\t\r`).toBe("15\n\t\r");

  expectPartialJson(`"15\\u`).toBe("15u");
  expectPartialJson(`"15\\u00`).toBe("15u00");
  expectPartialJson(`"15\\u00f`).toBe("15u00f");
  expectPartialJson(String.raw`"15\u00f8`).toBe("15\u00f8");
  expectPartialJson(String.raw`"15\u00f8C`).toBe("15\u00f8C");
  expectPartialJson(String.raw`"15\u00f8C"`).toBe("15\u00f8C");

  expectPartialJson(String.raw`"hello\\`).toBe("hello\\");
  expectPartialJson(String.raw`"hello\\"`).toBe("hello\\");

  expectPartialJson(String.raw`"hello${"\\"}`).toBe("hello\\");
  expectPartialJson(String.raw`"hello\"`).toBe('hello"');
  expectPartialJson(String.raw`"hello\""`).toBe('hello"');

  expectPartialJson(String.raw`"\t\n\r\b\f\/`).toBe("\t\n\r\b\f/");
  expectPartialJson(String.raw`"\t\n\r\b\f\/"`).toBe("\t\n\r\b\f/");

  expectPartialJson(String.raw`"foo\bar`).toBe("foo\bar");
  expectPartialJson(String.raw`"foo\bar"`).toBe("foo\bar");

  expectPartialJson(String.raw`"\u00f8${"\\"}`).toBe("\u00f8\\");

  expect(() => expectPartialJson('"hello\\m"')).toThrow();
  expect(() => expectPartialJson('"hello\\x"')).toThrow();
});

it("numbers", () => {
  expectPartialJson("1").toBe(1);
  expectPartialJson("12").toBe(12);
  expectPartialJson("123").toBe(123);

  expectPartialJson("-").toBe(-0);
  expectPartialJson("-1").toBe(-1);
  expectPartialJson("-12").toBe(-12);
  expectPartialJson("-12.").toBe(-12);
  expectPartialJson("-12.1").toBe(-12.1);

  expectPartialJson("-1").toBe(-1);
  expectPartialJson("-1e").toBe(-1);

  expectPartialJson("-1e1").toBe(-10);
  expectPartialJson("-1e10").toBe(-1e10);

  expectPartialJson("-1e+").toBe(-1);
  expectPartialJson("-1e+1").toBe(-1e1);
  expectPartialJson("-1e+10").toBe(-1e10);

  expectPartialJson("-1e-").toBe(-1);
  expectPartialJson("-1e-1").toBe(-1e-1);
  expectPartialJson("-1e-10").toBe(-1e-10);
});

it("null values", () => {
  for (const [item] of generateSegments("null")) {
    expectPartialJson(item).toBe(null);
  }
});

it("boolean values", () => {
  for (const [item] of generateSegments("true")) {
    expectPartialJson(item).toBe(true);
  }

  for (const [item] of generateSegments("false")) {
    expectPartialJson(item).toBe(false);
  }
});

it("whitespace", () => {
  expectPartialJson(" \n\t\r123").toBe(123);
  expectPartialJson("123\n\t\r").toBe(123);
});

it("malformed JSON - mismatched brackets in array", () => {
  expect(() => parsePartialJson("[}")).toThrow();
  expect(() => parsePartialJson("[1}")).toThrow();
  expect(() => parsePartialJson("[1,2}")).toThrow();
});

it("malformed JSON - mismatched brackets in object", () => {
  expect(() => parsePartialJson("{]")).toThrow();
  expect(() => parsePartialJson('{"key": 1]')).toThrow();
  expect(() => parsePartialJson('{"key": 1, "key2": 2]')).toThrow();
});

it("malformed JSON - invalid number formats", () => {
  expect.soft(() => parsePartialJson("+1")).toThrow();
  expect.soft(() => parsePartialJson("+123")).toThrow();
  expect.soft(() => parsePartialJson(".5")).toThrow();
  expect.soft(() => parsePartialJson(".123")).toThrow();
  expect.soft(() => parsePartialJson("[+1]")).toThrow();
  expect.soft(() => parsePartialJson('{"num": +1}')).toThrow();
  expect.soft(() => parsePartialJson('{"num": .5}')).toThrow();
});

it("malformed JSON - invalid object key", () => {
  expect.soft(() => parsePartialJson("{a: 1}")).toThrow();
  expect.soft(() => parsePartialJson("{1: 1}")).toThrow();
  expect.soft(() => parsePartialJson("{true: 1}")).toThrow();
  expect.soft(() => parsePartialJson('{"key": 1, a: 2}')).toThrow();
});

it("malformed JSON - unexpected closing bracket", () => {
  expect.soft(() => parsePartialJson("}")).toThrow();
  expect.soft(() => parsePartialJson("]")).toThrow();
  expect.soft(() => parsePartialJson("}1")).toThrow();
  expect.soft(() => parsePartialJson("]1")).toThrow();
});

it("malformed JSON - invalid characters after valid tokens", () => {
  expect.soft(() => parsePartialJson("nullx")).toThrow();
  expect.soft(() => parsePartialJson("truex")).toThrow();
  expect.soft(() => parsePartialJson("falsex")).toThrow();
  expect.soft(() => parsePartialJson("null1")).toThrow();
  expect.soft(() => parsePartialJson("true1")).toThrow();
  expect.soft(() => parsePartialJson("false1")).toThrow();
  expect.soft(() => parsePartialJson("[nullx]")).toThrow();
  expect.soft(() => parsePartialJson('{"key": nullx}')).toThrow();
});

it("malformed JSON - invalid number formats", () => {
  // Multiple decimal points
  expect.soft(() => parsePartialJson("1.2.3")).toThrow();
  expect.soft(() => parsePartialJson("12.34.56")).toThrow();
  expect.soft(() => parsePartialJson("-1.2.3")).toThrow();

  // Multiple e/E
  expect.soft(() => parsePartialJson("1e2e3")).toThrow();
  expect.soft(() => parsePartialJson("1E2E3")).toThrow();
  expect.soft(() => parsePartialJson("1e2E3")).toThrow();

  // Invalid characters in numbers
  expect.soft(() => parsePartialJson("1a2")).toThrow();
  expect.soft(() => parsePartialJson("1.2a")).toThrow();
  expect.soft(() => parsePartialJson("1e2a")).toThrow();
  expect.soft(() => parsePartialJson("1e+a")).toThrow();
  expect.soft(() => parsePartialJson("1e-a")).toThrow();
  expect.soft(() => parsePartialJson("12abc")).toThrow();
  expect.soft(() => parsePartialJson("-12abc")).toThrow();

  // Leading zeros (invalid in JSON)
  expect.soft(() => parsePartialJson("00")).toThrow();
  expect.soft(() => parsePartialJson("012")).toThrow();
  expect.soft(() => parsePartialJson("-01")).toThrow();
});

it("malformed JSON - nested bracket mismatches", () => {
  expect.soft(() => parsePartialJson("[[}]")).toThrow();
  expect.soft(() => parsePartialJson("{{]}}")).toThrow();
  expect.soft(() => parsePartialJson("[{]]")).toThrow();
  expect.soft(() => parsePartialJson('{"a": [}]')).toThrow();
  expect.soft(() => parsePartialJson('{"a": {]}}')).toThrow();
});

it("malformed JSON - missing colons in objects", () => {
  expect.soft(() => parsePartialJson('{"key" 1}')).toThrow();
  expect.soft(() => parsePartialJson('{"key"1}')).toThrow();
  expect.soft(() => parsePartialJson('{"key"}')).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1, "b" 2}')).toThrow();
});

it("malformed JSON - invalid characters after comma", () => {
  expect.soft(() => parsePartialJson("[1,]")).toThrow();
  expect.soft(() => parsePartialJson("[1,2,]")).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1,}')).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1, "b": 2,}')).toThrow();
  expect.soft(() => parsePartialJson("[1,}")).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1,]')).toThrow();
});

it("malformed JSON - trailing content after valid JSON", () => {
  expect.soft(() => parsePartialJson('{"a": 1}extra')).toThrow();
  expect.soft(() => parsePartialJson("[1]extra")).toThrow();
  expect.soft(() => parsePartialJson('"hello"extra')).toThrow();
  expect.soft(() => parsePartialJson("123extra")).toThrow();
  expect.soft(() => parsePartialJson("trueextra")).toThrow();
  expect.soft(() => parsePartialJson("falseextra")).toThrow();
  expect.soft(() => parsePartialJson("nullextra")).toThrow();
});

it("malformed JSON - multiple root values", () => {
  expect.soft(() => parsePartialJson("1 2")).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1} {"b": 2}')).toThrow();
  expect.soft(() => parsePartialJson("[1] [2]")).toThrow();
  expect.soft(() => parsePartialJson("true false")).toThrow();
  expect.soft(() => parsePartialJson("null true")).toThrow();
});

it("malformed JSON - invalid partial keywords", () => {
  expect.soft(() => parsePartialJson("nulx")).toThrow();
  expect.soft(() => parsePartialJson("trux")).toThrow();
  expect.soft(() => parsePartialJson("falsx")).toThrow();
  expect.soft(() => parsePartialJson("nul1")).toThrow();
  expect.soft(() => parsePartialJson("tru1")).toThrow();
  expect.soft(() => parsePartialJson("fals1")).toThrow();
  expect.soft(() => parsePartialJson("[nulx]")).toThrow();
  expect.soft(() => parsePartialJson('{"key": trux}')).toThrow();
});

it("malformed JSON - invalid object structure", () => {
  expect.soft(() => parsePartialJson('{"key":}')).toThrow();
  expect.soft(() => parsePartialJson('{:"value"}')).toThrow();
  expect.soft(() => parsePartialJson('{"key"::"value"}')).toThrow();
  expect.soft(() => parsePartialJson('{"key": "value": "extra"}')).toThrow();
  expect.soft(() => parsePartialJson('{"key" "value"}')).toThrow();
});

it("malformed JSON - invalid array structure", () => {
  expect.soft(() => parsePartialJson("[,]")).toThrow();
  expect.soft(() => parsePartialJson("[,1]")).toThrow();
  expect.soft(() => parsePartialJson("[1,,2]")).toThrow();
  expect.soft(() => parsePartialJson("[1 2]")).toThrow();
  expect.soft(() => parsePartialJson("[1:2]")).toThrow();
});

it("malformed JSON - invalid string escapes", () => {
  expect.soft(() => parsePartialJson('"\\x"')).toThrow();
  expect.soft(() => parsePartialJson('"\\z"')).toThrow();
  expect.soft(() => parsePartialJson('"\\u123"')).toThrow(); // Incomplete unicode
  expect.soft(() => parsePartialJson('"\\u123x"')).toThrow(); // Invalid hex in unicode
  expect.soft(() => parsePartialJson('"\\u12G3"')).toThrow(); // Invalid hex in unicode
});

it("malformed JSON - comments (not valid in JSON)", () => {
  expect.soft(() => parsePartialJson("// comment")).toThrow();
  expect.soft(() => parsePartialJson("/* comment */")).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1 // comment\n}')).toThrow();
  expect.soft(() => parsePartialJson('{"a": 1 /* comment */}')).toThrow();
});

it("malformed JSON - invalid whitespace handling", () => {
  // Control characters that aren't valid JSON
  expect.soft(() => parsePartialJson("\x00")).toThrow();
  expect.soft(() => parsePartialJson("\x01")).toThrow();
  expect.soft(() => parsePartialJson('{"a": \x00}')).toThrow();
});

it("kitchen sink of partial json parsing", async () => {
  const rawJson = `{"array": ["hello", null, false, true, 12345678910], "object": {"string": "string", "null": null, "false": false, "true": true, "number": 12345678910}, "long": "very long string"}`;
  const segments = (
    await fs.readFile(
      new URL("./__mocks__/json.kitchen-sink.jsonl", import.meta.url),
      "utf-8"
    )
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  expect(segments).toHaveLength(rawJson.length);
  for (const [item, i] of generateSegments(rawJson)) {
    expectPartialJson(item).toEqual(segments[i]);
  }
});
