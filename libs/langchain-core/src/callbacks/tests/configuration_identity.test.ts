import { EventStreamCallbackHandler } from "../../tracers/event_stream.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BaseCallbackHandler } from "../base.js";
import { CallbackManager, ensureHandler } from "../manager.js";
import { AIMessage, HumanMessage } from "../../messages/index.js";
import { mergeConfigs } from "../../runnables/config.js";
import { LangChainTracer } from "../../tracers/tracer_langchain.js";

class RecordingHandler extends BaseCallbackHandler {
  name = "registration-contract";
  handleChatModelStart = vi.fn();
  handleLLMNewToken = vi.fn();
  handleLLMEnd = vi.fn();
  handleLLMError = vi.fn();
  handleChainStart = vi.fn();
  handleChainEnd = vi.fn();
  handleToolStart = vi.fn();
  handleToolEnd = vi.fn();
  handleRetrieverStart = vi.fn();
  handleRetrieverEnd = vi.fn();

  constructor() {
    super({ _awaitHandler: true });
  }
}

const serialized = {
  lc: 1 as const,
  type: "not_implemented" as const,
  id: ["contract"],
};
const output = {
  generations: [[{ text: "hello", message: new AIMessage("hello") }]],
};

function callbacks(handler: BaseCallbackHandler, asManager: boolean) {
  return asManager
    ? new CallbackManager(undefined, {
        handlers: [handler],
        inheritableHandlers: [handler],
      })
    : [handler];
}

