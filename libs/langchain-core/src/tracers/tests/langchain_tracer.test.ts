/* oxlint-disable @typescript-eslint/no-explicit-any */

import { vi, test, expect, describe } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import * as uuid from "uuid";

import { RunnableLambda } from "../../runnables/base.js";
import { LangChainTracer, _patchMissingMetadata } from "../tracer_langchain.js";
import { getCallbackManagerForConfig } from "../../runnables/config.js";
import { BaseCallbackHandler } from "../../callbacks/base.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/async_local_storage/index.js";
import { AIMessage } from "../../messages/ai.js";
import { Serialized } from "../../load/serializable.js";
import { ChatGeneration } from "../../outputs.js";
import { UsageMetadata } from "../../messages/metadata.js";

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

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};

describe("LangChainTracer usage_metadata extraction", () => {
  test("onLLMEnd extracts usage_metadata and stores in run.extra.metadata", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    // Start an LLM run
    await tracer.handleLLMStart(serialized, ["test prompt"], runId);

    // End with generations containing usage_metadata
    const usageMetadata = {
      input_tokens: 100,
      output_tokens: 200,
      total_tokens: 300,
      input_token_details: {},
      output_token_details: {},
    };

    const message = new AIMessage({
      content: "Hello!",
      usage_metadata: usageMetadata,
    });
    const generation: ChatGeneration = {
      text: "Hello!",
      message,
    };

    await tracer.handleLLMEnd(
      {
        generations: [[generation]],
      },
      runId
    );

    // The run is deleted after end, so we check the mock calls
    expect(mockClient.updateRun).toHaveBeenCalled();

    // Check that usage_metadata was added to extra.metadata
    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    expect(updatedRun.extra?.metadata?.usage_metadata).toEqual(usageMetadata);
  });

  test("onLLMEnd does not add usage_metadata when not present", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["test prompt"], runId);

    // End without usage_metadata
    await tracer.handleLLMEnd(
      {
        generations: [[{ text: "Hello!" }]],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    // Should not have usage_metadata
    expect(updatedRun.extra?.metadata?.usage_metadata).toBeUndefined();
  });

  test("onLLMEnd preserves existing metadata when adding usage_metadata", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    // Start with existing metadata
    await tracer.handleLLMStart(
      serialized,
      ["test prompt"],
      runId,
      undefined,
      undefined,
      undefined,
      { existing_key: "existing_value" }
    );

    const usageMetadata: UsageMetadata = {
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      input_token_details: {},
      output_token_details: {},
    };

    const message = new AIMessage({
      content: "Hello!",
      usage_metadata: usageMetadata,
    });
    const generation: ChatGeneration = {
      text: "Hello!",
      message,
    };

    await tracer.handleLLMEnd(
      {
        generations: [[generation]],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    expect(updatedRun.extra?.metadata?.usage_metadata).toEqual(usageMetadata);
    expect(updatedRun.extra?.metadata?.existing_key).toEqual("existing_value");
  });

  test("onLLMEnd aggregates usage_metadata across multiple generations", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["test prompt"], runId);

    const firstUsage = {
      input_tokens: 5,
      output_tokens: 10,
      total_tokens: 15,
    };
    const secondUsage = {
      input_tokens: 50,
      output_tokens: 100,
      total_tokens: 150,
    };

    const firstMessage = new AIMessage({
      content: "First",
      usage_metadata: firstUsage,
    });
    const secondMessage = new AIMessage({
      content: "Second",
      usage_metadata: secondUsage,
    });
    const generations: ChatGeneration[] = [
      { text: "First", message: firstMessage },
      { text: "Second", message: secondMessage },
    ];

    await tracer.handleLLMEnd(
      {
        generations: [generations],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    // Should have aggregated usage_metadata from all generations
    expect(updatedRun.extra?.metadata?.usage_metadata).toEqual({
      input_tokens: 55,
      output_tokens: 110,
      total_tokens: 165,
      input_token_details: {},
      output_token_details: {},
    });
  });
});

function _makeTracer(metadata?: Record<string, string>): LangChainTracer {
  const mockClient = {
    createRun: vi.fn(),
    updateRun: vi.fn(),
  } as any;
  return new LangChainTracer({ client: mockClient, metadata });
}

