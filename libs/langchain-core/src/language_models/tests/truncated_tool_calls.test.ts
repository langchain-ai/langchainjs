import { describe, expect, test } from "vitest";
import { BaseChatModel } from "../chat_models.js";
import { BaseCallbackHandler } from "../../callbacks/base.js";
import { AIMessageChunk, type BaseMessage } from "../../messages/index.js";
import { collapseToolCallChunks } from "../../messages/utils.js";
import { ChatGenerationChunk, type ChatResult } from "../../outputs.js";

// A tool call whose arguments were cut off when the stream ended
// (output limit reached, or the connection closed mid-arguments).
const TRUNCATED = ['{"path": "notes.txt", ', '"content": "line1\\nli'];
const COMPLETE = ['{"path": "notes.txt", ', '"content": "line1\\nline2"}'];

function chunksFor(argParts: string[]): ChatGenerationChunk[] {
  return argParts.map(
    (args, i) =>
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              name: i === 0 ? "write_file" : undefined,
              id: i === 0 ? "call_1" : undefined,
              index: 0,
              args,
              type: "tool_call_chunk",
            },
          ],
        }),
      })
  );
}

/** Streams the given argument parts; aggregation is done by BaseChatModel. */
class StreamingFake extends BaseChatModel {
  constructor(private argParts: string[]) {
    super({});
  }

  _llmType() {
    return "streaming-fake";
  }

  async _generate(): Promise<ChatResult> {
    throw new Error("not used");
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[]
  ): AsyncGenerator<ChatGenerationChunk> {
    for (const chunk of chunksFor(this.argParts)) yield chunk;
  }
}

/** Streams inside _generate and concatenates the chunks itself,
 * the way a provider with `streaming: true` does. */
class SelfAggregatingFake extends BaseChatModel {
  constructor(private argParts: string[]) {
    super({});
  }

  _llmType() {
    return "self-aggregating-fake";
  }

  async _generate(): Promise<ChatResult> {
    let final: ChatGenerationChunk | undefined;
    for (const chunk of chunksFor(this.argParts)) {
      final = final ? final.concat(chunk) : chunk;
    }
    return { generations: final ? [final] : [] };
  }
}

/** Makes invoke() stream through BaseChatModel, as streamEvents/LangGraph do. */
class PrefersStreaming extends BaseCallbackHandler {
  name = "prefers-streaming";

  lc_prefer_streaming = true;
}

const streamingHandler = [new PrefersStreaming()];

describe("tool calls from a stream that ended mid-arguments", () => {
  test("core stream aggregation: truncated args are invalid", async () => {
    const msg = (await new StreamingFake(TRUNCATED).invoke("hi", {
      callbacks: streamingHandler,
    })) as AIMessageChunk;
    expect(msg.tool_calls).toEqual([]);
    expect(msg.invalid_tool_calls).toHaveLength(1);
    expect(msg.invalid_tool_calls?.[0]).toMatchObject({
      name: "write_file",
      id: "call_1",
      args: TRUNCATED.join(""),
    });
  });

  test("provider aggregation in _generate: truncated args are invalid", async () => {
    const msg = (await new SelfAggregatingFake(TRUNCATED).invoke(
      "hi"
    )) as AIMessageChunk;
    expect(msg.tool_calls).toEqual([]);
    expect(msg.invalid_tool_calls?.[0]).toMatchObject({
      id: "call_1",
      args: TRUNCATED.join(""),
    });
  });

  test("complete args still produce a tool call on both paths", async () => {
    const expected = { path: "notes.txt", content: "line1\nline2" };
    const viaCore = (await new StreamingFake(COMPLETE).invoke("hi", {
      callbacks: streamingHandler,
    })) as AIMessageChunk;
    const viaProvider = (await new SelfAggregatingFake(COMPLETE).invoke(
      "hi"
    )) as AIMessageChunk;
    for (const msg of [viaCore, viaProvider]) {
      expect(msg.invalid_tool_calls).toEqual([]);
      expect(msg.tool_calls).toEqual([
        { name: "write_file", args: expected, id: "call_1", type: "tool_call" },
      ]);
    }
  });

  test("chunks seen while streaming keep the lenient parse", async () => {
    const seen: AIMessageChunk[] = [];
    let full: AIMessageChunk | undefined;
    for await (const chunk of await new StreamingFake(TRUNCATED).stream("hi")) {
      seen.push(chunk);
      full = full ? (full.concat(chunk) as AIMessageChunk) : chunk;
    }
    expect(seen).toHaveLength(2);
    // Mid-stream, partial arguments stay visible for progressive rendering.
    expect(full?.tool_calls?.[0]?.args).toEqual({
      path: "notes.txt",
      content: "line1\nli",
    });
  });
});

describe("collapseToolCallChunks({ final })", () => {
  const chunks = chunksFor(TRUNCATED).map(
    (c) => (c.message as AIMessageChunk).tool_call_chunks![0]
  );

  test("default (in flight) heals partial JSON", () => {
    const out = collapseToolCallChunks(chunks);
    expect(out.tool_calls).toHaveLength(1);
    expect(out.invalid_tool_calls).toEqual([]);
  });

  test("final: truncated JSON is an invalid tool call with raw args", () => {
    const out = collapseToolCallChunks(chunks, { final: true });
    expect(out.tool_calls).toEqual([]);
    expect(out.invalid_tool_calls).toEqual([
      {
        name: "write_file",
        args: TRUNCATED.join(""),
        id: "call_1",
        error: "Malformed args.",
        type: "invalid_tool_call",
      },
    ]);
  });

  test("final: empty args still mean {}", () => {
    const out = collapseToolCallChunks(
      [{ name: "ping", id: "c2", index: 0, args: "", type: "tool_call_chunk" }],
      { final: true }
    );
    expect(out.tool_calls).toEqual([
      { name: "ping", args: {}, id: "c2", type: "tool_call" },
    ]);
  });
});
