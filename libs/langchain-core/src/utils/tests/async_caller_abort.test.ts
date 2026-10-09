import { afterEach, describe, expect, test, vi } from "vitest";
import { AsyncCaller } from "../async_caller.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AsyncCaller cancellation", () => {
  test.each([new Error("cancelled"), "cancelled"])(
    "does not invoke a callable with an already aborted signal (%s)",
    async (reason) => {
      const controller = new AbortController();
      controller.abort(reason);
      const callable = vi.fn(async () => "unexpected");
      const caller = new AsyncCaller({ maxRetries: 0 });
      await expect(
        caller.callWithOptions({ signal: controller.signal }, callable)
      ).rejects.toThrow("cancelled");
      expect(callable).not.toHaveBeenCalled();
    }
  );

  test("skips cancelled queued calls and continues processing the queue", async () => {
    const caller = new AsyncCaller({ maxConcurrency: 1, maxRetries: 0 });
    const running = deferred<string>();
    const first = caller.call(() => running.promise);
    const controller = new AbortController();
    const reason = new Error("cancel queued call");
    const callable = vi.fn(async () => "unexpected");
    const cancelled = caller.callWithOptions(
      { signal: controller.signal },
      callable
    );
    const rejected = expect(cancelled).rejects.toBe(reason);
    controller.abort(reason);
    await rejected;
    const following = caller.call(async () => "following");
    running.resolve("first");
    await expect(first).resolves.toBe("first");
    await expect(following).resolves.toBe("following");
    expect(callable).not.toHaveBeenCalled();
  });

  test("cancels backoff without delaying the next queued call", async () => {
    vi.useFakeTimers();
    const caller = new AsyncCaller({ maxConcurrency: 1, maxRetries: 2 });
    const controller = new AbortController();
    const callable = vi.fn(async () => {
      throw new Error("temporary failure");
    });
    const cancelled = caller.callWithOptions(
      { signal: controller.signal },
      callable
    );
    const rejected = expect(cancelled).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    const following = vi.fn(async () => "following");
    const next = caller.call(following);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(0);
    expect(following).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(next).resolves.toBe("following");
    await vi.runAllTimersAsync();
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("does not schedule backoff when cancelled during a failure handler", async () => {
    vi.useFakeTimers();
    const hook = deferred<void>();
    const handler = vi.fn(() => hook.promise);
    const caller = new AsyncCaller({
      maxConcurrency: 1,
      maxRetries: 2,
      onFailedAttempt: handler,
    });
    const controller = new AbortController();
    const callable = vi.fn(async () => {
      throw new Error("temporary failure");
    });
    const cancelled = caller.callWithOptions(
      { signal: controller.signal },
      callable
    );
    const rejected = expect(cancelled).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(handler).toHaveBeenCalledTimes(1);
    controller.abort();
    await rejected;
    hook.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    await expect(caller.call(async () => "following")).resolves.toBe(
      "following"
    );
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("observes cancellation triggered synchronously by the callable", async () => {
    const controller = new AbortController();
    const reason = new Error("synchronous cancellation");
    const caller = new AsyncCaller({ maxRetries: 0 });
    await expect(
      caller.callWithOptions({ signal: controller.signal }, async () => {
        controller.abort(reason);
        return "unexpected";
      })
    ).rejects.toBe(reason);
  });

  test("keeps the concurrency slot until a cancelled running call settles", async () => {
    const onFailedAttempt = vi.fn();
    const caller = new AsyncCaller({
      maxConcurrency: 1,
      maxRetries: 2,
      onFailedAttempt,
    });
    const controller = new AbortController();
    const running = deferred<string>();
    const callable = vi.fn(() => running.promise);
    const cancelled = caller.callWithOptions(
      { signal: controller.signal },
      callable
    );
    const rejected = expect(cancelled).rejects.toThrow();
    controller.abort();
    await rejected;
    const following = vi.fn(async () => "following");
    const next = caller.call(following);
    expect(following).not.toHaveBeenCalled();
    running.reject(new Error("late failure"));
    await expect(next).resolves.toBe("following");
    expect(callable).toHaveBeenCalledTimes(1);
    expect(onFailedAttempt).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    "removes the abort listener after settlement (failure: %s)",
    async (failure) => {
      const caller = new AsyncCaller({ maxRetries: 0 });
      const controller = new AbortController();
      const add = vi.spyOn(controller.signal, "addEventListener");
      const remove = vi.spyOn(controller.signal, "removeEventListener");
      const error = new Error("failure");
      const result = caller.callWithOptions(
        { signal: controller.signal },
        async () => {
          if (failure) throw error;
          return "success";
        }
      );
      if (failure) await expect(result).rejects.toBe(error);
      else await expect(result).resolves.toBe("success");
      const listener = add.mock.calls.find(([event]) => event === "abort")?.[1];
      expect(listener).toBeDefined();
      expect(remove).toHaveBeenCalledWith("abort", listener);
    }
  );
});
