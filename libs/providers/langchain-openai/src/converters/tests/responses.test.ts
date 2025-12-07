/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolCallChunk,
} from "@langchain/core/messages";
import {
  convertResponsesDeltaToChatGenerationChunk,
  convertResponsesUsageToUsageMetadata,
  convertStandardContentMessageToResponsesInput,
} from "../responses.js";

describe("convertResponsesUsageToUsageMetadata", () => {
  it("should convert OpenAI Responses usage to LangChain format with cached tokens", () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: {
        cached_tokens: 75,
        text_tokens: 25,
      },
      output_tokens_details: {
        reasoning_tokens: 10,
        text_tokens: 40,
      },
    };

    const result = convertResponsesUsageToUsageMetadata(usage as any);

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
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    };

    const result = convertResponsesUsageToUsageMetadata(usage as any);

    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_token_details: {},
      output_token_details: {},
    });
  });

  it("should handle undefined usage", () => {
    const result = convertResponsesUsageToUsageMetadata(undefined);

    expect(result).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      input_token_details: {},
      output_token_details: {},
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

      const functionResultMessage = functionResult?.message as AIMessageChunk;
      const customResultMessage = customResult?.message as AIMessageChunk;

      // Both should produce identical tool_call_chunks
      expect(functionResultMessage.tool_call_chunks).toEqual(
        customResultMessage.tool_call_chunks
      );
    });
  });
});

describe("convertStandardContentMessageToResponsesInput", () => {
  it("converts text blocks into a single message with inferred role", () => {
    const message = new HumanMessage({
      contentBlocks: [
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ],
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Hello" },
          { type: "input_text", text: "World" },
        ],
      },
    ]);
  });

  it("emits reasoning blocks as dedicated reasoning items", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "reasoning",
          id: "reason-1",
          reasoning: "Thoughts...",
        },
      ],
      response_metadata: { model_provider: "openai" },
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        type: "reasoning",
        id: "reason-1",
        summary: [{ type: "summary_text", text: "Thoughts..." }],
        content: [{ type: "reasoning_text", text: "Thoughts..." }],
      },
    ]);
  });

  it("converts tool call blocks and aggregates chunk fallbacks", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "tool_call_chunk",
          id: "call-1",
          name: "calculator",
          args: '{"value":',
        },
        {
          type: "tool_call_chunk",
          id: "call-1",
          args: "42}",
        },
      ],
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        type: "function_call",
        call_id: "call-1",
        name: "calculator",
        arguments: '{"value":42}',
      },
    ]);
  });

  it("converts server tool call results to function outputs", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "server_tool_call_result",
          toolCallId: "call-2",
          status: "success",
          output: { foo: "bar" },
        },
      ],
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        type: "function_call_output",
        call_id: "call-2",
        output: '{"foo":"bar"}',
        status: "completed",
      },
    ]);
  });

  it("converts completed tool calls using direct blocks", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "tool_call",
          id: "call-3",
          name: "summarize",
          args: { topic: "news" },
        },
      ],
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        type: "function_call",
        call_id: "call-3",
        name: "summarize",
        arguments: '{"topic":"news"}',
      },
    ]);
  });

  it("embeds multimodal blocks alongside text", () => {
    const message = new HumanMessage({
      contentBlocks: [
        { type: "text", text: "Look at this" },
        {
          type: "image",
          url: "https://example.com/image.png",
          metadata: { detail: "high" },
        },
        {
          type: "file",
          fileId: "file-123",
          metadata: { filename: "notes.txt" },
        },
      ],
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Look at this" },
          {
            type: "input_image",
            detail: "high",
            image_url: "https://example.com/image.png",
          },
          {
            type: "input_file",
            file_id: "file-123",
            filename: "notes.txt",
          },
        ],
      },
    ]);
  });

  it("preserves OpenAI-only non_standard content when present", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "non_standard",
          value: { type: "custom", payload: "data" },
        },
      ],
      response_metadata: { model_provider: "openai" },
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([{ type: "custom", payload: "data" }]);
  });

  it("converts file payloads when filename is provided", () => {
    const message = new HumanMessage({
      contentBlocks: [
        {
          type: "file",
          mimeType: "application/pdf",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAE",
          metadata: { filename: "sample.pdf" },
        },
      ],
    });

    const result = convertStandardContentMessageToResponsesInput(message);

    expect(result).toEqual([
      {
        role: "user",
        type: "message",
        content: [
          {
            type: "input_file",
            file_data:
              "data:application/pdf;base64,iVBORw0KGgoAAAANSUhEUgAAAAE",
            filename: "sample.pdf",
          },
        ],
      },
    ]);
  });

  it("throws error when file payload does not contain filename", () => {
    const message = new HumanMessage({
      contentBlocks: [
        {
          type: "file",
          mimeType: "application/pdf",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAE",
        },
      ],
    });

    expect(() =>
      convertStandardContentMessageToResponsesInput(message)
    ).toThrowError(
      `a filename or name or title is needed via meta-data for OpenAI when working with multimodal blocks`
    );
  });
});
