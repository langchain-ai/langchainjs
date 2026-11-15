import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/index.js";
import { tool } from "../../tools/index.js";
import type { ToolRunnableConfig } from "../../tools/types.js";
import { RunnableLambda } from "../base.js";
import {
  _getTracingInheritableMetadataFromConfig,
  ensureConfig,
  mergeConfigs,
  pickRunnableConfigKeys,
} from "../config.js";

describe("mergeConfigs metadata", () => {
  it("merges metadata with last-writer-wins", () => {
    const result = mergeConfigs(
      { metadata: { ls_provider: "openai", ls_model_type: "chat" } },
      { metadata: { ls_provider: "anthropic", ls_temperature: 0.7 } }
    );
    expect(result.metadata).toEqual({
      ls_provider: "anthropic",
      ls_model_type: "chat",
      ls_temperature: 0.7,
    });
  });

  it("merges metadata across three configs", () => {
    const result = mergeConfigs(
      { metadata: { a: 1 } },
      { metadata: { b: 2 } },
      { metadata: { c: 3 } }
    );
    expect(result.metadata).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("later config overwrites earlier for same key", () => {
    const result = mergeConfigs({ metadata: { a: 1 } }, { metadata: { a: 2 } });
    expect(result.metadata).toEqual({ a: 2 });
  });

  it("handles undefined and null configs", () => {
    const result = mergeConfigs(undefined, { metadata: { a: 1 } }, null);
    expect(result.metadata).toEqual({ a: 1 });
  });

  it("handles empty metadata", () => {
    const result = mergeConfigs({ metadata: {} }, { metadata: { a: 1 } });
    expect(result.metadata).toEqual({ a: 1 });
  });
});

describe("ensureConfig and tracer metadata behavior", () => {
  it("copies only configurable model into general metadata", () => {
    const config = ensureConfig({
      configurable: {
        model: "gpt-4o",
        thread_id: "th-123",
        temperature: 0.2,
      },
      metadata: { explicit: true },
    });

    expect(config.metadata).toEqual({
      explicit: true,
      model: "gpt-4o",
    });
  });

  it("builds tracer inheritable metadata from primitive configurable values", () => {
    const config = ensureConfig({
      configurable: {
        model: "from-configurable",
        thread_id: "th-123",
        checkpoint_id: "ckpt-1",
        temperature: 0.5,
        streaming: true,
        api_key: "should-not-propagate",
        __secret_key: "should-not-propagate",
        custom_setting: { nested: true },
        none_value: undefined,
      },
    });

    expect(_getTracingInheritableMetadataFromConfig(config)).toEqual({
      thread_id: "th-123",
      checkpoint_id: "ckpt-1",
      temperature: 0.5,
      streaming: true,
    });
  });

  it("does not override explicit metadata when building tracer inheritable metadata", () => {
    const config = ensureConfig({
      metadata: {
        model: "from-metadata",
        thread_id: "from-metadata",
      },
      configurable: {
        model: "from-configurable",
        thread_id: "from-configurable",
        checkpoint_id: "ckpt-1",
        temperature: 0.5,
        streaming: true,
        api_key: "should-not-propagate",
        __secret_key: "should-not-propagate",
        custom_setting: { nested: true },
        none_value: undefined,
      },
    });

    expect(_getTracingInheritableMetadataFromConfig(config)).toEqual({
      checkpoint_id: "ckpt-1",
      temperature: 0.5,
      streaming: true,
    });
  });
});

describe("runtime context propagation", () => {
  beforeAll(() => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );
  });

  // Helpers called inside a tool may read ambient config instead of receiving
  // the tool's explicit runtime argument (for example, LangGraph's getConfig).
  function readAmbientContext(): unknown {
    return AsyncLocalStorageProviderSingleton.getRunnableConfig()?.context;
  }

  it("preserves context without copying arbitrary fields or promoting it to metadata", () => {
    const context = { userId: "alice" };
    const metadata = { source: "test" };
    const config = pickRunnableConfigKeys({
      context,
      metadata,
      runId: "parent-run",
      runName: "parent-name",
      unrelated: "not inherited",
    });

    expect(config).toMatchObject({ context, metadata });
    expect(config?.metadata).toEqual({ source: "test" });
    expect(config).not.toHaveProperty("runId");
    expect(config).not.toHaveProperty("runName");
    expect(config).not.toHaveProperty("unrelated");
  });

  it.each(["string", "structured"])(
    "makes context available to helpers inside a %s tool",
    async (kind) => {
      const context = { userId: "alice" };
      const handler = async (
        _input: unknown,
        runtime: { context: unknown }
      ) => {
        expect(runtime.context).toBe(context);
        await Promise.resolve();
        expect(readAmbientContext()).toBe(context);
        return "done";
      };

      const result =
        kind === "string"
          ? await tool(handler, {
              name: "read_context",
              schema: z.string(),
            }).invoke("hello", { context })
          : await tool(handler, {
              name: "read_context",
              schema: z.object({}),
            }).invoke({}, { context });

      expect(result).toBe("done");
      expect(readAmbientContext()).toBeUndefined();
    }
  );

  it("inherits context through a runnable, a tool, and a nested runnable", async () => {
    const context = { userId: "alice" };
    const child = RunnableLambda.from(async () => {
      await Promise.resolve();
      return readAmbientContext();
    });
    const readContext = tool(() => child.invoke({}), {
      name: "read_context",
      schema: z.object({}),
    });
    const parent = RunnableLambda.from<unknown, unknown, ToolRunnableConfig>(
      () => readContext.invoke({})
    );

    expect(await parent.invoke({}, { context })).toBe(context);
  });

  it("uses an explicit child context without replacing the parent's context", async () => {
    const parentContext = { userId: "alice" };
    const childContext = { userId: "bob" };
    const readContext = tool(() => readAmbientContext(), {
      name: "read_context",
      schema: z.object({}),
    });
    const parent = RunnableLambda.from<unknown, unknown, ToolRunnableConfig>(
      async () => {
        expect(await readContext.invoke({}, { context: childContext })).toBe(
          childContext
        );
        expect(readAmbientContext()).toBe(parentContext);
        return readContext.invoke({});
      }
    );

    expect(await parent.invoke({}, { context: parentContext })).toBe(
      parentContext
    );
  });

  it("preserves context while a runnable streams and invokes a nested tool", async () => {
    const context = { userId: "alice" };
    const readContext = tool(() => readAmbientContext(), {
      name: "read_context",
      schema: z.object({}),
    });
    const parent = RunnableLambda.from<unknown, unknown, ToolRunnableConfig>(
      async () => {
        expect(readAmbientContext()).toBe(context);
        await Promise.resolve();
        return readContext.invoke({});
      }
    );

    const chunks = [];
    for await (const chunk of await parent.stream({}, { context })) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([context]);
    expect(readAmbientContext()).toBeUndefined();
  });

  it("isolates concurrent tool contexts and leaves later calls without context", async () => {
    let arrivals = 0;
    let release!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const readContext = tool(
      async (_input, runtime) => {
        const beforeWait = readAmbientContext();
        arrivals += 1;
        if (arrivals === 2) release();
        await bothStarted;
        expect(beforeWait).toBe(runtime.context);
        expect(readAmbientContext()).toBe(runtime.context);
        return readAmbientContext();
      },
      { name: "read_context", schema: z.object({}) }
    );
    const aliceContext = { userId: "alice" };
    const bobContext = { userId: "bob" };

    const results = await Promise.all([
      readContext.invoke({}, { context: aliceContext }),
      readContext.invoke({}, { context: bobContext }),
    ]);

    expect(results).toEqual([aliceContext, bobContext]);
    expect(readAmbientContext()).toBeUndefined();
    expect(await readContext.invoke({})).toBeUndefined();
  });
});
