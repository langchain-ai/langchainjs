import { describe, expect, it } from "vitest";
import { AIMessageChunk } from "../ai.js";
import { ToolCallChunk } from "../tool.js";

/**
 * Wraps a tool call chunk array so element accesses are counted. Collapsing
 * tool call chunks iterates the array, so element reads reveal whether the
 * constructor collapsed eagerly or deferred until `tool_calls` was read.
 */
function countElementReads(chunks: ToolCallChunk[]): {
  proxied: ToolCallChunk[];
  reads: () => number;
} {
  let reads = 0;
  const proxied = new Proxy(chunks, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        reads += 1;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { proxied, reads: () => reads };
}

describe("AIMessageChunk lazy tool call collapsing", () => {
  it("does not collapse tool call chunks until tool_calls is read", () => {
    const { proxied, reads } = countElementReads([
      {
        type: "tool_call_chunk",
        id: "call_1",
        name: "get_weather",
        args: '{"location": "San Francisco"}',
        index: 0,
      },
    ]);

    // Constructing a chunk (which happens once per streamed delta via
    // `concat`) must not collapse: collapsing re-parses all accumulated tool
    // args and would make stream aggregation O(n²).
    const chunk = new AIMessageChunk({
      content: "",
      tool_call_chunks: proxied,
    });
    expect(reads()).toBe(0);

    // Reading tool_calls collapses and returns the parsed tool call.
    expect(chunk.tool_calls).toEqual([
      {
        type: "tool_call",
        id: "call_1",
        name: "get_weather",
        args: { location: "San Francisco" },
      },
    ]);
    expect(chunk.invalid_tool_calls).toEqual([]);
    expect(reads()).toBeGreaterThan(0);
  });

  it("aggregates streamed tool call deltas correctly", () => {
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
    expect(aggregated.tool_calls).toEqual([
      {
        type: "tool_call",
        id: "call_1",
        name: "get_weather",
        args: { location: "San Francisco", days: 3 },
      },
    ]);
    expect(aggregated.invalid_tool_calls).toEqual([]);
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
