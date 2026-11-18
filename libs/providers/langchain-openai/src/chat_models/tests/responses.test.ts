import { ContextOverflowError } from "@langchain/core/errors";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { describe, it, expect, vi } from "vitest";
import { ChatOpenAIResponses } from "../responses.js";

class TraceableChatOpenAIResponses extends ChatOpenAIResponses {
  traceParams(options: Parameters<ChatOpenAIResponses["invocationParams"]>[0]) {
    return this._getInvocationParamsForTracing(options);
  }

  traceOptions(
    options: Parameters<ChatOpenAIResponses["invocationParams"]>[0]
  ) {
    const params = this._getInvocationParamsForTracing(options);
    return this._getCallOptionsForTracing(options ?? {}, params);
  }
}

describe("MCP credential tracing", () => {
  it("redacts MCP credentials without changing request params", () => {
    const model = new TraceableChatOpenAIResponses({ model: "gpt-4o" });
    const functionTool = {
      type: "function" as const,
      function: {
        name: "lookup",
        parameters: { type: "object", properties: {} },
      },
    };
    const options = {
      temperature: 0.3,
      tools: [
        functionTool,
        {
          type: "mcp" as const,
          server_label: "private-server",
          server_url: "https://example.com/mcp",
          headers: { Authorization: "Bearer header-secret" },
          authorization: "Bearer authorization-secret",
        },
      ],
    };

    const requestParams = model.invocationParams(options);
    const traceParams = model.traceParams(options);
    const traceOptions = model.traceOptions(options);

    expect(requestParams.tools?.[1]).toMatchObject({
      headers: { Authorization: "Bearer header-secret" },
      authorization: "Bearer authorization-secret",
    });
    expect(traceParams.tools?.[1]).toMatchObject({
      headers: "**REDACTED**",
      authorization: "**REDACTED**",
    });
    expect(traceOptions.tools?.[1]).toMatchObject({
      headers: "**REDACTED**",
      authorization: "**REDACTED**",
    });
    expect(traceOptions.temperature).toBe(options.temperature);
    expect(traceOptions.tools?.[0]).toBe(functionTool);
    expect(JSON.stringify({ traceParams, traceOptions })).not.toContain(
      "secret"
    );
  });
});

describe("constructor shorthand", () => {
  it("supports string model shorthand", () => {
    const model = new ChatOpenAIResponses("gpt-4o-mini", { temperature: 0.3 });
    expect(model.model).toBe("gpt-4o-mini");
    expect(model.temperature).toBe(0.3);
  });
});

describe("strict tool-calling configuration", () => {
  it("falls back to supportsStrictToolCalling when strict is undefined", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      supportsStrictToolCalling: true,
    });

    const params = model.invocationParams({
      tools: [
        {
          type: "function",
          function: {
            name: "test_func",
            description: "testing",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });

    expect("strict" in params).toBe(false);

    expect((params.tools as Array<{ strict?: boolean }>)[0].strict).toBe(true);
  });

  it("respects user-provided strict option", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      supportsStrictToolCalling: true,
    });

    const params = model.invocationParams({
      strict: false,
      tools: [
        {
          type: "function",
          function: {
            name: "test_func",
            description: "testing",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });

    expect("strict" in params).toBe(false);

    expect((params.tools as Array<{ strict?: boolean }>)[0].strict).toBe(false);
  });
});

describe("service_tier configuration", () => {
  it("passes service_tier to invocation params", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      service_tier: "auto",
    });

    const params = model.invocationParams({});
    expect(params.service_tier).toBe("auto");
  });
});

