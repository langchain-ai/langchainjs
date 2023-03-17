import hash from "object-hash";
import { test, expect, jest } from "@jest/globals";

import { InMemoryCache, RedisCache } from "../cache.js";

const sha256 = (str: string) => hash(str);

test("InMemoryCache", async () => {
  const cache = new InMemoryCache();
  await cache.update("foo", "bar", [{ text: "baz" }]);
  expect(await cache.lookup("foo", "bar")).toEqual([{ text: "baz" }]);
});

test("RedisCache", async () => {
  const redis = {
    get: jest.fn(async (key: string) => {
      if (key === sha256("foo_bar_0")) {
        return "baz";
      }
      return null;
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache = new RedisCache(redis as any);
  expect(await cache.lookup("foo", "bar")).toEqual([{ text: "baz" }]);
});
