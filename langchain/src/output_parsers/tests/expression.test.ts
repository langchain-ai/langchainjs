import { test } from "@jest/globals";
import { ExpressionParser } from "../expression.js";

const correctExps = [
  { type: "call_expression", funcCall: "hello", args: [] },
  {
    type: "call_expression",
    funcCall: "hello",
    args: [{ type: "string_literal", value: "world" }],
  },
  {
    type: "call_expression",
    funcCall: "hello",
    args: [
      { type: "string_literal", value: "world" },
      { type: "string_literal", value: "hello" },
    ],
  },
  {
    type: "call_expression",
    funcCall: "hello",
    args: [
      { type: "string_literal", value: "world" },
      { type: "string_literal", value: "hello" },
      {
        type: "array_literal",
        values: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
          { type: "numeric_literal", value: 1 },
          { type: "numeric_literal", value: 2.1 },
          { type: "numeric_literal", value: 3 },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: "hello",
    args: [
      { type: "string_literal", value: "world" },
      { type: "string_literal", value: "hello" },
      {
        type: "array_literal",
        values: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
          { type: "numeric_literal", value: 1 },
          { type: "numeric_literal", value: 2.1 },
          { type: "numeric_literal", value: 3 },
        ],
      },
      {
        type: "object_literal",
        values: [
          {
            type: "property_assignment",
            identifier: "hello",
            value: { type: "string_literal", value: "world" },
          },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: "hello",
    args: [
      { type: "string_literal", value: "world" },
      { type: "string_literal", value: "hello" },
      {
        type: "array_literal",
        values: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
          { type: "numeric_literal", value: 1 },
          { type: "numeric_literal", value: 2.1 },
          { type: "numeric_literal", value: 3 },
        ],
      },
      {
        type: "object_literal",
        values: [
          {
            type: "property_assignment",
            identifier: "hello",
            value: { type: "string_literal", value: "world" },
          },
        ],
      },
      { type: "numeric_literal", value: 1 },
      { type: "numeric_literal", value: 2.1 },
      { type: "numeric_literal", value: 3 },
    ],
  },
  {
    type: "call_expression",
    funcCall: "hello",
    args: [
      { type: "string_literal", value: "world" },
      { type: "string_literal", value: "hello" },
      {
        type: "array_literal",
        values: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
          { type: "numeric_literal", value: 1 },
          { type: "numeric_literal", value: 2.1 },
          { type: "numeric_literal", value: 3 },
        ],
      },
      {
        type: "object_literal",
        values: [
          {
            type: "property_assignment",
            identifier: "hello",
            value: { type: "string_literal", value: "world" },
          },
        ],
      },
      { type: "numeric_literal", value: 1 },
      { type: "numeric_literal", value: 2.1 },
      { type: "numeric_literal", value: 3 },
      {
        type: "call_expression",
        funcCall: "world",
        args: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
          {
            type: "array_literal",
            values: [
              {
                type: "object_literal",
                values: [
                  {
                    type: "property_assignment",
                    identifier: "hello",
                    value: { type: "string_literal", value: "world" },
                  },
                ],
              },
              {
                type: "object_literal",
                values: [
                  {
                    type: "property_assignment",
                    identifier: "hello",
                    value: {
                      type: "call_expression",
                      funcCall: "hello",
                      args: [{ type: "string_literal", value: "world" }],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: {
      type: "member_expression",
      identifier: "hello",
      property: "world",
    },
    args: [
      { type: "string_literal", value: "hello" },
      { type: "string_literal", value: "world" },
      {
        type: "array_literal",
        values: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
        ],
      },
      {
        type: "object_literal",
        values: [
          {
            type: "property_assignment",
            identifier: "hello",
            value: { type: "string_literal", value: "world" },
          },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: {
      type: "member_expression",
      identifier: "hello",
      property: "world",
    },
    args: [
      { type: "string_literal", value: "hello" },
      { type: "string_literal", value: "world" },
      {
        type: "array_literal",
        values: [
          { type: "string_literal", value: "hello" },
          { type: "string_literal", value: "world" },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: "a",
    args: [
      { type: "identifier", value: "b" },
      {
        type: "call_expression",
        funcCall: "c",
        args: [
          { type: "identifier", value: "d" },
          { type: "identifier", value: "e" },
          {
            type: "array_literal",
            values: [
              { type: "identifier", value: "f" },
              { type: "identifier", value: "g" },
            ],
          },
          {
            type: "object_literal",
            values: [
              {
                type: "property_assignment",
                identifier: "h",
                value: { type: "identifier", value: "i" },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: "and",
    args: [
      {
        type: "call_expression",
        funcCall: "in",
        args: [
          { type: "string_literal", value: "a" },
          {
            type: "array_literal",
            values: [
              { type: "string_literal", value: "a" },
              { type: "string_literal", value: "b" },
              { type: "string_literal", value: "c" },
            ],
          },
        ],
      },
      {
        type: "call_expression",
        funcCall: "eq",
        args: [
          { type: "string_literal", value: "a" },
          { type: "string_literal", value: "b" },
        ],
      },
    ],
  },
  {
    type: "call_expression",
    funcCall: "with",
    args: [
      {
        type: "call_expression",
        funcCall: "const",
        args: [
          { type: "string_literal", value: "a" },
          {
            type: "array_literal",
            values: [
              { type: "string_literal", value: "a" },
              { type: "string_literal", value: "b" },
              { type: "string_literal", value: "c" },
            ],
          },
        ],
      },
      {
        type: "call_expression",
        funcCall: "eq",
        args: [
          { type: "string_literal", value: "a" },
          { type: "string_literal", value: "b" },
          { type: "boolean_literal", value: true },
        ],
      },
    ],
  },
];

test("ExpressionParser multiple expressions test", async () => {
  const parser = new ExpressionParser();
  await parser.ensureParser();
  const expressions = [
    `hello()`,
    `hello("world")`,
    `hello("world", "hello")`,
    `hello("world", "hello", ["hello", "world", 1, 2.1, 3])`,
    `hello("world", "hello", ["hello", "world", 1, 2.1, 3], { hello: "world" })`,
    `hello("world", "hello", ["hello", "world", 1, 2.1, 3], { hello: "world" }, 1, 2.1, 3)`,
    `hello("world", "hello", ["hello", "world", 1, 2.1, 3], { hello: "world" }, 1, 2.1, 3, world("hello", "world", [{hello: "world"}, {"hello": hello("world")}]))`,
    `hello.world("hello", "world", ["hello", "world"], {"hello": "world"})`,
    `hello["world"]("hello", "world", ["hello", "world"])`,
    `a(b, c(d, e, [f, g], {h: i}))`,
    `and(in("a", ["a", "b", "c"]), eq("a", "b"))`,
    `with(const("a", ["a", "b", "c"]), eq("a", "b", true))`,
  ];
  const badExpressions = [
    `hello(`,
    `hello("world", ["hello", "world", 1, 2, 3 { hello: "world" })`,
    `hello("world", ["hello, "world", { hello: "world" )`,
    `l:::"""(}))))++===/...`,
  ];
  const parsedPromise = expressions.map((expression) =>
    parser.parse(expression)
  );
  const badExpressionsPromise = badExpressions.map((expression) =>
    parser.parse(expression).catch(() => "bad")
  );

  await Promise.allSettled(badExpressionsPromise).then((errors) => {
    errors.forEach((err) => {
      if (err.status === "fulfilled") {
        expect(err.value).toBe("bad");
      }
    });
  });

  const parsed = await Promise.all(parsedPromise);
  parsed.forEach((expression, index) => {
    expect(expression).toMatchObject(correctExps[index]);
  });
});
