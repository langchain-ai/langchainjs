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

test("InMemoryCache handles default key encoder", async () => {
  const cache = new InMemoryCache();

  await cache.update("prompt1", "key1", [
    {
      text: "text1",
    },
  ]);

  // expect this to call console.warn about SHA-1 usage
  const result = await cache.lookup("prompt1", "key1");

  expect(result).toBeDefined();
});

test("InMemoryCache handles custom key encoder", async () => {
  const cache = new InMemoryCache();

  // use fancy hashing algorithm to encode the key :)
  cache.makeDefaultKeyEncoder((prompt, key) => `${prompt}###${key}`);

  // expect custom key encoder not to call console.warn
  await cache.update("prompt1", "key1", [
    {
      text: "text1",
    },
  ]);

  const result1 = await cache.lookup("prompt1", "key1");
  expect(result1).toBeDefined();
  if (!result1) {
    return;
  }
  expect(result1[0].text).toBe("text1");
});
