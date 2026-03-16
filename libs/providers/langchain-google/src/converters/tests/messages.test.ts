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

    const functionResponsePart = toolResponseContent!.parts?.find(
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

    const functionResponsePart = toolResponseContent!.parts?.find(
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
    expect(toolResponseContents).toHaveLength(1);

    const parts = toolResponseContents[0].parts?.filter(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(parts).toHaveLength(2);

    const firstResponse = parts?.[0] as Gemini.Part.FunctionResponse;
    expect(firstResponse.functionResponse!.name).toBe("get_weather");

    const secondResponse = parts?.[1] as Gemini.Part.FunctionResponse;
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

    // Should produce: user, function (single merged turn)
    // The AIMessage with empty content and tool_calls produces no model content block
    expect(contents).toHaveLength(2);

    const functionTurn = contents[1];
    expect(functionTurn.role).toBe("function");
    expect(functionTurn.parts).toHaveLength(2);

    const responses = functionTurn.parts?.filter(
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

    const toolResponseContent = contents.find((c) => c.role === "function");
    const functionResponsePart = toolResponseContent!.parts?.find(
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

    const functionCallPart = modelContent!.parts?.find(
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

    const functionCallPart = modelContent!.parts?.find(
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

    const toolResponseContent = contents.find((c) => c.role === "function");
    expect(toolResponseContent).toBeDefined();

    const functionResponsePart = toolResponseContent!.parts?.find(
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

    const toolResponseContents = contents.filter((c) => c.role === "function");
    expect(toolResponseContents).toHaveLength(2);

    const firstResponse = toolResponseContents[0].parts?.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(firstResponse.functionResponse!.name).toBe("get_weather");

    const secondResponse = toolResponseContents[1].parts?.find(
      (p) => "functionResponse" in p && p.functionResponse
    ) as Gemini.Part.FunctionResponse;
    expect(secondResponse.functionResponse!.name).toBe("get_time");
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

    const functionResponsePart = toolResponseContent!.parts?.find(
      (p) => "functionResponse" in p && p.functionResponse
    );
    expect(functionResponsePart).toBeDefined();
    expect(
      (functionResponsePart as Gemini.Part.FunctionResponse).functionResponse!
        .id
    ).toBe("tool-call-xyz");
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

    const part = userContent!.parts?.[0] as Gemini.Part.FileData;
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

    const part = userContent!.parts?.[0] as Gemini.Part.FileData;
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

    const part = userContent!.parts?.[0] as Gemini.Part.InlineData;
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

    const part = userContent!.parts?.[0] as Gemini.Part.InlineData;
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
    expect((userContent!.parts?.[0] as Gemini.Part.Text).text).toBe(
      "Summarize these files"
    );
    // image part
    expect(
      (userContent!.parts?.[1] as Gemini.Part.FileData).fileData
    ).toBeDefined();
    // text-plain part
    expect(
      (userContent!.parts?.[2] as Gemini.Part.FileData).fileData!.fileUri
    ).toBe("gs://bucket/notes.txt");
    // file part
    expect(
      (userContent!.parts?.[3] as Gemini.Part.FileData).fileData!.fileUri
    ).toBe("gs://bucket/report.pdf");
  });

  // --- Multimodal ToolMessage tests (legacy path) ---

  test("ToolMessage with text + base64 image_url preserves inlineData as sibling (legacy path)", () => {
    const messages = [
      new HumanMessage("describe the screenshot"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "screenshot_tool",
            args: {},
            id: "call-img-1",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: [
          { type: "text", text: "Here is the screenshot" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,iVBORw0KGgoAAAANS",
            },
          },
        ],
        tool_call_id: "call-img-1",
        name: "screenshot_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart).toBeDefined();

    // The result should NOT contain base64 image data
    const result = functionResponsePart.functionResponse!.response.result;
    expect(result).not.toContain("iVBORw0KGgoAAAANS");

    // Should have an inlineData sibling
    const inlineDataPart = functionTurn!.parts?.find(
      (p) => "inlineData" in p
    ) as Gemini.Part.InlineData;
    expect(inlineDataPart).toBeDefined();
    expect(inlineDataPart.inlineData!.mimeType).toBe("image/png");
    expect(inlineDataPart.inlineData!.data).toBe("iVBORw0KGgoAAAANS");
  });

  test("ToolMessage with string content is unchanged (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "my_tool",
            args: {},
            id: "call-str-1",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "simple string result",
        tool_call_id: "call-str-1",
        name: "my_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart.functionResponse!.response.result).toBe(
      "simple string result"
    );
    // No media siblings
    expect(functionTurn!.parts).toHaveLength(1);
  });

  test("ToolMessage with text-only array content is unchanged (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "my_tool",
            args: {},
            id: "call-txt-arr",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: [
          { type: "text", text: "line 1" },
          { type: "text", text: "line 2" },
        ],
        tool_call_id: "call-txt-arr",
        name: "my_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    const result = functionResponsePart.functionResponse!.response.result;
    // Should contain the text items serialized as JSON
    expect(result).toContain("line 1");
    expect(result).toContain("line 2");
    // No media siblings
    expect(functionTurn!.parts).toHaveLength(1);
  });

  test("ToolMessage with only image_url (no text) (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "img_tool",
            args: {},
            id: "call-img-only",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: [
          {
            type: "image_url",
            image_url: {
              url: "data:image/jpeg;base64,/9j/4AAQ",
            },
          },
        ],
        tool_call_id: "call-img-only",
        name: "img_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    // Result should be empty since all content was media
    expect(functionResponsePart.functionResponse!.response.result).toBe("");

    // Should have an inlineData sibling
    const inlineDataPart = functionTurn!.parts?.find(
      (p) => "inlineData" in p
    ) as Gemini.Part.InlineData;
    expect(inlineDataPart).toBeDefined();
    expect(inlineDataPart.inlineData!.mimeType).toBe("image/jpeg");
  });

  test("ToolMessage with URL-based image produces fileData sibling (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "img_tool",
            args: {},
            id: "call-url-img",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: [
          { type: "text", text: "Image from URL" },
          {
            type: "image_url",
            image_url: {
              url: "https://example.com/photo.jpg",
            },
          },
        ],
        tool_call_id: "call-url-img",
        name: "img_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    // Should have a fileData sibling for URL-based image
    const fileDataPart = functionTurn!.parts?.find(
      (p) => "fileData" in p
    ) as Gemini.Part.FileData;
    expect(fileDataPart).toBeDefined();
    expect(fileDataPart.fileData!.fileUri).toBe(
      "https://example.com/photo.jpg"
    );

    // functionResponse result should not contain the URL as serialized content
    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    expect(
      functionResponsePart.functionResponse!.response.result
    ).not.toContain("https://example.com/photo.jpg");
  });

  test("ToolMessage with multiple images + text preserves all media siblings (legacy path)", () => {
    const messages = [
      new HumanMessage("hello"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "multi_img_tool",
            args: {},
            id: "call-multi-img",
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: [
          { type: "text", text: "Two images" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,img1data",
            },
          },
          {
            type: "image_url",
            image_url: {
              url: "data:image/jpeg;base64,img2data",
            },
          },
        ],
        tool_call_id: "call-multi-img",
        name: "multi_img_tool",
      }),
    ];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    // Should have 1 functionResponse + 2 inlineData parts
    const functionResponseParts = functionTurn!.parts?.filter(
      (p) => "functionResponse" in p
    );
    expect(functionResponseParts).toHaveLength(1);

    const inlineDataParts = functionTurn!.parts?.filter(
      (p) => "inlineData" in p
    ) as Gemini.Part.InlineData[];
    expect(inlineDataParts).toHaveLength(2);
    expect(inlineDataParts[0].inlineData!.data).toBe("img1data");
    expect(inlineDataParts[1].inlineData!.data).toBe("img2data");

    // Result should not contain image data
    const result = (functionResponseParts?.[0] as Gemini.Part.FunctionResponse)
      .functionResponse!.response.result;
    expect(result).not.toContain("img1data");
    expect(result).not.toContain("img2data");
  });

  // --- Multimodal ToolMessage tests (v1 path) ---

  test("ToolMessage with text + image preserves inlineData as sibling (v1 path)", () => {
    const toolMsg = new ToolMessage({
      content: [
        { type: "text", text: "Screenshot captured" },
        {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,abc123",
          },
        },
      ],
      tool_call_id: "call-v1-img",
      name: "screenshot_tool",
    });
    // Set v1 output version
    toolMsg.response_metadata = { output_version: "v1" };

    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "screenshot_tool",
          args: {},
          id: "call-v1-img",
          type: "tool_call",
        },
      ],
    });
    aiMsg.response_metadata = { output_version: "v1" };

    const messages = [new HumanMessage("take a screenshot"), aiMsg, toolMsg];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart).toBeDefined();

    // Result should not contain base64 data
    const result = functionResponsePart.functionResponse!.response.result;
    expect(result).not.toContain("abc123");

    // Should have an inlineData sibling
    const inlineDataPart = functionTurn!.parts?.find(
      (p) => "inlineData" in p
    ) as Gemini.Part.InlineData;
    expect(inlineDataPart).toBeDefined();
    expect(inlineDataPart.inlineData!.data).toBe("abc123");
  });

  test("ToolMessage with string content is unchanged (v1 path)", () => {
    const toolMsg = new ToolMessage({
      content: "simple v1 result",
      tool_call_id: "call-v1-str",
      name: "my_tool",
    });
    toolMsg.response_metadata = { output_version: "v1" };

    const aiMsg2 = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "my_tool",
          args: {},
          id: "call-v1-str",
          type: "tool_call",
        },
      ],
    });
    aiMsg2.response_metadata = { output_version: "v1" };

    const messages = [new HumanMessage("hello"), aiMsg2, toolMsg];

    const contents = convertMessagesToGeminiContents(messages);
    const functionTurn = contents.find((c) => c.role === "function");
    expect(functionTurn).toBeDefined();

    const functionResponsePart = functionTurn!.parts?.find(
      (p) => "functionResponse" in p
    ) as Gemini.Part.FunctionResponse;
    expect(functionResponsePart.functionResponse!.response.result).toBe(
      "simple v1 result"
    );
    expect(functionTurn!.parts).toHaveLength(1);
  });
});
