import { test, expect, jest } from "@jest/globals";
import hash from "object-hash";

import { UpstashRedisCache } from "../upstash_redis.js";
import { StoredGeneration } from "../../schema/index.js";

const sha256 = (str: string) => hash(str);

test("UpstashRedisCache", async () => {
  const redis = {
    get: jest.fn(async (key: string): Promise<StoredGeneration | null> => {
      if (key === sha256("foo_bar_0")) {
        return { text: "baz" };
      }
      return null;
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache = new UpstashRedisCache({ client: redis as any });
  expect(await cache.lookup("foo", "bar")).toEqual([{ text: "baz" }]);
});
