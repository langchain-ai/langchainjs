import { describe, expect, test } from "vitest";
import {
  AIMessageChunk,
  type AIMessageChunkFields,
} from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import { convertChunksToEvents } from "../compat.js";
import { ChatModelStream } from "../stream.js";
import type { ChatModelStreamEvent } from "../event.js";

function chunk(
  content: AIMessageChunkFields["content"],
  tool_call_chunks: AIMessageChunkFields["tool_call_chunks"] = []
) {
  return new ChatGenerationChunk({
    message: new AIMessageChunk({ content, tool_call_chunks }),
    text: typeof content === "string" ? content : "",
  });
}

async function collect(chunks: ChatGenerationChunk[]) {
  const before = JSON.stringify(chunks);
  const events: ChatModelStreamEvent[] = [];
  async function* source() {
    yield* chunks;
  }
  async function* observed() {
    for await (const event of convertChunksToEvents(source())) {
      events.push(event);
      yield event;
    }
  }
  const message = await new ChatModelStream(observed());
  const starts = events.filter(
    (event) => event.event === "content-block-start"
  );
  expect(new Set(starts.map((event) => event.index)).size).toBe(starts.length);
  expect(JSON.stringify(chunks)).toBe(before);
  return message;
}

const toolStart = () =>
  chunk("", [{ index: 0, id: "call_search", name: "search", args: '{"q":' }]);
const toolEnd = () => chunk("", [{ index: 0, args: '"hello"}' }]);
const expectedTool = {
  type: "tool_call",
  id: "call_search",
  name: "search",
  args: { q: "hello" },
};

describe("convertChunksToEvents block identities", () => {
  test.each(["text first", "tool first"])(
    "preserves string text and fragmented tool arguments: %s",
    async (order) => {
      const text = chunk("Hello");
      const start = toolStart();
      const message = await collect([
        ...(order === "text first" ? [text, start] : [start, text]),
        chunk(" world"),
        toolEnd(),
      ]);
      expect(message.text).toBe("Hello world");
      expect(message.tool_calls).toEqual([expectedTool]);
    }
  );

  test("keeps two reasoning summaries separate from a tool with the same index", async () => {
    const summaries = [
      { type: "reasoning", index: 0, id: "reasoning_a", reasoning: "First" },
      { type: "reasoning", index: 1, id: "reasoning_a", reasoning: "Second" },
    ];
    const message = await collect([
      chunk([summaries[0]]),
      chunk([summaries[1]]),
      chunk("", [
        { index: 1, id: "call_search", name: "search", args: '{"q":"hello"}' },
      ]),
    ]);
    expect(message.content.slice(0, 2)).toEqual(summaries);
    expect(message.tool_calls).toEqual([expectedTool]);
  });

  test.each(["reasoning first", "text first"])(
    "allocates late content independently of a prior tool and other content types: %s",
    async (order) => {
      const reasoning = chunk([
        { type: "reasoning", index: 0, reasoning: "Think" },
      ]);
      const text = chunk([{ type: "text", index: 0, text: "Answer" }]);
      const message = await collect([
        chunk("", [
          {
            index: 5,
            id: "call_search",
            name: "search",
            args: '{"q":"hello"}',
          },
        ]),
        ...(order === "reasoning first"
          ? [reasoning, text]
          : [text, reasoning]),
        chunk([{ type: "reasoning", index: 0, reasoning: " again" }]),
        chunk("!"),
      ]);
      expect(message.text).toBe("Answer!");
      expect(message.content).toContainEqual({
        type: "reasoning",
        index: 0,
        reasoning: "Think again",
      });
      expect(message.tool_calls).toEqual([expectedTool]);
    }
  );

  test("reuses string content indexes across interleaved tools", async () => {
    const message = await collect([
      chunk([{ type: "reasoning", index: "0:0", reasoning: "First" }]),
      toolStart(),
      chunk([{ type: "reasoning", index: "0:1", reasoning: "Second" }]),
      chunk([{ type: "reasoning", index: "0:0", reasoning: " again" }]),
      toolEnd(),
    ]);
    if (!Array.isArray(message.content))
      throw new Error("Expected content blocks");
    expect(
      message.content.filter(
        (block) => typeof block !== "string" && block.type === "reasoning"
      )
    ).toEqual([
      { type: "reasoning", index: "0:0", reasoning: "First again" },
      { type: "reasoning", index: "0:1", reasoning: "Second" },
    ]);
    expect(message.tool_calls).toEqual([expectedTool]);
  });

  test.each(["id", "index"])(
    "links tool aliases when a stream begins with only %s",
    async (first) => {
      const message = await collect([
        chunk("", [
          {
            ...(first === "id" ? { id: "call_search" } : { index: 3 }),
            name: "search",
            args: '{"q":',
          },
        ]),
        chunk("", [{ index: 3, id: "call_search", args: '"hello"' }]),
        chunk("", [
          {
            ...(first === "id" ? { index: 3 } : { id: "call_search" }),
            args: "}",
          },
        ]),
      ]);
      expect(message.tool_calls).toEqual([expectedTool]);
    }
  );

  test("does not join parallel tool calls through empty ID placeholders", async () => {
    const message = await collect([
      chunk("", [
        { index: 0, id: "", name: "first", args: '{"value":' },
        { index: 1, id: "", name: "second", args: '{"value":' },
      ]),
      chunk("", [
        { index: 1, id: "call_second", args: "2}" },
        { index: 0, id: "call_first", args: "1}" },
      ]),
    ]);
    expect(message.tool_calls).toEqual([
      {
        type: "tool_call",
        id: "call_first",
        name: "first",
        args: { value: 1 },
      },
      {
        type: "tool_call",
        id: "call_second",
        name: "second",
        args: { value: 2 },
      },
    ]);
  });

  test("rejects aliases that identify two already-emitted tool blocks", async () => {
    await expect(
      collect([
        chunk("", [
          { index: 0, id: "call_first", name: "first", args: "{}" },
          { index: 1, id: "call_second", name: "second", args: "{}" },
        ]),
        chunk("", [{ index: 0, id: "call_second", args: "" }]),
      ])
    ).rejects.toThrow("Conflicting provider content block identifiers");
  });

  test("keeps anonymous content distinct with sparse tool indexes and invalid arguments", async () => {
    const image = { type: "image", mimeType: "image/png", data: "example" };
    const message = await collect([
      chunk("", [
        { index: 1000000, id: "call_invalid", name: "search", args: "{broken" },
      ]),
      chunk([image, image]),
      chunk([{ type: "text", index: 0, text: "Answer" }]),
    ]);
    expect(message.text).toBe("Answer");
    if (!Array.isArray(message.content))
      throw new Error("Expected content blocks");
    expect(
      message.content.filter(
        (block) => typeof block !== "string" && block.type === "image"
      )
    ).toEqual([image, image]);
    expect(message.tool_calls).toEqual([]);
    expect(message.content).toContainEqual(
      expect.objectContaining({
        type: "invalid_tool_call",
        id: "call_invalid",
        args: "{broken",
      })
    );
  });
});
