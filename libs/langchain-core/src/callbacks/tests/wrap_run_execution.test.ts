import { describe, expect, test } from "vitest";

import { BaseCallbackHandler } from "../base.js";
import { BaseRunManager } from "../manager.js";

class ContextHandler extends BaseCallbackHandler {
  name: string;

  constructor(
    private readonly label: string,
    private readonly events: string[]
  ) {
    super();
    this.name = label;
  }

  wrapRunExecution<T>(runId: string, fn: () => T): T {
    this.events.push(`enter:${this.label}:${runId}`);
    try {
      return fn();
    } finally {
      this.events.push(`exit:${this.label}`);
    }
  }
}

class PlainHandler extends BaseCallbackHandler {
  name = "plain";
}

function createRunManager(handlers: BaseCallbackHandler[]) {
  return new BaseRunManager("run-1", handlers, handlers, [], [], {}, {});
}

describe("BaseRunManager.withRunContext", () => {
  test("passes through when handlers do not supply context", () => {
    const runManager = createRunManager([new PlainHandler()]);
    expect(runManager.withRunContext(() => 42)).toBe(42);
  });

  test("composes handler contexts and passes the run id", () => {
    const events: string[] = [];
    const runManager = createRunManager([
      new ContextHandler("a", events),
      new ContextHandler("b", events),
    ]);

    runManager.withRunContext(() => events.push("body"));

    expect(events).toEqual([
      "enter:b:run-1",
      "enter:a:run-1",
      "body",
      "exit:a",
      "exit:b",
    ]);
  });

  test("propagates synchronous and asynchronous errors", async () => {
    const runManager = createRunManager([new ContextHandler("a", [])]);
    const syncError = new Error("sync");
    const asyncError = new Error("async");

    expect(() =>
      runManager.withRunContext(() => {
        throw syncError;
      })
    ).toThrow(syncError);
    await expect(
      runManager.withRunContext(() => Promise.reject(asyncError))
    ).rejects.toBe(asyncError);
  });
});

describe("BaseRunManager.withRunContextAsyncIterable", () => {
  test("wraps every lazy iterator operation", async () => {
    const events: string[] = [];
    let returned = false;
    async function* source() {
      try {
        events.push("next-body");
        yield 1;
        yield 2;
      } finally {
        returned = true;
      }
    }
    const runManager = createRunManager([new ContextHandler("a", events)]);

    for await (const value of runManager.withRunContextAsyncIterable(
      source()
    )) {
      expect(value).toBe(1);
      break;
    }

    expect(events).toEqual([
      "enter:a:run-1",
      "next-body",
      "exit:a",
      "enter:a:run-1",
      "exit:a",
    ]);
    expect(returned).toBe(true);
  });
});
