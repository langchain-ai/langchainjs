/**
 * Golden streamv2 output for `ChatAnthropic` + `tools.webSearch_20250305` lives in
 * `fixtures/streamv2-web-search-expected.ndjson` (one JSON event per line).
 *
 * The mock stream replays the Anthropic Messages API shape that produced that
 * capture. We assert a strict prefix (server tool JSON streaming, tool result,
 * first text block) so fragment strings stay tied to the fixture. Replaying the
 * full 59-line golden would require encoding the entire raw stream (citations,
 * `non_standard` blocks, etc.); extend `buildWebSearchGoldenPrefixRawStream` if
 * you add a recorded raw-event fixture.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import type { ChatModelStreamv2Event } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "../chat_models.js";
import { tools } from "../tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadExpectedNdjson(): ChatModelStreamv2Event[] {
  const text = readFileSync(
    join(__dirname, "fixtures/streamv2-web-search-expected.ndjson"),
    "utf8"
  );
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatModelStreamv2Event);
}

/**
 * Replays the Anthropic Messages API stream that produced the golden
 * `streamv2-web-search-expected.ndjson` capture (prefix: server tool + first
 * text deltas). Fragment strings are taken from the golden file so the test
 * stays aligned with the fixture.
 */
function* buildWebSearchGoldenPrefixRawStream(
  expected: ChatModelStreamv2Event[]
): Generator<Record<string, unknown>> {
  const meta = expected[0];
  if (meta.event !== "message-start") {
    throw new Error("Expected first event to be message-start");
  }
  const startCb = expected[1];
  if (startCb.event !== "content-block-start") {
    throw new Error("Expected second event to be content-block-start");
  }
  const toolChunk = startCb.contentBlock as {
    type: string;
    id: string;
    name: string;
  };
  if (toolChunk.type !== "server_tool_call_chunk") {
    throw new Error("Expected server_tool_call_chunk at index 1");
  }

  yield {
    type: "message_start",
    message: {
      id: meta.messageId,
      type: "message",
      role: "assistant",
      content: [],
      model: meta.metadata?.model,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 0,
      },
    },
  };

  yield {
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "server_tool_use",
      id: toolChunk.id,
      name: toolChunk.name,
      input: {},
    },
  };

  for (let i = 2; i <= 8; i += 1) {
    const ev = expected[i];
    if (ev.event !== "content-block-delta") {
      throw new Error(`Expected content-block-delta at index ${i}`);
    }
    const cb = ev.contentBlock as { args: string };
    yield {
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "input_json_delta",
        partial_json: cb.args,
      },
    };
  }

  yield {
    type: "content_block_stop",
    index: 0,
  };

  const resultEv = expected[10];
  if (resultEv.event !== "content-block-delta") {
    throw new Error("Expected server_tool_call_result delta at index 10");
  }
  const resultCb = resultEv.contentBlock as {
    type: string;
    toolCallId: string;
    output: { urls: string[] };
  };
  const urls = resultCb.output.urls;
  yield {
    type: "content_block_start",
    index: 1,
    content_block: {
      type: "web_search_tool_result",
      tool_use_id: resultCb.toolCallId,
      content: urls.map((url) => ({
        type: "web_search_result",
        url,
        title: url,
      })),
    },
  };

  yield {
    type: "content_block_stop",
    index: 1,
  };

  const textStart = expected[11];
  if (textStart.event !== "content-block-start") {
    throw new Error("Expected text content-block-start at index 11");
  }
  const textStartCb = textStart.contentBlock as {
    type: string;
    text: string;
    index: number;
  };
  yield {
    type: "content_block_start",
    index: textStartCb.index,
    content_block: {
      type: "text",
      text: textStartCb.text ?? "",
    },
  };

  const textBased = expected[13];
  if (textBased.event !== "content-block-delta") {
    throw new Error("Expected text delta at index 13");
  }
  const textBasedCb = textBased.contentBlock as {
    type: string;
    text: string;
    index: number;
  };
  yield {
    type: "content_block_delta",
    index: textBasedCb.index,
    delta: {
      type: "text_delta",
      text: textBasedCb.text,
    },
  };

  yield {
    type: "message_delta",
    delta: {
      stop_reason: "end_turn",
      stop_sequence: null,
    },
    usage: {
      input_tokens: 100,
      output_tokens: 10,
    },
  };
}

class TestChatAnthropic extends ChatAnthropic {
  testStream?: AsyncIterable<unknown>;

  protected override async createStreamWithRetry() {
    if (!this.testStream) {
      throw new Error("No test stream configured.");
    }
    return this.testStream as never;
  }
}

test("streamv2-web-search-expected.ndjson parses as one JSON object per line", () => {
  const events = loadExpectedNdjson();
  expect(events.length).toBe(59);
  expect(events[0].event).toBe("message-start");
  const last = events[events.length - 1];
  expect(last.event).toBe("message-finish");
});

test("streamv2 with web search tool matches golden NDJSON prefix (server tool + first text)", async () => {
  const expected = loadExpectedNdjson();
  const PREFIX_LEN = 14;

  const model = new TestChatAnthropic({
    modelName: "claude-sonnet-4-5-20250929",
    anthropicApiKey: "testing",
    temperature: 0,
    tools: [tools.webSearch_20250305({ maxUses: 5 })],
  });

  model.testStream = (async function* () {
    yield* buildWebSearchGoldenPrefixRawStream(expected);
  })();

  const stream = await model.streamv2(
    "What are three notable headlines in tech news from the last few days?"
  );
  const actual: ChatModelStreamv2Event[] = [];
  for await (const event of stream) {
    actual.push(event);
  }

  expect(actual.slice(0, PREFIX_LEN)).toEqual(expected.slice(0, PREFIX_LEN));
});
