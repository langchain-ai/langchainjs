/* oxlint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { RunnableBinding } from "@langchain/core/runnables";

import { createAgent, createMiddleware } from "../index.js";
import { modelRetryMiddleware } from "../middleware/modelRetry.js";
import { MiddlewareError } from "../errors.js";
import { FakeToolCallingModel } from "./utils.js";

class RetryableError extends Error {
  code = "ECONNRESET";

  $retryable = true;

  constructor() {
    super("boom");
    this.name = "RetryableError";
  }
}

class HttpError extends Error {
  statusCode = 503;

  constructor() {
    super("service unavailable");
    this.name = "HTTPError";
  }
}

describe("MiddlewareError.wrap identity preservation (#11324)", () => {
  it("preserves own properties, prototype chain, and stack", () => {
    const raw = new RetryableError();
    const wrapped = MiddlewareError.wrap(raw, "testMiddleware") as RetryableError;

    // prototype chain is preserved, so instanceof and constructor checks work
    expect(wrapped).toBeInstanceOf(RetryableError);
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.constructor).toBe(RetryableError);

    // own enumerable properties survive the wrap
    expect(wrapped.code).toBe("ECONNRESET");
    expect(wrapped.$retryable).toBe(true);

    // message, name, cause, and stack are intact
    expect(wrapped.message).toBe("boom");
    expect(wrapped.name).toBe("RetryableError");
    expect(wrapped.cause).toBe(raw);
    expect(wrapped.stack).toBe(raw.stack);

    // still recognized as a MiddlewareError through the ~brand check
    expect(MiddlewareError.isInstance(wrapped)).toBe(true);
    expect(wrapped).toBeInstanceOf(MiddlewareError);
  });

  it("is chainable across multiple wrap layers", () => {
    const raw = new RetryableError();
    const once = MiddlewareError.wrap(raw, "inner");
    const twice = MiddlewareError.wrap(once, "outer");

    expect(twice).toBeInstanceOf(RetryableError);
    expect(twice.constructor).toBe(RetryableError);
    expect((twice as RetryableError).code).toBe("ECONNRESET");
    expect(MiddlewareError.isInstance(twice)).toBe(true);
  });
});

describe("modelRetryMiddleware with wrapped errors (#11324)", () => {
  let calls = 0;

  class FailingModel extends FakeToolCallingModel {
    _generate = vi.fn(() => {
      calls += 1;
      throw new RetryableError();
    });

    constructor() {
      super({ toolCalls: [[]] });
    }

    bindTools(tools: StructuredTool[]) {
      // oxlint-disable-next-line dot-notation
      this["tools"] = [...this["tools"], ...tools];
      return this as unknown as RunnableBinding<any, any, any>;
    }
  }

  const passthrough = createMiddleware({
    name: "Passthrough",
    wrapModelCall: async (request, handler) => handler(request),
  });

  async function modelCalls(
    retryOn:
      | ((error: Error) => boolean)
      | (new (...args: any[]) => Error)[],
    extraMiddleware: ReturnType<typeof createMiddleware>[] = []
  ): Promise<number> {
    calls = 0;
    const agent = createAgent({
      model: new FailingModel(),
      tools: [],
      middleware: [
        modelRetryMiddleware({
          maxRetries: 2,
          retryOn: retryOn as never,
          initialDelayMs: 0,
          jitter: false,
          onFailure: "error",
        }),
        ...extraMiddleware,
      ] as never[],
    });
    try {
      await agent.invoke({ messages: [new HumanMessage("hi")] });
    } catch {
      // expected
    }
    return calls;
  }

  it("retries with the array form when no extra middleware wraps the error", async () => {
    const result = await modelCalls([RetryableError], []);
    expect(result).toBe(3);
  });

  it("retries with the array form when a middleware wraps the error", async () => {
    const result = await modelCalls([RetryableError], [passthrough]);
    expect(result).toBe(3);
  });

  it("passes a wrapped error with preserved identity to the predicate form", async () => {
    let seen: Error | undefined;
    const result = await modelCalls((error) => {
      seen = error;
      return false;
    }, [passthrough]);

    // predicate rejected the retry, so only the initial attempt ran
    expect(result).toBe(1);

    // but the predicate saw the original identity, not a bare MiddlewareError
    expect(seen).toBeInstanceOf(RetryableError);
    expect(seen?.constructor).toBe(RetryableError);
    expect((seen as RetryableError).code).toBe("ECONNRESET");
    expect((seen as RetryableError).$retryable).toBe(true);
  });

  it("preserves documented predicate patterns like name + statusCode", async () => {
    let seen: Error | undefined;
    let modelCalls = 0;

    class HttpFailingModel extends FakeToolCallingModel {
      _generate = vi.fn(() => {
        modelCalls += 1;
        throw new HttpError();
      });

      constructor() {
        super({ toolCalls: [[]] });
      }

      bindTools(tools: StructuredTool[]) {
        // oxlint-disable-next-line dot-notation
        this["tools"] = [...this["tools"], ...tools];
        return this as unknown as RunnableBinding<any, any, any>;
      }
    }

    const agent = createAgent({
      model: new HttpFailingModel(),
      tools: [],
      middleware: [
        modelRetryMiddleware({
          maxRetries: 2,
          retryOn: (error: Error) => {
            seen = error;
            // the documented "Custom exception filtering" pattern
            return error.name === "HTTPError" && "statusCode" in error;
          },
          initialDelayMs: 0,
          jitter: false,
          onFailure: "error",
        }),
        passthrough,
      ] as never[],
    });

    try {
      await agent.invoke({ messages: [new HumanMessage("hi")] });
    } catch {
      // expected
    }

    expect(seen?.name).toBe("HTTPError");
    expect(seen).toBeInstanceOf(HttpError);
    expect((seen as HttpError).statusCode).toBe(503);
    expect(modelCalls).toBe(3);
  });
});
