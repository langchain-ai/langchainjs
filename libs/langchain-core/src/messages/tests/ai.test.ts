import { afterEach, describe, expect, it, vi } from "vitest";
import { AIMessage, AIMessageChunk } from "../ai.js";
import { ToolCallChunk } from "../tool.js";
import * as json from "../../utils/json.js";

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

  it("should preserve contentBlocks when output version is v1", () => {
    const message = new AIMessage({
      contentBlocks: [{ type: "text", text: "Hi there!" }],
      response_metadata: {
        output_version: "v1",
      },
    });

    expect(message.content).toEqual([{ type: "text", text: "Hi there!" }]);
    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Hi there!" },
    ]);
  });

  it("should coerce string content to text blocks when output version is v1", () => {
    const message = new AIMessage({
      content: "Hi there!",
      response_metadata: {
        output_version: "v1",
      },
    });

    expect(message.content).toEqual([{ type: "text", text: "Hi there!" }]);
    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Hi there!" },
    ]);
  });

  it("should coerce string content and merge tool_calls when output version is v1", () => {
    const message = new AIMessage({
      content: "Hi there!",
      tool_calls: [
        {
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

    expect(message.content).toEqual([
      { type: "text", text: "Hi there!" },
      {
        type: "tool_call",
        id: "123",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
      },
    ]);
    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Hi there!" },
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
  describe("lazy tool call collapsing", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each(["tool_calls", "invalid_tool_calls"] as const)(
      "parses once when %s is read first",
      (firstProperty) => {
        const parse = vi.spyOn(json, "parsePartialJson");
        const chunk = new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              type: "tool_call_chunk",
              id: "call_1",
              name: "get_weather",
              args: '{"location": "San Francisco"}',
              index: 0,
            },
          ],
        });
        expect(parse).not.toHaveBeenCalled();

        // Both properties and lc_kwargs share the cached parse result.
        expect(chunk[firstProperty]).toBeDefined();
        expect(chunk.tool_calls).toEqual([
          {
            type: "tool_call",
            id: "call_1",
            name: "get_weather",
            args: { location: "San Francisco" },
          },
        ]);
        expect(chunk.invalid_tool_calls).toEqual([]);
        expect(chunk.lc_kwargs.tool_calls).toBe(chunk.tool_calls);
        expect(chunk.lc_kwargs.invalid_tool_calls).toBe(
          chunk.invalid_tool_calls
        );
        expect(parse).toHaveBeenCalledTimes(1);
      }
    );

    it("keeps valid tool calls fixed at construction despite input mutations", () => {
      const chunks: ToolCallChunk[] = [
        {
          type: "tool_call_chunk",
          id: "call_1",
          name: "get_weather",
          args: '{"location": "Paris"}',
          index: 0,
        },
      ];
      const chunk = new AIMessageChunk({
        content: "",
        tool_call_chunks: chunks,
      });

      Object.assign(chunks[0], {
        id: "changed",
        name: "changed",
        args: "invalid",
        index: 1,
        isCustomTool: true,
      });
      chunks.splice(0, 1, {
        type: "tool_call_chunk",
        id: "call_2",
        name: "other_tool",
        args: "{}",
        index: 2,
      });
      chunks.push({ id: "call_3", args: "{}", index: 3 });

      expect(chunk.tool_calls).toEqual([
        {
          type: "tool_call",
          id: "call_1",
          name: "get_weather",
          args: { location: "Paris" },
        },
      ]);
      expect(chunk.invalid_tool_calls).toEqual([]);
      expect(JSON.parse(JSON.stringify(chunk)).kwargs.tool_calls).toEqual(
        chunk.tool_calls
      );
    });

    it("keeps invalid tool calls fixed at construction despite input mutations", () => {
      const chunks: ToolCallChunk[] = [
        {
          type: "tool_call_chunk",
          id: "call_1",
          name: "get_weather",
          args: "invalid",
          index: 0,
        },
      ];
      const chunk = new AIMessageChunk({
        content: "",
        tool_call_chunks: chunks,
      });

      Object.assign(chunks[0], {
        id: "changed",
        name: "changed",
        args: '{"location": "Paris"}',
      });
      chunks.length = 0;

      expect(chunk.invalid_tool_calls).toEqual([
        {
          type: "invalid_tool_call",
          id: "call_1",
          name: "get_weather",
          args: "invalid",
          error: "Malformed args.",
        },
      ]);
      expect(chunk.tool_calls).toEqual([]);
    });

    it("exposes parsed tool calls through spread and Object.entries", () => {
      const chunk = new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            id: "call_1",
            name: "get_weather",
            args: '{"location": "Paris"}',
            index: 0,
          },
        ],
      });
      const spread = { ...chunk };
      const entries = Object.fromEntries(Object.entries(chunk));
      const expected = [
        {
          type: "tool_call",
          id: "call_1",
          name: "get_weather",
          args: { location: "Paris" },
        },
      ];
      expect(spread.tool_calls).toEqual(expected);
      expect(entries.tool_calls).toEqual(expected);
      expect(spread.invalid_tool_calls).toEqual([]);
      expect(entries.invalid_tool_calls).toEqual([]);
    });

    it("aggregates streamed tool call deltas correctly", () => {
      const parse = vi.spyOn(json, "parsePartialJson");
      const args = JSON.stringify({ location: "San Francisco", days: 3 });
      const deltas = [
        new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              type: "tool_call_chunk",
              id: "call_1",
              name: "get_weather",
              args: "",
              index: 0,
            },
          ],
        }),
        ...Array.from(
          { length: args.length },
          (_, i) =>
            new AIMessageChunk({
              content: "",
              tool_call_chunks: [
                {
                  type: "tool_call_chunk",
                  args: args.slice(i, i + 1),
                  index: 0,
                },
              ],
            })
        ),
      ];

      const aggregated = deltas.reduce((acc, delta) => acc.concat(delta));
      expect(parse).not.toHaveBeenCalled();
      expect(aggregated.tool_calls).toEqual([
        {
          type: "tool_call",
          id: "call_1",
          name: "get_weather",
          args: { location: "San Francisco", days: 3 },
        },
      ]);
      expect(aggregated.invalid_tool_calls).toEqual([]);
      expect(parse).toHaveBeenCalledTimes(1);
    });

    it("serializes collapsed tool calls", () => {
      const chunk = new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            type: "tool_call_chunk",
            id: "call_1",
            name: "get_weather",
            args: '{"location": "Paris"}',
            index: 0,
          },
        ],
      });

      const serialized = JSON.parse(JSON.stringify(chunk));
      expect(serialized.kwargs.tool_calls).toEqual([
        {
          type: "tool_call",
          id: "call_1",
          name: "get_weather",
          args: { location: "Paris" },
        },
      ]);
      expect(serialized.kwargs.invalid_tool_calls).toEqual([]);
    });

    it("supports assigning tool_calls after construction", () => {
      const chunk = new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            type: "tool_call_chunk",
            id: "call_1",
            name: "get_weather",
            args: '{"location": "Paris"}',
            index: 0,
          },
        ],
      });
      chunk.tool_calls = [
        { type: "tool_call", id: "call_2", name: "other_tool", args: {} },
      ];
      expect(chunk.tool_calls).toEqual([
        { type: "tool_call", id: "call_2", name: "other_tool", args: {} },
      ]);
      // invalid_tool_calls still collapses lazily from the original chunks.
      expect(chunk.invalid_tool_calls).toEqual([]);
    });
  });

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
