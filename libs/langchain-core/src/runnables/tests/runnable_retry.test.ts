import { test, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { RunnableLambda } from "../base.js";

test("RunnableRetry invoke", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry();
  const result = await runnableRetry.invoke("");
  expect(result).toEqual(3);
});

test("RunnableRetry invoke with a failed attempt handler", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    onFailedAttempt: (error, input) => {
      expect(error.message).toBe("TEST ERROR");
      expect(input).toBe("test");
    },
  });
  const result = await runnableRetry.invoke("test");
  expect(result).toEqual(3);
});

test("RunnableRetry batch with thrown errors", async () => {
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      throw new Error("TEST ERROR");
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 1,
  });
  await expect(async () => {
    await runnableRetry.batch(["", "", ""]);
  }).rejects.toThrow();
});

test("RunnableRetry batch with all returned errors", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 5) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 1,
  });
  const result = await runnableRetry.batch(["", "", ""], undefined, {
    returnExceptions: true,
  });
  expect(result).toEqual([
    expect.objectContaining({ message: "TEST ERROR" }),
    expect.objectContaining({ message: "TEST ERROR" }),
    expect.objectContaining({ message: "TEST ERROR" }),
  ]);
});

test("RunnableRetry batch should not retry successful requests", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 2,
  });
  const result = await runnableRetry.batch(["", "", ""]);
  expect(attemptCount).toEqual(5);
  expect(result.sort()).toEqual([3, 4, 5]);
});

test("RunnableRetry batch with an onFailedAttempt handler", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 2,
    onFailedAttempt: (error, input) => {
      expect(error.message).toEqual("TEST ERROR");
      expect(input).toEqual("test1");
    },
  });
  const result = await runnableRetry.batch(["test1", "test2", "test3"]);
  expect(attemptCount).toEqual(5);
  expect(result.sort()).toEqual([3, 4, 5]);
});

// Custom error types for testing
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

