/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi, test, expect } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";

import { RunnableLambda } from "../../runnables/base.js";
import { LangChainTracer } from "../tracer_langchain.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/async_local_storage/index.js";

test("LangChainTracer payload snapshots for run create and update", async () => {
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );

  const mockClient = {
    createRun: vi.fn(),
    updateRun: vi.fn(),
  } as any;

  const mockTracer = new LangChainTracer({ client: mockClient });

  const parentRunnable = RunnableLambda.from(async (input: string) => {
    const childRunnable = RunnableLambda.from(async (childInput: string) => {
      return `processed: ${childInput}`;
    });

    const result = await childRunnable.invoke(input);
    return `parent: ${result}`;
  });

  await parentRunnable.invoke("test input", { callbacks: [mockTracer] });

  await awaitAllCallbacks();

  expect(mockClient.createRun).toHaveBeenCalledTimes(2);
  expect(mockClient.updateRun).toHaveBeenCalledTimes(2);

  const createPayloads = mockClient.createRun.mock.calls.map(
    (call: any) => call[0]
  );
  const updatePayloads = mockClient.updateRun.mock.calls.map(
    (call: any) => call[1]
  );

  expect(createPayloads[0]).toMatchSnapshot({
    session_name: expect.any(String),
    dotted_order: expect.any(String),
    start_time: expect.any(String),
    events: expect.arrayContaining([
      expect.objectContaining({
        time: expect.any(String),
      }),
    ]),
    id: expect.any(String),
    trace_id: expect.any(String),
  });

  expect(createPayloads[1]).toMatchSnapshot({
    session_name: expect.any(String),
    dotted_order: expect.any(String),
    start_time: expect.any(String),
    events: expect.arrayContaining([
      expect.objectContaining({
        time: expect.any(String),
      }),
    ]),
    id: expect.any(String),
    trace_id: expect.any(String),
    parent_run_id: expect.any(String),
  });

  expect(updatePayloads[0]).toMatchSnapshot({
    session_name: expect.any(String),
    dotted_order: expect.any(String),
    start_time: expect.any(String),
    end_time: expect.any(Number),
    events: expect.arrayContaining([
      expect.objectContaining({
        time: expect.any(String),
      }),
    ]),
    name: expect.any(String),
    trace_id: expect.any(String),
    parent_run_id: expect.any(String),
  });

  expect(updatePayloads[1]).toMatchSnapshot({
    session_name: expect.any(String),
    dotted_order: expect.any(String),
    start_time: expect.any(String),
    end_time: expect.any(Number),
    events: expect.arrayContaining([
      expect.objectContaining({
        time: expect.any(String),
      }),
    ]),
    name: expect.any(String),
    trace_id: expect.any(String),
  });
});
