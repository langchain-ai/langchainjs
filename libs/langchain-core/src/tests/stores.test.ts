import { describe, expect, test } from "vitest";
import { InMemoryStore } from "../stores.js";

describe("InMemoryStore", () => {
  test.each(["constructor", "toString", "__proto__"])(
    "returns undefined for the missing key %s",
    async (key) => {
      const store = new InMemoryStore<string>();

      expect(await store.mget([key])).toEqual([undefined]);
    }
  );

  test.each(["constructor", "toString", "__proto__"])(
    "stores, lists, overwrites, and deletes the key %s",
    async (key) => {
      const store = new InMemoryStore<{ value: number }>();
      const value = { value: 1 };
      await store.mset([
        [key, value],
        ["other", { value: 2 }],
      ]);

      expect(await store.mget([key])).toEqual([value]);
      const keys = [];
      for await (const storedKey of store.yieldKeys(key)) {
        keys.push(storedKey);
      }
      expect(keys).toEqual([key]);

      await store.mset([[key, { value: 3 }]]);
      expect(await store.mget([key])).toEqual([{ value: 3 }]);

      await store.mdelete([key]);
      expect(await store.mget([key, "other"])).toEqual([
        undefined,
        { value: 2 },
      ]);
    }
  );
});
