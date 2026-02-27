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
    expect(toolCalls[0].id).not.toBe("call_0");
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

    const functionResponsePart = toolResponseContent!.parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBe("tool-call-abc");
  });

  test("preserves thought and thoughtSignature on text parts from thinking models (legacy path)", () => {
    // Gemini thinking models produce [thought, functionCall] turns.
    // Verify the converter preserves thought/thoughtSignature on text parts
    // so the API can distinguish thoughts from regular text on the next call.
    const messages = [
      new HumanMessage("What's the weather in Paris?"),
      new AIMessage({
        content: [
          {
            type: "text",
            text: "I need to check the weather.",
            thought: true,
            thoughtSignature: "dGhvdWdodC1zaWduYXR1cmUtMQ==",
          },
        ] as unknown as Array<Record<string, unknown>>,
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();

    const part = modelContent!.parts[0] as Gemini.Part;
    expect(part.text).toBe("I need to check the weather.");
    expect(part.thought).toBe(true);
    expect(part.thoughtSignature).toBe("dGhvdWdodC1zaWduYXR1cmUtMQ==");
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

    const functionResponsePart = toolResponseContent!.parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBe("tool-call-xyz");
  });
});
