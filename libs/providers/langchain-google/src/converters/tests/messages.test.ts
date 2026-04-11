import { describe, expect, test } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
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

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
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

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
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

    const toolResponseContents = contents.filter(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
    expect(toolResponseContents).toHaveLength(1);

    const parts = toolResponseContents[0].parts.filter(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(parts).toHaveLength(2);

    const firstResponse = parts[0] as Gemini.Part.FunctionResponse;
    expect(firstResponse.functionResponse!.name).toBe("get_weather");

    const secondResponse = parts[1] as Gemini.Part.FunctionResponse;
    expect(secondResponse.functionResponse!.name).toBe("get_time");
  });

  test("merges consecutive ToolMessages into a single function turn for parallel tool calls (legacy path)", () => {
    const messages = [
      new HumanMessage("What's the weather in Paris and London?"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "get_weather",
            args: { city: "Paris" },
            id: "call-paris",
            type: "tool_call",
          },
          {
            name: "get_weather",
            args: { city: "London" },
            id: "call-london",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "18°C, partly cloudy",
        tool_call_id: "call-paris",
      }),
      new ToolMessage({
        content: "14°C, rainy",
        tool_call_id: "call-london",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    // Should produce: user, model (functionCall parts), user (single merged turn with functionResponses)
    expect(contents).toHaveLength(3);

    expect(contents[1].role).toBe("model");

    const functionTurn = contents[2];
    expect(functionTurn.role).toBe("user");
    expect(functionTurn.parts).toHaveLength(2);

    const responses = functionTurn.parts.filter(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse[];
    expect(responses).toHaveLength(2);
    expect(responses[0].functionResponse!.id).toBe("call-paris");
    expect(responses[1].functionResponse!.id).toBe("call-london");
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

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
    const functionResponsePart = toolResponseContent!.parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart.functionResponse!.name).toBe("get_weather");
  });

  test("AIMessage with tool_calls produces model turn with functionCall parts (legacy path)", () => {
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
        ],
      }),
      new ToolMessage({
        content: '{"temp": 15}',
        tool_call_id: "call-1",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();

    const functionCallPart = modelContent!.parts.find(
      (p) => "functionCall" in p && p.functionCall
    ) as Gemini.Part.FunctionCall;
    expect(functionCallPart).toBeDefined();
    expect(functionCallPart.functionCall!.name).toBe("get_weather");
    expect(functionCallPart.functionCall!.args).toEqual({ city: "London" });
  });

  test("AIMessage with tool_calls produces model turn with functionCall parts (v1 path)", () => {
    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "get_weather",
          args: { city: "London" },
          id: "call-1",
          type: "tool_call",
        },
      ],
    });
    aiMsg.response_metadata = { output_version: "v1" };
    const messages = [
      new HumanMessage("hello"),
      aiMsg,
      new ToolMessage({
        content: '{"temp": 15}',
        tool_call_id: "call-1",
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();

    const functionCallPart = modelContent!.parts.find(
      (p) => "functionCall" in p && p.functionCall
    ) as Gemini.Part.FunctionCall;
    expect(functionCallPart).toBeDefined();
    expect(functionCallPart.functionCall!.name).toBe("get_weather");
    expect(functionCallPart.functionCall!.args).toEqual({ city: "London" });
  });

  test("ToolMessage name resolved from tool_calls (v1 path)", () => {
    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "get_weather",
          args: { city: "London" },
          id: "call-123",
          type: "tool_call",
        },
      ],
    });
    aiMsg.response_metadata = { output_version: "v1" };
    const messages = [
      new HumanMessage("hello"),
      aiMsg,
      new ToolMessage({
        content: '{"temp": 15}',
        tool_call_id: "call-123",
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart).toBeDefined();
    expect(functionResponsePart.functionResponse!.name).toBe("get_weather");
  });

  test("Multiple tool calls name resolution (v1 path)", () => {
    const aiMsg = new AIMessage({
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
    });
    aiMsg.response_metadata = { output_version: "v1" };
    const messages = [
      new HumanMessage("hello"),
      aiMsg,
      new ToolMessage({
        content: '{"temp": 15}',
        tool_call_id: "call-1",
        response_metadata: { output_version: "v1" },
      }),
      new ToolMessage({
        content: '{"time": "12:00"}',
        tool_call_id: "call-2",
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    // Consecutive ToolMessages with the same "user" role are merged into one content
    const toolResponseContents = contents.filter(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
    expect(toolResponseContents).toHaveLength(1);

    const mergedParts = toolResponseContents[0].parts.filter(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse[];
    expect(mergedParts).toHaveLength(2);
    expect(mergedParts[0].functionResponse!.name).toBe("get_weather");
    expect(mergedParts[1].functionResponse!.name).toBe("get_time");
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

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
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

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
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

    const toolResponseContent = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => "functionResponse" in p)
    );
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

  test("v1 contentBlocks: text-plain block produces fileData part", () => {
    const messages = [
      new HumanMessage({
        content: [
          {
            type: "text-plain" as const,
            mimeType: "text/plain",
            url: "gs://bucket/readme.txt",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const userContent = contents.find((c) => c.role === "user");
    expect(userContent).toBeDefined();
    expect(userContent!.parts).toHaveLength(1);

    const part = userContent!.parts[0] as Gemini.Part.FileData;
    expect(part.fileData).toBeDefined();
    expect(part.fileData!.fileUri).toBe("gs://bucket/readme.txt");
    expect(part.fileData!.mimeType).toBe("text/plain");
  });

  test("v1 contentBlocks: file block produces fileData part", () => {
    const messages = [
      new HumanMessage({
        content: [
          {
            type: "file" as const,
            mimeType: "application/pdf",
            url: "gs://bucket/doc.pdf",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const userContent = contents.find((c) => c.role === "user");
    expect(userContent).toBeDefined();
    expect(userContent!.parts).toHaveLength(1);

    const part = userContent!.parts[0] as Gemini.Part.FileData;
    expect(part.fileData).toBeDefined();
    expect(part.fileData!.fileUri).toBe("gs://bucket/doc.pdf");
    expect(part.fileData!.mimeType).toBe("application/pdf");
  });

  test("v1 contentBlocks: text-plain block with base64 data produces inlineData part", () => {
    const messages = [
      new HumanMessage({
        content: [
          {
            type: "text-plain" as const,
            mimeType: "text/plain",
            data: "SGVsbG8gd29ybGQ=",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const userContent = contents.find((c) => c.role === "user");
    expect(userContent).toBeDefined();
    expect(userContent!.parts).toHaveLength(1);

    const part = userContent!.parts[0] as Gemini.Part.InlineData;
    expect(part.inlineData).toBeDefined();
    expect(part.inlineData!.mimeType).toBe("text/plain");
    expect(part.inlineData!.data).toBe("SGVsbG8gd29ybGQ=");
  });

  test("v1 contentBlocks: file block with base64 data produces inlineData part", () => {
    const messages = [
      new HumanMessage({
        content: [
          {
            type: "file" as const,
            mimeType: "application/pdf",
            data: "JVBERi0xLjQ=",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const userContent = contents.find((c) => c.role === "user");
    expect(userContent).toBeDefined();
    expect(userContent!.parts).toHaveLength(1);

    const part = userContent!.parts[0] as Gemini.Part.InlineData;
    expect(part.inlineData).toBeDefined();
    expect(part.inlineData!.mimeType).toBe("application/pdf");
    expect(part.inlineData!.data).toBe("JVBERi0xLjQ=");
  });

  test("v1 contentBlocks: mixed block types all produce parts", () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: "text" as const, text: "Summarize these files" },
          {
            type: "image" as const,
            mimeType: "image/png",
            url: "gs://bucket/photo.png",
          },
          {
            type: "text-plain" as const,
            mimeType: "text/plain",
            url: "gs://bucket/notes.txt",
          },
          {
            type: "file" as const,
            mimeType: "application/pdf",
            url: "gs://bucket/report.pdf",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const userContent = contents.find((c) => c.role === "user");
    expect(userContent).toBeDefined();
    expect(userContent!.parts).toHaveLength(4);

    // text part
    expect((userContent!.parts[0] as Gemini.Part.Text).text).toBe(
      "Summarize these files"
    );
    // image part
    expect(
      (userContent!.parts[1] as Gemini.Part.FileData).fileData
    ).toBeDefined();
    // text-plain part
    expect(
      (userContent!.parts[2] as Gemini.Part.FileData).fileData!.fileUri
    ).toBe("gs://bucket/notes.txt");
    // file part
    expect(
      (userContent!.parts[3] as Gemini.Part.FileData).fileData!.fileUri
    ).toBe("gs://bucket/report.pdf");
  });

  test("v0 legacy path: preserves thoughtSignature from originalTextContentBlock for string content", () => {
    const aiMsg = new AIMessage({
      content: "Hello thinking world",
      additional_kwargs: {
        originalTextContentBlock: {
          type: "text",
          text: "Hello thinking world",
          thoughtSignature: "sig-abc123",
        },
      },
      response_metadata: { model_provider: "google" },
    });
    const messages = [new HumanMessage("hello"), aiMsg];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts).toHaveLength(1);
    expect(modelContent!.parts[0].text).toBe("Hello thinking world");
    expect(modelContent!.parts[0].thoughtSignature).toBe("sig-abc123");
  });

  test("v0 legacy path: preserves partMetadata from originalTextContentBlock for string content", () => {
    const aiMsg = new AIMessage({
      content: "Hello with metadata",
      additional_kwargs: {
        originalTextContentBlock: {
          type: "text",
          text: "Hello with metadata",
          partMetadata: { custom: "data" },
        },
      },
      response_metadata: { model_provider: "google" },
    });
    const messages = [new HumanMessage("hello"), aiMsg];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts[0].text).toBe("Hello with metadata");
    expect(modelContent!.parts[0].partMetadata).toEqual({ custom: "data" });
  });

  test("v1 standard path: converts non_standard executableCode blocks to Gemini parts", () => {
    const messages = [
      new HumanMessage("run code"),
      new AIMessage({
        content: [
          { type: "text" as const, text: "Here is the code:" },
          {
            type: "non_standard" as const,
            value: {
              type: "executableCode",
              executableCode: {
                language: "PYTHON",
                code: 'print("hello")',
              },
            },
          },
          {
            type: "non_standard" as const,
            value: {
              type: "codeExecutionResult",
              codeExecutionResult: {
                outcome: "OUTCOME_OK",
                output: "hello",
              },
            },
          },
          { type: "text" as const, text: "Done!" },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts).toHaveLength(4);

    expect(modelContent!.parts[0].text).toBe("Here is the code:");
    expect(
      (modelContent!.parts[1] as Gemini.Part).executableCode
    ).toBeDefined();
    expect((modelContent!.parts[1] as Gemini.Part).executableCode!.code).toBe(
      'print("hello")'
    );
    expect(
      (modelContent!.parts[2] as Gemini.Part).codeExecutionResult
    ).toBeDefined();
    expect(
      (modelContent!.parts[2] as Gemini.Part).codeExecutionResult!.outcome
    ).toBe("OUTCOME_OK");
    expect(modelContent!.parts[3].text).toBe("Done!");
  });

  test("v1 standard path: converts reasoning blocks to thought parts", () => {
    const messages = [
      new HumanMessage("think about this"),
      new AIMessage({
        content: [
          {
            type: "reasoning" as const,
            reasoning: "Let me think about this...",
            thought: true,
          },
          { type: "text" as const, text: "Here is my answer." },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts).toHaveLength(2);

    expect(modelContent!.parts[0].text).toBe("Let me think about this...");
    expect(modelContent!.parts[0].thought).toBe(true);
    expect(modelContent!.parts[1].text).toBe("Here is my answer.");
    expect(modelContent!.parts[1].thought).toBeUndefined();
  });

  test("v1 standard path: propagates thoughtSignature on text blocks", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: [
          {
            type: "text" as const,
            text: "Response with signature",
            thoughtSignature: "sig-xyz789",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts).toHaveLength(1);
    expect(modelContent!.parts[0].text).toBe("Response with signature");
    expect(modelContent!.parts[0].thoughtSignature).toBe("sig-xyz789");
  });

  test("v1 standard path: round-trips streamed AIMessageChunk with originalTextContentBlock through Google translator", () => {
    // Simulates a streamed v0 message chunk with originalTextContentBlock being
    // fed back to ChatGoogle — the contentBlocks getter goes through the
    // ChatGoogleTranslator which uses originalTextContentBlock for single-text messages
    const chunk = new AIMessageChunk({
      content: "Streamed text",
      additional_kwargs: {
        originalTextContentBlock: {
          type: "text",
          text: "Streamed text",
          thoughtSignature: "sig-stream-001",
        },
      },
      response_metadata: { model_provider: "google" },
    });
    const messages = [new HumanMessage("hello"), chunk];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts).toHaveLength(1);
    expect(modelContent!.parts[0].text).toBe("Streamed text");
    expect(modelContent!.parts[0].thoughtSignature).toBe("sig-stream-001");
  });

  test("v1 standard path: non_standard blocks with thoughtSignature preserved", () => {
    const messages = [
      new HumanMessage("run code"),
      new AIMessage({
        content: [
          {
            type: "non_standard" as const,
            value: {
              type: "executableCode",
              executableCode: {
                language: "PYTHON",
                code: 'print("hi")',
              },
            },
            thoughtSignature: "sig-code-001",
          },
        ],
        response_metadata: { output_version: "v1" },
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);

    const modelContent = contents.find((c) => c.role === "model");
    expect(modelContent).toBeDefined();
    expect(modelContent!.parts).toHaveLength(1);
    expect(
      (modelContent!.parts[0] as Gemini.Part).executableCode
    ).toBeDefined();
    expect(modelContent!.parts[0].thoughtSignature).toBe("sig-code-001");
  });
});
