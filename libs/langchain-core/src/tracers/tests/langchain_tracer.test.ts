/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi, test, expect, describe } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import * as uuid from "uuid";

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
});

describe("LangChainTracer output flattening", () => {
  test("onLLMEnd flattens outputs when generations is a 1x1 matrix", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["test prompt"], runId);

    const message = new AIMessage({ content: "Hello!" });
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
    // Should be flattened to just the message
    expect(updatedRun.outputs).toEqual(message);
  });

  test("onLLMEnd does not flatten outputs when there are multiple generations in a batch", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["test prompt"], runId);

    const generation1: ChatGeneration = {
      text: "Hello!",
      message: new AIMessage({ content: "Hello!" }),
    };
    const generation2: ChatGeneration = {
      text: "Hi there!",
      message: new AIMessage({ content: "Hi there!" }),
    };

    await tracer.handleLLMEnd(
      {
        generations: [[generation1, generation2]],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    // Should NOT be flattened - keep original structure
    expect(updatedRun.outputs).toEqual({
      generations: [[generation1, generation2]],
    });
  });

  test("onLLMEnd does not flatten outputs when there are multiple batches", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["prompt1", "prompt2"], runId);

    const generation1: ChatGeneration = {
      text: "Response 1",
      message: new AIMessage({ content: "Response 1" }),
    };
    const generation2: ChatGeneration = {
      text: "Response 2",
      message: new AIMessage({ content: "Response 2" }),
    };

    await tracer.handleLLMEnd(
      {
        generations: [[generation1], [generation2]],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    // Should NOT be flattened - keep original structure
    expect(updatedRun.outputs).toEqual({
      generations: [[generation1], [generation2]],
    });
  });

  test("onLLMEnd does not flatten outputs when there are multiple batches with multiple generations", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["prompt1", "prompt2"], runId);

    const gen1a: ChatGeneration = {
      text: "1a",
      message: new AIMessage({ content: "1a" }),
    };
    const gen1b: ChatGeneration = {
      text: "1b",
      message: new AIMessage({ content: "1b" }),
    };
    const gen2a: ChatGeneration = {
      text: "2a",
      message: new AIMessage({ content: "2a" }),
    };
    const gen2b: ChatGeneration = {
      text: "2b",
      message: new AIMessage({ content: "2b" }),
    };

    await tracer.handleLLMEnd(
      {
        generations: [
          [gen1a, gen1b],
          [gen2a, gen2b],
        ],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    // Should NOT be flattened - keep original structure
    expect(updatedRun.outputs).toEqual({
      generations: [
        [gen1a, gen1b],
        [gen2a, gen2b],
      ],
    });
  });

  test("onLLMEnd handles empty generations without error", async () => {
    const mockClient = {
      createRun: vi.fn(),
      updateRun: vi.fn(),
    } as any;

    const tracer = new LangChainTracer({ client: mockClient });
    const runId = uuid.v4();

    await tracer.handleLLMStart(serialized, ["test prompt"], runId);

    await tracer.handleLLMEnd(
      {
        generations: [],
      },
      runId
    );

    const updateCall = mockClient.updateRun.mock.calls[0];
    const updatedRun = updateCall[1];
    // Should keep original structure when empty
    expect(updatedRun.outputs).toEqual({ generations: [] });
  });
});
