/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { OpenAI as OpenAIClient } from "openai";
import {
  AIMessage,
  AIMessageChunk,
  ContentBlock,
  HumanMessage,
  ToolCallChunk,
  ToolMessage,
} from "@langchain/core/messages";
import {
  convertMessagesToResponsesInput,
  convertResponsesDeltaToChatGenerationChunk,
  convertResponsesMessageToAIMessage,
  convertResponsesUsageToUsageMetadata,
  convertStandardContentMessageToResponsesInput,
  ResponsesCreateInvoke,
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

describe("convertResponsesMessageToAIMessage", () => {
  it("should elevate reasoning to content array", () => {
    const response = {
      id: "resp_123",
      model: "o3-mini",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "reasoning",
          id: "rs_abc123",
          summary: [
            { type: "summary_text", text: "First reasoning step" },
            { type: "summary_text", text: "Second reasoning step" },
          ],
        },
        {
          type: "message",
          id: "msg_123",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello!", annotations: [] }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    };

    const result = convertResponsesMessageToAIMessage(response as any);

    // Verify reasoning is in additional_kwargs
    expect(result.additional_kwargs.reasoning).toBeDefined();
    expect(result.additional_kwargs.reasoning).toEqual({
      type: "reasoning",
      id: "rs_abc123",
      summary: [
        { type: "summary_text", text: "First reasoning step" },
        { type: "summary_text", text: "Second reasoning step" },
      ],
    });

    // Verify reasoning is elevated to content array
    expect(Array.isArray(result.content)).toBe(true);
    const contentArray = result.content as Array<{
      type: string;
      [key: string]: unknown;
    }>;
    const reasoningBlocks = contentArray.filter(
      (block) => block.type === "reasoning"
    );
    expect(reasoningBlocks.length).toBe(1);
    expect(reasoningBlocks[0]).toEqual({
      type: "reasoning",
      reasoning: "First reasoning stepSecond reasoning step",
    });

    // Verify text content is also present
    const textBlocks = contentArray.filter((block) => block.type === "text");
    expect(textBlocks.length).toBe(1);
    expect(textBlocks[0]).toMatchObject({ type: "text", text: "Hello!" });
  });

  it("should handle reasoning with empty summary", () => {
    const response = {
      id: "resp_123",
      model: "o3-mini",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "reasoning",
          id: "rs_abc123",
          summary: [],
        },
        {
          type: "message",
          id: "msg_123",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello!", annotations: [] }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    };

    const result = convertResponsesMessageToAIMessage(response as any);

    // Verify reasoning is in additional_kwargs
    expect(result.additional_kwargs.reasoning).toBeDefined();

    // Verify no reasoning block is added to content when summary is empty
    expect(Array.isArray(result.content)).toBe(true);
    const contentArray = result.content as Array<{
      type: string;
      [key: string]: unknown;
    }>;
    const reasoningBlocks = contentArray.filter(
      (block) => block.type === "reasoning"
    );
    expect(reasoningBlocks.length).toBe(0);
  });

  it("should handle response without reasoning", () => {
    const response = {
      id: "resp_123",
      model: "gpt-4o",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg_123",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello!", annotations: [] }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    };

    const result = convertResponsesMessageToAIMessage(response as any);

    // Verify no reasoning in additional_kwargs
    expect(result.additional_kwargs.reasoning).toBeUndefined();

    // Verify no reasoning block in content
    expect(Array.isArray(result.content)).toBe(true);
    const contentArray = result.content as Array<{
      type: string;
      [key: string]: unknown;
    }>;
    const reasoningBlocks = contentArray.filter(
      (block) => block.type === "reasoning"
    );
    expect(reasoningBlocks.length).toBe(0);
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

  describe("reasoning streaming elevation", () => {
    it("should elevate reasoning to content on response.output_item.added with reasoning", () => {
      const event = {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "reasoning",
          id: "rs_abc123",
          summary: [
            { type: "summary_text", text: "Thinking about this..." },
            { type: "summary_text", text: "Let me reason through." },
          ],
        },
      };

      const result = convertResponsesDeltaToChatGenerationChunk(event as any);
      const aiMessageChunk = result?.message as AIMessageChunk;

      // Verify reasoning is in additional_kwargs
      expect(aiMessageChunk.additional_kwargs.reasoning).toBeDefined();
      expect(aiMessageChunk.additional_kwargs.reasoning).toMatchObject({
        id: "rs_abc123",
        type: "reasoning",
      });

      // Verify reasoning is elevated to content
      expect(Array.isArray(aiMessageChunk.content)).toBe(true);
      const contentArray = aiMessageChunk.content as Array<{
        type: string;
        [key: string]: unknown;
      }>;
      const reasoningBlocks = contentArray.filter(
        (block) => block.type === "reasoning"
      );
      expect(reasoningBlocks.length).toBe(1);
      expect(reasoningBlocks[0]).toEqual({
        type: "reasoning",
        reasoning: "Thinking about this...Let me reason through.",
      });
    });

    it("should elevate reasoning to content on response.reasoning_summary_part.added", () => {
      const event = {
        type: "response.reasoning_summary_part.added",
        item_id: "rs_abc123",
        output_index: 0,
        summary_index: 0,
        part: {
          type: "summary_text",
          text: "Initial reasoning step",
        },
      };

      const result = convertResponsesDeltaToChatGenerationChunk(event as any);
      const aiMessageChunk = result?.message as AIMessageChunk;

      // Verify reasoning is in additional_kwargs
      expect(aiMessageChunk.additional_kwargs.reasoning).toBeDefined();
      expect(aiMessageChunk.additional_kwargs.reasoning).toMatchObject({
        type: "reasoning",
        summary: [
          { type: "summary_text", text: "Initial reasoning step", index: 0 },
        ],
      });

      // Verify reasoning is elevated to content
      expect(Array.isArray(aiMessageChunk.content)).toBe(true);
      const contentArray = aiMessageChunk.content as Array<{
        type: string;
        [key: string]: unknown;
      }>;
      const reasoningBlocks = contentArray.filter(
        (block) => block.type === "reasoning"
      );
      expect(reasoningBlocks.length).toBe(1);
      expect(reasoningBlocks[0]).toEqual({
        type: "reasoning",
        reasoning: "Initial reasoning step",
      });
    });

    it("should elevate reasoning to content on response.reasoning_summary_text.delta", () => {
      const event = {
        type: "response.reasoning_summary_text.delta",
        item_id: "rs_abc123",
        output_index: 0,
        summary_index: 0,
        delta: "more reasoning text",
      };

      const result = convertResponsesDeltaToChatGenerationChunk(event as any);
      const aiMessageChunk = result?.message as AIMessageChunk;

      // Verify reasoning is in additional_kwargs
      expect(aiMessageChunk.additional_kwargs.reasoning).toBeDefined();
      expect(aiMessageChunk.additional_kwargs.reasoning).toMatchObject({
        type: "reasoning",
        summary: [
          { type: "summary_text", text: "more reasoning text", index: 0 },
        ],
      });

      // Verify reasoning is elevated to content
      expect(Array.isArray(aiMessageChunk.content)).toBe(true);
      const contentArray = aiMessageChunk.content as Array<{
        type: string;
        [key: string]: unknown;
      }>;
      const reasoningBlocks = contentArray.filter(
        (block) => block.type === "reasoning"
      );
      expect(reasoningBlocks.length).toBe(1);
      expect(reasoningBlocks[0]).toEqual({
        type: "reasoning",
        reasoning: "more reasoning text",
      });
    });

    it("should not add reasoning to content when summary is empty on response.output_item.added", () => {
      const event = {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "reasoning",
          id: "rs_abc123",
          summary: [],
        },
      };

      const result = convertResponsesDeltaToChatGenerationChunk(event as any);
      const aiMessageChunk = result?.message as AIMessageChunk;

      // Verify reasoning is in additional_kwargs
      expect(aiMessageChunk.additional_kwargs.reasoning).toBeDefined();

      // Verify no reasoning block is added to content when summary is empty
      expect(Array.isArray(aiMessageChunk.content)).toBe(true);
      const contentArray = aiMessageChunk.content as Array<{
        type: string;
        [key: string]: unknown;
      }>;
      const reasoningBlocks = contentArray.filter(
        (block) => block.type === "reasoning"
      );
      expect(reasoningBlocks.length).toBe(0);
    });

    it("should not add reasoning to content when delta is empty on response.reasoning_summary_text.delta", () => {
      const event = {
        type: "response.reasoning_summary_text.delta",
        item_id: "rs_abc123",
        output_index: 0,
        summary_index: 0,
        delta: "",
      };

      const result = convertResponsesDeltaToChatGenerationChunk(event as any);
      const aiMessageChunk = result?.message as AIMessageChunk;

      // Verify reasoning is in additional_kwargs
      expect(aiMessageChunk.additional_kwargs.reasoning).toBeDefined();

      // Verify no reasoning block is added to content when delta is empty
      expect(Array.isArray(aiMessageChunk.content)).toBe(true);
      const contentArray = aiMessageChunk.content as Array<{
        type: string;
        [key: string]: unknown;
      }>;
      const reasoningBlocks = contentArray.filter(
        (block) => block.type === "reasoning"
      );
      expect(reasoningBlocks.length).toBe(0);
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

describe("convertMessagesToResponsesInput", () => {
  describe("ToolMessage conversion", () => {
    it("passes through provider-native input_file content without stringification", () => {
      const toolMessage = new ToolMessage({
        tool_call_id: "call_123",
        content: [
          {
            type: "input_file",
            file_data: "data:application/pdf;base64,JVBERi0xLjQKJeLjz9M=",
            filename: "test.pdf",
          },
        ],
      });

      const result = convertMessagesToResponsesInput({
        messages: [toolMessage],
        zdrEnabled: false,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          type: "function_call_output",
          call_id: "call_123",
          id: undefined,
          output: [
            {
              type: "input_file",
              file_data: "data:application/pdf;base64,JVBERi0xLjQKJeLjz9M=",
              filename: "test.pdf",
            },
          ],
        },
      ]);
    });

    it("passes through provider-native input_image content without stringification", () => {
      const toolMessage = new ToolMessage({
        tool_call_id: "call_456",
        content: [
          {
            type: "input_image",
            image_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
          },
        ],
      });

      const result = convertMessagesToResponsesInput({
        messages: [toolMessage],
        zdrEnabled: false,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          type: "function_call_output",
          call_id: "call_456",
          id: undefined,
          output: [
            {
              type: "input_image",
              image_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
            },
          ],
        },
      ]);
    });

    it("passes through provider-native input_text content without stringification", () => {
      const toolMessage = new ToolMessage({
        tool_call_id: "call_789",
        content: [
          {
            type: "input_text",
            text: "Some text result",
          },
        ],
      });

      const result = convertMessagesToResponsesInput({
        messages: [toolMessage],
        zdrEnabled: false,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          type: "function_call_output",
          call_id: "call_789",
          id: undefined,
          output: [
            {
              type: "input_text",
              text: "Some text result",
            },
          ],
        },
      ]);
    });

    it("passes through mixed provider-native content types without stringification", () => {
      const toolMessage = new ToolMessage({
        tool_call_id: "call_mixed",
        content: [
          {
            type: "input_file",
            file_data: "data:application/pdf;base64,JVBERi0xLjQ=",
            filename: "doc.pdf",
          },
          {
            type: "input_text",
            text: "File description",
          },
        ],
      });

      const result = convertMessagesToResponsesInput({
        messages: [toolMessage],
        zdrEnabled: false,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          type: "function_call_output",
          call_id: "call_mixed",
          id: undefined,
          output: [
            {
              type: "input_file",
              file_data: "data:application/pdf;base64,JVBERi0xLjQ=",
              filename: "doc.pdf",
            },
            {
              type: "input_text",
              text: "File description",
            },
          ],
        },
      ]);
    });

    it("stringifies non-native array content", () => {
      const toolMessage = new ToolMessage({
        tool_call_id: "call_obj",
        content: [
          {
            type: "text",
            text: "Result from tool",
          },
        ],
      });

      const result = convertMessagesToResponsesInput({
        messages: [toolMessage],
        zdrEnabled: false,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          type: "function_call_output",
          call_id: "call_obj",
          id: undefined,
          output: '[{"type":"text","text":"Result from tool"}]',
        },
      ]);
    });

    it("keeps string content as-is", () => {
      const toolMessage = new ToolMessage({
        tool_call_id: "call_str",
        content: "Simple string result",
      });

      const result = convertMessagesToResponsesInput({
        messages: [toolMessage],
        zdrEnabled: false,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          type: "function_call_output",
          call_id: "call_str",
          id: undefined,
          output: "Simple string result",
        },
      ]);
    });
  });
});

describe("convertResponsesMessageToAIMessage", () => {
  it("should convert image_generation_call to image content block", () => {
    const imageResult =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const mockResponse: ResponsesCreateInvoke = {
      id: "resp_123",
      model: "gpt-4",
      created_at: 1234567890,
      status: "completed",
      object: "response",
      output_text: "",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: {},
      temperature: 1,
      top_p: 1,
      max_output_tokens: null,
      truncation: "disabled",
      tool_choice: "auto",
      parallel_tool_calls: true,
      tools: [],
      output: [
        {
          type: "image_generation_call",
          id: "ig_abc123",
          status: "completed",
          result: imageResult,
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    };

    const result = convertResponsesMessageToAIMessage(mockResponse);

    // Should have image content block
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(1);

    const imageBlock = (result.content as ContentBlock[])[0];
    expect(imageBlock.type).toBe("image");
    expect((imageBlock as ContentBlock.Multimodal.Image).mimeType).toBe(
      "image/png"
    );
    expect((imageBlock as ContentBlock.Multimodal.Image).data).toBe(
      imageResult
    );
    expect((imageBlock as ContentBlock.Multimodal.Image).id).toBe("ig_abc123");
    expect((imageBlock as ContentBlock.Multimodal.Image).metadata).toEqual({
      status: "completed",
    });

    // Should also have tool_outputs for backwards compatibility
    expect(result.additional_kwargs.tool_outputs).toBeDefined();
    expect(result.additional_kwargs.tool_outputs).toHaveLength(1);
    expect((result.additional_kwargs.tool_outputs as any[])[0].type).toBe(
      "image_generation_call"
    );
  });

  it("should not add image content block when result is null", () => {
    const mockResponse: ResponsesCreateInvoke = {
      id: "resp_123",
      model: "gpt-4",
      created_at: 1234567890,
      status: "in_progress",
      object: "response",
      output_text: "",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: {},
      temperature: 1,
      top_p: 1,
      max_output_tokens: null,
      truncation: "disabled",
      tool_choice: "auto",
      parallel_tool_calls: true,
      tools: [],
      output: [
        {
          type: "image_generation_call",
          id: "ig_abc123",
          status: "in_progress",
          result: null,
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    };

    const result = convertResponsesMessageToAIMessage(mockResponse);

    // Should not have image content block when result is null
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(0);

    // Should still have tool_outputs for backwards compatibility
    expect(result.additional_kwargs.tool_outputs).toBeDefined();
    expect(result.additional_kwargs.tool_outputs).toHaveLength(1);
  });

  it("should handle multiple output items including image_generation_call", () => {
    const mockResponse: ResponsesCreateInvoke = {
      id: "resp_123",
      model: "gpt-4",
      created_at: 1234567890,
      status: "completed",
      object: "response",
      output_text: "Here is the image you requested:",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: {},
      temperature: 1,
      top_p: 1,
      max_output_tokens: null,
      truncation: "disabled",
      tool_choice: "auto",
      parallel_tool_calls: true,
      tools: [],
      output: [
        {
          type: "message",
          id: "msg_456",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Here is the image you requested:",
              annotations: [],
            },
          ],
        },
        {
          type: "image_generation_call",
          id: "ig_abc123",
          status: "completed",
          result: "base64ImageData",
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    };

    const result = convertResponsesMessageToAIMessage(mockResponse);

    // Should have both text and image content blocks
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(2);

    const textBlock = (result.content as ContentBlock[])[0];
    expect(textBlock.type).toBe("text");
    expect((textBlock as ContentBlock.Text).text).toBe(
      "Here is the image you requested:"
    );

    const imageBlock = (result.content as ContentBlock[])[1];
    expect(imageBlock.type).toBe("image");
    expect((imageBlock as ContentBlock.Multimodal.Image).data).toBe(
      "base64ImageData"
    );
  });
});

describe("convertResponsesDeltaToChatGenerationChunk - image generation", () => {
  it("should convert image_generation_call streaming event to image content block", () => {
    const streamEvent: OpenAIClient.Responses.ResponseStreamEvent = {
      type: "response.output_item.done",
      sequence_number: 1,
      output_index: 0,
      item: {
        type: "image_generation_call",
        id: "ig_stream_123",
        status: "completed",
        result: "streamedBase64ImageData",
      },
    };

    const result = convertResponsesDeltaToChatGenerationChunk(streamEvent);

    expect(result).not.toBeNull();
    const message = result!.message as AIMessageChunk;

    // Should have image content block
    expect(Array.isArray(message.content)).toBe(true);
    expect(message.content).toHaveLength(1);

    const imageBlock = (message.content as ContentBlock[])[0];
    expect(imageBlock.type).toBe("image");
    expect((imageBlock as ContentBlock.Multimodal.Image).mimeType).toBe(
      "image/png"
    );
    expect((imageBlock as ContentBlock.Multimodal.Image).data).toBe(
      "streamedBase64ImageData"
    );
    expect((imageBlock as ContentBlock.Multimodal.Image).id).toBe(
      "ig_stream_123"
    );
    expect((imageBlock as ContentBlock.Multimodal.Image).metadata).toEqual({
      status: "completed",
    });

    // Should also have tool_outputs for backwards compatibility
    expect(message.additional_kwargs.tool_outputs).toBeDefined();
    expect(message.additional_kwargs.tool_outputs).toHaveLength(1);
  });

  it("should not add image content block for streaming event when result is null", () => {
    const streamEvent: OpenAIClient.Responses.ResponseStreamEvent = {
      type: "response.output_item.done",
      sequence_number: 1,
      output_index: 0,
      item: {
        type: "image_generation_call",
        id: "ig_stream_123",
        status: "in_progress",
        result: null,
      },
    };

    const result = convertResponsesDeltaToChatGenerationChunk(streamEvent);

    expect(result).not.toBeNull();
    const message = result!.message as AIMessageChunk;

    // Should not have image content block when result is null
    expect(Array.isArray(message.content)).toBe(true);
    expect(message.content).toHaveLength(0);

    // Should still have tool_outputs
    expect(message.additional_kwargs.tool_outputs).toBeDefined();
  });

  it("should return null for partial image events", () => {
    const partialImageEvent: OpenAIClient.Responses.ResponseStreamEvent = {
      type: "response.image_generation_call.partial_image",
      sequence_number: 1,
      item_id: "ig_partial_123",
      output_index: 0,
      partial_image_index: 0,
      partial_image_b64: "partialImageData",
    };

    const result =
      convertResponsesDeltaToChatGenerationChunk(partialImageEvent);

    // Partial images should be ignored
    expect(result).toBeNull();
  });
});
