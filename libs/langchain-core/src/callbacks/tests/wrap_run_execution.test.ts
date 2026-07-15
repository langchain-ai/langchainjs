import { describe, expect, test } from "vitest";

import { BaseCallbackHandler } from "../base.js";
import { BaseRunManager } from "../manager.js";

/** Handler that records ctx entry/exit and tags a shared stack while `fn` runs. */
class ContextHandler extends BaseCallbackHandler {
  name: string;

  constructor(
    private readonly label: string,
    private readonly stack: string[],
  ) {
    super();
    this.name = label;
  }

  wrapRunExecution<T>(runId: string, fn: () => T): T {
    this.stack.push(`enter:${this.label}:${runId}`);
    try {
      return fn();
    } finally {
      this.stack.push(`exit:${this.label}`);
    }
  }
}

/** Handler that does NOT implement wrapRunExecution (should be skipped). */
class PlainHandler extends BaseCallbackHandler {
  name = "PlainHandler";
}

function makeRunManager(handlers: BaseCallbackHandler[], runId = "run-1"): BaseRunManager {
  return new BaseRunManager(runId, handlers, handlers, [], [], {}, {});
}

describe("BaseRunManager.withRunContext", () => {
  test("invokes fn once and returns its value when no handler implements the hook", () => {
    const rm = makeRunManager([new PlainHandler()]);
    let calls = 0;
    const result = rm.withRunContext(() => {
      calls += 1;
      return 42;
    });
    expect(calls).toBe(1);
    expect(result).toBe(42);
  });

  test("wraps fn with a handler's wrapRunExecution and passes the runId", () => {
    const stack: string[] = [];
    const rm = makeRunManager([new ContextHandler("A", stack)], "abc");
    const result = rm.withRunContext(() => {
      stack.push("body");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(stack).toEqual(["enter:A:abc", "body", "exit:A"]);
  });

  test("composes multiple handlers so each wraps the next (last handler is outermost)", () => {
    const stack: string[] = [];
    const rm = makeRunManager([
      new ContextHandler("A", stack),
      new ContextHandler("B", stack),
    ]);
    rm.withRunContext(() => {
      stack.push("body");
    });
    // B is applied last in the loop, so it becomes the outermost wrapper.
    expect(stack).toEqual([
      "enter:B:run-1",
      "enter:A:run-1",
      "body",
      "exit:A",
      "exit:B",
    ]);
  });

  test("skips plain handlers but still applies context handlers", () => {
    const stack: string[] = [];
    const rm = makeRunManager([
      new PlainHandler(),
      new ContextHandler("A", stack),
      new PlainHandler(),
    ]);
    rm.withRunContext(() => stack.push("body"));
    expect(stack).toEqual(["enter:A:run-1", "body", "exit:A"]);
  });

  test("propagates a rejected promise returned by fn", async () => {
    const stack: string[] = [];
    const rm = makeRunManager([new ContextHandler("A", stack)]);
    const boom = new Error("boom");
    await expect(
      rm.withRunContext(() => Promise.reject(boom)),
    ).rejects.toBe(boom);
    // The wrapper's finally still runs synchronously around fn() invocation.
    expect(stack).toEqual(["enter:A:run-1", "exit:A"]);
  });

  test("propagates a synchronous throw from fn", () => {
    const stack: string[] = [];
    const rm = makeRunManager([new ContextHandler("A", stack)]);
    expect(() =>
      rm.withRunContext(() => {
        throw new Error("sync-boom");
      }),
    ).toThrow("sync-boom");
    expect(stack).toEqual(["enter:A:run-1", "exit:A"]);
  });
});

describe("BaseRunManager.withRunContextAsyncIterable", () => {
  async function* source(): AsyncGenerator<number> {
    yield 1;
    yield 2;
    yield 3;
  }

  test("runs each next() inside the run context and yields all values", async () => {
    const stack: string[] = [];
    const rm = makeRunManager([new ContextHandler("A", stack)]);
    const wrapped = rm.withRunContextAsyncIterable(source());

    const seen: number[] = [];
    for await (const v of wrapped) {
      seen.push(v);
    }

    expect(seen).toEqual([1, 2, 3]);
    // One enter/exit pair per next() call (3 values + the final done next()).
    const enters = stack.filter((s) => s.startsWith("enter:")).length;
    expect(enters).toBeGreaterThanOrEqual(3);
    expect(stack.filter((s) => s.startsWith("exit:")).length).toBe(enters);
  });

  test("is a passthrough when no handler implements the hook", async () => {
    const rm = makeRunManager([new PlainHandler()]);
    const wrapped = rm.withRunContextAsyncIterable(source());
    const seen: number[] = [];
    for await (const v of wrapped) seen.push(v);
    expect(seen).toEqual([1, 2, 3]);
  });

  test("forwards early return() (break) through the context", async () => {
    const stack: string[] = [];
    let returned = false;
    async function* withReturn(): AsyncGenerator<number> {
      try {
        yield 1;
        yield 2;
      } finally {
        returned = true;
      }
    }
    const rm = makeRunManager([new ContextHandler("A", stack)]);
    const wrapped = rm.withRunContextAsyncIterable(withReturn());

    const seen: number[] = [];
    for await (const v of wrapped) {
      seen.push(v);
      break; // triggers iterator.return()
    }

    expect(seen).toEqual([1]);
    expect(returned).toBe(true);
    expect(stack.some((s) => s.startsWith("enter:A"))).toBe(true);
  });

  test("forwards throw() through the context", async () => {
    const stack: string[] = [];
    const rm = makeRunManager([new ContextHandler("A", stack)]);
    async function* infinite(): AsyncGenerator<number> {
      let i = 0;
      while (true) yield i++;
    }
    const wrapped = rm.withRunContextAsyncIterable(infinite());
    const iterator = wrapped[Symbol.asyncIterator]();

    await iterator.next();
    const boom = new Error("iter-boom");
    await expect(iterator.throw?.(boom)).rejects.toBe(boom);
    expect(stack.some((s) => s.startsWith("enter:A"))).toBe(true);
  });
});
