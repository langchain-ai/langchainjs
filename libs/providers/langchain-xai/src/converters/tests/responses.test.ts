/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  convertMessageToResponsesInput,
  convertMessagesToResponsesInput,
  convertUsageToUsageMetadata,
  extractTextFromOutput,
  convertResponseToAIMessage,
  convertStreamEventToChunk,
} from "../responses.js";
import type {
  XAIResponse,
  XAIResponsesOutputItem,
  XAIResponsesStreamEvent,
  XAIResponsesUsage,
} from "../../chat_models/responses-types.js";

// ============================================================================
// convertUsageToUsageMetadata Tests
// ============================================================================

describe("convertUsageToUsageMetadata", () => {
  it("should convert xAI usage to LangChain format with cached tokens", () => {
    const usage: XAIResponsesUsage = {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: {
        cached_tokens: 75,
      },
      output_tokens_details: {
        reasoning_tokens: 10,
      },
    };

    const result = convertUsageToUsageMetadata(usage);

    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_token_details: {
        cache_read: 75,
      },
      output_token_details: {
        reasoning: 10,
      },
    });
  });

  it("should handle missing usage details gracefully", () => {
    const usage: XAIResponsesUsage = {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    };

    const result = convertUsageToUsageMetadata(usage);

    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_token_details: {},
      output_token_details: {},
    });
  });

  it("should handle undefined usage", () => {
    const result = convertUsageToUsageMetadata(undefined);

    expect(result).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      input_token_details: {},
      output_token_details: {},
    });
  });

  it("should handle null usage", () => {
    const result = convertUsageToUsageMetadata(null);

    expect(result).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      input_token_details: {},
      output_token_details: {},
    });
  });
});

// ============================================================================
// convertMessageToResponsesInput Tests
// ============================================================================

describe("convertMessageToResponsesInput", () => {
  describe("HumanMessage conversion", () => {
    it("should convert HumanMessage with string content", () => {
      const message = new HumanMessage("Hello, world!");

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "user",
        content: "Hello, world!",
      });
    });

    it("should convert HumanMessage with text content parts", () => {
      const message = new HumanMessage({
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      });

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "user",
        content: [
          { type: "input_text", text: "Hello" },
          { type: "input_text", text: "World" },
        ],
      });
    });

    it("should convert HumanMessage with image_url content (string format)", () => {
      const message = new HumanMessage({
        content: [
          { type: "text", text: "What's in this image?" },
          { type: "image_url", image_url: "https://example.com/image.jpg" },
        ],
      });

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "user",
        content: [
          { type: "input_text", text: "What's in this image?" },
          {
            type: "input_image",
            image_url: "https://example.com/image.jpg",
            detail: "auto",
          },
        ],
      });
    });

    it("should convert HumanMessage with image_url content (object format)", () => {
      const message = new HumanMessage({
        content: [
          { type: "text", text: "Describe this" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/photo.png" },
          },
        ],
      });

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "user",
        content: [
          { type: "input_text", text: "Describe this" },
          {
            type: "input_image",
            image_url: "https://example.com/photo.png",
            detail: "auto",
          },
        ],
      });
    });

    it("should handle unknown content types with empty text", () => {
      const message = new HumanMessage({
        content: [{ type: "unknown_type" as any, data: "something" }],
      });

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "user",
        content: [{ type: "input_text", text: "" }],
      });
    });
  });

  describe("SystemMessage conversion", () => {
    it("should convert SystemMessage with string content", () => {
      const message = new SystemMessage("You are a helpful assistant.");

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
    });

    it("should convert SystemMessage with array content by joining", () => {
      const message = new SystemMessage({
        content: [
          { type: "text", text: "You are helpful." },
          { type: "text", text: " Be concise." },
        ],
      });

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "system",
        content: "You are helpful. Be concise.",
      });
    });
  });

  describe("AIMessage conversion", () => {
    it("should convert AIMessage with string content", () => {
      const message = new AIMessage("I'm an AI assistant.");

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        type: "message",
        role: "assistant",
        text: "I'm an AI assistant.",
      });
    });

    it("should convert AIMessage with non-string content to empty text", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Complex content" }],
      });

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        type: "message",
        role: "assistant",
        text: "",
      });
    });
  });

  describe("Unknown message type fallback", () => {
    it("should fallback to user role with string content", () => {
      // Create a message with an unknown type by directly modifying type
      const message = new HumanMessage("Test content");
      (message as any)._getType = () => "unknown";
      (message as any).type = "unknown";

      const result = convertMessageToResponsesInput(message);

      expect(result).toEqual({
        role: "user",
        content: "Test content",
      });
    });
  });
});

