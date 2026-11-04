import { describe, expect, it, vi } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  LangChainTracer,
  omitPayload,
} from "@langchain/core/tracers/tracer_langchain";
import { z } from "zod/v3";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
type SentRun = Record<string, any>;

/** A LangChainTracer whose client records what would be sent to LangSmith. */
function mockTracer() {
  const client = { createRun: vi.fn(), updateRun: vi.fn() };
  const tracer = new LangChainTracer({
    client: client as unknown as LangChainTracer["client"],
  });
  /** The first run with this name, with its final outputs merged in. */
  const sent = (name: string): SentRun => {
    const run = client.createRun.mock.calls
      .map(([r]) => r)
      .find((r) => r.name === name);
    const end = client.updateRun.mock.calls
      .filter(([id]) => id === run?.id)
      .at(-1)?.[1];
    return { ...run, outputs: end?.outputs };
  };
  return { tracer, sent };
}

const hello = { messages: [new HumanMessage("hello")] };

describe("middleware tracePolicy", () => {
  it("applies each middleware's policy only to its own hook runs", async () => {
    const inputOnly = createMiddleware({
      name: "InputOnly",
      tracePolicy: { processInputs: omitPayload },
      beforeModel: () => ({ messages: [] }),
    });
    const outputOnly = createMiddleware({
      name: "OutputOnly",
      tracePolicy: { processOutputs: omitPayload },
      beforeModel: () => ({ messages: [] }),
    });
    const unfiltered = createMiddleware({
      name: "Unfiltered",
      beforeModel: () => ({ messages: [] }),
    });
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [inputOnly, outputOnly, unfiltered],
      tools: [],
    });
    const { tracer, sent } = mockTracer();

    const result = await agent.invoke(hello, { callbacks: [tracer] });

    expect(result.messages.at(-1)?.content).toBe("hello");
    const raw = { messages: [expect.anything()] };
    expect(sent("InputOnly.before_model").inputs).toEqual({});
    expect(sent("InputOnly.before_model").outputs).toEqual({ messages: [] });
    expect(sent("OutputOnly.before_model").inputs).toMatchObject(raw);
    expect(sent("OutputOnly.before_model").outputs).toEqual({});
    expect(sent("Unfiltered.before_model").inputs).toMatchObject(raw);
    expect(sent("Unfiltered.before_model").outputs).toEqual({ messages: [] });
  });

  it("covers every lifecycle hook and leaves model runs raw", async () => {
    const middleware = createMiddleware({
      name: "Filtered",
      tracePolicy: { processInputs: omitPayload, processOutputs: omitPayload },
      beforeAgent: () => undefined,
      beforeModel: () => undefined,
      afterModel: () => undefined,
      afterAgent: () => undefined,
    });
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [middleware],
      tools: [],
    });
    const { tracer, sent } = mockTracer();
    const big = "x".repeat(10_000);

    const result = await agent.invoke(
      { messages: [new HumanMessage(big)] },
      { callbacks: [tracer] }
    );

    expect(result.messages.at(-1)?.content).toBe(big);
    for (const hook of [
      "before_agent",
      "before_model",
      "after_model",
      "after_agent",
    ]) {
      const run = sent(`Filtered.${hook}`);
      expect(run.inputs).toEqual({});
      expect(run.outputs).toEqual({});
    }
    expect(JSON.stringify(sent("FakeToolCallingModel").inputs)).toContain(big);
  });

  it("leaves tool runs raw", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [{ id: "call_1", name: "weather", args: { city: "Tokyo" } }],
        [],
      ],
    });
    const getWeather = tool(async () => "sunny", {
      name: "weather",
      description: "Gets the weather",
      schema: z.object({ city: z.string() }),
    });
    const middleware = createMiddleware({
      name: "Filtered",
      tracePolicy: { processInputs: omitPayload, processOutputs: omitPayload },
      afterModel: () => undefined,
    });
    const agent = createAgent({
      model,
      tools: [getWeather],
      middleware: [middleware],
    });
    const { tracer, sent } = mockTracer();

    const result = await agent.invoke(
      { messages: [new HumanMessage("weather in Tokyo")] },
      { callbacks: [tracer] }
    );

    expect(result.messages.some(ToolMessage.isInstance)).toBe(true);
    expect(sent("Filtered.after_model")).toMatchObject({
      inputs: {},
      outputs: {},
    });
    expect(sent("weather").inputs).toEqual({ city: "Tokyo" });
    expect(JSON.stringify(sent("weather").outputs)).toContain("sunny");
  });

  it("leaves streamEvents payloads raw", async () => {
    const middleware = createMiddleware({
      name: "Filtered",
      tracePolicy: { processInputs: omitPayload, processOutputs: omitPayload },
      beforeModel: () => undefined,
    });
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [middleware],
      tools: [],
    });

    const events = [];
    for await (const event of agent.streamEvents(hello, { version: "v2" })) {
      events.push(event);
    }

    const start = events.find(
      (e) => e.name === "Filtered.before_model" && e.event === "on_chain_start"
    );
    expect(start?.data.input).toMatchObject({ messages: [expect.anything()] });
  });
});
