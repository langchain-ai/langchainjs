import { test, it, expect, describe } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";

import {
  DynamicStructuredTool,
  DynamicTool,
  StructuredToolParams,
  ToolInputParsingException,
  isStructuredToolParams,
  tool,
} from "../index.js";
import { ToolCall, ToolMessage } from "../../messages/tool.js";
import { RunnableConfig } from "../../runnables/types.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";

test("Tool should error if responseFormat is content_and_artifact but the function doesn't return a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    // Should be able to type this as base RunnableConfig without issue,
    // though true type is more specific
    (_, _config: RunnableConfig) => {
      return "str";
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  await expect(async () => {
    await weatherTool.invoke({ location: "San Francisco" });
  }).rejects.toThrow();
});

test("Tool works if responseFormat is content_and_artifact and returns a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    (input) => {
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  const toolResult = await weatherTool.invoke({ location: "San Francisco" });

  expect(toolResult).not.toBeInstanceOf(ToolMessage);
  expect(toolResult).toBe("msg_content");
});

test("ToolMessage content coerces to empty string when tool returns undefined", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const toolCall = {
    id: "testid",
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    () => {
      return undefined;
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult).toHaveProperty("content", "");
});

test("Does not return tool message if responseFormat is content_and_artifact and returns a tuple and a tool call with no id is passed in", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });
  const toolCall = {
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    (input, config) => {
      expect(config.toolCall).toEqual(toolCall);
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBe("msg_content");
});

test("Returns tool message if responseFormat is content_and_artifact and returns a tuple and a tool call with id is passed in", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const toolCall = {
    id: "testid",
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    (input, config) => {
      expect(config.toolCall).toEqual(toolCall);
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult.content).toBe("msg_content");
  expect(toolResult.artifact).toEqual({ location: "San Francisco" });
  expect(toolResult.name).toBe("weather");
});

test("Does not double wrap a returned tool message even if a tool call with id is passed in", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const toolCall = {
    id: "testid",
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    (_, config) => {
      expect(config.toolCall).toEqual(toolCall);
      return new ToolMessage({
        tool_call_id: "not_original",
        content: "bar",
        name: "baz",
      });
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult.tool_call_id).toBe("not_original");
  expect(toolResult.content).toBe("bar");
  expect(toolResult.name).toBe("baz");
});

test("Tool can accept single string input", async () => {
  const toolCall = {
    id: "testid",
    args: { input: "b" },
    name: "string_tool",
    type: "tool_call",
  } as const;

  const stringTool = tool(
    (input: string, config): string => {
      expect(config).toMatchObject({ configurable: { foo: "bar" } });
      if (config.configurable.usesToolCall) {
        expect(config.toolCall).toEqual(toolCall);
      }
      return `${input}a`;
    },
    {
      name: "string_tool",
      description: "A tool that appends 'a' to the input string",
      schema: z.string(),
    }
  );

  const result = await stringTool.invoke("b", { configurable: { foo: "bar" } });
  expect(result).toBe("ba");

  const result2 = await stringTool.invoke(toolCall, {
    configurable: { foo: "bar", usesToolCall: true },
  });
  expect(result2).toBeInstanceOf(ToolMessage);
  expect(result2.content).toBe("ba");
  expect(result2.name).toBe("string_tool");
});

