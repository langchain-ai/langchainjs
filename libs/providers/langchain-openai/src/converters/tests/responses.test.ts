/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { OpenAI as OpenAIClient } from "openai";
import {
  AIMessage,
  AIMessageChunk,
  ContentBlock,
  HumanMessage,
  SystemMessage,
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

  it("should store output in response_metadata", () => {
    const output = [
      {
        type: "reasoning",
        id: "rs_abc123",
        summary: [{ type: "summary_text", text: "Thinking..." }],
      },
      {
        type: "function_call",
        id: "fc_xyz789",
        call_id: "call_123",
        name: "get_weather",
        arguments: '{"city":"NYC"}',
      },
    ];
    const response = {
      id: "resp_123",
      model: "o3-mini",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output,
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const result = convertResponsesMessageToAIMessage(response as any);

    expect(result.response_metadata.output).toEqual(output);
  });

  it("should strip parsed_arguments from function_call items in stored output", () => {
    const response = {
      id: "resp_123",
      model: "o3-mini",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "function_call",
          id: "fc_xyz789",
          call_id: "call_123",
          name: "get_weather",
          arguments: '{"city":"NYC"}',
          parsed_arguments: { city: "NYC" },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const result = convertResponsesMessageToAIMessage(response as any);

    const storedOutput = result.response_metadata.output as any[];
    expect(storedOutput).toHaveLength(1);
    expect(storedOutput[0].name).toBe("get_weather");
    expect(storedOutput[0]).not.toHaveProperty("parsed_arguments");
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

  it.each([
    {
      ext: "docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: "report.docx",
    },
    {
      ext: "pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      filename: "slides.pptx",
    },
    {
      ext: "xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "data.xlsx",
    },
    {
      ext: "csv",
      mimeType: "text/csv",
      filename: "data.csv",
    },
  ])(
    "converts $ext file block with base64 data to input_file",
    ({ mimeType, filename }) => {
      const message = new HumanMessage({
        contentBlocks: [
          {
            type: "file",
            mimeType,
            data: "dGVzdGRhdGE=",
            metadata: { filename },
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
              file_data: `data:${mimeType};base64,dGVzdGRhdGE=`,
              filename,
            },
          ],
        },
      ]);
    }
  );

  it.each([
    { ext: "docx", filename: "report.docx" },
    { ext: "pptx", filename: "slides.pptx" },
    { ext: "xlsx", filename: "data.xlsx" },
    { ext: "csv", filename: "data.csv" },
  ])("converts $ext file block with URL to input_file", ({ filename }) => {
    const url = `https://example.com/${filename}`;
    const message = new HumanMessage({
      contentBlocks: [
        {
          type: "file",
          url,
          metadata: { filename },
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
            file_url: url,
            filename,
          },
        ],
      },
    ]);
  });

  it.each([
    { ext: "docx", fileId: "file-docx-123" },
    { ext: "pptx", fileId: "file-pptx-456" },
    { ext: "xlsx", fileId: "file-xlsx-789" },
    { ext: "csv", fileId: "file-csv-012" },
  ])("converts $ext file block with fileId to input_file", ({ fileId }) => {
    const message = new HumanMessage({
      contentBlocks: [
        {
          type: "file",
          fileId,
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
            file_id: fileId,
          },
        ],
      },
    ]);
  });
});

