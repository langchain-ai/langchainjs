import { test, expect } from "@jest/globals";
import { AsyncLocalStorage } from "node:async_hooks";
import { AsyncLocalStorageProviderSingleton } from "../index.js";
import { RunnableLambda } from "../../runnables/base.js";

test("Config should be automatically populated after setting global async local storage", async () => {
  const inner = RunnableLambda.from((_, config) => config);
  const outer = RunnableLambda.from(async (input) => {
    const res = await inner.invoke(input);
    return res;
  });
  const res1 = await outer.invoke(
    { hi: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["tester"],
    }
  );
  expect(res1?.tags).toEqual([]);
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const res2 = await outer.invoke(
    { hi: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["tester"],
    }
  );
  expect(res2?.tags).toEqual(["tester"]);
});
