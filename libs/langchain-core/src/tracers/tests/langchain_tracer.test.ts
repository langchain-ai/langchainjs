/* oxlint-disable @typescript-eslint/no-explicit-any */

import { vi, test, expect, describe, afterEach } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { RunTree } from "langsmith/run_trees";
import * as uuid from "../../utils/uuid/index.js";

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

describe("LangChainTracer code and environment destinations", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const CODE_ADDRESS = {
    agentId: "code-agent",
    agentEnvironment: "production",
  };

  function caseFor(inputs: {
    codeProject: boolean;
    codeAddress: boolean;
    envProject: boolean;
    envAddress: boolean;
  }) {
    // Expected outcome: code defined overrides supersede env vars
    if (inputs.codeProject && inputs.codeAddress) {
      return {
        kind: "conflict",
        description: "confict",
        error: /A run is sent to a project .* or to an address .* not both/,
      } as const;
    }

    if (inputs.codeProject) {
      return {
        kind: "traced",
        description: "traced code-project",
        payload: { session_name: "code-project", address: undefined },
      } as const;
    }

    if (inputs.codeAddress) {
      return {
        kind: "traced",
        description: "traced code-agent",
        payload: { session_name: undefined, address: CODE_ADDRESS },
      } as const;
    }

    if (inputs.envProject && inputs.envAddress)
      return { kind: "untraced", description: "untraced" } as const;

    if (inputs.envProject) {
      return {
        kind: "traced",
        description: "traced env-project",
        payload: { session_name: "env-project", address: undefined },
      } as const;
    }

    if (inputs.envAddress) {
      return {
        kind: "traced",
        description: "traced env-agent",
        payload: {
          session_name: undefined,
          address: { agentId: "env-agent", agentEnvironment: "staging" },
        },
      } as const;
    }

    return {
      kind: "traced",
      description: "traced default",
      payload: { session_name: "default", address: undefined },
    } as const;
  }

  const cases = [false, true].flatMap((codeProject) =>
    [false, true].flatMap((codeAddress) =>
      [false, true].flatMap((envProject) =>
        [false, true].map((envAddress) => {
          const inputs = { codeProject, codeAddress, envProject, envAddress };
          const outcome = caseFor(inputs);
          const bool = (v: boolean) => (v ? "1" : "0");
          const title = `project(code: ${bool(codeProject)}, env: ${bool(envProject)}) + address(code: ${bool(codeAddress)}; env: ${bool(envAddress)}) -> ${outcome.description}`;
          return [title, { ...inputs, outcome }] as const;
        })
      )
    )
  );

  test.each(cases)(
    "%s",
    async (
      _,
      { codeProject, codeAddress, envProject, envAddress, outcome }
    ) => {
      vi.stubEnv("LANGSMITH_PROJECT", envProject ? "env-project" : undefined);
      vi.stubEnv("LANGCHAIN_PROJECT", undefined);
      vi.stubEnv("LANGCHAIN_SESSION", undefined);
      vi.stubEnv("LANGSMITH_AGENT_ID", envAddress ? "env-agent" : undefined);
      vi.stubEnv(
        "LANGSMITH_AGENT_ENVIRONMENT",
        envAddress ? "staging" : undefined
      );
      vi.stubEnv("LANGSMITH_TRACING", "true");

      const persistedCreateRun = vi.fn();
      const persistedUpdateRun = vi.fn();
      const tracerState: { tracer?: LangChainTracer } = {};
      // Client payloads do not carry tracingEnabled. Read it from the SDK's
      // configured RunTree so this mock respects its destination resolution.
      const mockClient = {
        createRun: vi.fn(async (run: { id?: string }) => {
          if (
            run.id &&
            tracerState.tracer?.getRunTreeWithTracingConfig(run.id)
              ?.tracingEnabled !== false
          ) {
            persistedCreateRun(run);
          }
        }),
        updateRun: vi.fn(async (id: string, run: unknown) => {
          if (
            tracerState.tracer?.getRunTreeWithTracingConfig(id)
              ?.tracingEnabled !== false
          ) {
            persistedUpdateRun(id, run);
          }
        }),
      };
      const tracer = new LangChainTracer({
        client: mockClient,
        projectName: codeProject ? "code-project" : undefined,
        address: codeAddress ? CODE_ADDRESS : undefined,
      });
      tracerState.tracer = tracer;
      const runId = uuid.v4();
      const start = tracer.handleLLMStart(serialized, ["test prompt"], runId);

      if (outcome.kind === "conflict") {
        await expect(start).rejects.toThrow(outcome.error);
        expect(mockClient.createRun).not.toHaveBeenCalled();
        return;
      }

      await start;
      await tracer.handleLLMEnd({ generations: [[{ text: "ok" }]] }, runId);

      if (outcome.kind === "untraced") {
        // An invalid environment destination leaves the run untraced.
        expect(persistedCreateRun).not.toHaveBeenCalled();
        expect(persistedUpdateRun).not.toHaveBeenCalled();
        return;
      }

      expect(persistedCreateRun).toHaveBeenCalledTimes(1);
      expect(persistedUpdateRun).toHaveBeenCalledTimes(1);
      expect(persistedCreateRun).toHaveBeenCalledWith(
        expect.objectContaining(outcome.payload)
      );
      expect(persistedUpdateRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining(outcome.payload)
      );
    }
  );
});

