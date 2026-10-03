import { describe, it, expect, vi, afterEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ConfigurableModel, initChatModel } from "../universal.js";
import * as universal from "../universal.js";

class DummyChatModel {
  profile: Record<string, unknown>;

  constructor(fields: { model?: string }) {
    this.profile = { maxInputTokens: fields.model ? 999 : 0 };
  }
}

describe("ConfigurableModel._getCacheKey", () => {
  it("ignores __pregel_ keys under config.configurable", () => {
    const model = new ConfigurableModel({});
    const config1 = { configurable: { model: "gpt-4o", __pregel_foo: "bar" } };
    const config2 = { configurable: { model: "gpt-4o" } };

    expect(model._getCacheKey(config1)).toBe(model._getCacheKey(config2));
  });

  it("returns deterministic key for undefined or empty config", () => {
    const model = new ConfigurableModel({});
    const keyEmpty = model._getCacheKey({});
    const keyUndefined = model._getCacheKey(undefined);

    expect(typeof keyEmpty).toBe("string");
    expect(keyEmpty).toBe(keyUndefined);
  });

  it("ignores per-run config outside the model params", () => {
    const model = new ConfigurableModel({});
    const config1 = {
      configurable: { model: "gpt-4o", thread_id: "thread-1" },
      metadata: { request_id: "a" },
      runName: "first",
    };
    const config2 = {
      configurable: { model: "gpt-4o", thread_id: "thread-2" },
      metadata: { request_id: "b" },
      runName: "second",
    };

    expect(model._getCacheKey(config1)).toBe(model._getCacheKey(config2));
  });
});

describe("ConfigurableModel._getModelInstance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns same instance when called with no config (default cache key)", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");
    const instance1 = await model._getModelInstance();
    const instance2 = await model._getModelInstance();

    expect(instance1).toBe(instance2);
  });

  it("caches instances for identical cache keys", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");
    const config = { configurable: { model: "gpt-4o" } };
    const instance1 = await model._getModelInstance(config);
    const instance2 = await model._getModelInstance(config);

    expect(instance1).toBe(instance2);
  });

  it("reuses cached instances when only __pregel_ keys differ", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");
    const config1 = { configurable: { model: "gpt-4o", __pregel_foo: "bar" } };
    const config2 = { configurable: { model: "gpt-4o", __pregel_foo: "baz" } };

    const instance1 = await model._getModelInstance(config1);
    const instance2 = await model._getModelInstance(config2);

    expect(instance1).toBe(instance2);
  });

  it("does not reuse cached instances when real configurable fields differ", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");

    const instance1 = await model._getModelInstance({
      configurable: { model: "gpt-4o" },
    });
    const instance2 = await model._getModelInstance({
      configurable: { model: "gpt-4o-mini" },
    });

    expect(instance1).not.toBe(instance2);
  });

  it('keeps LangGraph run keys out of the model params with configurableFields "any"', async () => {
    const model = await initChatModel("gpt-4o-mini", {
      configurableFields: "any",
    });
    const runConfig = (threadId: string, temperature: number) => ({
      configurable: {
        temperature,
        thread_id: threadId,
        checkpoint_ns: "",
        checkpoint_id: `${threadId}-checkpoint`,
        checkpoint_map: { "": `${threadId}-checkpoint` },
        __pregel_task_id: `${threadId}-task`,
      },
    });

    const instance1 = await model._getModelInstance(runConfig("thread-1", 0.5));
    const instance2 = await model._getModelInstance(runConfig("thread-2", 0.5));
    const instance3 = await model._getModelInstance(runConfig("thread-3", 0.7));

    expect(model._modelParams(runConfig("thread-1", 0.5))).toEqual({
      temperature: 0.5,
    });
    expect(instance1).toBe(instance2);
    expect(instance3).not.toBe(instance1);
  });
});

describe("ConfigurableModel in a LangGraph node", () => {
  it("reuses one model instance across runs on different threads", async () => {
    const completion = {
      id: "chatcmpl-1",
      object: "chat.completion",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "ok" },
          finish_reason: "stop",
        },
      ],
    };
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify(completion), {
          headers: { "content-type": "application/json" },
        })
    );
    const model = await initChatModel("gpt-4o-mini", {
      apiKey: "test-key",
      configuration: { fetch: mockFetch },
    });
    const graph = new StateGraph(MessagesAnnotation)
      .addNode("llm", async (state, config) => ({
        messages: [await model.invoke(state.messages, config)],
      }))
      .addEdge(START, "llm")
      .addEdge("llm", END)
      .compile({ checkpointer: new MemorySaver() });

    for (let i = 0; i < 5; i += 1) {
      await graph.invoke(
        { messages: [new HumanMessage("hi")] },
        { configurable: { thread_id: `thread-${i}` } }
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(model["_modelInstanceCache"].size).toBe(1);
  });
});

describe("ConfigurableModel.profile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns explicit profile override (even after caching an inner instance)", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini", {
      profile: { maxInputTokens: 1 },
    });
    await model._getModelInstance();

    expect(model.profile.maxInputTokens).toBe(1);
  });

  it("returns {} if no explicit profile exists and no cached instance exists", () => {
    const model = new ConfigurableModel({});
    expect(model.profile).toEqual({});
  });

  it("returns the cached inner instance profile when no explicit profile exists", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini", {});
    expect(model.profile.maxInputTokens).toBe(128000);
  });
});
