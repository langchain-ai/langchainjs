import { test, expect } from "vitest";
import { DallEAPIWrapper } from "../dalle.js";

test.skip("Dalle can generate images", async () => {
  const dalle = new DallEAPIWrapper();

  const res = await dalle.invoke("A painting of a cat");
  expect(res).toBeDefined();
  expect(res).toContain("https://");
});

test.skip("Dalle can generate images with base 64 response format", async () => {
  const dalle = new DallEAPIWrapper({
    responseFormat: "b64_json",
  });

  const res = await dalle.invoke("A painting of a cat");
  expect(res).toBeDefined();
  expect(res).not.toContain("https://");
});

test.skip("Dalle returns multiple image URLs if n > 1", async () => {
  const dalle = new DallEAPIWrapper({
    n: 2,
  });
  const res = await dalle.invoke("A painting of a cat");
  expect(res).toBeDefined();
  expect(res).toBeInstanceOf(Array);
  if (!Array.isArray(res)) return;
  expect(res).toHaveLength(2);

  // The types for each should be `image_url` with an `image_url` field containing the URL
  expect(res[0].type).toBe("image_url");
  expect(res[1].type).toBe("image_url");

  expect(res[0]).toHaveProperty("image_url");
  expect(res[1]).toHaveProperty("image_url");

  expect(res[0].image_url.startsWith("https://")).toBe(true);
  expect(res[1].image_url.startsWith("https://")).toBe(true);
});

test.skip("Dalle returns multiple base64 image strings if n > 1", async () => {
  const dalle = new DallEAPIWrapper({
    n: 2,
    dallEResponseFormat: "b64_json",
  });
  const res = await dalle.invoke("A painting of a cat");
  expect(res).toBeDefined();
  expect(res).toBeInstanceOf(Array);
  if (!Array.isArray(res)) return;
  expect(res).toHaveLength(2);

  // The types for each should be `b64_json` with an `b64_json` field containing the URL
  expect(res[0].type).toBe("image_url");
  expect(res[1].type).toBe("image_url");

  expect(res[0]).toHaveProperty("image_url");
  expect(res[1]).toHaveProperty("image_url");

  expect(res[0].image_url).toHaveProperty("url");
  expect(res[1].image_url).toHaveProperty("url");

  expect(res[0].image_url.url).toBeDefined();
  expect(res[1].image_url.url).toBeDefined();

  expect(res[0].image_url.url).not.toBe("");
  expect(res[1].image_url.url).not.toBe("");
});