test("Tool declared with JSON schema", async () => {
  const weatherSchema = {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "A place",
      },
    },
    required: ["location"],
  } as const;

  let toolFunctionWeatherToolCalls = 0;
  const toolFunctionWeatherTool = tool(
    (input) => {
      toolFunctionWeatherToolCalls += 1;
      expect(input).toBeDefined();
      expect(typeof input).toBe("object");
      expect(Array.isArray(input)).toBe(false);
      expect(input).toEqual({ location: expect.any(String) });
      return "Sunny";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  expect(toolFunctionWeatherTool).toBeInstanceOf(DynamicStructuredTool);

  let dstClassWeatherToolCalls = 0;
  const dstClassWeatherTool = new DynamicStructuredTool({
    name: "weather",
    description: "get the weather",
    func: async (input) => {
      dstClassWeatherToolCalls += 1;
      expect(input).toBeDefined();
      expect(typeof input).toBe("object");
      expect(Array.isArray(input)).toBe(false);
      expect(input).toEqual({ location: expect.any(String) });
      return "Sunny";
    },
    schema: weatherSchema,
  });

  await expect(
    // unfortunately this can't be type checked, but we do validate the schema
    toolFunctionWeatherTool.invoke({
      somethingSilly: true,
    })
  ).rejects.toThrow(ToolInputParsingException);

  // should not have called the tool function because input didn't validate
  expect(toolFunctionWeatherToolCalls).toBe(0);

  await expect(
    toolFunctionWeatherTool.invoke({
      location: "San Francisco",
    })
  ).resolves.toBe("Sunny");
  expect(toolFunctionWeatherToolCalls).toBe(1);

  await expect(
    // unfortunately this can't be type checked, but we do validate the schema
    dstClassWeatherTool.invoke({
      somethingSilly: true,
    })
  ).rejects.toThrow(ToolInputParsingException);
  expect(dstClassWeatherToolCalls).toBe(0);

  await expect(
    dstClassWeatherTool.invoke({
      location: "San Francisco",
    })
  ).resolves.toBe("Sunny");

  expect(dstClassWeatherToolCalls).toBe(1);
});

