import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { createAgent } from "../index.js";
import { toolEmulatorMiddleware } from "../middleware/toolEmulator.js";
import { summarizationMiddleware } from "../middleware/summarization.js";

/** Drains `run.messages`, returning each stream's concatenated text. */
async function v3MessageTexts(
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

/**
 * Message contents from classic `stream({ streamMode: "messages" })`, split by
 * type. Unlike the v3 projection, this surface also emits `ToolMessage`s, so
 * tool results have to be separated from model output to assert on either.
 */
async function classicMessageTexts(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any,
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  input: any
): Promise<{ model: string[]; tools: string[] }> {
  const model: string[] = [];
  const tools: string[] = [];
  for await (const chunk of await agent.stream(input, {
    streamMode: "messages",
  })) {
    const message = chunk[0];
    const text = typeof message?.content === "string" ? message.content : "";
    if (!text) continue;
    if (message.getType?.() === "tool") tools.push(text);
    else model.push(text);
  }
  return { model, tools };
}

const weather = tool(async () => "REAL_TOOL_OUTPUT", {
  name: "get_weather",
  description: "Get the weather",
  schema: z.object({ city: z.string() }),
});

/** Fresh agent per run: `fakeModel` responses are a consumable queue. */
const emulatorAgent = () =>
  createAgent({
    model: fakeModel()
      .respond(
        new AIMessage({
          content: "CALLING_TOOL",
          tool_calls: [{ id: "c1", name: "get_weather", args: { city: "SF" } }],
        })
      )
      .respond(new AIMessage("MAIN_ANSWER")),
    tools: [weather],
    middleware: [
      toolEmulatorMiddleware({
        model: fakeModel().respond(new AIMessage("EMULATED_TOOL_RESULT")),
      }),
    ],
  });

const emulatorInput = { messages: [new HumanMessage("weather in SF?")] };

const summarizationAgent = () =>
  createAgent({
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

const summarizationInput = {
  messages: [
    new HumanMessage("first message that is quite long ".repeat(20)),
    new AIMessage("first reply"),
    new HumanMessage("second message"),
  ],
};

describe("middleware-internal model calls are excluded from run.messages", () => {
  it("omits the tool emulation call", async () => {
    const run = await emulatorAgent().streamEvents(emulatorInput, {
      version: "v3",
    });

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = await v3MessageTexts(run.messages as any);
    expect(texts).toEqual(["CALLING_TOOL", "MAIN_ANSWER"]);
  });

  it("omits the summarization call", async () => {
    const run = await summarizationAgent().streamEvents(summarizationInput, {
      version: "v3",
    });

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = await v3MessageTexts(run.messages as any);

    expect(texts).not.toContain("THE_SUMMARY");
    expect(texts).toContain("MAIN_ANSWER");
    /**
     * The synthetic summary `HumanMessage` is a state write, not a model call,
     * so the tag does not reach it. Deliberately not asserted either way here —
     * suppressing it is a separate fix (#11267).
     */
  });
});

describe('middleware-internal model calls are excluded from stream({ streamMode: "messages" })', () => {
  it("omits the tool emulation call", async () => {
    const { model, tools } = await classicMessageTexts(
      emulatorAgent(),
      emulatorInput
    );

    expect(model).not.toContain("EMULATED_TOOL_RESULT");
    expect(model).toContain("MAIN_ANSWER");
    // The emulated result still reaches the caller as the tool's output.
    expect(tools).toContain("EMULATED_TOOL_RESULT");
  });

  it("omits the summarization call", async () => {
    const { model } = await classicMessageTexts(
      summarizationAgent(),
      summarizationInput
    );

    expect(model).not.toContain("THE_SUMMARY");
    expect(model).toContain("MAIN_ANSWER");
  });
});
