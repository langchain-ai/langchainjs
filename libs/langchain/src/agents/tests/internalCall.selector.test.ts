import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import {
  AIMessageChunk,
  AIMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatResult } from "@langchain/core/outputs";
import { fakeModel } from "@langchain/core/testing";
import { tool } from "@langchain/core/tools";

import { createAgent } from "../index.js";
import { llmToolSelectorMiddleware } from "../middleware/llmToolSelector.js";

/** Real chat-model run: `fakeModel().withStructuredOutput()` never calls the model, so it would pass vacuously. */
class SelectorModel extends BaseChatModel {
  _llmType() {
    return "selector-fake";
  }

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  override bindTools(_tools: any[]): any {
    return this;
  }

  async _generate(): Promise<ChatResult> {
    const message = new AIMessageChunk({
      content: "SELECTOR_INTERNAL",
      tool_calls: [
        { id: "sel_1", name: "extract", args: { tools: ["toolA"] } },
      ],
    });
    return { generations: [{ text: "SELECTOR_INTERNAL", message }] };
  }
}

const mkTool = (name: string) =>
  tool(async () => `${name} result`, {
    name,
    description: `${name} for testing`,
    schema: z.object({ prop: z.unknown().optional() }),
  });

const allTools = ["toolA", "toolB", "toolC", "toolD", "toolE"].map(mkTool);

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
async function collectMessageTexts(messages: AsyncIterable<any>) {
  const texts: string[] = [];
  for await (const stream of messages) {
    let text = "";
    for await (const event of stream) {
      if (event.event === "content-block-delta")
        text += event.delta?.text ?? "";
      if (event.event === "content-block-start") {
        text += (event.contentBlock ?? event.content_block)?.text ?? "";
      }
    }
    texts.push(text);
  }
  return texts;
}

describe("llmToolSelector internal call is excluded from run.messages", () => {
  it("omits the tool-selection call", async () => {
    const agent = createAgent({
      model: fakeModel().respond(new AIMessage("MAIN_ANSWER")),
      tools: allTools,
      middleware: [
        llmToolSelectorMiddleware({
          model: new SelectorModel({}),
          maxTools: 2,
        }),
      ],
    });

    const run = await agent.streamEvents(
      { messages: [new HumanMessage("do something")] },
      { version: "v3" }
    );

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = await collectMessageTexts(run.messages as any);

    expect(texts).not.toContain("SELECTOR_INTERNAL");
    expect(texts).toContain("MAIN_ANSWER");
  });
});
