import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { fakeModel } from "@langchain/core/testing";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import {
  mergeConfigs,
  pickRunnableConfigKeys,
  type RunnableConfig,
} from "@langchain/core/runnables";

import { createAgent, createMiddleware } from "../index.js";
import { INTERNAL_CALL_TAG } from "../middleware/internalCall.js";

// Both LangGraph messages paths must be suppressed: streamed and whole-message.

/** Streams: one delta per character. */
const streamingModel = (text: string) =>
  new FakeListChatModel({ responses: [text] }) as unknown as BaseChatModel;

/** Does not stream: one synthetic delta total. */
const nonStreamingModel = (text: string) =>
  fakeModel().respond(new AIMessage(text)) as unknown as BaseChatModel;

/** Middleware making a bookkeeping model call, optionally tagged. */
function internalCallMiddleware(model: BaseChatModel, tagged: boolean) {
  return createMiddleware({
    name: "InternalCallMiddleware",
    beforeModel: async (_state, runtime) => {
      const base: RunnableConfig = pickRunnableConfigKeys(runtime) ?? {};
      const config = mergeConfigs(base, {
        metadata: { lc_source: "internal_test" },
        ...(tagged ? { tags: [INTERNAL_CALL_TAG] } : {}),
      });
      await model.invoke("bookkeeping prompt", config);
      return undefined;
    },
  });
}

interface RunSummary {
  texts: string[];
  deltaCount: number;
}

async function runAgent(
  internal: BaseChatModel,
  tagged: boolean
): Promise<RunSummary> {
  const agent = createAgent({
    model: nonStreamingModel("MAIN_ANSWER"),
    tools: [],
    middleware: [internalCallMiddleware(internal, tagged)],
  });

  const run = await agent.streamEvents(
    { messages: [new HumanMessage("hi")] },
    { version: "v3" }
  );

  let deltaCount = 0;
  const texts: string[] = [];
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const stream of run.messages as AsyncIterable<any>) {
    let text = "";
    for await (const event of stream) {
      if (event.event === "content-block-delta") {
        deltaCount += 1;
        text += event.delta?.text ?? "";
      }
      if (event.event === "content-block-start") {
        text += (event.contentBlock ?? event.content_block)?.text ?? "";
      }
    }
    texts.push(text);
  }
  return { texts, deltaCount };
}

describe("INTERNAL_CALL_TAG suppresses both langgraph messages paths", () => {
  describe("streamed path (handleChatModelStreamEvent)", () => {
    it("leaks the internal call when untagged", async () => {
      const { texts, deltaCount } = await runAgent(
        streamingModel("INTERNAL_STREAMED"),
        false
      );

      expect(texts).toContain("INTERNAL_STREAMED");
      expect(texts).toContain("MAIN_ANSWER");
      // 17 streamed deltas + 1 synthetic for the main model: only reachable via the streamed path.
      expect(deltaCount).toBe(18);
    });

    it("suppresses the internal call when tagged", async () => {
      const { texts, deltaCount } = await runAgent(
        streamingModel("INTERNAL_STREAMED"),
        true
      );

      expect(texts).toEqual(["MAIN_ANSWER"]);
      expect(deltaCount).toBe(1);
    });
  });

  describe("whole-message path (emitFinalMessage)", () => {
    it("leaks the internal call when untagged", async () => {
      const { texts, deltaCount } = await runAgent(
        nonStreamingModel("INTERNAL_WHOLE"),
        false
      );

      expect(texts).toContain("INTERNAL_WHOLE");
      expect(texts).toContain("MAIN_ANSWER");
      // One synthetic delta per message: internal call + main turn.
      expect(deltaCount).toBe(2);
    });

    it("suppresses the internal call when tagged", async () => {
      const { texts, deltaCount } = await runAgent(
        nonStreamingModel("INTERNAL_WHOLE"),
        true
      );

      expect(texts).toEqual(["MAIN_ANSWER"]);
      expect(deltaCount).toBe(1);
    });
  });
});
