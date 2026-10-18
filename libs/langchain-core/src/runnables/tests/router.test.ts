import { expect, test } from "vitest";
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
