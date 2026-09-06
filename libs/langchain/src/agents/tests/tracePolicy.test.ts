import { afterEach, describe, expect, it, vi } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { FakeTracer } from "@langchain/core/utils/testing";
import { z } from "zod/v3";

import {
  configureTracePolicy,
  createAgent,
  createMiddleware,
  omitPayload,
} from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

function runsFor(tracer: FakeTracer, name: string) {
  const flatten = (runs: typeof tracer.runs): typeof tracer.runs =>
    runs.flatMap((run) => [run, ...flatten(run.child_runs)]);
  return flatten(tracer.runs).filter((run) => run.name === name);
}

afterEach(() => configureTracePolicy(null));

describe("middleware tracePolicy", () => {
  it("preserves default hook payloads and agent results", async () => {
    const middleware = createMiddleware({
      name: "Default",
      beforeModel: () => undefined,
    });
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [middleware],
      tools: [],
    });
    const tracer = new FakeTracer();

    const result = await agent.invoke(
      { messages: [new HumanMessage("hello")] },
      { callbacks: [tracer] }
    );

    expect(result.messages.at(-1)?.content).toBe("hello");
    expect(runsFor(tracer, "Default.before_model")[0].inputs).toMatchObject({
      messages: [expect.objectContaining({ content: "hello" })],
    });
  });

  it("filters all lifecycle hook spans while preserving child model traces", async () => {
    const middleware = createMiddleware({
      name: "Filtered",
      tracePolicy: {
        processInputs: omitPayload,
        processOutputs: omitPayload,
      },
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
    const tracer = new FakeTracer();

    const result = await agent.invoke(
      { messages: [new HumanMessage("x".repeat(10_000))] },
      { callbacks: [tracer] }
    );

    expect(result.messages.at(-1)?.content).toBe("x".repeat(10_000));
    for (const hook of [
      "before_agent",
      "before_model",
      "after_model",
      "after_agent",
    ]) {
      const [run] = runsFor(tracer, `Filtered.${hook}`);
      expect(run.inputs).toEqual({});
      expect(run.outputs).toEqual({});
    }
    const [modelRun] = runsFor(tracer, "FakeToolCallingModel");
    expect(JSON.stringify(modelRun.inputs)).toContain("x".repeat(10_000));
  });

  it("transforms hook outputs independently", async () => {
    const middleware = createMiddleware({
      name: "OutputOnly",
      tracePolicy: { processOutputs: () => undefined },
      beforeModel: () => ({}),
    });
    const tracer = new FakeTracer();
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [middleware],
      tools: [],
    });

    await agent.invoke(
      { messages: [new HumanMessage("hello")] },
      { callbacks: [tracer] }
    );

    const [run] = runsFor(tracer, "OutputOnly.before_model");
    expect(run.inputs.messages[0].content).toBe("hello");
    expect(run.outputs).toEqual({ output: undefined });
  });

  it("resolves the global policy at hook execution with wholesale overrides", async () => {
    const inherited = createMiddleware({
      name: "Inherited",
      beforeModel: () => undefined,
    });
    const emptyOverride = createMiddleware({
      name: "EmptyOverride",
      tracePolicy: {},
      beforeModel: () => undefined,
    });
    const outputOverride = createMiddleware({
      name: "OutputOverride",
      tracePolicy: { processOutputs: omitPayload },
      beforeModel: () => undefined,
    });
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [inherited, emptyOverride, outputOverride],
      tools: [],
    });
    configureTracePolicy({
      processInputs: omitPayload,
      processOutputs: omitPayload,
    });
    let tracer = new FakeTracer();

    await agent.invoke(
      { messages: [new HumanMessage("hello")] },
      { callbacks: [tracer] }
    );

    expect(runsFor(tracer, "Inherited.before_model")[0]).toMatchObject({
      inputs: {},
      outputs: {},
    });
    expect(runsFor(tracer, "EmptyOverride.before_model")[0]).toMatchObject({
      inputs: { messages: [expect.anything()] },
    });
    expect(runsFor(tracer, "OutputOverride.before_model")[0]).toMatchObject({
      inputs: { messages: [expect.anything()] },
      outputs: {},
    });

    configureTracePolicy(null);
    tracer = new FakeTracer();
    await agent.invoke(
      { messages: [new HumanMessage("goodbye")] },
      { callbacks: [tracer] }
    );
    expect(runsFor(tracer, "Inherited.before_model")[0].inputs).toMatchObject({
      messages: [expect.anything()],
    });
  });

  it("preserves null processor results", async () => {
    const middleware = createMiddleware({
      name: "NullOutput",
      tracePolicy: { processOutputs: () => null },
      beforeModel: () => ({}),
    });
    const tracer = new FakeTracer();
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [middleware],
      tools: [],
    });

    await agent.invoke(
      { messages: [new HumanMessage("hello")] },
      { callbacks: [tracer] }
    );

    expect(runsFor(tracer, "NullOutput.before_model")[0].outputs).toEqual({
      output: null,
    });
  });

  it("fails open when a processor throws", async () => {
    const failure = new Error("processor failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const middleware = createMiddleware({
      name: "Failure",
      tracePolicy: {
        processInputs: () => {
          throw failure;
        },
      },
      beforeModel: () => undefined,
    });
    const tracer = new FakeTracer();
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [middleware],
      tools: [],
    });

    await expect(
      agent.invoke(
        { messages: [new HumanMessage("hello")] },
        { callbacks: [tracer] }
      )
    ).resolves.toMatchObject({ messages: expect.any(Array) });
    expect(runsFor(tracer, "Failure.before_model")[0].inputs).toMatchObject({
      messages: [expect.anything()],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("untransformed payload"),
      failure
    );
  });

  it("transforms middleware chain events while unfiltered streams retain payloads", async () => {
    const filtered = createMiddleware({
      name: "FilteredStreaming",
      tracePolicy: { processInputs: omitPayload, processOutputs: omitPayload },
      beforeModel: () => undefined,
    });
    const unfiltered = createMiddleware({
      name: "UnfilteredStreaming",
      beforeModel: () => undefined,
    });
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      middleware: [filtered, unfiltered],
      tools: [],
    });
    const events = [];
    for await (const event of agent.streamEvents(
      { messages: [new HumanMessage("hello")] },
      { version: "v2" }
    )) {
      events.push(event);
    }

    expect(
      events.find(
        (event) =>
          event.name === "FilteredStreaming.before_model" &&
          event.event === "on_chain_start"
      )?.data.input
    ).toEqual({});
    expect(
      events.find(
        (event) =>
          event.name === "FilteredStreaming.before_model" &&
          event.event === "on_chain_end"
      )?.data.output
    ).toEqual({});
    expect(
      events.find(
        (event) =>
          event.name === "UnfilteredStreaming.before_model" &&
          event.event === "on_chain_start"
      )?.data.input
    ).toMatchObject({ messages: [expect.anything()] });
  });

  it("preserves tool child trace payloads and hierarchy", async () => {
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
    const tracer = new FakeTracer();
    const agent = createAgent({
      model,
      tools: [getWeather],
      middleware: [middleware],
    });

    const result = await agent.invoke(
      { messages: [new HumanMessage("weather in Tokyo")] },
      { callbacks: [tracer] }
    );

    expect(result.messages.some(ToolMessage.isInstance)).toBe(true);
    expect(runsFor(tracer, "Filtered.after_model")[0]).toMatchObject({
      inputs: {},
      outputs: {},
    });
    const [toolRun] = runsFor(tracer, "weather");
    expect(toolRun.inputs).toEqual({ input: '{"city":"Tokyo"}' });
    expect(JSON.stringify(toolRun.outputs)).toContain("sunny");
    expect(toolRun.parent_run_id).toBeDefined();
  });
});