describe("RunnableRetry advanced options", () => {
  describe("retryOn with error constructors", () => {
    test("should retry only specified error types", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          if (attemptCount === 1) {
            throw new TimeoutError("Timeout");
          } else if (attemptCount === 2) {
            throw new RateLimitError("Rate limit");
          } else {
            return attemptCount;
          }
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        retryOn: [TimeoutError, RateLimitError],
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(3);
      expect(attemptCount).toEqual(3);
    });

    test("should not retry non-specified error types", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          throw new Error("Generic error");
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        retryOn: [TimeoutError, RateLimitError],
      });

      await expect(runnableRetry.invoke("")).rejects.toThrow("Generic error");
      // Should only attempt once since Error is not in retryOn list
      expect(attemptCount).toEqual(1);
    });
  });

  describe("retryOn with function", () => {
    test("should use custom retry function", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          if (attemptCount < 3) {
            const error = new Error("Rate limit exceeded");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).statusCode = 429;
            throw error;
          }
          return attemptCount;
        },
      });

      const shouldRetry = (error: Error): boolean => {
        return (
          error.name === "RateLimitError" ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any).statusCode === 429
        );
      };

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        retryOn: shouldRetry,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(3);
      expect(attemptCount).toEqual(3);
    });

    test("should not retry when function returns false", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          throw new Error("Generic error");
        },
      });

      const shouldRetry = (error: Error): boolean => {
        return error.message.includes("Rate limit");
      };

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        retryOn: shouldRetry,
      });

      await expect(runnableRetry.invoke("")).rejects.toThrow("Generic error");
      // Should only attempt once since shouldRetry returns false
      expect(attemptCount).toEqual(1);
    });
  });

  describe("backoffFactor", () => {
    test("should apply exponential backoff", async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      let lastTime = performance.now();

      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          const currentTime = performance.now();
          if (attemptCount > 0) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        initialDelayMs: 100,
        backoffFactor: 2.0,
        jitter: false,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(3);

      // Should have delays between retries
      expect(delays.length).toBeGreaterThanOrEqual(1);
      // First delay should be around initialDelayMs (100ms)
      expect(delays[0]).toBeGreaterThanOrEqual(90);
      expect(delays[0]).toBeLessThan(150);
      // Second delay should be around initialDelayMs * backoffFactor (200ms)
      if (delays.length > 1) {
        expect(delays[1]).toBeGreaterThanOrEqual(180);
        expect(delays[1]).toBeLessThan(250);
      }
    });

    test("should apply constant backoff when backoffFactor is 0", async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      let lastTime = performance.now();

      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          const currentTime = performance.now();
          if (attemptCount > 0) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        initialDelayMs: 100,
        backoffFactor: 0.0,
        jitter: false,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(3);

      // All delays should be approximately the same (around initialDelayMs)
      if (delays.length > 1) {
        const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
        expect(avgDelay).toBeGreaterThanOrEqual(90);
        expect(avgDelay).toBeLessThan(150);
      }
    });
  });

  describe("initialDelayMs", () => {
    test("should respect initial delay", async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      let lastTime = performance.now();

      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          const currentTime = performance.now();
          if (attemptCount > 0) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;
          attemptCount += 1;
          if (attemptCount < 2) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 2,
        initialDelayMs: 200,
        backoffFactor: 2.0,
        jitter: false,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(2);

      // First delay should be around initialDelayMs (200ms)
      expect(delays.length).toBeGreaterThanOrEqual(1);
      expect(delays[0]).toBeGreaterThanOrEqual(180);
      expect(delays[0]).toBeLessThan(250);
    });
  });

  describe("maxDelayMs", () => {
    test("should cap delay at maxDelayMs", async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      let lastTime = performance.now();

      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          const currentTime = performance.now();
          if (attemptCount > 0) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;
          attemptCount += 1;
          if (attemptCount < 4) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 4,
        initialDelayMs: 100,
        backoffFactor: 3.0, // Would be 100, 300, 900ms without cap
        maxDelayMs: 250, // Cap at 250ms
        jitter: false,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(4);

      // All delays should be capped at maxDelayMs
      expect(delays.length).toBeGreaterThanOrEqual(2);
      for (const delay of delays) {
        expect(delay).toBeLessThan(300); // Allow some tolerance
        // The last delay should be capped (would be 900ms without cap)
        if (delays.indexOf(delay) === delays.length - 1) {
          expect(delay).toBeLessThan(300); // Should be capped around 250ms
        }
      }
    });
  });

  describe("jitter", () => {
    test("should add jitter when enabled", async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      let lastTime = performance.now();

      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          const currentTime = performance.now();
          if (attemptCount > 0) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        initialDelayMs: 100,
        backoffFactor: 2.0,
        jitter: true,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(3);

      // With jitter, delays should vary (±25%)
      expect(delays.length).toBeGreaterThanOrEqual(1);
      // Delay should be within jitter range (100ms ± 25% = 75-125ms)
      expect(delays[0]).toBeGreaterThanOrEqual(70);
      expect(delays[0]).toBeLessThan(150);
    });

    test("should not add jitter when disabled", async () => {
      let attemptCount = 0;
      const delays: number[] = [];
      let lastTime = performance.now();

      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          const currentTime = performance.now();
          if (attemptCount > 0) {
            delays.push(currentTime - lastTime);
          }
          lastTime = currentTime;
          attemptCount += 1;
          if (attemptCount < 2) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 2,
        initialDelayMs: 100,
        backoffFactor: 2.0,
        jitter: false,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(2);

      // Without jitter, delay should be more consistent
      expect(delays.length).toBeGreaterThanOrEqual(1);
      // Should be close to exact value (100ms)
      expect(delays[0]).toBeGreaterThanOrEqual(90);
      expect(delays[0]).toBeLessThan(120);
    });
  });

  describe("combined options", () => {
    test("should work with all advanced options together", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new TimeoutError("Timeout");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        retryOn: [TimeoutError],
        initialDelayMs: 50,
        backoffFactor: 2.0,
        maxDelayMs: 200,
        jitter: false,
        onFailedAttempt: (error, input) => {
          expect(error).toBeInstanceOf(TimeoutError);
          expect(input).toBe("test");
        },
      });

      const result = await runnableRetry.invoke("test");
      expect(result).toEqual(3);
      expect(attemptCount).toEqual(3);
    });
  });

  describe("backward compatibility", () => {
    test("should work with only stopAfterAttempt (backward compatible)", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
      });

      const result = await runnableRetry.invoke("");
      expect(result).toEqual(3);
      expect(attemptCount).toEqual(3);
    });

    test("should work with only onFailedAttempt (backward compatible)", async () => {
      let attemptCount = 0;
      const runnable = new RunnableLambda({
        func: (_thing: unknown) => {
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new Error("TEST ERROR");
          }
          return attemptCount;
        },
      });

      const runnableRetry = runnable.withRetry({
        stopAfterAttempt: 3,
        onFailedAttempt: (error, input) => {
          expect(error.message).toBe("TEST ERROR");
          expect(input).toBe("test");
        },
      });

      const result = await runnableRetry.invoke("test");
      expect(result).toEqual(3);
      expect(attemptCount).toEqual(3);
    });
  });
});
