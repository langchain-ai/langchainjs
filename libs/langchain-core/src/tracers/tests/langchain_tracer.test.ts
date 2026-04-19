/* oxlint-disable @typescript-eslint/no-explicit-any */

import { vi, test, expect, describe } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import * as uuid from "uuid";
import { RunTree } from "langsmith/run_trees";
import { withRunTree } from "langsmith/singletons/traceable";

import { RunnableLambda } from "../../runnables/base.js";
import { LangChainTracer } from "../tracer_langchain.js";
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

  test("tracing defaults patch missing run metadata without overriding explicit values", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { env: "prod", tenant: "default" },
      tags: ["tracer-tag"],
    });
    const runId = uuid.v4();

    await tracer.handleLLMStart(
      serialized,
      ["test prompt"],
      runId,
      undefined,
      undefined,
      ["run-tag"],
      { tenant: "explicit" }
    );
    await tracer.handleLLMEnd({ generations: [[{ text: "ok" }]] }, runId);

    const updateCall = mockClient.updateRun.mock.calls[0][1];
    expect(updateCall.extra?.metadata?.env).toBe("prod");
    expect(updateCall.extra?.metadata?.tenant).toBe("explicit");
    expect(updateCall.tags).toEqual(
      expect.arrayContaining(["run-tag", "tracer-tag"])
    );
  });

  test("copyWithTracingConfig keeps original tracer unchanged", () => {
    const tracer = new LangChainTracer({
      client: { createRun: vi.fn(), updateRun: vi.fn() } as any,
      metadata: { env: "staging" },
      tags: ["existing"],
    });
    const copied = tracer.copyWithTracingConfig({
      metadata: { tenant: "alpha", env: "prod" },
      tags: ["tenant:alpha", "existing"],
    });

    expect(copied).not.toBe(tracer);
    expect(copied.tracingMetadata).toEqual({
      env: "staging",
      tenant: "alpha",
    });
    expect(copied.tracingTags).toEqual(["existing", "tenant:alpha"]);
    expect(tracer.tracingMetadata).toEqual({ env: "staging" });
    expect(tracer.tracingTags).toEqual(["existing"]);
  });
});

