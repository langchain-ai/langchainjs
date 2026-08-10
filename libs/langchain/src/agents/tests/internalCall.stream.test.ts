import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { createAgent } from "../index.js";
import { toolEmulatorMiddleware } from "../middleware/toolEmulator.js";
import { summarizationMiddleware } from "../middleware/summarization.js";

/** Drains `run.messages`, returning each stream's concatenated text. */
async function collectMessageTexts(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  messages: AsyncIterable<any>
): Promise<string[]> {
  const texts: string[] = [];
  for await (const stream of messages) {
    let text = "";
    for await (const event of stream) {
      if (event.event === "content-block-delta") {
        text += event.delta?.text ?? "";
      }
      if (event.event === "content-block-start") {
        text += (event.contentBlock ?? event.content_block)?.text ?? "";
      }
    }
    texts.push(text);
  }
  return texts;
}

const weather = tool(async () => "REAL_TOOL_OUTPUT", {
  name: "get_weather",
  description: "Get the weather",
  schema: z.object({ city: z.string() }),
});

describe("middleware-internal model calls are excluded from run.messages", () => {
  it("omits the tool emulation call", async () => {
    const model = fakeModel()
      .respond(
        new AIMessage({
          content: "CALLING_TOOL",
          tool_calls: [{ id: "c1", name: "get_weather", args: { city: "SF" } }],
        })
      )
      .respond(new AIMessage("MAIN_ANSWER"));

    const agent = createAgent({
      model,
      tools: [weather],
      middleware: [
        toolEmulatorMiddleware({
          model: fakeModel().respond(new AIMessage("EMULATED_TOOL_RESULT")),
        }),
      ],
    });

    const run = await agent.streamEvents(
      { messages: [new HumanMessage("weather in SF?")] },
      { version: "v3" }
    );

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = await collectMessageTexts(run.messages as any);
    expect(texts).toEqual(["CALLING_TOOL", "MAIN_ANSWER"]);
  });

  it("omits the summarization call but keeps the resulting summary message", async () => {
    const agent = createAgent({
      model: fakeModel().respond(new AIMessage("MAIN_ANSWER")),
      tools: [],
      middleware: [
        summarizationMiddleware({
          model: fakeModel().respond(new AIMessage("THE_SUMMARY")),
          maxTokensBeforeSummary: 1,
          messagesToKeep: 1,
        }),
      ],
    });

    const run = await agent.streamEvents(
      {
        messages: [
          new HumanMessage("first message that is quite long ".repeat(20)),
          new AIMessage("first reply"),
          new HumanMessage("second message"),
        ],
      },
      { version: "v3" }
    );

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = await collectMessageTexts(run.messages as any);

    // Remaining entries are state messages from the middleware node, not model calls.
    expect(texts).not.toContain("THE_SUMMARY");
    expect(texts).toContain("MAIN_ANSWER");
    expect(texts).toContain(
      "Here is a summary of the conversation to date:\n\nTHE_SUMMARY"
    );
  });
});
