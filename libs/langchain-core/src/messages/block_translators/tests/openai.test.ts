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
        { type: "code_interpreter_call", code: "print('hello')" },
        {
          type: "code_interpreter_result",
          output: [
            { type: "code_interpreter_output", returnCode: 0, stdout: "hello" },
          ],
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
  });
});