// ============================================================================
// convertMessagesToResponsesInput Tests
// ============================================================================

describe("convertMessagesToResponsesInput", () => {
  it("should convert an array of messages", () => {
    const messages = [
      new SystemMessage("Be helpful."),
      new HumanMessage("Hello!"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
    ];

    const result = convertMessagesToResponsesInput(messages);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: "system", content: "Be helpful." });
    expect(result[1]).toEqual({ role: "user", content: "Hello!" });
    expect(result[2]).toEqual({
      type: "message",
      role: "assistant",
      text: "Hi there!",
    });
    expect(result[3]).toEqual({ role: "user", content: "How are you?" });
  });

  it("should handle empty array", () => {
    const result = convertMessagesToResponsesInput([]);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// extractTextFromOutput Tests
// ============================================================================

describe("extractTextFromOutput", () => {
  it("should extract text from message output items", () => {
    const output: XAIResponsesOutputItem[] = [
      {
        type: "message",
        role: "assistant",
        content: [
          { type: "output_text", text: "Hello, " },
          { type: "output_text", text: "world!" },
        ],
      },
    ];

    const result = extractTextFromOutput(output);

    expect(result).toBe("Hello, world!");
  });

  it("should handle refusal content by ignoring it", () => {
    const output: XAIResponsesOutputItem[] = [
      {
        type: "message",
        role: "assistant",
        content: [
          { type: "output_text", text: "Some text" },
          { type: "refusal", refusal: "I cannot help with that." },
        ],
      },
    ];

    const result = extractTextFromOutput(output);

    expect(result).toBe("Some text");
  });

  it("should handle multiple message items", () => {
    const output: XAIResponsesOutputItem[] = [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "First " }],
      },
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Second" }],
      },
    ];

    const result = extractTextFromOutput(output);

    expect(result).toBe("First Second");
  });

  it("should ignore non-message output items", () => {
    const output: XAIResponsesOutputItem[] = [
      {
        type: "function_call",
        id: "call_123",
        name: "get_weather",
        arguments: '{"location": "NYC"}',
      },
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "The weather is sunny." }],
      },
    ];

    const result = extractTextFromOutput(output);

    expect(result).toBe("The weather is sunny.");
  });

  it("should return empty string for empty output", () => {
    const result = extractTextFromOutput([]);
    expect(result).toBe("");
  });

  it("should return empty string when no text content", () => {
    const output: XAIResponsesOutputItem[] = [
      {
        type: "function_call",
        id: "call_123",
        name: "some_function",
        arguments: "{}",
      },
    ];

    const result = extractTextFromOutput(output);

    expect(result).toBe("");
  });
});

// ============================================================================
// convertResponseToAIMessage Tests
// ============================================================================

