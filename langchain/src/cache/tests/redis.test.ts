import { test, expect, jest } from "@jest/globals";
import { insecureHash } from "@langchain/core/utils/hash";

import { RedisCache } from "../redis.js";

const sha1 = (str: string) => insecureHash(str);

test("RedisCache", async () => {
  const redis = {
    get: jest.fn(async (key: string) => {
      if (key === sha1("foo_bar_0")) {
        return JSON.stringify({ text: "baz" });
      }
      return null;
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache = new RedisCache(redis as any);
  expect(await cache.lookup("foo", "bar")).toEqual([{ text: "baz" }]);
});