test("Tool declared with zod v4 schema", async () => {
  const weatherSchema = z4.object({
    location: z4.string(),
  });

  const weatherTool = tool(
    (_) => {
      return "Sunny";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  const result = await weatherTool.invoke({
    location: "San Francisco",
  });
  expect(result).toBe("Sunny");

  await expect(
    // unfortunately this can't be type checked, but we do validate the schema
    weatherTool.invoke({
      // @ts-expect-error Invalid argument
      somethingSilly: true,
    })
  ).rejects.toThrow(ToolInputParsingException);
});

test("Tool input typing is enforced", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    (_) => {
      return "Sunny";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  const weatherTool2 = new DynamicStructuredTool({
    name: "weather",
    description: "get the weather",
    func: async (_) => {
      return "Sunny";
    },
    schema: weatherSchema,
  });

  const weatherTool3 = tool(
    async (_) => {
      return "Sunny";
    },
    {
      name: "weather",
      description: "get the weather",
      schema: z.string(),
    }
  );

  await expect(async () => {
    await weatherTool.invoke({
      // @ts-expect-error Invalid argument
      badval: "someval",
    });
  }).rejects.toThrow();
  const res = await weatherTool.invoke({
    location: "somewhere",
  });
  expect(res).toEqual("Sunny");
  await expect(async () => {
    await weatherTool2.invoke({
      // @ts-expect-error Invalid argument
      badval: "someval",
    });
  }).rejects.toThrow();
  const res2 = await weatherTool2.invoke({
    location: "someval",
  });
  expect(res2).toEqual("Sunny");
  const res3 = await weatherTool3.invoke("blah");
  expect(res3).toEqual("Sunny");
});

test("Tool can throw detailed errors", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const stringTool = tool(
    (input) => {
      return JSON.stringify(input);
    },
    {
      name: "string_tool",
      description: "A tool that appends 'a' to the input string",
      schema: weatherSchema,
      verboseParsingErrors: true,
    }
  );

  await expect(
    stringTool.invoke({
      // @ts-expect-error Testing parsing errors
      location: 8,
    })
  ).rejects.toThrow(`Received tool input did not match expected schema
Details: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "location"
    ],
    "message": "Expected string, received number"
  }
]`);
});

describe("isStructuredToolParams", () => {
  test("returns true for a tool with a zod schema", () => {
    const zodToolParams: StructuredToolParams = {
      name: "test",
      schema: z.string(),
    };
    expect(isStructuredToolParams(zodToolParams)).toBe(true);
  });
  test("returns true for a tool with a zod v4 schema", () => {
    const zodToolParams: StructuredToolParams = {
      name: "test",
      schema: z4.string(),
    };
    expect(isStructuredToolParams(zodToolParams)).toBe(true);
  });
  test("returns true for a tool with a json schema", () => {
    const jsonToolParams: StructuredToolParams = {
      name: "test",
      schema: { type: "string", description: "test" },
    };
    expect(isStructuredToolParams(jsonToolParams)).toBe(true);
  });
  test("returns false for a tool with an invalid schema", () => {
    const nonStructuredToolParams: StructuredToolParams = {
      name: "test",
      // @ts-expect-error Testing non-structured schema
      schema: "not a schema",
    };
    expect(isStructuredToolParams(nonStructuredToolParams)).toBe(false);
  });
});

describe("DynamicTool", () => {
  test("will thread metadata through to a resulting ToolMessage", async () => {
    const tool = new DynamicTool({
      name: "test",
      description: "test",
      metadata: {
        foo: "bar",
      },
      func: async () => "test",
    });

    const input: ToolCall = {
      id: "test_id",
      name: "test",
      args: { input: "test" },
      type: "tool_call",
    };

    const result = await tool.invoke(input);

    expect(result).toBeInstanceOf(ToolMessage);
    expect(result.metadata).toEqual({
      foo: "bar",
    });
  });
});

describe("tool()", () => {
  it("should propagate extras to the tool instance", () => {
    const testTool = tool(
      async (input) => {
        const typedInput: string = input;
        return `processed: ${typedInput}`;
      },
      {
        name: "test_tool",
        description: "A test tool",
        extras: {
          foo: "test",
        },
      }
    );
    expect(testTool.extras).toEqual({
      foo: "test",
    });
  });
});

describe("Generator tools (async function*)", () => {
  test("Generator tool yields partial results and returns final result", async () => {
    const partials: unknown[] = [];

    const testTool = tool(
      async function* (input) {
        yield { status: "searching", city: input.city };
        yield { status: "found", temperature: 72 };
        return `Weather in ${input.city}: 72F`;
      },
      {
        name: "weather",
        schema: z.object({ city: z.string() }),
        description: "Get weather",
      }
    );

    const result = await testTool.invoke(
      {
        id: "call_123",
        name: "weather",
        args: { city: "SF" },
        type: "tool_call",
      },
      {
        callbacks: [
          {
            handleToolEvent(chunk: unknown) {
              partials.push(chunk);
            },
          },
        ],
      }
    );

    expect(result).toBeInstanceOf(ToolMessage);
    expect(result.content).toBe("Weather in SF: 72F");

    expect(partials).toHaveLength(2);
    expect(partials[0]).toEqual({ status: "searching", city: "SF" });
    expect(partials[1]).toEqual({ status: "found", temperature: 72 });
  });

  test("DynamicTool (string schema) generator yields partial results and returns final result", async () => {
    const partials: unknown[] = [];

    const stringSchemaTool = tool(
      async function* (input: string) {
        yield { message: "step 1", input };
        await new Promise((r) => setTimeout(r, 10));
        yield { message: "step 2" };
        return `Done: ${input}`;
      },
      {
        name: "string_stream_tool",
        description: "A string-input tool that streams progress",
        schema: z.string(),
      }
    );

    const result = await stringSchemaTool.invoke("hello", {
      callbacks: [
        {
          handleToolEvent(chunk: unknown) {
            partials.push(chunk);
          },
        },
      ],
    });

    expect(result).toBe("Done: hello");
    expect(partials).toHaveLength(2);
    expect(partials[0]).toEqual({ message: "step 1", input: "hello" });
    expect(partials[1]).toEqual({ message: "step 2" });
  });

  test("Non generator tool still works correctly", async () => {
    const partials: unknown[] = [];

    const testTool = tool(
      async (input) => {
        return `Weather in ${input.city}: 72F`;
      },
      {
        name: "weather",
        schema: z.object({ city: z.string() }),
        description: "Get weather",
      }
    );

    const result = await testTool.invoke(
      { city: "SF" },
      {
        callbacks: [
          {
            handleToolEvent(chunk: unknown) {
              partials.push(chunk);
            },
          },
        ],
      }
    );

    expect(result).toBe("Weather in SF: 72F");
    expect(partials).toHaveLength(0);
  });

  test("Generator tool with no yields works", async () => {
    const testTool = tool(
      // eslint-disable-next-line require-yield -- intentional: testing generator with no yields
      async function* (input) {
        return input.x * 2;
      },
      {
        name: "double",
        schema: z.object({ x: z.number() }),
        description: "Double a number",
      }
    );

    const result = await testTool.invoke({ x: 5 });
    expect(result).toBe(10);
  });

  test("handleToolStart and handleToolEnd still fire with generator tools", async () => {
    const events: string[] = [];

    const testTool = tool(
      async function* (input) {
        yield { status: "searching", city: input.city };
        yield { status: "found", temperature: 72 };
        return `Weather in ${input.city}: 72F`;
      },
      {
        name: "weather",
        schema: z.object({ city: z.string() }),
        description: "Get weather",
      }
    );

    await testTool.invoke(
      { city: "SF" },
      {
        callbacks: [
          {
            handleToolStart() {
              events.push("start");
            },
          },
          {
            handleToolEvent() {
              events.push("stream");
            },
          },
          {
            handleToolEnd() {
              events.push("end");
            },
          },
        ],
      }
    );

    await awaitAllCallbacks();

    expect(events).toEqual(["start", "stream", "stream", "end"]);
  });

  test("handleToolStart receives toolCallId when invoked with ToolCall", async () => {
    const expectedToolCallId = "call_abc123";
    let receivedToolCallId: string | undefined;

    const testTool = tool((input) => String(input.x), {
      name: "adder",
      schema: z.object({ x: z.number() }),
      description: "Echo x",
    });

    const toolCall: ToolCall = {
      id: expectedToolCallId,
      name: "adder",
      args: { x: 42 },
      type: "tool_call",
    };

    await testTool.invoke(toolCall, {
      callbacks: [
        {
          handleToolStart(
            _tool,
            _input,
            _runId,
            _parentRunId,
            _tags,
            _metadata,
            _runName,
            toolCallId
          ) {
            receivedToolCallId = toolCallId;
          },
        },
      ],
    });

    expect(receivedToolCallId).toBe(expectedToolCallId);
  });

  test("should handle generator errors mid-stream", async () => {
    let handleToolErrorCalled = false;

    const testTool = tool(
      async function* (input) {
        yield input.chunk;
        throw new Error("Mid-stream failure");
      },
      {
        name: "failing",
        schema: z.object({ chunk: z.string() }),
        description: "Generator that throws after yielding",
      }
    );

    await expect(
      testTool.invoke(
        { chunk: "chunk1" },
        {
          callbacks: [
            {
              handleToolError(err: unknown) {
                handleToolErrorCalled = true;
                expect(err).toBeInstanceOf(Error);
                expect((err as Error).message).toBe("Mid-stream failure");
              },
            },
          ],
        }
      )
    ).rejects.toThrow("Mid-stream failure");

    expect(handleToolErrorCalled).toBe(true);
  });

  test("should handle callback errors during streaming (resilient)", async () => {
    let handleToolErrorCalled = false;

    const testTool = tool(
      async function* (input) {
        yield input.chunk;
        return "final";
      },
      {
        name: "streaming",
        schema: z.object({ chunk: z.string() }),
        description: "Generator that yields then returns",
      }
    );

    const result = await testTool.invoke(
      { chunk: "chunk1" },
      {
        callbacks: [
          {
            handleToolEvent: async () => {
              throw new Error("Callback failed");
            },
            handleToolError(err: unknown) {
              handleToolErrorCalled = true;
              expect(err).toBeInstanceOf(Error);
              expect((err as Error).message).toBe("Callback failed");
            },
            raiseError: true,
            awaitHandlers: true,
          },
        ],
      }
    );

    await awaitAllCallbacks();
    expect(handleToolErrorCalled).toBe(true);
    expect(result).toBe("final");
  });

  test("should close generator on early termination (cleanup runs)", async () => {
    let generatorCleanupRan = false;

    // When generator throws mid-stream, invoke rejects and we still close the generator in finally.
    const throwingTool = tool(
      async function* (input) {
        try {
          yield input.chunk;
          throw new Error("Generator fails");
        } finally {
          generatorCleanupRan = true;
        }
      },
      {
        name: "throwing",
        schema: z.object({ chunk: z.string() }),
        description: "Generator that throws after yield",
      }
    );

    await expect(throwingTool.invoke({ chunk: "chunk1" })).rejects.toThrow(
      "Generator fails"
    );

    expect(generatorCleanupRan).toBe(true);
  });
});
