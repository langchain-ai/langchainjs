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
          { type: "numeric_literal", value: 2 },
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
          { type: "numeric_literal", value: 2 },
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
          { type: "numeric_literal", value: 2 },
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
      { type: "numeric_literal", value: 2 },
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
          { type: "numeric_literal", value: 2 },
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
      { type: "numeric_literal", value: 2 },
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
];

test("ExpressionParser multiple expressions test", async () => {
  const parser = new ExpressionParser();
  const expressions = [
    `hello()`,
    `hello("world")`,
    `hello("world", "hello")`,
    `hello("world", "hello", ["hello", "world", 1, 2, 3])`,
    `hello("world", "hello", ["hello", "world", 1, 2, 3], { hello: "world" })`,
    `hello("world", "hello", ["hello", "world", 1, 2, 3], { hello: "world" }, 1, 2, 3)`,
    `hello("world", "hello", ["hello", "world", 1, 2, 3], { hello: "world" }, 1, 2, 3, world("hello", "world", [{hello: "world"}, {"hello": hello("world")}]))`,
    `hello.world("hello", "world", ["hello", "world"], {"hello": "world"})`,
    `hello["world"]("hello", "world", ["hello", "world"])`,
    `a(b, c(d, e, [f, g], {h: i}))`,
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
    parser.parse(expression)
  );

  try {
    await Promise.all(badExpressionsPromise).catch(() => "bad");
  } catch (err) {
    expect(err).toBe("bad");
  }

  const parsed = await Promise.all(parsedPromise);
  parsed.forEach((expression, index) => {
    expect(expression).toMatchObject(correctExps[index]);
  });
});
