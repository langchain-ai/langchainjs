import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import {
  mergeConfigs,
  pickRunnableConfigKeys,
  type RunnableConfig,
} from "@langchain/core/runnables";

import { createAgent, createMiddleware } from "../index.js";
import { INTERNAL_CALL_TAG } from "../middleware/constants.js";

// Pins where internal calls stay observable once tagged, and where they don't.

function buildAgent(tagged: boolean) {
  const internalModel = fakeModel().respond(new AIMessage("INTERNAL_CALL"));

  const middleware = createMiddleware({
    name: "InternalCallMiddleware",
    beforeModel: async (_state, runtime) => {
      const base: RunnableConfig = pickRunnableConfigKeys(runtime) ?? {};
      const config = mergeConfigs(base, {
        metadata: { lc_source: "internal_test" },
        ...(tagged ? { tags: [INTERNAL_CALL_TAG] } : {}),
      });
      await internalModel.invoke("bookkeeping prompt", config);
      return undefined;
    },
  });

  return createAgent({
    model: fakeModel().respond(new AIMessage("MAIN_ANSWER")),
    tools: [],
    middleware: [middleware],
  });
}

/** Contents seen via classic `streamMode: "messages"`. */
async function classicMessages(tagged: boolean): Promise<string[]> {
  const seen: string[] = [];
  for await (const chunk of await buildAgent(tagged).stream(
    { messages: [new HumanMessage("hi")] },
    { streamMode: "messages" }
  )) {
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (chunk as any)[0];
    const text = typeof message?.content === "string" ? message.content : "";
    if (text) seen.push(text);
  }
  return seen;
}

/** Model outputs seen via Core's `streamEvents({ version: "v2" })`. */
async function coreV2Outputs(tagged: boolean): Promise<string[]> {
  const seen: string[] = [];
  // Overloads resolve to the v3 signature; v2 returns a directly-iterable stream at runtime.
  const events = buildAgent(tagged).streamEvents(
    { messages: [new HumanMessage("hi")] },
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    { version: "v2" } as any
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  ) as unknown as AsyncIterable<any>;

  for await (const event of events) {
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const e = event as any;
    if (e.event !== "on_chat_model_end") continue;
    const content = e.data?.output?.content;
    if (typeof content === "string" && content) seen.push(content);
  }
  return seen;
}

describe("observability of tagged internal calls", () => {
  it("hides internal calls from classic streamMode: messages", async () => {
    expect(await classicMessages(false)).toEqual([
      "INTERNAL_CALL",
      "MAIN_ANSWER",
    ]);
    expect(await classicMessages(true)).toEqual(["MAIN_ANSWER"]);
  });

  it("leaves Core's streamEvents v2 untouched", async () => {
    expect(await coreV2Outputs(false)).toEqual([
      "INTERNAL_CALL",
      "MAIN_ANSWER",
    ]);
    // Unchanged by the tag: Core's callback pipeline is a separate surface.
    expect(await coreV2Outputs(true)).toEqual(["INTERNAL_CALL", "MAIN_ANSWER"]);
  });
});
