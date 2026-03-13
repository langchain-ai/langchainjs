import { describe, expect, test } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Gemini } from "../../chat_models/types.js";
import {
  convertGeminiPartsToToolCalls,
  convertMessagesToGeminiContents,
} from "../messages.js";

describe("convertGeminiPartsToToolCalls", () => {
  test("uses native functionCall.id when present", () => {
    const parts: Gemini.Part[] = [
      {
        functionCall: {
          name: "search_web",
          args: { query: "latest AI news" },
          id: "server-assigned-id-123",
        },
      },
    ];

    const toolCalls = convertGeminiPartsToToolCalls(parts);

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].id).toBe("server-assigned-id-123");
    expect(toolCalls[0].name).toBe("search_web");
    expect(toolCalls[0].args).toEqual({ query: "latest AI news" });
  });

  test("generates a unique ID when functionCall.id is not present", () => {
    const parts: Gemini.Part[] = [
      {
        functionCall: {
          name: "search_web",
          args: { query: "latest AI news" },
        },
      },
    ];

    const toolCalls = convertGeminiPartsToToolCalls(parts);

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].id).toBeDefined();
    expect(toolCalls[0].id!.startsWith("lc-tool-call-")).toEqual(true);
  });

  test("generates unique IDs across multiple invocations", () => {
    const parts: Gemini.Part[] = [
      {
        functionCall: {
          name: "my_tool",
          args: { query: "first" },
        },
      },
    ];

    const firstCallToolCalls = convertGeminiPartsToToolCalls(parts);
    const secondCallToolCalls = convertGeminiPartsToToolCalls(parts);

    expect(firstCallToolCalls[0].id).not.toBe(secondCallToolCalls[0].id);
    expect(firstCallToolCalls[0].id!.startsWith("lc-tool-call-"));
    expect(secondCallToolCalls[0].id!.startsWith("lc-tool-call-"));
  });

  test("generates unique IDs for multiple tool calls in the same response", () => {
    const parts: Gemini.Part[] = [
      {
        functionCall: {
          name: "tool_a",
          args: { query: "first" },
        },
      },
      {
        functionCall: {
          name: "tool_b",
          args: { query: "second" },
        },
      },
    ];

    const toolCalls = convertGeminiPartsToToolCalls(parts);

    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].id).not.toBe(toolCalls[1].id);
  });

  test("mixes native and generated IDs", () => {
    const parts: Gemini.Part[] = [
      {
        functionCall: {
          name: "tool_a",
          args: {},
          id: "native-id",
        },
      },
      {
        functionCall: {
          name: "tool_b",
          args: {},
        },
      },
    ];

    const toolCalls = convertGeminiPartsToToolCalls(parts);

    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].id).toBe("native-id");
    expect(toolCalls[1].id).toBeDefined();
    expect(toolCalls[1].id).not.toBe("native-id");
  });
});

describe("convertMessagesToGeminiContents", () => {
  test("passes tool_call_id through as functionResponse.id (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "my_tool",
            args: { query: "test" },
            id: "tool-call-abc",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "result",
        tool_call_id: "tool-call-abc",
        name: "my_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find((c) => c.role === "function");
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts!.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBe("tool-call-abc");
  });

  test("resolves functionResponse.name from tool_calls (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "get_weather",
            args: { city: "London" },
            id: "call-123",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: '{"temp": 15}',
        tool_call_id: "call-123",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find((c) => c.role === "function");
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .name
    ).toBe("get_weather");
  });

  test("resolves functionResponse.name for multiple tool calls (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "get_weather",
            args: { city: "London" },
            id: "call-1",
            type: "tool_call",
          },
          {
            name: "get_time",
            args: { timezone: "UTC" },
            id: "call-2",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: '{"temp": 15}',
        tool_call_id: "call-1",
      }),
      new ToolMessage({
        content: '{"time": "12:00"}',
        tool_call_id: "call-2",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContents = contents.filter((c) => c.role === "function");
    expect(toolResponseContents).toHaveLength(2);

    const firstResponse = toolResponseContents[0].parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(firstResponse.functionResponse!.name).toBe("get_weather");

    const secondResponse = toolResponseContents[1].parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(secondResponse.functionResponse!.name).toBe("get_time");
  });

  test("falls back to ToolMessage.name when tool call lookup succeeds (legacy path)", () => {
    // Even when ToolMessage has a name, the tool_calls lookup should take priority
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "get_weather",
            args: {},
            id: "call-abc",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "result",
        tool_call_id: "call-abc",
        name: "get_weather",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find((c) => c.role === "function");
    const functionResponsePart = toolResponseContent!.parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart.functionResponse!.name).toBe("get_weather");
  });

  test("passes tool_call_id through as functionResponse.id (v1 standard path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "my_tool",
            args: { query: "test" },
            id: "tool-call-xyz",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "result",
        tool_call_id: "tool-call-xyz",
        name: "my_tool",
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find((c) => c.role === "function");
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts!.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBe("tool-call-xyz");
  });

  test("omits generated tool_call_id from functionResponse.id (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "my_tool",
            args: { query: "test" },
            id: "lc-tool-call-abc",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "result",
        tool_call_id: "lc-tool-call-abc",
        name: "my_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find((c) => c.role === "function");
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts!.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBeUndefined();
  });

  test("omits generated tool_call_id from functionResponse.id (v1 standard path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "my_tool",
            args: { query: "test" },
            id: "lc-tool-call-xyz",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "result",
        tool_call_id: "lc-tool-call-xyz",
        name: "my_tool",
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find((c) => c.role === "function");
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts!.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBeUndefined();
  });
});
