import { describe, expect, test, vi } from "vitest";
import { RunnableLambda, RunnableSequence } from "../base.js";
import type { RunnableConfig } from "../types.js";

describe("RunnableSequence batch with returned exceptions", () => {
  test.each([0, 1, 2])(
    "preserves an error from step %i and skips later steps",
    async (failureStep) => {
      const error = new Error("original failure");
      const calls = [0, 1, 2].map(() => vi.fn());
      const steps = calls.map((record, index) =>
        RunnableLambda.from((value: string) => {
          record(value);
          if (index === failureStep && value === "bad") throw error;
          return value;
        })
      );
      const sequence = RunnableSequence.from([steps[0], steps[1], steps[2]]);
      const results = await sequence.batch(
        ["good", "bad", "last"],
        {},
        {
          returnExceptions: true,
        }
      );
      expect(results).toEqual(["good", error, "last"]);
      expect(results[1]).toBe(error);
      for (let index = 0; index < calls.length; index += 1) {
        expect(calls[index].mock.calls.map(([input]) => input)).toEqual(
          index <= failureStep ? ["good", "bad", "last"] : ["good", "last"]
        );
      }
    }
  );

  test("keeps batch inputs and per-input configuration aligned across failures", async () => {
    const firstError = new Error("first failure");
    const secondError = new Error("second failure");
    const seen: Array<[string, unknown, string[] | undefined]> = [];
    const first = RunnableLambda.from((value: string) => {
      if (value === "a") throw firstError;
      return value;
    });
    const middle = RunnableLambda.from(
      (value: string, config?: RunnableConfig) => {
        seen.push([value, config?.configurable?.index, config?.tags]);
        if (value === "c") throw secondError;
        return value;
      }
    );
    const last = RunnableLambda.from(
      (value: string, config?: RunnableConfig) =>
        `${value}:${config?.configurable?.index}`
    );
    const middleBatch = vi.spyOn(middle, "batch");
    const lastBatch = vi.spyOn(last, "batch");
    const options = [0, 1, 2, 3].map((index) => ({
      configurable: { index },
      tags: [`input:${index}`],
    }));
    const results = await first
      .pipe(middle)
      .pipe(last)
      .batch(["a", "b", "c", "d"], options, { returnExceptions: true });
    expect(results).toEqual([firstError, "b:1", secondError, "d:3"]);
    expect(results[0]).toBe(firstError);
    expect(results[2]).toBe(secondError);
    expect(seen).toEqual([
      ["b", 1, ["input:1"]],
      ["c", 2, ["input:2"]],
      ["d", 3, ["input:3"]],
    ]);
    expect(middleBatch).toHaveBeenCalledTimes(1);
    expect(middleBatch.mock.calls[0][0]).toEqual(["b", "c", "d"]);
    expect(lastBatch).toHaveBeenCalledTimes(1);
    expect(lastBatch.mock.calls[0][0]).toEqual(["b", "d"]);
  });

  test("does not invoke downstream batches when all inputs fail", async () => {
    const errors = [new Error("first"), new Error("second")];
    const first = RunnableLambda.from((index: number) => {
      throw errors[index];
    });
    const last = RunnableLambda.from((value: unknown) => value);
    const lastBatch = vi.spyOn(last, "batch");
    const results = await first
      .pipe(last)
      .batch([0, 1], {}, { returnExceptions: true });
    expect(results[0]).toBe(errors[0]);
    expect(results[1]).toBe(errors[1]);
    expect(lastBatch).not.toHaveBeenCalled();
  });

  test("reports each root run's own success or error exactly once", async () => {
    const error = new Error("first input failed");
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ];
    const handleChainEnd = vi.fn();
    const handleChainError = vi.fn();
    const handleChainStart = vi.fn();
    const first = RunnableLambda.from((value: number) => {
      if (value === 0) throw error;
      return value;
    });
    const last = RunnableLambda.from((value: number) => value * 10).withConfig({
      runName: "last-step",
    });
    await first.pipe(last).batch(
      [0, 1],
      ids.map((runId) => ({
        runId,
        callbacks: [{ handleChainStart, handleChainEnd, handleChainError }],
      })),
      { returnExceptions: true }
    );
    const rootErrors = handleChainError.mock.calls.filter(([, runId]) =>
      ids.includes(runId)
    );
    const rootEnds = handleChainEnd.mock.calls.filter(([, runId]) =>
      ids.includes(runId)
    );
    expect(rootErrors).toHaveLength(1);
    expect(rootErrors[0][0]).toBe(error);
    expect(rootErrors[0][1]).toBe(ids[0]);
    expect(rootEnds).toHaveLength(1);
    expect(rootEnds[0][0]).toEqual({ output: 10 });
    expect(rootEnds[0][1]).toBe(ids[1]);
    const lastStarts = handleChainStart.mock.calls.filter(
      (args) => args[7] === "last-step"
    );
    expect(lastStarts).toHaveLength(1);
    expect(lastStarts[0][3]).toBe(ids[1]);
  });

  test("retains falsy successful outputs and accepts Error objects as inputs", async () => {
    const values = [undefined, null, false, 0, ""];
    const first = RunnableLambda.from((index: number) => values[index]);
    const last = RunnableLambda.from((value: unknown) => value);
    expect(
      await first
        .pipe(last)
        .batch([0, 1, 2, 3, 4], {}, { returnExceptions: true })
    ).toEqual(values);
    const input = new Error("valid input");
    const readMessage = RunnableLambda.from((value: Error) => value.message);
    expect(
      await readMessage
        .pipe(last)
        .batch([input], {}, { returnExceptions: true })
    ).toEqual(["valid input"]);
  });

  test("returns an empty batch without executing any steps", async () => {
    const first = RunnableLambda.from((value: string) => value);
    const last = RunnableLambda.from((value: string) => value);
    const firstBatch = vi.spyOn(first, "batch");
    const lastBatch = vi.spyOn(last, "batch");
    expect(
      await first.pipe(last).batch([], {}, { returnExceptions: true })
    ).toEqual([]);
    expect(firstBatch).not.toHaveBeenCalled();
    expect(lastBatch).not.toHaveBeenCalled();
  });

  test.each([undefined, false])(
    "still rejects without returnExceptions (%s)",
    async (returnExceptions) => {
      const error = new Error("fail fast");
      const first = RunnableLambda.from((value: string) => {
        if (value === "bad") throw error;
        return value;
      });
      const last = RunnableLambda.from((value: string) => value);
      const lastBatch = vi.spyOn(last, "batch");
      await expect(
        first.pipe(last).batch(["good", "bad"], {}, { returnExceptions })
      ).rejects.toBe(error);
      expect(lastBatch).not.toHaveBeenCalled();
    }
  );

  test.each([
    { name: "shared config", options: { maxConcurrency: 2 }, limit: 2 },
    {
      name: "first config only",
      options: [{ maxConcurrency: 1 }, {}, {}, {}, {}],
      limit: 1,
    },
    {
      name: "higher limit on a surviving config",
      options: [{ maxConcurrency: 1 }, { maxConcurrency: 4 }, {}, {}, {}],
      limit: 1,
    },
  ])(
    "keeps the batch concurrency limit with $name",
    async ({ options, limit }) => {
      const error = new Error("failed input");
      const first = RunnableLambda.from((value: number) => {
        if (value === 0) throw error;
        return value;
      });
      let active = 0;
      let peak = 0;
      const last = RunnableLambda.from(async (value: number) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active -= 1;
        return value * 2;
      });
      expect(
        await first
          .pipe(last)
          .batch([0, 1, 2, 3, 4], options, { returnExceptions: true })
      ).toEqual([error, 2, 4, 6, 8]);
      expect(peak).toBe(limit);
    }
  );

  test("does not duplicate terminal callbacks when a later whole batch rejects", async () => {
    const firstError = new Error("individual failure");
    const batchError = new Error("whole batch failure");
    const rootErrors = vi.fn();
    const rootEnds = vi.fn();
    const first = RunnableLambda.from((value: number) => {
      if (value === 0) throw firstError;
      return value;
    });
    const last = RunnableLambda.from((value: number) => value);
    vi.spyOn(last, "batch").mockRejectedValue(batchError);
    const callbacks = [
      {
        handleChainError: (
          error: Error,
          runId: string,
          parentRunId?: string
        ) => {
          if (!parentRunId) rootErrors(error, runId);
        },
        handleChainEnd: (
          _output: unknown,
          runId: string,
          parentRunId?: string
        ) => {
          if (!parentRunId) rootEnds(runId);
        },
      },
    ];
    await expect(
      first.pipe(last).batch([0, 1], { callbacks }, { returnExceptions: true })
    ).rejects.toBe(batchError);
    expect(rootErrors.mock.calls.map(([error]) => error)).toEqual([
      firstError,
      batchError,
    ]);
    expect(rootEnds).not.toHaveBeenCalled();
  });
});