describe("_patchMissingMetadata", () => {
  test("adds metadata when run has none", () => {
    const tracer = _makeTracer({ env: "prod", service: "api" });
    const run = { extra: { metadata: {} } };
    _patchMissingMetadata(tracer, run);
    expect(run.extra.metadata).toEqual({ env: "prod", service: "api" });
  });

  test("does not overwrite existing keys", () => {
    const tracer = _makeTracer({ env: "prod", service: "api" });
    const run = { extra: { metadata: { env: "staging" } } };
    _patchMissingMetadata(tracer, run);
    expect(run.extra.metadata).toEqual({ env: "staging", service: "api" });
  });

  test("noop when tracer has no metadata", () => {
    const tracer = _makeTracer(undefined);
    const original = { existing: "value" };
    const run = { extra: { metadata: { ...original } } };
    _patchMissingMetadata(tracer, run);
    expect(run.extra.metadata).toEqual(original);
  });

  test("noop when all keys already present", () => {
    const tracer = _makeTracer({ env: "prod" });
    const run = { extra: { metadata: { env: "dev" } } };
    _patchMissingMetadata(tracer, run);
    expect(run.extra.metadata).toEqual({ env: "dev" });
  });

  test("merges disjoint keys", () => {
    const tracer = _makeTracer({ tracer_key: "tracer_val" });
    const run = { extra: { metadata: { config_key: "config_val" } } };
    _patchMissingMetadata(tracer, run);
    expect(run.extra.metadata).toEqual({
      tracer_key: "tracer_val",
      config_key: "config_val",
    });
  });
});

describe("copyWithMetadataDefaults", () => {
  test("copies configuration, does not mutate original", () => {
    const tracer = _makeTracer({ env: "staging" });
    tracer.projectName = "project";

    const copied = tracer.copyWithMetadataDefaults({
      metadata: { service: "api" },
    });

    expect(copied).not.toBe(tracer);
    expect(copied.client).toBe(tracer.client);
    expect(copied.projectName).toBe("project");
    expect(copied.tracingMetadata).toEqual({
      env: "staging",
      service: "api",
    });
    // Original is unchanged
    expect(tracer.tracingMetadata).toEqual({ env: "staging" });
  });

  test("tracer metadata takes precedence over incoming metadata", () => {
    const tracer = _makeTracer({ env: "staging" });
    const copied = tracer.copyWithMetadataDefaults({
      metadata: { env: "prod", service: "api" },
    });
    expect(copied.tracingMetadata).toEqual({
      env: "staging",
      service: "api",
    });
  });

  test("null metadata preserves existing", () => {
    const tracer = _makeTracer({ env: "staging" });
    const copied = tracer.copyWithMetadataDefaults({ metadata: undefined });
    expect(copied).not.toBe(tracer);
    expect(copied.tracingMetadata).toEqual({ env: "staging" });
  });

  test("separate copies are isolated", () => {
    const tracer = _makeTracer();
    const alpha = tracer.copyWithMetadataDefaults({
      metadata: { tenant: "alpha" },
    });
    const beta = tracer.copyWithMetadataDefaults({
      metadata: { tenant: "beta" },
    });
    expect(tracer.tracingMetadata).toBeUndefined();
    expect(alpha.tracingMetadata).toEqual({ tenant: "alpha" });
    expect(beta.tracingMetadata).toEqual({ tenant: "beta" });
    expect(alpha).not.toBe(beta);
  });
});

describe("getCallbackManagerForConfig langsmith metadata", () => {
  test("configurable keys flow as tracer metadata", async () => {
    const tracer = _makeTracer();
    const cm = await getCallbackManagerForConfig({
      callbacks: [tracer],
      configurable: {
        thread_id: "th-123",
        model: "gpt-4o",
        temperature: 0.5,
        streaming: true,
        custom_obj: { nested: true }, // not a primitive, excluded
        __secret: "hidden", // __ prefix, excluded
        api_key: "secret", // excluded
      },
    });
    const lcTracers = cm?.handlers.filter(
      (h) => h instanceof LangChainTracer
    ) as LangChainTracer[];
    expect(lcTracers).toHaveLength(1);
    expect(lcTracers[0]).not.toBe(tracer);
    expect(lcTracers[0].tracingMetadata).toEqual({
      thread_id: "th-123",
      model: "gpt-4o",
      temperature: 0.5,
      streaming: true,
    });
    // Original unchanged
    expect(tracer.tracingMetadata).toBeUndefined();
  });

  test("no configurable means no tracer copy", async () => {
    const tracer = _makeTracer();
    const cm = await getCallbackManagerForConfig({
      callbacks: [tracer],
    });
    const lcTracer = cm?.handlers.find(
      (h) => h instanceof LangChainTracer
    ) as LangChainTracer;
    // No configurable keys to forward, so same instance
    expect(lcTracer).toBe(tracer);
    expect(tracer.tracingMetadata).toBeUndefined();
  });

  test("tracer metadata takes precedence over configurable keys", async () => {
    const tracer = _makeTracer({ thread_id: "from-tracer" });
    const cm = await getCallbackManagerForConfig({
      callbacks: [tracer],
      configurable: { thread_id: "from-configurable", user_id: "uid-1" },
    });
    const lcTracer = cm?.handlers.find(
      (h) => h instanceof LangChainTracer
    ) as LangChainTracer;
    expect(lcTracer.tracingMetadata).toEqual({
      thread_id: "from-tracer",
      user_id: "uid-1",
    });
  });

  test("langsmith metadata does not affect non-tracer handlers", async () => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const tracer = _makeTracer();
    const receivedMetadata: Record<string, unknown>[] = [];

    class MetadataCapture extends BaseCallbackHandler {
      name = "metadata_capture";
      async handleChainStart(
        _chain: any,
        _inputs: any,
        _runId?: string,
        _parentRunId?: string,
        _tags?: string[],
        metadata?: Record<string, unknown>
      ) {
        receivedMetadata.push({ ...metadata });
      }
    }

    const capture = new MetadataCapture();
    const cm = await getCallbackManagerForConfig({
      callbacks: [tracer, capture],
      configurable: { thread_id: "th-123" },
    });

    const myFunc = RunnableLambda.from((x: number) => x);
    await myFunc.invoke(1, { callbacks: cm });

    await awaitAllCallbacks();

    // Non-tracer handler should NOT see configurable metadata
    expect(receivedMetadata.length).toBeGreaterThanOrEqual(1);
    for (const md of receivedMetadata) {
      expect(md).not.toHaveProperty("thread_id");
    }
  });
});

