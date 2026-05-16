import { test, expect, describe } from "vitest";
import { FakeListChatModel } from "../../utils/testing/index.js";
import { BaseCallbackHandler } from "../../callbacks/base.js";

/**
 * A callback handler that sets lc_prefer_streaming = true,
 * which forces _generateUncached to use the streaming aggregation branch.
 * This mirrors what LangGraph does internally when using createAgent.
 */
class StreamingPreferredHandler extends BaseCallbackHandler {
  name = "streaming_preferred_handler";

  readonly lc_prefer_streaming = true;
}

describe("outputVersion v1 in _generateUncached streaming aggregation branch", () => {
  test("invoke with streaming-preferred handler sets output_version in response_metadata", async () => {
    const model = new FakeListChatModel({
      responses: ["hello world"],
      outputVersion: "v1",
    });

    // Using a streaming-preferred callback handler triggers the streaming
    // aggregation branch inside _generateUncached (the buggy path).
    const result = await model.invoke([{ role: "human", content: "hi" }], {
      callbacks: [new StreamingPreferredHandler()],
    });

    expect(result.response_metadata).toBeDefined();
    expect(result.response_metadata.output_version).toBe("v1");
  });

  test("invoke without streaming-preferred handler sets output_version in response_metadata", async () => {
    const model = new FakeListChatModel({
      responses: ["hello world"],
      outputVersion: "v1",
    });

    // Without the streaming-preferred handler, _generateUncached takes
    // the non-streaming branch (which was already working correctly).
    const result = await model.invoke([{ role: "human", content: "hi" }]);

    expect(result.response_metadata).toBeDefined();
    expect(result.response_metadata.output_version).toBe("v1");
  });

  test("stream iterator sets output_version in response_metadata when v1", async () => {
    const model = new FakeListChatModel({
      responses: ["hello"],
      outputVersion: "v1",
    });

    const chunks = [];
    for await (const chunk of await model.stream([
      { role: "human", content: "hi" },
    ])) {
      chunks.push(chunk);
    }

    // Each streamed chunk should have output_version set
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.response_metadata.output_version).toBe("v1");
    }
  });

  test("output_version is NOT set when outputVersion is default (v0)", async () => {
    const model = new FakeListChatModel({
      responses: ["hello world"],
    });

    const result = await model.invoke([{ role: "human", content: "hi" }], {
      callbacks: [new StreamingPreferredHandler()],
    });

    // With default v0, output_version should not be set
    expect(result.response_metadata?.output_version).toBeUndefined();
  });

  test("streamEvents stream chunks have output_version v1", async () => {
    const model = new FakeListChatModel({
      responses: ["hello"],
      outputVersion: "v1",
    });

    // streamEvents uses _streamIterator internally, which already had the fix.
    // This test confirms the streaming path emits v1-formatted chunks.
    const streamChunks = [];
    for await (const event of model.streamEvents(
      [{ role: "human", content: "hi" }],
      { version: "v2" }
    )) {
      if (event.event === "on_chat_model_stream") {
        streamChunks.push(event.data.chunk);
      }
    }

    expect(streamChunks.length).toBeGreaterThan(0);
    for (const chunk of streamChunks) {
      expect(chunk.response_metadata.output_version).toBe("v1");
    }
  });

  test("all three code paths produce consistent output_version behavior", async () => {
    // Path 1: Direct invoke (non-streaming branch)
    const model1 = new FakeListChatModel({
      responses: ["abc"],
      outputVersion: "v1",
    });
    const directResult = await model1.invoke([
      { role: "human", content: "hi" },
    ]);

    // Path 2: Invoke with streaming-preferred handler (streaming aggregation branch)
    const model2 = new FakeListChatModel({
      responses: ["abc"],
      outputVersion: "v1",
    });
    const streamAggResult = await model2.invoke(
      [{ role: "human", content: "hi" }],
      { callbacks: [new StreamingPreferredHandler()] }
    );

    // Path 3: Stream iterator
    const model3 = new FakeListChatModel({
      responses: ["abc"],
      outputVersion: "v1",
    });
    const streamChunks = [];
    for await (const chunk of await model3.stream([
      { role: "human", content: "hi" },
    ])) {
      streamChunks.push(chunk);
    }

    // All three paths should set output_version to "v1"
    expect(directResult.response_metadata.output_version).toBe("v1");
    expect(streamAggResult.response_metadata.output_version).toBe("v1");
    for (const chunk of streamChunks) {
      expect(chunk.response_metadata.output_version).toBe("v1");
    }
  });
});
