/* oxlint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, beforeAll } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";

import { RunnableLambda, RunnableSequence } from "../../runnables/base.js";
import { LangChainTracer, type TracePolicy } from "../tracer_langchain.js";
import { RunCollectorCallbackHandler } from "../run_collector.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/async_local_storage/index.js";

beforeAll(() => {
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
});

const omit = () => ({});

function makeSequence(tracePolicy?: TracePolicy) {
  return new RunnableSequence({
    first: RunnableLambda.from((x: { n: number }) => ({ n: x.n + 1 })),
    last: RunnableLambda.from((x: { n: number }) => ({ n: x.n * 2 })),
    tracePolicy,
  });
}

function makeTracer() {
  const client = { createRun: vi.fn(), updateRun: vi.fn() } as any;
  const tracer = new LangChainTracer({ client });
  const created = (name: string) =>
    client.createRun.mock.calls
      .map((c: any) => c[0])
      .filter((r: any) => r.name === name);
  const updated = (id: string) =>
    client.updateRun.mock.calls
      .filter((c: any) => c[0] === id)
      .map((c: any) => c[1]);
  return { tracer, created, updated };
}

test("policy shapes only the sequence's own LangSmith run", async () => {
  const { tracer, created, updated } = makeTracer();
  const collector = new RunCollectorCallbackHandler();
  const seq = makeSequence({ processInputs: omit, processOutputs: omit });

  const result = await seq.invoke({ n: 1 }, { callbacks: [tracer, collector] });
  await awaitAllCallbacks();

  expect(result).toEqual({ n: 4 });
  const [run] = created("RunnableSequence");
  expect(run.inputs).toEqual({});
  expect(Object.getOwnPropertySymbols(run.extra)).toEqual([]);
  expect(updated(run.id).at(-1).outputs).toEqual({});

  // Child runs and other handlers keep the raw payloads.
  const children = created("RunnableLambda");
  expect(children.map((r: any) => r.inputs)).toEqual([{ n: 1 }, { n: 2 }]);
  expect(collector.tracedRuns[0].inputs).toEqual({ n: 1 });
  expect(collector.tracedRuns[0].outputs).toEqual({ n: 4 });
});

test("policy applies on the stream path, and streamEvents sees raw values", async () => {
  const { tracer, created, updated } = makeTracer();
  const seq = makeSequence({
    processInputs: () => ({ trimmed: true }),
    processOutputs: () => ({ trimmed: true }),
  });

  const events = [];
  for await (const event of seq.streamEvents(
    { n: 1 },
    { version: "v2", callbacks: [tracer] }
  )) {
    events.push(event);
  }
  await awaitAllCallbacks();

  const start = events.find((e) => e.event === "on_chain_start");
  const end = events.find(
    (e) => e.event === "on_chain_end" && e.name === "RunnableSequence"
  );
  expect(start?.data.input).toEqual({ n: 1 });
  expect(end?.data.output).toEqual({ n: 4 });

  const [run] = created("RunnableSequence");
  expect(run.inputs).toEqual({ trimmed: true });
  expect(updated(run.id).at(-1).outputs).toEqual({ trimmed: true });
});

test("batch runs each record their own output", async () => {
  const { tracer, created, updated } = makeTracer();
  const processOutputs = vi.fn((outputs) => outputs);
  const seq = makeSequence({ processOutputs });

  await seq.batch([{ n: 1 }, { n: 2 }], { callbacks: [tracer] });
  await awaitAllCallbacks();

  const outputs = created("RunnableSequence").map(
    (run: any) => updated(run.id).at(-1).outputs
  );
  expect(outputs).toEqual([{ n: 4 }, { n: 6 }]);
  expect(processOutputs.mock.calls.map((c) => c[0])).toEqual(
    expect.arrayContaining([{ n: 4 }, { n: 6 }])
  );
});

test("a throwing processor fails the trace instead of sending the raw value", async () => {
  const { tracer, created } = makeTracer();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const seq = makeSequence({
    processInputs: () => {
      throw new Error("boom");
    },
  });

  await seq.invoke({ n: 1 }, { callbacks: [tracer] });
  await awaitAllCallbacks();

  expect(created("RunnableSequence")).toEqual([]);
  warn.mockRestore();
});

test("policy is not serialized and is not kept by pipe()", () => {
  const withPolicy = makeSequence({ processInputs: omit });
  expect(JSON.stringify(withPolicy)).toEqual(JSON.stringify(makeSequence()));

  const piped = withPolicy.pipe(RunnableLambda.from((x: unknown) => x));
  expect((piped as any)._tracePolicy).toBeUndefined();
});
