import { test, expect } from "@jest/globals";
import { MessageContentComplex } from "../../messages/base.js";
import { InMemoryCache } from "../base.js";

test("InMemoryCache works", async () => {
  const cache = new InMemoryCache();

  await cache.update("prompt", "key1", [
    {
      text: "text1",
    },
  ]);

  const result = await cache.lookup("prompt", "key1");
  expect(result).toBeDefined();
  if (!result) {
    return;
  }
  expect(result[0].text).toBe("text1");
});

test("InMemoryCache works with complex message types", async () => {
  const cache = new InMemoryCache<MessageContentComplex[]>();

  await cache.update("prompt", "key1", [
    {
      type: "text",
      text: "text1",
    },
  ]);

  const result = await cache.lookup("prompt", "key1");
  expect(result).toBeDefined();
  if (!result) {
    return;
  }
  expect(result[0]).toEqual({
    type: "text",
    text: "text1",
  });
});
