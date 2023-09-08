import { test, expect, jest } from "@jest/globals";
import hash from "object-hash";

import { CloudflareKVCache } from "../cloudflare_kv.js";

const sha256 = (str: string) => hash(str);

test("CloudflareKVCache", async () => {
  const kv = {
    get: jest.fn(async (key: string) => {
      if (key === sha256("foo_bar_0")) {
        return "baz";
      }
      return null;
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache = new CloudflareKVCache(kv as any);
  expect(await cache.lookup("foo", "bar")).toEqual([{ text: "baz" }]);
});
