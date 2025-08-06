import { test, expect } from "vitest";

import { InMemoryCache } from "../caches/base.js";

test("InMemoryCache", async () => {
  const cache = new InMemoryCache();
  await cache.update("foo", "bar", [{ text: "baz" }]);
  expect(await cache.lookup("foo", "bar")).toEqual([{ text: "baz" }]);
});