test("LangChainTracer inherits an addressed parent without assigning a project", () => {
  const tracer = new LangChainTracer();
  const address = { agentId: "support", agentEnvironment: "production" };

  const parent = new RunTree({ name: "parent", address });

  expect(tracer.projectName).toBeUndefined();
  expect(parent.project_name).toBeUndefined();

  tracer.updateFromRunTree(parent);

  // Reconstructing the inherited run must not introduce a project/address conflict.
  const runTree = tracer.getRunTreeWithTracingConfig(parent.id);
  expect(runTree).toBeDefined();
  expect(runTree?.address).toEqual(address);
  expect(runTree?.project_name).toBeUndefined();
});

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

  test("copyWithTracingConfig allows nested override of allowlisted keys", () => {
    const tracer = new LangChainTracer({
      client: { createRun: vi.fn(), updateRun: vi.fn() } as any,
      metadata: { ls_agent_type: "root", env: "prod" },
    });
    const copied = tracer.copyWithTracingConfig({
      metadata: { ls_agent_type: "subagent", env: "dev" },
    });

    // `ls_agent_type` is on the LangSmith allowlist, so the nested
    // value wins. `env` is not, so the ancestor value is preserved.
    expect(copied.tracingMetadata).toEqual({
      ls_agent_type: "subagent",
      env: "prod",
    });
    // Original tracer is not mutated.
    expect(tracer.tracingMetadata).toEqual({
      ls_agent_type: "root",
      env: "prod",
    });
  });

  test("tracing defaults allow allowlisted keys to override explicit run values", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({
      client: mockClient,
      metadata: { ls_agent_type: "subagent", env: "prod" },
    });
    const runId = uuid.v4();

    // Start the run with an explicit `ls_agent_type` on the run's own
    // metadata. The tracer's `ls_agent_type: "subagent"` is on the
    // LangSmith allowlist, so it must override the run-level value,
    // while non-allowlisted keys (like `env`) follow first-wins and
    // preserve any explicit run-level value.
    await tracer.handleLLMStart(
      serialized,
      ["test prompt"],
      runId,
      undefined,
      undefined,
      undefined,
      { ls_agent_type: "root", env: "explicit" }
    );
    await tracer.handleLLMEnd({ generations: [[{ text: "ok" }]] }, runId);

    const updateCall = mockClient.updateRun.mock.calls[0][1];
    expect(updateCall.extra?.metadata?.ls_agent_type).toBe("subagent");
    expect(updateCall.extra?.metadata?.env).toBe("explicit");
  });
});
