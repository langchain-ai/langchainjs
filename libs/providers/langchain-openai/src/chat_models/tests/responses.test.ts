import { describe, it, expect } from "vitest";
import { ChatOpenAIResponses } from "../responses.js";

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

describe("tool search support", () => {
  it("tool_search passes through as a built-in tool", () => {
    const model = new ChatOpenAIResponses({ model: "gpt-4.1-mini" });
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
    const model = new ChatOpenAIResponses({ model: "gpt-4.1-mini" });
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
    const model = new ChatOpenAIResponses({ model: "gpt-4.1-mini" });
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
