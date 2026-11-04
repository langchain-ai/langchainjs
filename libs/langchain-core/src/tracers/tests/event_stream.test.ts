import { describe, test, expect } from "vitest";
import { EventStreamCallbackHandler } from "../event_stream.js";
import { Run } from "../../callbacks/manager.js";
import { BaseMessage } from "../../messages/index.js";
import type { ToolCall } from "../../messages/tool.js";

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    name: "run",
    start_time: Date.now(),
    execution_order: 1,
    child_execution_order: 1,
    child_runs: [],
    extra: {},
    tags: [],
    trace_id: "trace-1",
    dotted_order: "1",
    parent_run_id: undefined,
    ...overrides,
  };
}

describe("EventStreamCallbackHandler duplicate end delivery", () => {
  test("a chain end delivered twice emits once and does not throw", async () => {
    const handler = new EventStreamCallbackHandler({ autoClose: false });
    const events: string[] = [];
    const consume = (async () => {
      for await (const event of handler.receiveStream) {
        events.push(event.event);
      }
    })();

    const run = makeRun({ run_type: "chain" });
    await handler.handleChainStart?.(
      { name: "my_chain" },
      { input: "x" },
      run.id,
      run.parent_run_id,
      undefined,
      {},
      "chain",
      run.name
    );

    await handler.handleChainEnd?.(
      { outputs: { result: 1 } },
      run.id,
      run.parent_run_id,
      undefined,
      undefined
    );
    // Duplicate delivery of the same end (nested-graph double registration).
    await handler.handleChainEnd?.(
      { outputs: { result: 1 } },
      run.id,
      run.parent_run_id,
      undefined,
      undefined
    );

    await handler.finish();
    await consume;

    const chainEndEvents = events.filter((e) => e === "on_chain_end");
    expect(chainEndEvents).toHaveLength(1);
  });

  test("an llm end delivered twice emits once and does not throw", async () => {
    const handler = new EventStreamCallbackHandler({ autoClose: false });
    const events: string[] = [];
    const consume = (async () => {
      for await (const event of handler.receiveStream) {
        events.push(event.event);
      }
    })();

    const run = makeRun({ run_type: "llm" });
    await handler.handleLLMStart?.(
      { name: "my_llm" },
      ["hi"],
      run.id,
      run.parent_run_id,
      {},
      undefined,
      undefined,
      run.name
    );

    const message = new BaseMessage({ content: "hello" });
    const outputs = {
      generations: [[{ text: "hello", message }]],
    };
    await handler.handleLLMEnd?.(outputs, run.id);
    // Duplicate delivery.
    await handler.handleLLMEnd?.(outputs, run.id);

    await handler.finish();
    await consume;

    const llmEndEvents = events.filter((e) => e === "on_llm_end");
    expect(llmEndEvents).toHaveLength(1);
  });

  test("a tool end delivered twice emits once and does not throw", async () => {
    const handler = new EventStreamCallbackHandler({ autoClose: false });
    const events: string[] = [];
    const consume = (async () => {
      for await (const event of handler.receiveStream) {
        events.push(event.event);
      }
    })();

    const run = makeRun({ run_type: "tool" });
    await handler.handleToolStart?.(
      { name: "my_tool" },
      "{}",
      run.id,
      run.parent_run_id,
      undefined,
      {},
      run.name
    );

    await handler.handleToolEnd?.({ output: "done" }, run.id);
    // Duplicate delivery.
    await handler.handleToolEnd?.({ output: "done" }, run.id);

    await handler.finish();
    await consume;

    const toolEndEvents = events.filter((e) => e === "on_tool_end");
    expect(toolEndEvents).toHaveLength(1);
  });

  test("a retriever end delivered twice emits once and does not throw", async () => {
    const handler = new EventStreamCallbackHandler({ autoClose: false });
    const events: string[] = [];
    const consume = (async () => {
      for await (const event of handler.receiveStream) {
        events.push(event.event);
      }
    })();

    const run = makeRun({ run_type: "retriever" });
    await handler.handleRetrieverStart?.(
      { name: "my_retriever" },
      "q",
      run.id,
      run.parent_run_id,
      undefined,
      {},
      run.name
    );

    await handler.handleRetrieverEnd?.({ documents: [] }, run.id);
    // Duplicate delivery.
    await handler.handleRetrieverEnd?.({ documents: [] }, run.id);

    await handler.finish();
    await consume;

    const retrieverEndEvents = events.filter((e) => e === "on_retriever_end");
    expect(retrieverEndEvents).toHaveLength(1);
  });
});
