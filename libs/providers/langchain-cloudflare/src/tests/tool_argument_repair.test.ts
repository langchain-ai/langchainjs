import { expect, test } from "vitest";
import { toolArgumentRepair } from "../utils/tool_argument_repair.js";

function fixture(field: unknown) {
  return toolArgumentRepair([
    {
      type: "function",
      function: {
        name: "lookup",
        parameters: {
          type: "object",
          properties: { ids: field, query: { type: "string" } },
        },
      },
    },
  ]);
}
const nullableArray = {
  anyOf: [{ type: "array", items: { type: "number" } }, { type: "null" }],
};

test.each([
  nullableArray,
  { type: ["array", "null"], items: { type: "number" } },
  { oneOf: [{ type: "array" }, { type: "null" }] },
  { allOf: [{ type: ["array", "null"] }, { enum: [null, []] }] },
  { const: null },
  { enum: [null, 1] },
])("repairs only schema-declared non-string nullable values", (schema) => {
  const repair = fixture(schema);
  expect(
    JSON.parse(repair.repair("lookup", '{"ids":"null","query":"null"}'))
  ).toEqual({ ids: null, query: "null" });
  expect(repair.bufferStreamArguments).toBe(true);
});

test.each([
  { type: ["string", "null"] },
  { anyOf: [{ type: "string" }, { type: "null" }] },
  { enum: ["null", null] },
  { type: "array" },
  {},
  true,
  { anyOf: [{ type: "null" }, {}] },
  { oneOf: [{ type: "null" }, { type: "null" }] },
  { $ref: "#/$defs/ids", type: ["array", "null"] },
  { type: ["array", "null"], not: { type: "null" } },
])(
  "does not coerce strings for ambiguous or incompatible schemas",
  (schema) => {
    const original = '{"ids":"null","query":"null"}';
    expect(fixture(schema).repair("lookup", original)).toBe(original);
  }
);

test("preserves malformed JSON, unknown tools, unknown properties and other invalid values", () => {
  const repair = fixture(nullableArray);
  for (const args of [
    "{",
    '{"ids":"NULL"}',
    '{"ids":"undefined"}',
    '{"ids":17}',
    '{"ids":[1]}',
    '{"ids":null}',
    '{"unknown":"null"}',
  ]) {
    expect(repair.repair("lookup", args)).toBe(args);
  }
  expect(repair.repair("another", '{"ids":"null"}')).toBe('{"ids":"null"}');
});

test("traverses explicit nested properties and array items", () => {
  const repair = fixture({
    type: "object",
    properties: { values: { type: "array", items: nullableArray } },
  });
  expect(
    JSON.parse(
      repair.repair("lookup", '{"ids":{"values":["null",[1]]},"query":"null"}')
    )
  ).toEqual({ ids: { values: [null, [1]] }, query: "null" });
});

test("does not traverse conditional object constraints", () => {
  const repair = fixture({
    type: "object",
    properties: { nested: nullableArray },
    allOf: [{ properties: { nested: { type: "array" } } }],
  });
  const original = '{"ids":{"nested":"null"}}';
  expect(repair.repair("lookup", original)).toBe(original);
});
