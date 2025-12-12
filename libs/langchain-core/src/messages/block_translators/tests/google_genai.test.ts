import { AIMessage } from "../../ai.js";

describe("ChatGoogleGenAITranslator", () => {
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
