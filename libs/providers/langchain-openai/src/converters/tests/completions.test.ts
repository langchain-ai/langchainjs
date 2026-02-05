/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { ChatCompletionMessage } from "openai/resources";
import { AIMessage } from "@langchain/core/messages";
import {
  completionsApiContentBlockConverter,
  convertCompletionsMessageToBaseMessage,
  convertMessagesToCompletionsMessageParams,
  convertStandardContentBlockToCompletionsContentPart,
} from "../completions.js";

describe("convertCompletionsMessageToBaseMessage", () => {
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

    it("will throw an error when when no filename is providing to a base64 file block", () => {
      const block = {
        type: "file",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAE",
        mimeType: "application/pdf",
      } as any;

      expect(() =>
        convertStandardContentBlockToCompletionsContentPart(block)
      ).toThrowError(
        "a filename or name or title is needed via meta-data for OpenAI when working with multimodal blocks"
      );
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
    it("throws when base64 file block is missing filename/name/title metadata", () => {
      const block = {
        source_type: "base64",
        mime_type: "application/pdf",
        data: "AAABBB",
        // metadata intentionally missing
      } as any;

      expect(() =>
        completionsApiContentBlockConverter.fromStandardFileBlock!(block)
      ).toThrowError(
        "a filename or name or title is needed via meta-data for OpenAI when working with multimodal blocks"
      );
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
});
