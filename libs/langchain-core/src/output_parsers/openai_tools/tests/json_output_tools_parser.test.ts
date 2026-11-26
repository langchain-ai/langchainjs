/* oxlint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { JsonOutputKeyToolsParser } from "../json_output_tools_parsers.js";
import { OutputParserException } from "../../base.js";
import { AIMessage, AIMessageChunk } from "../../../messages/ai.js";
import { RunnableLambda } from "../../../runnables/base.js";
import { InteropZodType } from "../../../utils/types/zod.js";

test("JSONOutputKeyToolsParser invoke", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
  });
  const result = await outputParser.invoke(
    new AIMessage({
      content: "",
      additional_kwargs: {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "testing",
              arguments: JSON.stringify({ testKey: 9 }),
            },
          },
        ],
      },
    })
  );
  expect(result).toEqual({ testKey: 9 });
});

describe("JSONOutputKeyToolsParser with a passed schema throws", () => {
  const assertThrows = async (schema: InteropZodType) => {
    const outputParser = new JsonOutputKeyToolsParser({
      keyName: "testing",
      returnSingle: true,
      zodSchema: schema,
    });
    try {
      await outputParser.invoke(
        new AIMessage({
          content: "",
          additional_kwargs: {
            tool_calls: [
              {
                id: "test",
                type: "function",
                function: {
                  name: "testing",
                  arguments: JSON.stringify({ testKey: 9 }),
                },
              },
            ],
          },
        })
      );
      expect(false).toBe(true);
    } catch (e) {
      expect(e).toBeInstanceOf(OutputParserException);
    }
  };
  test("zod v3", async () => {
    await assertThrows(z.object({ testKey: z.string() }));
  });
  test("zod v4", async () => {
    await assertThrows(z4.object({ testKey: z4.string() }));
  });
});

describe("JSONOutputKeyToolsParser can validate a proper input", () => {
  const assertValid = async (schema: InteropZodType) => {
    const outputParser = new JsonOutputKeyToolsParser({
      keyName: "testing",
      returnSingle: true,
      zodSchema: schema,
    });
    const result = await outputParser.invoke(
      new AIMessage({
        content: "",
        additional_kwargs: {
          tool_calls: [
            {
              id: "test",
              type: "function",
              function: {
                name: "testing",
                arguments: JSON.stringify({ testKey: "testval" }),
              },
            },
          ],
        },
      })
    );
    expect(result).toEqual({ testKey: "testval" });
  };
  test("zod v3", async () => {
    await assertValid(z.object({ testKey: z.string() }));
  });
  test("zod v4", async () => {
    await assertValid(z4.object({ testKey: z4.string() }));
  });
});

test("JSONOutputKeyToolsParser invoke with a top-level tool call", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
  });
  const result = await outputParser.invoke(
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "test",
          name: "testing",
          args: { testKey: 9 },
        },
      ],
    })
  );
  expect(result).toEqual({ testKey: 9 });
});

test("JSONOutputKeyToolsParser with a top-level tool call and passed schema throws", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
    zodSchema: z.object({
      testKey: z.string(),
    }),
  });
  try {
    await outputParser.invoke(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "test",
            name: "testing",
            args: { testKey: 9 },
          },
        ],
      })
    );
  } catch (e) {
    expect(e).toBeInstanceOf(OutputParserException);
  }
});

test("JSONOutputKeyToolsParser with a top-level tool call can validate a proper input", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
    zodSchema: z.object({
      testKey: z.string(),
    }),
  });
  const result = await outputParser.invoke(
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "test",
          name: "testing",
          args: { testKey: "testval" },
        },
      ],
    })
  );
  expect(result).toEqual({ testKey: "testval" });
});

test("JSONOutputKeyToolsParser can handle streaming input", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
    zodSchema: z.object({
      testKey: z.string(),
    }),
  });
  const fakeModel = RunnableLambda.from(async function* () {
    yield new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          index: 0,
          id: "test",
          name: "testing",
          args: `{ "testKey":`,
          type: "tool_call_chunk",
        },
      ],
    });
    yield new AIMessageChunk({
      content: "",
      tool_call_chunks: [],
    });
    yield new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          index: 0,
          id: "test",
          args: ` "testv`,
          type: "tool_call_chunk",
        },
      ],
    });
    yield new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          index: 0,
          id: "test",
          args: `al" }`,
          type: "tool_call_chunk",
        },
      ],
    });
  });
  const stream = await (fakeModel as any).pipe(outputParser).stream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.at(-1)).toEqual({ testKey: "testval" });
  // TODO: Fix typing issue
  const result = await (fakeModel as any).pipe(outputParser).invoke(
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "test",
          name: "testing",
          args: { testKey: "testval" },
          type: "tool_call",
        },
      ],
    })
  );
  expect(result).toEqual({ testKey: "testval" });
});

describe("JsonOutputKeyToolsParser returnId", () => {
  const message = new AIMessage({
    content: "",
    tool_calls: [
      { id: "call_1", name: "calc", args: { a: 1 }, type: "tool_call" },
      { id: "call_2", name: "calc", args: { a: 2 }, type: "tool_call" },
    ],
  });

  test("defaults to returning only args", async () => {
    const parser = new JsonOutputKeyToolsParser({ keyName: "calc" });
    expect(parser.returnId).toBe(false);
    expect(await parser.invoke(message)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("returnId: false returns only args", async () => {
    const parser = new JsonOutputKeyToolsParser({
      keyName: "calc",
      returnId: false,
      returnSingle: true,
    });
    expect(await parser.invoke(message)).toEqual({ a: 1 });
  });

  test("returnId: true returns the tool call id", async () => {
    const parser = new JsonOutputKeyToolsParser({
      keyName: "calc",
      returnId: true,
    });
    expect(parser.returnId).toBe(true);
    expect(await parser.invoke(message)).toEqual([
      { type: "calc", args: { a: 1 }, id: "call_1" },
      { type: "calc", args: { a: 2 }, id: "call_2" },
    ]);
  });

  test("returnId: true with returnSingle returns the first tool call", async () => {
    const parser = new JsonOutputKeyToolsParser({
      keyName: "calc",
      returnId: true,
      returnSingle: true,
    });
    expect(await parser.invoke(message)).toEqual({
      type: "calc",
      args: { a: 1 },
      id: "call_1",
    });
  });

  test("returnId: true reads ids from additional_kwargs tool calls", async () => {
    const parser = new JsonOutputKeyToolsParser({
      keyName: "calc",
      returnId: true,
      returnSingle: true,
    });
    const legacy = new AIMessage({
      content: "",
      additional_kwargs: {
        tool_calls: [
          {
            id: "call_9",
            type: "function",
            function: { name: "calc", arguments: JSON.stringify({ a: 9 }) },
          },
        ],
      },
    });
    expect(await parser.invoke(legacy)).toEqual({
      type: "calc",
      args: { a: 9 },
      id: "call_9",
    });
  });

  const schemaTests = (schema: InteropZodType) => async () => {
    const parser = new JsonOutputKeyToolsParser({
      keyName: "calc",
      returnId: true,
      zodSchema: schema,
    });
    expect(await parser.invoke(message)).toEqual([
      { type: "calc", args: { a: "1" }, id: "call_1" },
      { type: "calc", args: { a: "2" }, id: "call_2" },
    ]);
    const bad = new AIMessage({
      content: "",
      tool_calls: [
        { id: "call_3", name: "calc", args: { b: 1 }, type: "tool_call" },
      ],
    });
    await expect(parser.invoke(bad)).rejects.toThrow(OutputParserException);
  };

  test(
    "returnId: true validates args against a zod v3 schema",
    schemaTests(z.object({ a: z.number().transform(String) }))
  );
  test(
    "returnId: true validates args against a zod v4 schema",
    schemaTests(z4.object({ a: z4.number().transform(String) }))
  );
});
