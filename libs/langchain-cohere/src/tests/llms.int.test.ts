/* eslint-disable no-promise-executor-return */
import { test } from "@jest/globals";
import { Cohere } from "../llms.js";

test("test invoke", async () => {
  const cohere = new Cohere({});
  const result = await cohere.invoke(
    "What is a good name for a company that makes colorful socks?"
  );
  console.log({ result });
});

test("test invoke with callback", async () => {
  const cohere = new Cohere({
    model: "command-light",
  });
  const tokens: string[] = [];
  const result = await cohere.invoke(
    "What is a good name for a company that makes colorful socks?",
    {
      callbacks: [
        {
          handleLLMNewToken(token) {
            tokens.push(token);
          },
        },
      ],
    }
  );
  // Not streaming, so we should only get one token
  expect(tokens.length).toBe(1);
  expect(result).toEqual(tokens.join(""));
});

test("should abort the request", async () => {
  const cohere = new Cohere({
    model: "command-light",
  });
  const controller = new AbortController();

  await expect(async () => {
    const ret = cohere.invoke("Respond with an verbose response", {
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    return ret;
  }).rejects.toThrow("AbortError");
});