describe("LangChainTracer allowlisted inheritable metadata overrides", () => {
  /**
   * Build a fresh `RunTree` suitable for use as the target of
   * `withRunTree(...)` with the given metadata. We attach a no-op mock
   * client so that any accidental `postRun`/`patchRun` called against
   * the passed-in RunTree itself (as opposed to clones made by the
   * tracer) doesn't blow up.
   */
  function makeScopedRunTree(
    metadata: Record<string, unknown>,
    name = "scoped_root"
  ): RunTree {
    return new RunTree({
      name,
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      client: {
        createRun: vi.fn().mockResolvedValue(undefined),
        updateRun: vi.fn().mockResolvedValue(undefined),
      } as any,
      tracingEnabled: false,
      metadata,
    });
  }

  test("withRunTree rescopes allowlisted `ls_agent_type` mid-run for tracer only", async () => {
    // Mirrors the Python
    // `test_live_tracing_context_overrides_allowlisted_keys_tracer_only`:
    // the outer tracer is configured with a default `ls_agent_type`;
    // mid-run the caller enters `withRunTree(...)` with a RunTree whose
    // metadata overrides `ls_agent_type`; the inner run's LangSmith
    // payload must show the rescoped value while non-tracer callback
    // handlers must never observe `ls_agent_type` at all.
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const mockClient = {
      createRun: vi.fn().mockResolvedValue(undefined),
      updateRun: vi.fn().mockResolvedValue(undefined),
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { ls_agent_type: "root" },
    });

    // Directly drive the tracer's lifecycle instead of going through
    // Runnable so we have precise control over which run is inside
    // the `withRunTree` scope and which is outside.
    const outerRunId = uuid.v4();
    const innerRunId = uuid.v4();

    // Outer run: starts before `withRunTree`, so it inherits the
    // tracer's default `ls_agent_type: "root"` from its configure-time
    // `tracingMetadata`.
    await tracer.handleChainStart(
      serialized,
      { input: 1 },
      outerRunId,
      undefined,
      undefined,
      undefined,
      undefined,
      "outer"
    );

    // Inner run: starts while `withRunTree(scoped, ...)` is active.
    // The scoped RunTree overrides `ls_agent_type` to "subagent".
    const scoped = makeScopedRunTree({ ls_agent_type: "subagent" });
    await withRunTree(scoped, async () => {
      await tracer.handleChainStart(
        serialized,
        { input: 1 },
        innerRunId,
        outerRunId,
        undefined,
        undefined,
        undefined,
        "inner"
      );
      await tracer.handleChainEnd({ output: 1 }, innerRunId);
    });
    await tracer.handleChainEnd({ output: 1 }, outerRunId);
    await awaitAllCallbacks();

    // Inspect the update payloads (patches to LangSmith) rather than
    // the initial create payloads: `_patchMissingTracingDefaults` runs
    // on update for non-allowlisted keys, and the allowlisted
    // override is re-applied at read time in
    // `getRunTreeWithTracingConfig`, so the final-state metadata is
    // what LangSmith ends up with.
    const updates = mockClient.updateRun.mock.calls.map(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any) => ({ id: call[0], update: call[1] })
    );
    const outerUpdate = updates.find(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => u.id === outerRunId
    );
    const innerUpdate = updates.find(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => u.id === innerRunId
    );
    expect(outerUpdate).toBeDefined();
    expect(innerUpdate).toBeDefined();

    // Outer run keeps the tracer's default `ls_agent_type: "root"` —
    // the mid-run `withRunTree` scope opened AFTER it started and
    // closed BEFORE it ended, so the override never applied.
    expect(outerUpdate.update.extra?.metadata?.ls_agent_type).toBe("root");

    // Inner run is posted while the `withRunTree` scope is active, so
    // the allowlisted override wins over the outer tracer default.
    expect(innerUpdate.update.extra?.metadata?.ls_agent_type).toBe("subagent");
  });

  test("withRunTree does NOT rescope non-allowlisted keys (first-wins preserved)", async () => {
    // Mirrors the Python
    // `test_live_tracing_context_non_allowlisted_keys_do_not_override`:
    // a non-allowlisted key like `env` must keep the outer tracer's
    // default value for every posted run, even if a mid-run `withRunTree`
    // scope carries a different value.
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );

    const mockClient = {
      createRun: vi.fn().mockResolvedValue(undefined),
      updateRun: vi.fn().mockResolvedValue(undefined),
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { env: "prod" },
    });

    const outerRunId = uuid.v4();
    const innerRunId = uuid.v4();

    await tracer.handleChainStart(
      serialized,
      { input: 1 },
      outerRunId,
      undefined,
      undefined,
      undefined,
      undefined,
      "outer"
    );

    const scoped = makeScopedRunTree({ env: "staging" });
    await withRunTree(scoped, async () => {
      await tracer.handleChainStart(
        serialized,
        { input: 1 },
        innerRunId,
        outerRunId,
        undefined,
        undefined,
        undefined,
        "inner"
      );
      await tracer.handleChainEnd({ output: 1 }, innerRunId);
    });
    await tracer.handleChainEnd({ output: 1 }, outerRunId);
    await awaitAllCallbacks();

    const updates = mockClient.updateRun.mock.calls.map(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any) => ({ id: call[0], update: call[1] })
    );
    expect(updates.length).toBe(2);
    // `env` is not allowlisted, so the tracer's default ("prod") must
    // survive on every posted run regardless of any mid-run
    // `withRunTree` scope setting a different value.
    for (const { update } of updates) {
      expect(update.extra?.metadata?.env).toBe("prod");
    }
  });
});
