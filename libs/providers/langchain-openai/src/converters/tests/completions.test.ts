/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { ChatCompletionMessage } from "openai/resources";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import {
  completionsApiContentBlockConverter,
  convertCompletionsDeltaToBaseMessageChunk,
  convertCompletionsMessageToBaseMessage,
  convertMessagesToCompletionsMessageParams,
  convertStandardContentBlockToCompletionsContentPart,
} from "../completions.js";

describe("convertCompletionsMessageToBaseMessage", () => {
  it("preserves assistant reasoning_content in additional_kwargs", () => {
    const mockMessage = {
      role: "assistant" as const,
      content: "2",
      reasoning_content: "The user asked 1+1.",
    };

    const mockRawResponse = {
      id: "chatcmpl-reasoning",
      model: "gpt-5.4",
      choices: [{ index: 0, message: mockMessage }],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    };

    const result = convertCompletionsMessageToBaseMessage({
      message: mockMessage as unknown as ChatCompletionMessage,
      rawResponse: mockRawResponse as any,
    }) as AIMessage;

    expect(result.additional_kwargs.reasoning_content).toBe(
      "The user asked 1+1."
    );
  });

  it("preserves delta reasoning_content in streaming chunks", () => {
    const delta = {
      role: "assistant" as const,
      content: "",
      reasoning_content: "The user",
    };
    const rawResponse = {
      id: "chatcmpl-reasoning-stream",
      choices: [{ index: 0, delta, finish_reason: null }],
      usage: { total_tokens: 0, total_characters: 0 },
    };

    const result = convertCompletionsDeltaToBaseMessageChunk({
      delta,
      rawResponse: rawResponse as any,
    }) as AIMessageChunk;

    expect(result.additional_kwargs.reasoning_content).toBe("The user");
  });

  describe("OpenRouter image response handling", () => {
    it("Should correctly parse OpenRouter-style image responses", () => {
      // Mock message with images from OpenRouter
      const mockMessage = {
        role: "assistant" as const,
        content: "Here is your image of a cute cat:",
      };

      const mockRawResponse = {
        id: "chatcmpl-12345",
        object: "chat.completion",
        created: 1234567890,
        model: "google/gemini-2.5-flash-image-preview",
        choices: [
          {
            index: 0,
            message: {
              ...mockMessage,
              // OpenRouter includes images in a separate array
              images: [
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                  },
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = convertCompletionsMessageToBaseMessage({
        message: mockMessage as ChatCompletionMessage,
        rawResponse: mockRawResponse as any,
      });

      // Verify the result is an AIMessage with structured content
      expect(result.constructor.name).toBe("AIMessage");
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Here is your image of a cute cat:",
        },
        {
          type: "image",
          url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        },
      ]);
    });

    it("Should handle OpenRouter responses with multiple images", () => {
      const mockMessage = {
        role: "assistant" as const,
        content: "Here are multiple images:",
      };

      const mockRawResponse = {
        id: "chatcmpl-12345",
        object: "chat.completion",
        created: 1234567890,
        model: "google/gemini-2.5-flash-image-preview",
        choices: [
          {
            index: 0,
            message: {
              ...mockMessage,
              images: [
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,image1",
                  },
                },
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,image2",
                  },
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = convertCompletionsMessageToBaseMessage({
        message: mockMessage as ChatCompletionMessage,
        rawResponse: mockRawResponse as any,
      });

      // Verify the response contains structured content with multiple image_urls
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Here are multiple images:",
        },
        {
          type: "image",
          url: "data:image/png;base64,image1",
        },
        {
          type: "image",
          url: "data:image/png;base64,image2",
        },
      ]);
    });
  });

  describe("convertStandardContentBlockToCompletionsContentPart", () => {
    it("can convert image block with base64 data to image_url data URL", () => {
      const block = {
        type: "image",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAE",
        mimeType: "image/png",
      } as any;

      const result = convertStandardContentBlockToCompletionsContentPart(block);
      expect(result).toEqual({
        type: "image_url",
        image_url: {
          url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE",
        },
      });
    });

    it("can convert image block with url to image_url", () => {
      const block = {
        type: "image",
        url: "https://example.com/cat.png",
      } as any;

      const result = convertStandardContentBlockToCompletionsContentPart(block);
      expect(result).toEqual({
        type: "image_url",
        image_url: {
          url: "https://example.com/cat.png",
        },
      });
    });

    it("will use placeholder filename when no filename is provided to a base64 file block", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const block = {
        type: "file",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAE",
        mimeType: "application/pdf",
      } as any;

      const result = convertStandardContentBlockToCompletionsContentPart(block);
      expect(result).toEqual({
        type: "file",
        file: {
          file_data: "data:application/pdf;base64,iVBORw0KGgoAAAANSUhEUgAAAAE",
          filename: "LC_AUTOGENERATED",
        },
      });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("will convert a file block to an openai file payload when a filename is provided", () => {
      const block = {
        type: "file",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAE",
        mimeType: "application/pdf",
        metadata: { filename: "cat.pdf" },
      } as any;

      const result = convertStandardContentBlockToCompletionsContentPart(block);
      expect(result).toEqual({
        type: "file",
        file: {
          file_data: "data:application/pdf;base64,iVBORw0KGgoAAAANSUhEUgAAAAE",
          filename: "cat.pdf",
        },
      });
    });
  });

  describe("convertMessagesToCompletionsMessageParams", () => {
    it("should preserve AIMessage content when tool_calls are present", () => {
      const message = new AIMessage({
        content:
          "I'll check the status of item 730 for identifier X1110 to find out why it's not active.",
        tool_calls: [
          {
            id: "call_zGKlzVl2Ee3Lyob4AsyqfGXb",
            name: "getStatus",
            args: { identifier: "X1110", itemId: "730" },
          },
        ],
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content:
          "I'll check the status of item 730 for identifier X1110 to find out why it's not active.",
        tool_calls: [
          {
            id: "call_zGKlzVl2Ee3Lyob4AsyqfGXb",
            type: "function",
            function: {
              name: "getStatus",
              arguments: '{"identifier":"X1110","itemId":"730"}',
            },
          },
        ],
      });
    });

    it("should handle AIMessage with empty content and tool_calls", () => {
      const message = new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "someFunction",
            args: { key: "value" },
          },
        ],
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "someFunction",
              arguments: '{"key":"value"}',
            },
          },
        ],
      });
    });

    it("should preserve tool_calls for output_version v1 assistant messages", () => {
      const message = new AIMessage({
        content: [
          {
            type: "tool_call",
            id: "call_123",
            name: "someFunction",
            args: { key: "value" },
          },
        ],
        tool_calls: [
          {
            id: "call_123",
            name: "someFunction",
            args: { key: "value" },
          },
        ],
        response_metadata: {
          output_version: "v1",
        },
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: [],
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "someFunction",
              arguments: '{"key":"value"}',
            },
          },
        ],
      });
    });

    it("should preserve content with function_call in additional_kwargs", () => {
      const message = new AIMessage({
        content: "Let me call a function for you.",
        additional_kwargs: {
          function_call: {
            name: "myFunction",
            arguments: '{"arg":"value"}',
          },
        },
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "Let me call a function for you.",
        function_call: {
          name: "myFunction",
          arguments: '{"arg":"value"}',
        },
      });
    });
  });

  describe("completionsApiContentBlockConverter.fromStandardFileBlock", () => {
    it("uses placeholder filename when base64 file block is missing filename/name/title metadata", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const block = {
        source_type: "base64",
        mime_type: "application/pdf",
        data: "AAABBB",
        // metadata intentionally missing
      } as any;

      const result =
        completionsApiContentBlockConverter.fromStandardFileBlock!(block);
      expect(result).toEqual({
        type: "file",
        file: {
          file_data: "data:application/pdf;base64,AAABBB",
          filename: "LC_AUTOGENERATED",
        },
      });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("converts base64 file block to file with data URL and filename from metadata.filename", () => {
      const block = {
        source_type: "base64",
        mime_type: "application/pdf",
        data: "AAABBB",
        metadata: { filename: "doc.pdf" },
      } as any;

      const result =
        completionsApiContentBlockConverter.fromStandardFileBlock!(block);
      expect(result).toEqual({
        type: "file",
        file: {
          file_data: "data:application/pdf;base64,AAABBB",
          filename: "doc.pdf",
        },
      });
    });

    it("converts url data-url file block to file with file_data equal to url and includes filename from metadata.name", () => {
      const dataUrl = "data:application/pdf;base64,AAABBB";
      const block = {
        source_type: "url",
        url: dataUrl,
        metadata: { name: "report.pdf" },
      } as any;

      const result =
        completionsApiContentBlockConverter.fromStandardFileBlock!(block);
      expect(result).toEqual({
        type: "file",
        file: {
          file_data: dataUrl,
          filename: "report.pdf",
        },
      });
    });

    it("returns file_id for id source_type", () => {
      const block = {
        source_type: "id",
        id: "file_123",
      } as any;

      const result =
        completionsApiContentBlockConverter.fromStandardFileBlock!(block);
      expect(result).toEqual({
        type: "file",
        file: {
          file_id: "file_123",
        },
      });
    });

    it("throws when url is not a data URL", () => {
      const block = {
        source_type: "url",
        url: "https://example.com/file.pdf",
        metadata: { filename: "file.pdf" },
      } as any;

      expect(() =>
        completionsApiContentBlockConverter.fromStandardFileBlock!(block)
      ).toThrowError(
        `URL file blocks with source_type url must be formatted as a data URL for ChatOpenAI`
      );
    });
  });

  describe("Anthropic cross-provider compatibility", () => {
    it("should drop tool_use blocks from content (already in tool_calls)", () => {
      const message = new AIMessage({
        content: [
          { type: "text", text: "I will search for that." },
          {
            type: "tool_use",
            id: "toolu_abc123",
            name: "get_weather",
            input: { location: "SF" },
          },
        ],
        tool_calls: [
          {
            id: "toolu_abc123",
            name: "get_weather",
            args: { location: "SF" },
          },
        ],
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: [{ type: "text", text: "I will search for that." }],
        tool_calls: [
          {
            id: "toolu_abc123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location":"SF"}',
            },
          },
        ],
      });
    });

    it("should drop tool_use blocks alongside thinking blocks", () => {
      const message = new AIMessage({
        content: [
          {
            type: "thinking",
            thinking: "I need to consider...",
            signature: "sig123",
          },
          { type: "text", text: "Here is my answer." },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "search",
            input: { q: "langchain" },
          },
        ],
        tool_calls: [
          {
            id: "toolu_1",
            name: "search",
            args: { q: "langchain" },
          },
        ],
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      // Both tool_use and thinking are dropped; only text remains. Reasoning
      // traces are output-only and are rejected when echoed back to strict
      // openai-compatible providers (e.g. DeepSeek).
      const contentArr = result[0].content as any[];
      expect(contentArr.some((c: any) => c.type === "tool_use")).toBe(false);
      expect(contentArr.some((c: any) => c.type === "thinking")).toBe(false);
      expect(contentArr.some((c: any) => c.type === "text")).toBe(true);
      // tool_calls should still be present
      expect((result[0] as any).tool_calls).toHaveLength(1);
    });

    it("should drop reasoning, reasoning_content, and tool_call blocks from content", () => {
      // Regression: standard reasoning/tool-call blocks held in message
      // history were echoed back into the request, which strict
      // openai-compatible providers reject (e.g. DeepSeek:
      // "unknown variant `reasoning`/`tool_call`, expected `text`").
      const message = new AIMessage({
        content: [
          { type: "reasoning", reasoning: "Let me think about this..." },
          { type: "reasoning_content", reasoning_content: "more thoughts" },
          {
            type: "tool_call",
            id: "call_1",
            name: "search",
            args: { q: "langchain" },
          },
          { type: "text", text: "The answer is 42." },
        ],
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toEqual([
        { type: "text", text: "The answer is 42." },
      ]);
    });

    it("should drop input_json_delta blocks from content (cross-provider replay)", () => {
      // Regression: an AIMessage authored by an Anthropic model can retain
      // streaming tool-call artifacts (`input_json_delta`) in its content.
      // When replayed to an OpenAI model these were passed through raw and
      // rejected with "400 Invalid value: 'input_json_delta'". The finalized
      // tool call is already carried in message.tool_calls, so dropping the
      // residual delta blocks loses nothing.
      const message = new AIMessage({
        content: [
          { type: "text", text: "reading files" },
          {
            type: "input_json_delta",
            index: 0,
            input: '{"file_path": "/README.md"}',
          },
        ] as any,
        tool_calls: [
          {
            id: "call_1",
            name: "read_file",
            args: { file_path: "/README.md" },
          },
        ],
      });

      const result = convertMessagesToCompletionsMessageParams({
        messages: [message],
      });

      expect(result).toHaveLength(1);
      // The streaming artifact is dropped; only the text block remains.
      expect(result[0].content).toEqual([
        { type: "text", text: "reading files" },
      ]);
      // The finalized tool call is preserved verbatim in tool_calls — proving
      // we removed only the redundant residual delta, not tool-call data.
      expect((result[0] as any).tool_calls).toEqual([
        {
          id: "call_1",
          type: "function",
          function: {
            name: "read_file",
            arguments: '{"file_path":"/README.md"}',
          },
        },
      ]);
    });
  });
});
