/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatCompletionMessage } from "openai/resources";
import { convertCompletionsMessageToBaseMessage } from "../completions.js";
import { convertResponsesDeltaToChatGenerationChunk } from "../responses.js";
import { AIMessageChunk, ToolCallChunk } from "@langchain/core/messages";

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

      // Test the _convertCompletionsMessageToBaseMessage method
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
});

describe("convertResponsesDeltaToChatGenerationChunk", () => {
  describe("custom tool streaming delta handling", () => {
    it("should handle response.custom_tool_call_input.delta events", () => {
      // Test custom tool delta event
      const customToolDelta = {
        type: "response.custom_tool_call_input.delta",
        delta: '{"query": "test query"}',
        output_index: 0,
      };

      const result = convertResponsesDeltaToChatGenerationChunk(
        customToolDelta as any
      );
      const aiMessageChunk = result?.message as AIMessageChunk;

      expect(aiMessageChunk.tool_call_chunks).toBeDefined();
      expect(aiMessageChunk.tool_call_chunks).toHaveLength(1);
      expect(aiMessageChunk.tool_call_chunks?.[0]).toEqual({
        type: "tool_call_chunk",
        args: '{"query": "test query"}',
        index: 0,
      } as ToolCallChunk);
    });

    it("should handle both function and custom tool delta events equally", () => {
      // Test function call delta
      const functionDelta = {
        type: "response.function_call_arguments.delta",
        delta: '{"location": "NYC"}',
        output_index: 0,
      };

      // Test custom tool delta
      const customDelta = {
        type: "response.custom_tool_call_input.delta",
        delta: '{"location": "NYC"}',
        output_index: 0,
      };

      const functionResult = convertResponsesDeltaToChatGenerationChunk(
        functionDelta as any
      );
      const customResult = convertResponsesDeltaToChatGenerationChunk(
        customDelta as any
      );

      // Both should produce identical tool_call_chunks
      const aiMessageChunk = functionResult?.message as AIMessageChunk;
      expect(aiMessageChunk.tool_call_chunks).toEqual(
        customResult?.message as AIMessageChunk
      );
    });
  });
});