describe("convertResponseToAIMessage", () => {
  it("should convert a basic xAI response to AIMessage", () => {
    const response: XAIResponse = {
      id: "resp_123",
      object: "response",
      created_at: 1234567890,
      model: "grok-3",
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello from xAI!" }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
    };

    const result = convertResponseToAIMessage(response);

    expect(result).toBeInstanceOf(AIMessage);
    expect(result.content).toBe("Hello from xAI!");
    expect(result.response_metadata).toEqual({
      model_provider: "xai",
      model: "grok-3",
      created_at: 1234567890,
      id: "resp_123",
      status: "completed",
      object: "response",
    });
    expect(result.usage_metadata).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      input_token_details: {},
      output_token_details: {},
    });
  });

  it("should include incomplete_details in response metadata", () => {
    const response: XAIResponse = {
      id: "resp_456",
      object: "response",
      created_at: 1234567890,
      model: "grok-3",
      status: "incomplete",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Partial..." }],
        },
      ],
      incomplete_details: {
        reason: "max_output_tokens",
      },
    };

    const result = convertResponseToAIMessage(response);

    expect(result.response_metadata?.incomplete_details).toEqual({
      reason: "max_output_tokens",
    });
  });

  it("should include reasoning in additional_kwargs", () => {
    const response: XAIResponse = {
      id: "resp_789",
      object: "response",
      created_at: 1234567890,
      model: "grok-3",
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Answer" }],
        },
      ],
      reasoning: {
        effort: "high",
        summary: "detailed",
      },
    };

    const result = convertResponseToAIMessage(response);

    expect(result.additional_kwargs?.reasoning).toEqual({
      effort: "high",
      summary: "detailed",
    });
  });

  it("should handle response with no usage", () => {
    const response: XAIResponse = {
      id: "resp_no_usage",
      object: "response",
      created_at: 1234567890,
      model: "grok-3",
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Test" }],
        },
      ],
    };

    const result = convertResponseToAIMessage(response);

    expect(result.usage_metadata).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      input_token_details: {},
      output_token_details: {},
    });
  });
});

// ============================================================================
// convertStreamEventToChunk Tests
// ============================================================================

describe("convertStreamEventToChunk", () => {
  describe("response.output_text.delta event", () => {
    it("should convert text delta to ChatGenerationChunk", () => {
      const event: XAIResponsesStreamEvent = {
        type: "response.output_text.delta",
        output_index: 0,
        content_index: 0,
        delta: "Hello",
      };

      const result = convertStreamEventToChunk(event);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("Hello");
      expect(result?.message).toBeInstanceOf(AIMessageChunk);
      expect(result?.message.content).toBe("Hello");
      expect(result?.message.response_metadata).toEqual({
        model_provider: "xai",
      });
    });
  });

  describe("response.created event", () => {
    it("should convert created event with response metadata", () => {
      const event: XAIResponsesStreamEvent = {
        type: "response.created",
        response: {
          id: "resp_stream_123",
          object: "response",
          created_at: 1234567890,
          model: "grok-3",
          status: "in_progress",
          output: [],
        },
      };

      const result = convertStreamEventToChunk(event);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("");
      expect(result?.message.response_metadata).toEqual({
        model_provider: "xai",
        id: "resp_stream_123",
        model: "grok-3",
      });
    });
  });

  describe("response.completed event", () => {
    it("should convert completed event with full response data", () => {
      const event: XAIResponsesStreamEvent = {
        type: "response.completed",
        response: {
          id: "resp_complete_123",
          object: "response",
          created_at: 1234567890,
          model: "grok-3",
          status: "completed",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: "Final answer" }],
            },
          ],
          usage: {
            input_tokens: 20,
            output_tokens: 10,
            total_tokens: 30,
          },
        },
      };

      const result = convertStreamEventToChunk(event);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("");
      expect(result?.message.usage_metadata).toEqual({
        input_tokens: 20,
        output_tokens: 10,
        total_tokens: 30,
        input_token_details: {},
        output_token_details: {},
      });
    });
  });

  describe("unhandled event types", () => {
    it("should return null for response.in_progress event", () => {
      const event: XAIResponsesStreamEvent = {
        type: "response.in_progress",
        response: {
          id: "resp_123",
          object: "response",
          created_at: 1234567890,
          model: "grok-3",
          status: "in_progress",
          output: [],
        },
      };

      const result = convertStreamEventToChunk(event);

      expect(result).toBeNull();
    });

    it("should return null for response.output_item.added event", () => {
      const event: XAIResponsesStreamEvent = {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "message",
          role: "assistant",
          content: [],
        },
      };

      const result = convertStreamEventToChunk(event);

      expect(result).toBeNull();
    });

    it("should return null for error event", () => {
      const event: XAIResponsesStreamEvent = {
        type: "error",
        code: "server_error",
        message: "Something went wrong",
      };

      const result = convertStreamEventToChunk(event);

      expect(result).toBeNull();
    });
  });
});
