import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";

describe("openaiTranslator", () => {
  describe("Chat Completions", () => {
    it("should translate string content and tool calls to v1 content blocks", () => {
      const message = new AIMessage({
        content: "Hello from OpenAI",
        tool_calls: [
          {
            id: "call_123",
            name: "get_weather",
            args: { location: "San Francisco" },
          },
        ],
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Hello from OpenAI" },
        {
          type: "tool_call",
          id: "call_123",
          name: "get_weather",
          args: { location: "San Francisco" },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
      expect(message.content).not.toEqual(expected);

      const message2 = new AIMessage({
        content: message.contentBlocks,
        response_metadata: { output_version: "v1" },
      });
      expect(message2.contentBlocks).toEqual(expected);
      expect(message2.content).toEqual(expected);
    });

    it("should translate chat completions chunk with parsed tool call chunks", () => {
      const chunks = [
        new AIMessageChunk({
          content: [{ type: "text", text: "Looking ", index: 0 }],
          response_metadata: { model_provider: "openai" },
        }),
        new AIMessageChunk({
          content: [{ type: "text", text: "up.", index: 0 }],
          tool_call_chunks: [
            {
              type: "tool_call_chunk",
              id: "call_abc",
              name: "search",
              args: '{"query":"weather"}',
              index: 0,
            },
          ],
          response_metadata: { model_provider: "openai" },
        }),
      ];

      expect(chunks[0].contentBlocks).toEqual([
        { type: "text", text: "Looking ", index: 0 },
      ]);
      expect(chunks[1].contentBlocks).toEqual([
        { type: "text", text: "up.", index: 0 },
        {
          type: "tool_call",
          id: "call_abc",
          name: "search",
          args: { query: "weather" },
        },
      ]);

      const full = chunks[0].concat(chunks[1]);
      const expectedFull: Array<ContentBlock.Standard> = [
        { type: "text", text: "Looking up.", index: 0 },
        {
          type: "tool_call",
          id: "call_abc",
          name: "search",
          args: { query: "weather" },
        },
      ];
      expect(full.contentBlocks).toEqual(expectedFull);
    });

    it("should not include empty text block when content is empty string with tool calls", () => {
      // When OpenAI returns tool calls without text content, content is often ""
      const message = new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "get_value",
            args: { key: "a" },
          },
          {
            id: "call_456",
            name: "get_value",
            args: { key: "b" },
          },
        ],
        response_metadata: { model_provider: "openai" },
      });

      // Should NOT include empty text block, only tool calls
      const expected: Array<ContentBlock.Standard> = [
        {
          type: "tool_call",
          id: "call_123",
          name: "get_value",
          args: { key: "a" },
        },
        {
          type: "tool_call",
          id: "call_456",
          name: "get_value",
          args: { key: "b" },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should not include empty text block in chunk when content is empty string", () => {
      const chunk = new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            type: "tool_call_chunk",
            id: "call_abc",
            name: "search",
            args: '{"query":"test"}',
            index: 0,
          },
        ],
        response_metadata: { model_provider: "openai" },
      });

      // Should NOT include empty text block, only tool call
      const expected: Array<ContentBlock.Standard> = [
        {
          type: "tool_call",
          id: "call_abc",
          name: "search",
          args: { query: "test" },
        },
      ];

      expect(chunk.contentBlocks).toEqual(expected);
    });
  });

  describe("Responses", () => {
    it("should translate responses message to v1 content blocks", () => {
      const message = new AIMessage({
        content: [
          {
            type: "text",
            text: "Here is a result.",
            annotations: [
              {
                type: "url_citation",
                url: "https://example.com",
                title: "Example",
                start_index: 0,
                end_index: 4,
              },
              {
                type: "file_citation",
                file_id: "file_123",
                filename: "doc.pdf",
                index: 10,
              },
            ],
          },
        ],
        tool_calls: [
          { id: "call_456", name: "summarize", args: { length: "short" } },
        ],
        additional_kwargs: {
          reasoning: { summary: [{ text: "Thinking..." }, { text: " Done." }] },
          tool_outputs: [
            {
              id: "call_456",
              type: "code_interpreter_call",
              code: "print('hello')",
              status: "completed",
              outputs: [{ type: "logs", logs: "hello" }],
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "reasoning", reasoning: "Thinking... Done." },
        {
          type: "text",
          text: "Here is a result.",
          annotations: [
            {
              type: "citation",
              url: "https://example.com",
              title: "Example",
              startIndex: 0,
              endIndex: 4,
            },
            {
              type: "citation",
              title: "doc.pdf",
              startIndex: 10,
              endIndex: 10,
              fileId: "file_123",
            },
          ],
        },
        {
          type: "tool_call",
          id: "call_456",
          name: "summarize",
          args: { length: "short" },
        },
        {
          type: "server_tool_call",
          name: "code_interpreter",
          id: "call_456",
          args: { code: "print('hello')" },
        },
        {
          type: "server_tool_call_result",
          toolCallId: "call_456",
          status: "success",
          output: {
            type: "code_interpreter_output",
            returnCode: 0,
            stderr: undefined,
            stdout: "hello",
          },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
      expect(message.content).not.toEqual(expected);

      const message2 = new AIMessage({
        content: message.contentBlocks,
        response_metadata: { output_version: "v1" },
      });
      expect(message2.contentBlocks).toEqual(expected);
      expect(message2.content).toEqual(expected);
    });

    it("should translate responses chunk and include tool_call when args parse", () => {
      const chunk1 = new AIMessageChunk({
        content: [{ type: "text", text: "Processing ", index: 0 }],
        tool_call_chunks: [
          {
            type: "tool_call_chunk",
            id: "call_1",
            name: "compute",
            args: '{"x":',
            index: 0,
          },
        ],
        response_metadata: { model_provider: "openai" },
      });
      const chunk2 = new AIMessageChunk({
        content: [{ type: "text", text: "now.", index: 0 }],
        tool_call_chunks: [
          { type: "tool_call_chunk", id: "call_1", args: "1}", index: 0 },
        ],
        response_metadata: { model_provider: "openai" },
      });

      const full = chunk1.concat(chunk2);

      const expectedFull: Array<ContentBlock.Standard> = [
        { type: "text", text: "Processing now.", index: 0 },
        {
          type: "tool_call",
          id: "call_1",
          name: "compute",
          args: { x: 1 },
        },
      ];
      expect(full.contentBlocks).toEqual(expectedFull);
    });

    it("should translate image_generation_call to image content block", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Here is your image:" }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "image_generation_call",
              id: "ig_abc123",
              status: "completed",
              result: "base64ImageData",
              revised_prompt: "A beautiful sunset over the ocean",
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Here is your image:" },
        {
          type: "image",
          mimeType: "image/png",
          data: "base64ImageData",
          id: "ig_abc123",
          metadata: {
            status: "completed",
          },
        },
        {
          type: "non_standard",
          value: {
            type: "image_generation_call",
            id: "ig_abc123",
            status: "completed",
            result: "base64ImageData",
            revised_prompt: "A beautiful sunset over the ocean",
          },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should translate web_search_call without action data to server_tool_call with empty args and result", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Here is what I found:" }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              id: "ws_abc123",
              status: "completed",
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Here is what I found:" },
        {
          type: "server_tool_call",
          name: "web_search",
          id: "ws_abc123",
          args: {},
        },
        {
          type: "server_tool_call_result",
          toolCallId: "ws_abc123",
          status: "success",
          output: {},
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should translate web_search_call with action data to server_tool_call with query args", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Here is what I found:" }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              id: "ws_abc456",
              status: "completed",
              action: {
                type: "search",
                query: "melbourne australia news today",
                sources: [{ type: "url", url: "https://example.com/news" }],
              },
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Here is what I found:" },
        {
          type: "server_tool_call",
          name: "web_search",
          id: "ws_abc456",
          args: { query: "melbourne australia news today" },
        },
        {
          type: "server_tool_call_result",
          toolCallId: "ws_abc456",
          status: "success",
          output: {
            action: {
              type: "search",
              query: "melbourne australia news today",
              sources: [{ type: "url", url: "https://example.com/news" }],
            },
          },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should translate multiple web_search_call items to multiple server_tool_call blocks", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Search results:" }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              id: "ws_001",
              status: "completed",
            },
            {
              type: "web_search_call",
              id: "ws_002",
              status: "completed",
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const blocks = message.contentBlocks;
      const serverToolCalls = blocks.filter(
        (b) => b.type === "server_tool_call"
      );
      const serverToolCallResults = blocks.filter(
        (b) => b.type === "server_tool_call_result"
      );

      expect(serverToolCalls).toHaveLength(2);
      expect(serverToolCallResults).toHaveLength(2);
      expect(serverToolCalls[0]).toMatchObject({
        id: "ws_001",
        name: "web_search",
      });
      expect(serverToolCalls[1]).toMatchObject({
        id: "ws_002",
        name: "web_search",
      });
    });

    it("should translate file_search_call to server_tool_call with queries and results", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Found these files:" }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "file_search_call",
              id: "fs_abc123",
              status: "completed",
              queries: ["quarterly report", "revenue 2025"],
              results: [
                {
                  file_id: "file_001",
                  filename: "report.pdf",
                  score: 0.95,
                  text: "Revenue grew 15% in Q3...",
                },
              ],
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Found these files:" },
        {
          type: "server_tool_call",
          name: "file_search",
          id: "fs_abc123",
          args: { queries: ["quarterly report", "revenue 2025"] },
        },
        {
          type: "server_tool_call_result",
          toolCallId: "fs_abc123",
          status: "success",
          output: {
            results: [
              {
                file_id: "file_001",
                filename: "report.pdf",
                score: 0.95,
                text: "Revenue grew 15% in Q3...",
              },
            ],
          },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should translate file_search_call without results to server_tool_call with empty output", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Searching..." }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "file_search_call",
              id: "fs_abc456",
              status: "completed",
              queries: ["test query"],
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const blocks = message.contentBlocks;
      const serverToolCall = blocks.find((b) => b.type === "server_tool_call");
      const serverToolCallResult = blocks.find(
        (b) => b.type === "server_tool_call_result"
      );

      expect(serverToolCall).toEqual({
        type: "server_tool_call",
        name: "file_search",
        id: "fs_abc456",
        args: { queries: ["test query"] },
      });
      expect(serverToolCallResult).toEqual({
        type: "server_tool_call_result",
        toolCallId: "fs_abc456",
        status: "success",
        output: {},
      });
    });

    it("should translate web_search_call with failed status to error result", () => {
      const message = new AIMessage({
        content: [],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              id: "ws_fail",
              status: "failed",
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const blocks = message.contentBlocks;
      const result = blocks.find((b) => b.type === "server_tool_call_result");

      expect(result).toEqual({
        type: "server_tool_call_result",
        toolCallId: "ws_fail",
        status: "error",
        output: {},
      });
    });

    it("should not emit server_tool_call_result for in_progress web_search_call", () => {
      const message = new AIMessage({
        content: [],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              id: "ws_progress",
              status: "in_progress",
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const blocks = message.contentBlocks;
      const serverToolCall = blocks.find((b) => b.type === "server_tool_call");
      const result = blocks.find((b) => b.type === "server_tool_call_result");

      expect(serverToolCall).toBeDefined();
      expect(result).toBeUndefined();
    });

    it("should not add image block when image_generation_call has no result", () => {
      const message = new AIMessage({
        content: [{ type: "text", text: "Generating..." }],
        additional_kwargs: {
          tool_outputs: [
            {
              type: "image_generation_call",
              id: "ig_abc123",
              status: "in_progress",
              result: null,
            },
          ],
        },
        response_metadata: { model_provider: "openai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Generating..." },
        // Only non_standard block, no image block since result is null
        {
          type: "non_standard",
          value: {
            type: "image_generation_call",
            id: "ig_abc123",
            status: "in_progress",
            result: null,
          },
        },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });
  });
});
