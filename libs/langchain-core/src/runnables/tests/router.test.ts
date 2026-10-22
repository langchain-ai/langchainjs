import { expect, test, vi } from "vitest";
import { RunnableLambda } from "../base.js";
import { RouterRunnable } from "../router.js";
import type { RunnableConfig } from "../config.js";

test.each([
  { maxConcurrency: 1, source: "config" },
  { maxConcurrency: 2, source: "config" },
  { maxConcurrency: 3, source: "config" },
  { maxConcurrency: 1, source: "batch" },
  { maxConcurrency: 2, source: "batch" },
  { maxConcurrency: 3, source: "batch" },
  { maxConcurrency: 10, source: "config" },
])(
  "RouterRunnable.batch preserves routes and configs with $source maxConcurrency=$maxConcurrency",
  async ({ maxConcurrency, source }) => {
    const route = (name: string) =>
      RunnableLambda.from((input: number, config?: RunnableConfig) => ({
        route: name,
        input,
        item: config?.metadata?.item,
      }));
    const router = new RouterRunnable({
      runnables: {
        first: route("first"),
        second: route("second"),
        third: route("third"),
      },
    });
    const keys = ["first", "second", "third", "first", "second"];
    const inputs = keys.map((key, input) => ({ key, input }));
    const configs = inputs.map(({ input }) => ({
      metadata: { item: `item-${input}` },
      ...(source === "config" ? { maxConcurrency } : {}),
    }));

    const results = await router.batch(
      inputs,
      configs,
      source === "batch" ? { maxConcurrency } : undefined
    );

    expect(results).toEqual(
      keys.map((key, input) => ({
        route: key,
        input,
        item: `item-${input}`,
      }))
    );
  }
);

test.each([1, 2, 10])(
  "RouterRunnable.batch returns per-input errors with maxConcurrency=%i",
  async (maxConcurrency) => {
    const failure = new Error("Route failed");
    const router = new RouterRunnable({
      runnables: {
        double: RunnableLambda.from((input: number) => input * 2),
        fail: RunnableLambda.from((_input: number): number => {
          throw failure;
        }),
      },
    });

    const results = await router.batch(
      [
        { key: "double", input: 1 },
        { key: "missing", input: 2 },
        { key: "fail", input: 3 },
        { key: "double", input: 4 },
      ],
      undefined,
      { returnExceptions: true, maxConcurrency }
    );

    expect(results).toEqual([
      2,
      new Error('No runnable associated with key "missing".'),
      failure,
      8,
    ]);
    expect(results[2]).toBe(failure);
  }
);

test("RouterRunnable.batch returns a child error without rejecting", async () => {
  const failure = new Error("Route failed");
  const router = new RouterRunnable({
    runnables: {
      double: RunnableLambda.from((input: number) => {
        if (input === 2) throw failure;
        return input * 2;
      }),
    },
  });

  const results = await router.batch(
    [1, 2, 3].map((input) => ({ key: "double", input })),
    undefined,
    { returnExceptions: true }
  );

  expect(results).toEqual([2, failure, 6]);
  expect(results[1]).toBe(failure);
});

test.each([undefined, false])(
  "RouterRunnable.batch validates routes before invoking with returnExceptions=%s",
  async (returnExceptions) => {
    const invoke = vi.fn((input: number) => input * 2);
    const router = new RouterRunnable({
      runnables: { double: RunnableLambda.from(invoke) },
    });

    await expect(
      router.batch(
        [
          { key: "double", input: 1 },
          { key: "missing", input: 2 },
        ],
        undefined,
        { returnExceptions }
      )
    ).rejects.toThrow("One or more keys do not have a corresponding runnable.");
    expect(invoke).not.toHaveBeenCalled();
  }
);

test("RouterRunnable.batch rejects child errors by default", async () => {
  const failure = new Error("Route failed");
  const router = new RouterRunnable({
    runnables: {
      fail: RunnableLambda.from((_input: number): number => {
        throw failure;
      }),
    },
  });

  await expect(router.batch([{ key: "fail", input: 1 }])).rejects.toBe(failure);
});
