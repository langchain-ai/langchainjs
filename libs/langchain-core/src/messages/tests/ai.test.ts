import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../ai.js";
import { ToolCallChunk } from "../tool.js";

describe("AIMessage", () => {
  it("can be constructed with tool calls", () => {
    const message = new AIMessage({
      content: "Hello, world!",
      tool_calls: [
        {
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ],
    });
    expect(message.content).toEqual("Hello, world!");
    expect(message.tool_calls).toEqual([
      {
        id: "123",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
      },
    ]);
  });

  it("should contain tool call content blocks when output version is v1", () => {
    const message = new AIMessage({
      content: [
        {
          type: "tool_call",
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ],
      response_metadata: {
        output_version: "v1",
      },
    });
    expect(message.contentBlocks).toEqual([
      {
        type: "tool_call",
        id: "123",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
      },
    ]);
    expect(message.tool_calls).toEqual([
      {
        type: "tool_call",
        id: "123",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
      },
    ]);
  });

  describe(".contentBlocks", () => {
    it("should have tool call content blocks from .tool_calls", () => {
      const message = new AIMessage({
        content: "Hello, world!",
        tool_calls: [
          {
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
      });
      expect(message.contentBlocks).toEqual([
        {
          type: "text",
          text: "Hello, world!",
        },
        {
          type: "tool_call",
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ]);
    });

    it("should include tool calls not included in constructor content blocks", () => {
      const message = new AIMessage({
        contentBlocks: [
          {
            type: "reasoning",
            reasoning: "foo",
          },
          {
            type: "text",
            text: "bar",
          },
          {
            type: "text",
            text: "baz",
            annotations: [
              {
                type: "citation",
                url: "https://example.com",
              },
            ],
          },
          {
            type: "tool_call",
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
        tool_calls: [
          {
            type: "tool_call",
            id: "456",
            // tool call thats included in contentBlocks but not in tool_calls
            name: "missing",
            args: {},
          },
        ],
      });
      expect(message.contentBlocks).toEqual(
        expect.arrayContaining([
          {
            type: "reasoning",
            reasoning: "foo",
          },
          {
            type: "text",
            text: "bar",
          },
          {
            type: "text",
            text: "baz",
            annotations: [
              {
                type: "citation",
                url: "https://example.com",
              },
            ],
          },
          {
            type: "tool_call",
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
          {
            type: "tool_call",
            id: "456",
            name: "missing",
            args: {},
          },
        ])
      );
    });

    it("should populate .tool_calls from content blocks", () => {
      const message = new AIMessage({
        contentBlocks: [
          {
            type: "tool_call",
            id: "123",
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
      });
      expect(message.tool_calls).toEqual([
        {
          type: "tool_call",
          id: "123",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ]);
    });
  });
});

describe("AIMessageChunk", () => {
  describe("constructor", () => {
    it("omits tool call chunks without IDs", () => {
      const chunks: ToolCallChunk[] = [
        {
          name: "get_current_time",
          type: "tool_call_chunk",
          index: 0,
          // no `id` provided
        },
      ];

      const result = new AIMessageChunk({
        content: "",
        tool_call_chunks: chunks,
      });

      expect(result.tool_calls?.length).toBe(0);
      expect(result.invalid_tool_calls?.length).toBe(1);
      expect(result.invalid_tool_calls).toEqual([
        {
          type: "invalid_tool_call",
          id: undefined,
          name: "get_current_time",
          args: "{}",
          error: "Malformed args.",
        },
      ]);
    });

    it("omits tool call chunks without IDs and no index", () => {
      const chunks: ToolCallChunk[] = [
        {
          name: "get_current_time",
          type: "tool_call_chunk",
          // no `id` or `index` provided
        },
      ];

      const result = new AIMessageChunk({
        content: "",
        tool_call_chunks: chunks,
      });

      expect(result.tool_calls?.length).toBe(0);
      expect(result.invalid_tool_calls?.length).toBe(1);
      expect(result.invalid_tool_calls).toEqual([
        {
          type: "invalid_tool_call",
          id: undefined,
          name: "get_current_time",
          args: "{}",
          error: "Malformed args.",
        },
      ]);
    });

    it("can concatenate tool call chunks without IDs", () => {
      const chunk = new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            name: "get_weather",
            args: "",
            id: "call_q6ZzjkLjKNYb4DizyMOaqpfW",
            index: 0,
            type: "tool_call_chunk",
          },
          {
            args: '{"',
            index: 0,
            type: "tool_call_chunk",
          },
          {
            args: "location",
            index: 0,
            type: "tool_call_chunk",
          },
          {
            args: '":"',
            index: 0,
            type: "tool_call_chunk",
          },
          {
            args: "San",
            index: 0,
            type: "tool_call_chunk",
          },
          {
            args: " Francisco",
            index: 0,
            type: "tool_call_chunk",
          },
          {
            args: '"}',
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      });
      expect(chunk.tool_calls).toHaveLength(1);
      expect(chunk.tool_calls).toEqual([
        {
          type: "tool_call",
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
          id: "call_q6ZzjkLjKNYb4DizyMOaqpfW",
        },
      ]);
    });

    it("can be constructed with tool calls using basic params", () => {
      const chunk = new AIMessageChunk({
        tool_calls: [
          {
            name: "get_weather",
            args: {
              location: "San Francisco",
            },
          },
        ],
        invalid_tool_calls: [],
        tool_call_chunks: [],
        additional_kwargs: {},
        response_metadata: {},
      });
      expect(chunk.tool_calls).toHaveLength(1);
      expect(chunk.tool_calls).toEqual([
        {
          name: "get_weather",
          args: {
            location: "San Francisco",
          },
        },
      ]);
    });
  });

  it("should properly merge tool call chunks that have matching indices and ids", () => {
    const chunk1 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_new_task",
          args: '{"tasks":["buy tomatoes","help child with math"]}',
          type: "tool_call_chunk",
          index: 0,
          id: "9fb5c937-6944-4173-84be-ad1caee1cedd",
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_ideas",
          args: '{"ideas":["read about Angular 19 updates"]}',
          type: "tool_call_chunk",
          index: 0,
          id: "5abf542e-87f3-4899-87c6-8f7d9cb6a28d",
        },
      ],
    });

    const merged = chunk1.concat(chunk2);
    expect(merged.tool_call_chunks).toHaveLength(2);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("add_new_task");
    expect(firstCall?.args).toBe(
      '{"tasks":["buy tomatoes","help child with math"]}'
    );
    expect(firstCall?.id).toBe("9fb5c937-6944-4173-84be-ad1caee1cedd");

    const secondCall = merged.tool_call_chunks?.[1];
    expect(secondCall?.name).toBe("add_ideas");
    expect(secondCall?.args).toBe(
      '{"ideas":["read about Angular 19 updates"]}'
    );
    expect(secondCall?.id).toBe("5abf542e-87f3-4899-87c6-8f7d9cb6a28d");

    expect(merged.tool_calls).toHaveLength(2);
    expect(merged.tool_calls).toEqual([
      {
        id: "9fb5c937-6944-4173-84be-ad1caee1cedd",
        type: "tool_call",
        name: "add_new_task",
        args: {
          tasks: ["buy tomatoes", "help child with math"],
        },
      },
      {
        id: "5abf542e-87f3-4899-87c6-8f7d9cb6a28d",
        type: "tool_call",
        name: "add_ideas",
        args: {
          ideas: ["read about Angular 19 updates"],
        },
      },
    ]);
  });

  it("should properly merge tool call chunks that have matching indices and at least one id is blank", () => {
    const chunk1 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_new_task",
          type: "tool_call_chunk",
          index: 0,
          id: "9fb5c937-6944-4173-84be-ad1caee1cedd",
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          args: '{"tasks":["buy tomatoes","help child with math"]}',
          type: "tool_call_chunk",
          index: 0,
        },
      ],
    });

    const merged = chunk1.concat(chunk2);
    expect(merged.tool_call_chunks).toHaveLength(1);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("add_new_task");
    expect(firstCall?.args).toBe(
      '{"tasks":["buy tomatoes","help child with math"]}'
    );
    expect(firstCall?.id).toBe("9fb5c937-6944-4173-84be-ad1caee1cedd");

    expect(merged.tool_calls).toHaveLength(1);
    expect(merged.tool_calls).toEqual([
      {
        type: "tool_call",
        name: "add_new_task",
        args: {
          tasks: ["buy tomatoes", "help child with math"],
        },
        id: "9fb5c937-6944-4173-84be-ad1caee1cedd",
      },
    ]);
  });

  // https://github.com/langchain-ai/langchainjs/issues/9450
  it("should properly concat a string of old completions-style tool call chunks", () => {
    const chunk1 = new AIMessageChunk({
      tool_call_chunks: [
        {
          name: "get_weather",
          args: "",
          id: "call_7171a25538d44feea5155a",
          index: 0,
          type: "tool_call_chunk",
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      tool_call_chunks: [
        {
          name: undefined,
          args: '{"city": "',
          id: "",
          index: 0,
          type: "tool_call_chunk",
        },
      ],
    });
    const chunk3 = new AIMessageChunk({
      tool_call_chunks: [
        {
          name: undefined,
          args: 'sf"}',
          id: "",
          index: 0,
          type: "tool_call_chunk",
        },
      ],
    });

    const merged = chunk1.concat(chunk2).concat(chunk3);
    expect(merged.tool_call_chunks).toHaveLength(1);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("get_weather");
    expect(firstCall?.args).toBe('{"city": "sf"}');
    expect(firstCall?.id).toBe("call_7171a25538d44feea5155a");

    expect(merged.tool_calls).toHaveLength(1);
    expect(merged.tool_calls).toEqual([
      {
        type: "tool_call",
        name: "get_weather",
        args: {
          city: "sf",
        },
        id: "call_7171a25538d44feea5155a",
      },
    ]);
  });

  it("should properly merge tool call chunks that have matching indices no IDs at all", () => {
    const chunk1 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_new_task",
          type: "tool_call_chunk",
          index: 0,
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          args: '{"tasks":["buy tomatoes","help child with math"]}',
          type: "tool_call_chunk",
          index: 0,
        },
      ],
    });

    const merged = chunk1.concat(chunk2);
    expect(merged.tool_call_chunks).toHaveLength(1);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("add_new_task");
    expect(firstCall?.args).toBe(
      '{"tasks":["buy tomatoes","help child with math"]}'
    );
    expect(firstCall?.id).toBeUndefined();
  });

  it("should properly merge server tool call chunks", () => {
    const chunk1 = new AIMessageChunk({
      content: [
        {
          type: "server_tool_call_chunk",
          index: 0,
          name: "foo",
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: [
        {
          type: "server_tool_call_chunk",
          index: 0,
          args: '{"a',
        },
      ],
    });
    const chunk3 = new AIMessageChunk({
      content: [
        {
          type: "server_tool_call_chunk",
          index: 0,
          args: '": 1}',
        },
      ],
    });

    const merged = chunk1.concat(chunk2).concat(chunk3);
    expect(merged.content).toEqual([
      {
        type: "server_tool_call_chunk",
        index: 0,
        name: "foo",
        args: '{"a": 1}',
      },
    ]);
  });
});
