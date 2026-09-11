import { describe, test, expect } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import { convertChunksToEvents } from "../compat.js";
import type { ContentBlock } from "../../messages/content/index.js";

function chunkWith(
  content: string | Array<Record<string, unknown>>,
  toolCallChunks: AIMessageChunk["tool_call_chunks"] = []
): ChatGenerationChunk {
  const message = new AIMessageChunk({
    content: content as never,
    tool_call_chunks: toolCallChunks,
  });
  return new ChatGenerationChunk({ message, text: "" });
}

async function collectEvents(
  gen: AsyncGenerator<unknown>
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for await (const ev of gen) out.push(ev as Record<string, unknown>);
  return out;
}

describe("convertChunksToEvents - tool_call index collision (issue #11074)", () => {
  test("text + tool_call do not share block index 0", async () => {
    // Provider tool-call index is scoped to the tool-call list, so a
    // tool_call with `index: 0` must not collide with the text block
    // (which also implicitly sits at index 0).
    const chunks = [
      chunkWith("I will call a tool", [
        { index: 0, id: "call_1", name: "eval", args: '{"code"' },
      ]),
      chunkWith("", [
        { index: 0, args: ':"new Date()"}' },
      ]),
    ];

    const events = await collectEvents(
      convertChunksToEvents((async function* () {
        for (const c of chunks) yield c;
      })())
    );

    const blockStarts = events
      .filter((e) => e.event === "content-block-start")
      .map((e) => ({ index: e.index, type: (e.content as ContentBlock).type }));

    // Two distinct blocks: text (no provider index) and tool_call
    // (provider index 0). They must not share an event index.
    expect(blockStarts).toHaveLength(2);
    expect(new Set(blockStarts.map((b) => b.index)).size).toBe(2);
    expect(blockStarts.find((b) => b.type === "text")).toBeDefined();
    expect(
      blockStarts.find((b) => b.type === "tool_call_chunk")
    ).toBeDefined();

    // The accumulated tool_call args should still parse to the full JSON.
    const toolFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        ((e.content as ContentBlock).type === "tool_call" ||
          (e.content as ContentBlock).type === "invalid_tool_call")
    );
    expect(toolFinish).toBeDefined();
    expect((toolFinish!.content as ContentBlock.Tools.ToolCall).args).toEqual({
      code: "new Date()",
    });
  });

  test("two parallel tool_calls get distinct block indices", async () => {
    // A second tool_call (provider index 1) must get its own block —
    // no collision with the first tool_call (provider index 0).
    const chunks = [
      chunkWith("", [{ index: 0, id: "call_a", name: "fn_a", args: "{}" }]),
      chunkWith("", [{ index: 1, id: "call_b", name: "fn_b", args: "{}" }]),
    ];

    const events = await collectEvents(
      convertChunksToEvents((async function* () {
        for (const c of chunks) yield c;
      })())
    );

    const toolStarts = events
      .filter(
        (e) =>
          e.event === "content-block-start" &&
          (e.content as ContentBlock).type === "tool_call_chunk"
      )
      .map((e) => e.index);

    expect(toolStarts).toHaveLength(2);
    expect(new Set(toolStarts).size).toBe(2);
  });

  test("single tool_call with index 0 still works", async () => {
    // Regression guard: the original happy path (only one tool_call)
    // continues to produce a single tool_call block.
    const chunks = [
      chunkWith("", [{ index: 0, id: "call_x", name: "fn_x", args: '{"a":1}' }]),
    ];

    const events = await collectEvents(
      convertChunksToEvents((async function* () {
        for (const c of chunks) yield c;
      })())
    );

    const toolStarts = events.filter(
      (e) =>
        e.event === "content-block-start" &&
        (e.content as ContentBlock).type === "tool_call_chunk"
    );
    expect(toolStarts).toHaveLength(1);
  });
});