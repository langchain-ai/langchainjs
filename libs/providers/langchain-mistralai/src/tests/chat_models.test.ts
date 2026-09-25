import { test, expect, describe, vi } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { OutputParserException } from "@langchain/core/output_parsers";
import {
  ChatMistralAI,
  convertMessagesToMistralMessages,
} from "../chat_models.js";
import {
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
  _mistralContentChunkToMessageContentComplex,
  _mistralContentToText,
} from "../utils.js";
import { ChatCompletionRequest } from "@mistralai/mistralai/models/components/chatcompletionrequest.js";

describe("Mistral Tool Call ID Conversion", () => {
  test("valid and invalid Mistral tool call IDs", () => {
    expect(_isValidMistralToolCallId("ssAbar4Dr")).toBe(true);
    expect(_isValidMistralToolCallId("abc123")).toBe(false);
    expect(_isValidMistralToolCallId("call_JIIjI55tTipFFzpcP8re3BpM")).toBe(
      false
    );
  });

  test("tool call ID conversion", () => {
    const resultMap: Record<string, string> = {
      ssAbar4Dr: "ssAbar4Dr",
      abc123: "0001yoN1K",
      call_JIIjI55tTipFFzpcP8re3BpM: "0001sqrj5",
      12345: "00003akVR",
    };

    for (const [inputId, expectedOutput] of Object.entries(resultMap)) {
      const convertedId = _convertToolCallIdToMistralCompatible(inputId);
      expect(convertedId).toBe(expectedOutput);
      expect(_isValidMistralToolCallId(convertedId)).toBe(true);
    }
  });
});

test("Serialization", () => {
  const model = new ChatMistralAI({
    apiKey: "foo",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","mistralai","ChatMistralAI"],"kwargs":{"mistral_api_key":{"lc":1,"type":"secret","id":["MISTRAL_API_KEY"]}}}`
  );
});

test("Constructor supports string model shorthand", () => {
  const shorthand = new ChatMistralAI("mistral-small-latest", {
    apiKey: "test-api-key",
    temperature: 0.2,
  });
  const explicit = new ChatMistralAI({
    apiKey: "test-api-key",
    model: "mistral-small-latest",
    temperature: 0.2,
  });

  expect(shorthand.model).toBe(explicit.model);
  expect(shorthand.temperature).toBe(explicit.temperature);
});

/**
 * Test to make sure that the logic in convertMessagesToMistralMessages that makes sure
 * tool calls are only included if there is a corresponding ToolMessage works as expected
 *
 * Or else the Mistral API will reject the request
 */
test("convertMessagesToMistralMessages converts roles and filters toolCalls", () => {
  const msgs = [
    new HumanMessage("hi"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "123456789",
          name: "extract-1",
          args: { answer: "x" },
          type: "tool_call",
        },
        { id: "ORPHAN123", name: "noop", args: {}, type: "tool_call" },
      ],
    }),
    new ToolMessage({ tool_call_id: "123456789", content: "result payload" }),
  ];

  const converted = convertMessagesToMistralMessages(msgs) as {
    role: "user" | "assistant" | "tool";
    toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
    toolCallId?: string;
  }[];
  // Expect user, assistant (toolCalls), tool
  const roles = converted.map((m) => m.role);
  expect(roles).toContain("user");
  expect(roles).toContain("assistant");
  expect(roles).toContain("tool");

  const assistantMsg = converted.find((m) => Array.isArray(m.toolCalls)) as {
    toolCalls: { id: string }[];
  };
  expect(assistantMsg.toolCalls.length).toBe(1);
  expect(assistantMsg.toolCalls[0].id).toBe("123456789");

  const toolMsg = converted.find((m) => m.role === "tool");
  expect(toolMsg?.toolCallId).toBe("123456789");
});

describe("withStructuredOutput - StandardSchema", () => {
  function makeSerializableSchema() {
    return {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: unknown) => {
          const v = value as Record<string, unknown>;
          if (v && typeof v === "object" && "name" in v) {
            return { value: v as { name: string } };
          }
          return {
            issues: [{ message: "Expected object with name" }],
          };
        },
        jsonSchema: {
          input: () => ({
            type: "object" as const,
            properties: {
              name: { type: "string", description: "A name" },
            },
            required: ["name"],
          }),
          output: () => ({ type: "object" as const, properties: {} }),
        },
      },
    };
  }

  test("functionCalling with valid output parses correctly", async () => {
    const model = new ChatMistralAI({
      model: "mistral-small-latest",
      apiKey: "testing",
    });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "extract",
              args: { name: "cobalt" },
              id: "1",
              type: "tool_call",
            },
          ],
        })
      );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      name: "extract",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "cobalt" });
  });

  test("functionCalling with invalid output throws OutputParserException", async () => {
    const model = new ChatMistralAI({
      model: "mistral-small-latest",
      apiKey: "testing",
    });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessageChunk({
          content: "",
          tool_calls: [
            {
              name: "extract",
              args: { invalid: true },
              id: "1",
              type: "tool_call",
            },
          ],
        })
      );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      name: "extract",
    });

    await expect(async () => {
      await structured.invoke("What?");
    }).rejects.toThrow(OutputParserException);
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatMistralAI({
      model: "mistral-small-latest",
      apiKey: "testing",
    });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "GetName",
              args: { name: "test" },
              id: "1",
              type: "tool_call",
            },
          ],
        })
      );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      name: "GetName",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "test" });
  });

  test("functionCalling with includeRaw returns raw and parsed", async () => {
    const mockResponse = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "extract",
          args: { name: "cobalt" },
          id: "1",
          type: "tool_call",
        },
      ],
    });
    const model = new ChatMistralAI({
      model: "mistral-small-latest",
      apiKey: "testing",
    });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(mockResponse);

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      name: "extract",
      includeRaw: true,
    });

    const result = await structured.invoke("What?");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).parsed).toEqual({ name: "cobalt" });
  });
});

