import { describe, test, expect } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import type { BaseMessage } from "../../messages/base.js";
import { ChatGenerationChunk, type ChatResult } from "../../outputs.js";
import { BaseChatModel } from "../chat_models.js";

/**
 * A chat model that only implements the legacy chunk API, the way providers
 * do, and reports the finish reason on a chunk of its own.
 */
class FakeChunkModel extends BaseChatModel {
  constructor(private readonly chunks: ChatGenerationChunk[]) {
    super({});
  }

  _llmType() {
    return "fake-chunk";
  }

  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    throw new Error("_generate is not used");
  }

  async *_streamResponseChunks(): AsyncGenerator<ChatGenerationChunk> {
    yield* this.chunks;
  }
}

function finishChunk(metadata: Record<string, unknown>) {
  return new ChatGenerationChunk({
    text: "",
    message: new AIMessageChunk({ content: "", response_metadata: metadata }),
  });
}

async function concatStream(model: BaseChatModel) {
  let accumulated: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("hi")) {
    accumulated = accumulated
      ? (accumulated.concat(chunk as AIMessageChunk) as AIMessageChunk)
      : (chunk as AIMessageChunk);
  }
  return accumulated;
}

describe("stream finishes like invoke", () => {
  test("a forced tool call reports tool_call", async () => {
    const model = new FakeChunkModel([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            { name: "search", args: "{}", id: "call_1", index: 0 },
          ],
        }),
      }),
      finishChunk({ finish_reason: "stop", normalized_finish_reason: "stop" }),
    ]);

    const message = await concatStream(model);
    expect(message?.response_metadata.finish_reason).toBe("stop");
    expect(message?.response_metadata.normalized_finish_reason).toBe(
      "tool_call"
    );
  });

  test("a refusal that arrives before the finish reports refusal", async () => {
    const model = new FakeChunkModel([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          additional_kwargs: { refusal: "I can't help with that." },
        }),
      }),
      finishChunk({ finish_reason: "stop", normalized_finish_reason: "stop" }),
    ]);

    const message = await concatStream(model);
    expect(message?.response_metadata.normalized_finish_reason).toBe("refusal");
  });

  test("a plain stop stays stop", async () => {
    const model = new FakeChunkModel([
      new ChatGenerationChunk({
        text: "hi",
        message: new AIMessageChunk({ content: "hi" }),
      }),
      finishChunk({ finish_reason: "stop", normalized_finish_reason: "stop" }),
    ]);

    const message = await concatStream(model);
    expect(message?.response_metadata.normalized_finish_reason).toBe("stop");
  });

  test("a provider that sets nothing gets no finish fields", async () => {
    const model = new FakeChunkModel([
      new ChatGenerationChunk({
        text: "hi",
        message: new AIMessageChunk({ content: "hi" }),
      }),
    ]);

    const message = await concatStream(model);
    expect(message?.response_metadata).not.toHaveProperty("finish_reason");
    expect(message?.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });
});