describe("callback configuration identity", () => {
  const tracingKeys = [
    "LANGSMITH_TRACING",
    "LANGCHAIN_TRACING_V2",
    "LANGCHAIN_TRACING",
  ] as const;
  const tracingBefore = tracingKeys.map((key) => process.env[key]);

  beforeAll(() => {
    for (const key of tracingKeys) process.env[key] = "";
  });

  afterAll(() => {
    tracingKeys.forEach((key, index) => {
      if (tracingBefore[index] === undefined) delete process.env[key];
      else process.env[key] = tracingBefore[index];
    });
  });
  it.each([
    { leftManager: false, rightManager: false },
    { leftManager: false, rightManager: true },
    { leftManager: true, rightManager: false },
    { leftManager: true, rightManager: true },
  ])(
    "delivers every lifecycle once after merging $leftManager / $rightManager managers",
    async ({ leftManager, rightManager }) => {
      const handler = new RecordingHandler();
      const merged = mergeConfigs(
        { callbacks: callbacks(handler, leftManager) },
        { callbacks: callbacks(handler, rightManager) }
      );
      const manager = await CallbackManager.configure(merged.callbacks);
      expect(manager).toBeDefined();
      if (!manager) return;

      const [model] = await manager.handleChatModelStart(serialized, [
        [new HumanMessage("hello")],
      ]);
      await model.handleLLMNewToken("hello");
      await model.handleLLMEnd(output);
      const chain = await manager.handleChainStart(serialized, {});
      await chain.handleChainEnd({});
      const tool = await manager.handleToolStart(serialized, "input");
      await tool.handleToolEnd("output");
      const retriever = await manager.handleRetrieverStart(serialized, "query");
      await retriever.handleRetrieverEnd([]);

      for (const callback of [
        handler.handleChatModelStart,
        handler.handleLLMNewToken,
        handler.handleLLMEnd,
        handler.handleChainStart,
        handler.handleChainEnd,
        handler.handleToolStart,
        handler.handleToolEnd,
        handler.handleRetrieverStart,
        handler.handleRetrieverEnd,
      ])
        expect(callback).toHaveBeenCalledTimes(1);
    }
  );

  it("preserves constructor array ownership and normalizes configured copies in order", async () => {
    const first = new RecordingHandler();
    const second = new RecordingHandler();
    const handlers = [first, first];
    const inheritableHandlers = [first, first];
    const input = new CallbackManager("parent", {
      handlers,
      inheritableHandlers,
    });
    handlers.push(second);
    expect(input.handlers).toBe(handlers);
    expect(input.inheritableHandlers).toBe(inheritableHandlers);
    const manager = await CallbackManager.configure(input);
    expect(manager?.handlers).toEqual([first, second]);
    expect(manager?.inheritableHandlers).toEqual([first]);
    expect(manager?.getParentRunId()).toBe("parent");
    expect(handlers).toEqual([first, first, second]);
    expect(inheritableHandlers).toEqual([first, first]);
  });

  it("promotes an existing local handler and delivers it once to children", async () => {
    const handler = new RecordingHandler();
    const manager = new CallbackManager();
    manager.addHandler(handler, false);
    manager.addHandler(handler, true);
    manager.addHandler(handler, false);
    const configured = await CallbackManager.configure(manager);
    const parent = await configured!.handleChainStart(serialized, {});
    const child = await parent.getChild().handleChainStart(serialized, {});
    await child.handleChainEnd({});
    await parent.handleChainEnd({});
    expect(handler.handleChainStart).toHaveBeenCalledTimes(2);
    expect(handler.handleChainEnd).toHaveBeenCalledTimes(2);
    expect(child.parentRunId).toBe(parent.runId);
  });

  it("keeps local handlers out of child runs", async () => {
    const local = new RecordingHandler();
    const inherited = new RecordingHandler();
    const manager = new CallbackManager();
    manager.addHandler(local, false);
    manager.addHandler(inherited, true);
    const configured = await CallbackManager.configure(manager);
    const parent = await configured!.handleChainStart(serialized, {});
    const child = await parent.getChild().handleChainStart(serialized, {});
    await child.handleChainEnd({});
    await parent.handleChainEnd({});
    expect(local.handleChainEnd).toHaveBeenCalledTimes(1);
    expect(inherited.handleChainEnd).toHaveBeenCalledTimes(2);
  });

  it("keeps separate same-name handlers and independent registrations", async () => {
    const first = new RecordingHandler();
    const second = new RecordingHandler();
    const manager = new CallbackManager(undefined, {
      handlers: [first, second],
    });
    const [model] = await manager.handleChatModelStart(serialized, [
      [new HumanMessage("hello")],
    ]);
    await model.handleLLMEnd(output);
    expect(first.handleLLMEnd).toHaveBeenCalledTimes(1);
    expect(second.handleLLMEnd).toHaveBeenCalledTimes(1);
  });

  it("creates fresh wrappers and observes callback method changes between requests", async () => {
    const first = vi.fn();
    const replacement = vi.fn();
    const methods = { handleChainEnd: first };
    const firstHandler = ensureHandler(methods);
    firstHandler.ignoreChain = true;
    expect(ensureHandler(methods)).not.toBe(firstHandler);
    expect(ensureHandler(methods).ignoreChain).toBe(false);
    const manager = await CallbackManager.configure([methods]);
    await (await manager!.handleChainStart(serialized, {})).handleChainEnd({});
    methods.handleChainEnd = replacement;
    const next = await CallbackManager.configure([methods]);
    await (await next!.handleChainStart(serialized, {})).handleChainEnd({});
    expect(first).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit registrations until configuration", async () => {
    const handler = new RecordingHandler();
    const manager = new CallbackManager();
    manager.setHandlers([handler, handler], true);
    expect(manager.handlers).toEqual([handler, handler]);
    const configured = await CallbackManager.configure(manager);
    expect(configured?.handlers).toEqual([handler]);
    expect(configured?.inheritableHandlers).toEqual([handler]);
    manager.removeHandler(handler);
    manager.addHandler(handler, false);
    expect(manager.handlers).toEqual([handler]);
    expect(manager.inheritableHandlers).toEqual([]);
  });

  it("still coalesces LangSmith tracing copies by run store", async () => {
    const tracer = new LangChainTracer();
    const inherited = tracer.copyWithTracingConfig({ tags: ["child"] });
    const separate = new LangChainTracer();
    const manager = await CallbackManager.configure(
      new CallbackManager(undefined, {
        handlers: [tracer, inherited, separate],
        inheritableHandlers: [inherited, separate],
      })
    );
    expect(manager?.handlers).toHaveLength(2);
    expect(manager?.inheritableHandlers).toHaveLength(2);
    expect(manager?.handlers).toContain(separate);
    const mergedTracer = manager?.handlers.find(
      (handler) => handler !== separate
    ) as LangChainTracer;
    expect(mergedTracer._getRunStoreKey()).toBe(tracer._getRunStoreKey());
    expect(manager?.inheritableHandlers).toContain(mergedTracer);
  });

  it("keeps concurrent runs independent when they share a callback instance", async () => {
    const handler = new RecordingHandler();
    await Promise.all(
      [false, true].map(async (asManager) => {
        const config = mergeConfigs(
          { callbacks: callbacks(handler, asManager) },
          { callbacks: callbacks(handler, !asManager) }
        );
        const manager = await CallbackManager.configure(config.callbacks);
        expect(manager).toBeDefined();
        if (!manager) return;
        const [model] = await manager.handleChatModelStart(serialized, [
          [new HumanMessage("hello")],
        ]);
        await model.handleLLMEnd(output);
      })
    );
    expect(handler.handleChatModelStart).toHaveBeenCalledTimes(2);
    expect(handler.handleLLMEnd).toHaveBeenCalledTimes(2);
    const starts = handler.handleChatModelStart.mock.calls.map(
      (call) => call[2]
    );
    const ends = handler.handleLLMEnd.mock.calls.map((call) => call[1]);
    expect(new Set(starts).size).toBe(2);
    expect(ends.sort()).toEqual(starts.sort());
  });

  it("delivers errors once and still reports a later successful retry", async () => {
    const handler = new RecordingHandler();
    const manager = (await CallbackManager.configure(
      new CallbackManager(undefined, { handlers: [handler, handler] })
    ))!;
    const [failed] = await manager.handleChatModelStart(serialized, [
      [new HumanMessage("hello")],
    ]);
    const failure = new Error("provider failed");
    await failed.handleLLMError(failure);
    const [retried] = await manager.handleChatModelStart(serialized, [
      [new HumanMessage("hello")],
    ]);
    await retried.handleLLMEnd(output);
    expect(handler.handleChatModelStart).toHaveBeenCalledTimes(2);
    expect(handler.handleLLMError).toHaveBeenCalledTimes(1);
    expect(handler.handleLLMEnd).toHaveBeenCalledTimes(1);
    expect(retried.runId).not.toBe(failed.runId);
  });
  it.each([false, true])(
    "preserves inheritance when the local manager is on the left: %s",
    async (localFirst) => {
      const shared = new RecordingHandler();
      const localOnly = new RecordingHandler();
      const local = new CallbackManager("ancestor", {
        handlers: [shared, localOnly],
        tags: ["inherited", "local"],
        inheritableTags: ["inherited"],
        metadata: { inherited: 1, local: 2 },
        inheritableMetadata: { inherited: 1 },
      });
      const configs = [{ callbacks: local }, { callbacks: [shared] }];
      const merged = mergeConfigs(
        ...(localFirst ? configs : configs.reverse())
      );
      const manager = (await CallbackManager.configure(merged.callbacks))!;
      expect(manager.getParentRunId()).toBe("ancestor");
      const parent = await manager.handleChainStart(serialized, {});
      const childManager = parent.getChild();
      expect(childManager.tags).toEqual(["inherited"]);
      expect(childManager.metadata).toEqual({ inherited: 1 });
      const child = await childManager.handleChainStart(serialized, {});
      await child.handleChainEnd({});
      await parent.handleChainEnd({});
      expect(shared.handleChainEnd).toHaveBeenCalledTimes(2);
      expect(localOnly.handleChainEnd).toHaveBeenCalledTimes(1);
    }
  );

  it("keeps mutable method-object state private to each configured wrapper", async () => {
    const counts: number[] = [];
    const methods = {
      count: 0,
      handleChainEnd() {
        counts.push(++this.count);
      },
    };
    for (let i = 0; i < 2; i++) {
      const manager = (await CallbackManager.configure([methods]))!;
      await (await manager.handleChainStart(serialized, {})).handleChainEnd({});
    }
    expect(counts).toEqual([1, 1]);
    expect(methods.count).toBe(0);
  });

  it.each([false, true])(
    "pairs streamed model events when duplicate callbacks use managers: %s",
    async (asManager) => {
      const handler = new EventStreamCallbackHandler({ autoClose: false });
      const config = mergeConfigs(
        { callbacks: callbacks(handler, asManager) },
        { callbacks: callbacks(handler, !asManager) }
      );
      const manager = CallbackManager.configure(config.callbacks)!;
      const events: string[] = [];
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consume = (async () => {
        for await (const event of handler) events.push(event.event);
      })();
      let warnings: unknown[][] = [];
      try {
        const [model] = await manager.handleChatModelStart(serialized, [
          [new HumanMessage("hello")],
        ]);
        await model.handleLLMEnd(output);
      } finally {
        await handler.finish();
        await consume;
        warnings = [...warning.mock.calls];
        warning.mockRestore();
      }
      expect(events).toEqual(["on_chat_model_start", "on_chat_model_end"]);
      expect(warnings).toEqual([]);
    }
  );
});