describe("tracer metadata through invoke", () => {
  test("tracer metadata applied to all runs", async () => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { env: "prod", service: "api" },
    });

    const child = RunnableLambda.from((x: number) => x + 1);
    const parent = RunnableLambda.from(async (x: number) => child.invoke(x));

    await parent.invoke(1, { callbacks: [tracer] });
    await awaitAllCallbacks();

    expect(mockClient.createRun).toHaveBeenCalledTimes(2);
    for (const call of mockClient.createRun.mock.calls) {
      const payload = call[0];
      expect(payload.extra?.metadata?.env).toBe("prod");
      expect(payload.extra?.metadata?.service).toBe("api");
    }
  });

  test("config metadata takes precedence over tracer metadata", async () => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { env: "prod", tracer_only: "yes" },
    });

    const myFunc = RunnableLambda.from((x: number) => x);

    await myFunc.invoke(1, {
      callbacks: [tracer],
      metadata: { env: "staging", config_only: "yes" },
    });
    await awaitAllCallbacks();

    expect(mockClient.createRun).toHaveBeenCalledTimes(1);
    const payload = mockClient.createRun.mock.calls[0][0];
    const md = payload.extra?.metadata;
    // Config wins for overlapping key
    expect(md.env).toBe("staging");
    // Both non-overlapping keys present
    expect(md.tracer_only).toBe("yes");
    expect(md.config_only).toBe("yes");
  });

  test("nested calls inherit config and tracer metadata", async () => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { tracer_key: "tracer_val" },
    });

    const child = RunnableLambda.from((x: number) => x + 1);
    const parent = RunnableLambda.from(async (x: number) => child.invoke(x));

    await parent.invoke(1, {
      callbacks: [tracer],
      metadata: { config_key: "config_val" },
    });
    await awaitAllCallbacks();

    expect(mockClient.createRun).toHaveBeenCalledTimes(2);
    for (const call of mockClient.createRun.mock.calls) {
      const md = call[0].extra?.metadata;
      expect(md.config_key).toBe("config_val");
      expect(md.tracer_key).toBe("tracer_val");
    }
  });

  test("tracer metadata not applied to sibling handlers", async () => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { tracer_key: "tracer_val" },
    });

    const receivedMetadata: Record<string, unknown>[] = [];

    class MetadataCapture extends BaseCallbackHandler {
      name = "metadata_capture";
      async handleChainStart(
        _chain: any,
        _inputs: any,
        _runId?: string,
        _parentRunId?: string,
        _tags?: string[],
        metadata?: Record<string, unknown>
      ) {
        receivedMetadata.push({ ...metadata });
      }
    }

    const capture = new MetadataCapture();
    const myFunc = RunnableLambda.from((x: number) => x);

    await myFunc.invoke(1, {
      callbacks: [tracer, capture],
      metadata: { shared_key: "shared_val" },
    });
    await awaitAllCallbacks();

    // Non-tracer handler should NOT see tracer metadata
    expect(receivedMetadata.length).toBeGreaterThanOrEqual(1);
    for (const md of receivedMetadata) {
      expect(md.shared_key).toBe("shared_val");
      expect(md).not.toHaveProperty("tracer_key");
    }

    // But the posted runs SHOULD have both
    expect(mockClient.createRun).toHaveBeenCalled();
    for (const call of mockClient.createRun.mock.calls) {
      const md = call[0].extra?.metadata;
      expect(md.shared_key).toBe("shared_val");
      expect(md.tracer_key).toBe("tracer_val");
    }
  });
});