describe("streaming errors", () => {
  it("wraps errors thrown while iterating the response stream", async () => {
    const model = new ChatOpenAIResponses({ model: "gpt-4o" });
    const originalError = {
      code: "context_length_exceeded",
      message: "The request exceeds the context window.",
      constructor: { name: "APIError" },
      toString() {
        return `APIError: ${this.message} (code: ${this.code})`;
      },
    };

    async function* streamWithError() {
      yield await Promise.reject(originalError);
    }

    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(streamWithError()) as typeof model.completionWithRetry;

    let caughtError: unknown;
    try {
      for await (const _ of model._streamResponseChunks(
        [new HumanMessage("hello")],
        {}
      )) {
        // The mocked stream throws before yielding chunks.
      }
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(ContextOverflowError);
    expect((caughtError as ContextOverflowError).cause).toBe(originalError);
  });
});

describe("streamed tool call arguments", () => {
  type StreamEvent = Record<string, unknown>;

  async function streamToolCalls(events: StreamEvent[]) {
    const model = new ChatOpenAIResponses({ model: "gpt-4o" });
    async function* stream() {
      yield* events;
    }
    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(stream()) as typeof model.completionWithRetry;

    let message: AIMessageChunk | undefined;
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("hello")],
      {}
    )) {
      if (!AIMessageChunk.isInstance(chunk.message)) {
        throw new Error("Expected an AIMessageChunk");
      }
      message = message ? message.concat(chunk.message) : chunk.message;
    }
    return message;
  }

  function functionCall(index: number, args: string): StreamEvent[] {
    const item = {
      type: "function_call",
      id: `fc_${index}`,
      call_id: `call_${index}`,
      name: "get_weather",
      arguments: "",
      status: "in_progress",
    };
    return [
      { type: "response.output_item.added", output_index: index, item },
      {
        type: "response.function_call_arguments.done",
        output_index: index,
        item_id: item.id,
        arguments: args,
      },
      {
        type: "response.output_item.done",
        output_index: index,
        item: { ...item, arguments: args, status: "completed" },
      },
    ];
  }

  function argumentDelta(index: number, delta: string): StreamEvent {
    return {
      type: "response.function_call_arguments.delta",
      output_index: index,
      item_id: `fc_${index}`,
      delta,
    };
  }

  it("keeps arguments that arrive only in the final events", async () => {
    const cities = ["Paris", "Tokyo", "Lima"];
    const message = await streamToolCalls(
      cities.flatMap((city, index) =>
        functionCall(index, JSON.stringify({ city }))
      )
    );

    expect(message?.tool_calls).toEqual(
      cities.map((city, index) => ({
        type: "tool_call",
        name: "get_weather",
        args: { city },
        id: `call_${index}`,
      }))
    );
  });

  it("does not repeat arguments that were streamed in full", async () => {
    const args = JSON.stringify({ city: "Paris" });
    const [added, ...done] = functionCall(0, args);
    const message = await streamToolCalls([
      added,
      argumentDelta(0, args.slice(0, 5)),
      argumentDelta(0, args.slice(5)),
      ...done,
    ]);

    expect(message?.tool_call_chunks?.[0].args).toBe(args);
    expect(message?.tool_calls?.[0].args).toEqual({ city: "Paris" });
  });

  it("fills in the text missing after partial deltas", async () => {
    const args = JSON.stringify({ city: "Paris" });
    const [added, ...done] = functionCall(0, args);
    const message = await streamToolCalls([
      added,
      argumentDelta(0, args.slice(0, 6)),
      ...done,
    ]);

    expect(message?.tool_call_chunks?.[0].args).toBe(args);
    expect(message?.tool_calls?.[0].args).toEqual({ city: "Paris" });
  });

  it("leaves a final text that does not extend the streamed text", async () => {
    const [added, ...done] = functionCall(0, JSON.stringify({ city: "Paris" }));
    const message = await streamToolCalls([
      added,
      argumentDelta(0, '{"town":"Lyon"}'),
      ...done,
    ]);

    expect(message?.tool_call_chunks?.[0].args).toBe('{"town":"Lyon"}');
  });

  it("keeps custom tool input that arrives only in the final events", async () => {
    const item = {
      type: "custom_tool_call",
      id: "ctc_0",
      call_id: "call_0",
      name: "execute_code",
      input: "",
    };
    const message = await streamToolCalls([
      { type: "response.output_item.added", output_index: 0, item },
      {
        type: "response.custom_tool_call_input.done",
        output_index: 0,
        item_id: item.id,
        input: "print(1)",
      },
      {
        type: "response.output_item.done",
        output_index: 0,
        item: { ...item, input: "print(1)" },
      },
    ]);

    expect(message?.tool_calls).toEqual([
      {
        type: "tool_call",
        name: "execute_code",
        args: { input: "print(1)" },
        id: "call_0",
      },
    ]);
  });
});

describe("tool search support", () => {
  it("tool_search passes through as a built-in tool", () => {
    const model = new ChatOpenAIResponses({ model: "gpt-5.3" });
    const params = model.invocationParams({
      tools: [
        { type: "tool_search" },
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });

    const tools = params.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(2);
    expect(tools[0]).toEqual({ type: "tool_search" });
    expect(tools[1]).toHaveProperty("type", "function");
  });

  it("tool_search with client execution passes through", () => {
    const model = new ChatOpenAIResponses({ model: "gpt-5.3" });
    const params = model.invocationParams({
      tools: [
        {
          type: "tool_search",
          execution: "client",
          description: "Search tools",
          parameters: {
            type: "object",
            properties: { goal: { type: "string" } },
          },
        },
      ],
    });

    const tools = params.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(1);
    expect(tools[0]).toEqual({
      type: "tool_search",
      execution: "client",
      description: "Search tools",
      parameters: {
        type: "object",
        properties: { goal: { type: "string" } },
      },
    });
  });

  it("defer_loading is propagated from function tool definitions", () => {
    const model = new ChatOpenAIResponses({ model: "gpt-5.3" });
    const params = model.invocationParams({
      tools: [
        { type: "tool_search" },
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "object", properties: {} },
          },
          defer_loading: true,
        },
      ],
    });

    const tools = params.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(2);
    expect(tools[1]).toHaveProperty("defer_loading", true);
    expect(tools[1]).toHaveProperty("type", "function");
    expect(tools[1]).toHaveProperty("name", "get_weather");
  });
});