describe("convertMessagesToResponsesInput", () => {
  describe("Regression Tests", () => {
    it("allows file_url without filename metadata and excludes filename from payload", () => {
      const messages = [
        new SystemMessage({
          content:
            "You are a helpful assistant that answers questions about the world.",
        }),
        new HumanMessage({
          contentBlocks: [
            { type: "text", text: "summary of this document" },
            {
              type: "file",
              url: "https://www.appropedia.org/w/images/c/ca/Writing_Sample.pdf",
              mimeType: "application/pdf",
            },
            {
              type: "text",
              text: 'The user cannot see this text only you can, they have uploaded a file.\n<file id="cmh43owcq0001rag7ce3flj36" filename="Writing_Sample.pdf" mimeType="application/pdf" size="47104 bytes" url="https://www.appropedia.org/w/images/c/ca/Writing_Sample.pdf" />',
            },
          ],
        }),
      ];

      const result = convertMessagesToResponsesInput({
        messages,
        model: "gpt-5.2",
        zdrEnabled: true,
      });

      expect(result).toMatchObject([
        {
          type: "message",
          role: "developer",
          content:
            "You are a helpful assistant that answers questions about the world.",
        },
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "summary of this document" },
            {
              type: "input_file",
              file_url:
                "https://www.appropedia.org/w/images/c/ca/Writing_Sample.pdf",
            },
            {
              type: "input_text",
              text: expect.stringContaining("The user cannot see this text"),
            },
          ],
        },
      ]);

      const userMessageContent = (result[1] as any).content;
      const fileBlock = userMessageContent[1];

      expect(fileBlock.type).toBe("input_file");
      expect(fileBlock.file_url).toBe(
        "https://www.appropedia.org/w/images/c/ca/Writing_Sample.pdf"
      );
      expect(fileBlock.filename).toBeUndefined();
    });
  });

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

  describe("assistant reasoning conversion", () => {
    it("includes reasoning items in ZDR mode when encrypted content is present", () => {
      const message = new AIMessage({
        content: [],
        additional_kwargs: {
          reasoning: {
            id: "reasoning_123",
            type: "reasoning",
            summary: [{ type: "summary_text", text: "Encrypted summary" }],
            encrypted_content: "encrypted_payload",
          },
        },
      });

      const result = convertMessagesToResponsesInput({
        messages: [message],
        zdrEnabled: true,
        model: "gpt-4o",
      });

      expect(result).toEqual([
        {
          id: "reasoning_123",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Encrypted summary" }],
          encrypted_content: "encrypted_payload",
        },
      ]);
    });

    it("uses fast path when response_metadata.output is available", () => {
      const output = [
        {
          type: "reasoning",
          id: "rs_abc123",
          summary: [{ type: "summary_text", text: "Thinking..." }],
        },
        {
          type: "function_call",
          id: "fc_xyz789",
          call_id: "call_123",
          name: "get_weather",
          arguments: '{"city":"NYC"}',
        },
      ];
      const message = new AIMessage({
        content: [],
        tool_calls: [
          { name: "get_weather", args: { city: "NYC" }, id: "call_123" },
        ],
        response_metadata: { output },
      });

      const result = convertMessagesToResponsesInput({
        messages: [message],
        zdrEnabled: false,
        model: "o3-mini",
      });

      // Fast path returns the stored output verbatim
      expect(result).toEqual(output);
    });

    it("round-trips reasoning + tool calls through AIMessage", () => {
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
            summary: [{ type: "summary_text", text: "Thinking..." }],
          },
          {
            type: "function_call",
            id: "fc_xyz789",
            call_id: "call_123",
            name: "get_weather",
            arguments: '{"city":"NYC"}',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      };

      // Convert API response to AIMessage
      const aiMsg = convertResponsesMessageToAIMessage(response as any);

      // Convert AIMessage back to Responses API input
      const input = convertMessagesToResponsesInput({
        messages: [aiMsg],
        zdrEnabled: false,
        model: "o3-mini",
      });

      // Should preserve the full output array including reasoning + function_call pairing
      expect(input).toEqual(response.output);
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

describe("annotation round-trip conversion", () => {
  it("should correctly round-trip url_citation annotations through AIMessage conversion", () => {
    // Simulate an OpenAI response with url_citation annotations
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
          content: [
            {
              type: "output_text",
              text: "Here is the information you requested.",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.com/article",
                  title: "Example Article",
                  start_index: 0,
                  end_index: 38,
                },
              ],
            },
          ],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    };

    // Step 1: Convert OpenAI response -> LangChain AIMessage
    const aiMessage = convertResponsesMessageToAIMessage(response as any);

    // Verify annotations were converted to LangChain format
    const contentArray = aiMessage.content as ContentBlock.Text[];
    expect(contentArray[0].annotations).toEqual([
      {
        type: "citation",
        source: "url_citation",
        url: "https://example.com/article",
        title: "Example Article",
        startIndex: 0,
        endIndex: 38,
      },
    ]);

    // Step 2: Convert LangChain AIMessage -> OpenAI Responses input (multi-turn)
    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    // Find the message item
    const messageItem = result.find((item) => item.type === "message") as any;
    expect(messageItem).toBeDefined();

    // Verify annotations are correctly converted back to OpenAI format
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock).toBeDefined();
    expect(outputTextBlock.annotations).toEqual([
      {
        type: "url_citation",
        url: "https://example.com/article",
        title: "Example Article",
        start_index: 0,
        end_index: 38,
      },
    ]);
  });

  it("should correctly round-trip file_citation annotations", () => {
    const response = {
      id: "resp_456",
      model: "gpt-4o",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg_456",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "From the uploaded document.",
              annotations: [
                {
                  type: "file_citation",
                  file_id: "file-abc123",
                  filename: "report.pdf",
                  index: 5,
                },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const aiMessage = convertResponsesMessageToAIMessage(response as any);
    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    const messageItem = result.find((item) => item.type === "message") as any;
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock.annotations).toEqual([
      {
        type: "file_citation",
        file_id: "file-abc123",
        filename: "report.pdf",
        index: 5,
      },
    ]);
  });

  it("should correctly round-trip container_file_citation annotations", () => {
    const response = {
      id: "resp_789",
      model: "gpt-4o",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg_789",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "From the container file.",
              annotations: [
                {
                  type: "container_file_citation",
                  file_id: "file-def456",
                  filename: "data.csv",
                  container_id: "container-xyz",
                  start_index: 0,
                  end_index: 24,
                },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const aiMessage = convertResponsesMessageToAIMessage(response as any);
    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    const messageItem = result.find((item) => item.type === "message") as any;
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock.annotations).toEqual([
      {
        type: "container_file_citation",
        file_id: "file-def456",
        filename: "data.csv",
        container_id: "container-xyz",
        start_index: 0,
        end_index: 24,
      },
    ]);
  });

  it("should correctly round-trip file_path annotations", () => {
    const response = {
      id: "resp_101",
      model: "gpt-4o",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg_101",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "Here is the file output.",
              annotations: [
                {
                  type: "file_path",
                  file_id: "file-ghi789",
                  index: 10,
                },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const aiMessage = convertResponsesMessageToAIMessage(response as any);
    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    const messageItem = result.find((item) => item.type === "message") as any;
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock.annotations).toEqual([
      {
        type: "file_path",
        file_id: "file-ghi789",
        index: 10,
      },
    ]);
  });

  it("should pass through annotations already in OpenAI format", () => {
    // AIMessage with annotations already in OpenAI format (e.g., from output_text block passthrough)
    const aiMessage = new AIMessage({
      content: [
        {
          type: "text",
          text: "Citation text",
          annotations: [
            {
              type: "url_citation",
              url: "https://example.com",
              title: "Example",
              start_index: 0,
              end_index: 13,
            },
          ],
        },
      ],
    });

    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    const messageItem = result.find((item) => item.type === "message") as any;
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock.annotations).toEqual([
      {
        type: "url_citation",
        url: "https://example.com",
        title: "Example",
        start_index: 0,
        end_index: 13,
      },
    ]);
  });

  it("should handle empty annotations array", () => {
    const aiMessage = new AIMessage({
      content: [
        {
          type: "text",
          text: "No citations here.",
          annotations: [],
        },
      ],
    });

    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    const messageItem = result.find((item) => item.type === "message") as any;
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock.annotations).toEqual([]);
  });

  it("should handle multiple annotations of different types in one text block", () => {
    const response = {
      id: "resp_multi",
      model: "gpt-4o",
      created_at: 1234567890,
      object: "response",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg_multi",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "Multiple sources cited here.",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.com/page1",
                  title: "Page 1",
                  start_index: 0,
                  end_index: 10,
                },
                {
                  type: "url_citation",
                  url: "https://example.com/page2",
                  title: "Page 2",
                  start_index: 11,
                  end_index: 27,
                },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const aiMessage = convertResponsesMessageToAIMessage(response as any);
    const result = convertMessagesToResponsesInput({
      messages: [aiMessage],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    const messageItem = result.find((item) => item.type === "message") as any;
    const outputTextBlock = messageItem.content.find(
      (c: any) => c.type === "output_text"
    );
    expect(outputTextBlock.annotations).toHaveLength(2);
    expect(outputTextBlock.annotations[0]).toEqual({
      type: "url_citation",
      url: "https://example.com/page1",
      title: "Page 1",
      start_index: 0,
      end_index: 10,
    });
    expect(outputTextBlock.annotations[1]).toEqual({
      type: "url_citation",
      url: "https://example.com/page2",
      title: "Page 2",
      start_index: 11,
      end_index: 27,
    });
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

describe("Anthropic cross-provider compatibility", () => {
  it("should drop tool_use blocks from assistant content in convertMessagesToResponsesInput", () => {
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

    const result = convertMessagesToResponsesInput({
      messages: [message],
      zdrEnabled: false,
      model: "gpt-4o",
    });

    // Should have a message item + a function_call item
    const messageItem = result.find((r: any) => r.type === "message") as any;
    const fnCallItem = result.find(
      (r: any) => r.type === "function_call"
    ) as any;

    expect(messageItem).toBeDefined();
    expect(fnCallItem).toBeDefined();

    // The message content should only have the text, no tool_use
    if (typeof messageItem.content !== "string") {
      expect(messageItem.content.some((c: any) => c.type === "tool_use")).toBe(
        false
      );
      expect(messageItem.content).toHaveLength(1);
      expect(messageItem.content[0].type).toBe("output_text");
      expect(messageItem.content[0].text).toBe("I will search for that.");
    }

    // function_call should be present
    expect(fnCallItem.name).toBe("get_weather");
    expect(fnCallItem.call_id).toBe("toolu_abc123");
  });
});
