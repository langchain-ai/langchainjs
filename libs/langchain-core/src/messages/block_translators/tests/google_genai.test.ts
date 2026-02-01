import { describe, expect, it } from "vitest";
import { AIMessage } from "../../ai.js";

describe("ChatGoogleGenAITranslator", () => {
  it("should translate thinking blocks to reasoning content blocks", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Let me think about this...",
          signature: "abc123",
        },
        {
          type: "text",
          text: "The answer is 42",
        },
      ],
      response_metadata: { model_provider: "google-genai" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Let me think about this...",
        signature: "abc123",
      },
      { type: "text", text: "The answer is 42" },
    ]);
  });

  it("should translate thinking blocks without signature", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Analyzing the problem...",
        },
        {
          type: "text",
          text: "Here is my answer",
        },
      ],
      response_metadata: { model_provider: "google-genai" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Analyzing the problem...",
      },
      { type: "text", text: "Here is my answer" },
    ]);
  });

  it("should translate ChatGoogleGenAI messages to standard content blocks", () => {
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "Hello from Google",
        },
        {
          type: "inlineData",
          inlineData: {
            mimeType: "text/plain",
            data: "Hello from Google",
          },
        },
        {
          type: "functionCall",
          functionCall: {
            name: "get_weather",
            args: { location: "San Francisco" },
          },
        },
        {
          type: "functionResponse",
          functionResponse: {
            name: "get_weather",
            response: { location: "San Francisco" },
          },
        },
        {
          type: "fileData",
          fileData: {
            mimeType: "text/plain",
            fileUri: "https://example.com/file.txt",
          },
        },
        {
          type: "executableCode",
          executableCode: {
            language: "python",
            code: "print('Hello from Google')",
          },
        },
        {
          type: "codeExecutionResult",
          codeExecutionResult: {
            outcome: "outcome_ok",
            output: "Hello from Google",
          },
        },
      ],
      response_metadata: { model_provider: "google-genai" },
    });
    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Hello from Google" },
      { type: "file", mimeType: "text/plain", data: "Hello from Google" },
      {
        type: "tool_call",
        id: undefined,
        name: "get_weather",
        args: { location: "San Francisco" },
      },
      {
        type: "non_standard",
        value: {
          type: "functionResponse",
          functionResponse: {
            name: "get_weather",
            response: { location: "San Francisco" },
          },
        },
      },
      {
        type: "file",
        mimeType: "text/plain",
        fileId: "https://example.com/file.txt",
      },
      {
        type: "non_standard",
        value: {
          type: "executableCode",
          executableCode: {
            language: "python",
            code: "print('Hello from Google')",
          },
        },
      },
      {
        type: "non_standard",
        value: {
          type: "codeExecutionResult",
          codeExecutionResult: {
            outcome: "outcome_ok",
            output: "Hello from Google",
          },
        },
      },
    ]);
  });
});
