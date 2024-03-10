import { test, expect } from "@jest/globals";
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