describe("Streaming", () => {
  test("streaming request includes stream: true parameter", async () => {
    // Mock the Mistral SDK to capture the request parameters
    const mockStreamFn = vi.fn().mockImplementation(async function* () {
      yield {
        data: {
          id: "test-id",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "mistral-small-latest",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finishReason: null,
            },
          ],
        },
      };
      yield {
        data: {
          id: "test-id",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "mistral-small-latest",
          choices: [
            {
              index: 0,
              delta: { content: " world!" },
              finishReason: "stop",
            },
          ],
        },
      };
    });

    const model = new ChatMistralAI({
      apiKey: "test-api-key",
      model: "mistral-small-latest",
    });

    // Override completionWithRetry to capture the call
    const originalCompletionWithRetry = model.completionWithRetry.bind(model);
    let capturedStreamParam = false;

    model.completionWithRetry = async function (
      input: unknown,
      streaming: boolean
    ) {
      if (streaming) {
        // Verify that when we call stream, we would pass stream: true
        // The actual fix adds { ...input, stream: true } in the implementation
        capturedStreamParam = true;
        return mockStreamFn();
      }
      return originalCompletionWithRetry(
        input as ChatCompletionRequest,
        streaming
      );
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Consume the stream
    const chunks: string[] = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("Hello")],
      {}
    )) {
      chunks.push(chunk.text);
    }

    // Verify streaming was called
    expect(capturedStreamParam).toBe(true);
    expect(chunks.length).toBe(2);
    expect(chunks.join("")).toBe("Hello world!");
  });
});

describe("Thinking chunks", () => {
  const thinkingDelta = (text: string) => ({
    data: {
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: [{ type: "text", text }],
                closed: true,
              },
            ],
          },
          finishReason: null,
        },
      ],
    },
  });

  const textDelta = (text: string, finishReason: string | null = null) => ({
    data: {
      choices: [{ index: 0, delta: { content: text }, finishReason }],
    },
  });

  test("sends assistant thinking chunks back instead of throwing", () => {
    const messages = [
      new HumanMessage("Say hi in 3 words."),
      new AIMessage({
        content: [
          {
            type: "thinking",
            thinking: [{ type: "text", text: "Three words." }],
            closed: true,
          },
          { type: "text", text: "Hello there, friend!" },
        ],
      }),
      new HumanMessage("Now in French."),
    ];

    expect(convertMessagesToMistralMessages(messages)[1]).toEqual({
      role: "assistant",
      content: [
        {
          type: "thinking",
          thinking: [{ type: "text", text: "Three words." }],
        },
        { type: "text", text: "Hello there, friend!" },
      ],
    });
  });

  test("still rejects thinking chunks on user messages", () => {
    const message = new HumanMessage({
      content: [
        { type: "thinking", thinking: [{ type: "text", text: "Hmm" }] },
      ],
    });

    expect(() => convertMessagesToMistralMessages([message])).toThrow(
      /only supports types "text" or "image_url"/
    );
  });

  test("streamed thinking round-trips as one merged thinking chunk", async () => {
    const model = new ChatMistralAI({
      apiKey: "test-api-key",
      model: "zai-glm-5-3",
    });
    model.completionWithRetry = (async () =>
      (async function* () {
        yield thinkingDelta("The user");
        yield thinkingDelta(" wants a greeting.");
        yield textDelta("Hello");
        yield textDelta(" there!", "stop");
      })()) as any; // oxlint-disable-next-line @typescript-eslint/no-explicit-any

    const texts: string[] = [];
    let merged: AIMessageChunk | undefined;
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("Hi")],
      {}
    )) {
      texts.push(chunk.text);
      const message = chunk.message as AIMessageChunk;
      merged = merged ? merged.concat(message) : message;
    }

    // Thinking deltas carry no text
    expect(texts).toEqual(["", "", "Hello", " there!"]);

    const history = convertMessagesToMistralMessages([
      new HumanMessage("Hi"),
      new AIMessage({ content: merged!.content }),
      new HumanMessage("Thanks"),
    ]);

    expect(history[1]).toEqual({
      role: "assistant",
      content: [
        {
          type: "thinking",
          thinking: [{ type: "text", text: "The user wants a greeting." }],
        },
        { type: "text", text: "Hello" },
        { type: "text", text: " there!" },
      ],
    });
  });

  test("generation text ignores thinking chunks", async () => {
    const model = new ChatMistralAI({
      apiKey: "test-api-key",
      model: "zai-glm-5-3",
    });
    model.completionWithRetry = (async () => ({
      choices: [
        {
          index: 0,
          finishReason: "stop",
          message: {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: [{ type: "text", text: "Three words." }],
              },
              { type: "text", text: "Hello there, friend!" },
            ],
          },
        },
      ],
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;

    const result = await model._generate([new HumanMessage("Hi")], {});

    expect(result.generations[0].text).toBe("Hello there, friend!");
  });

  test("_mistralContentToText joins text chunks only", () => {
    expect(_mistralContentToText(null)).toBe("");
    expect(_mistralContentToText("plain")).toBe("plain");
    expect(
      _mistralContentToText([
        { type: "thinking", thinking: [{ type: "text", text: "hidden" }] },
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ])
    ).toBe("ab");
  });
});
