/* eslint-disable no-promise-executor-return, no-process-env */

import { test, expect } from "vitest";
import { Cohere } from "../llms.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("test invoke", async () => {
  const cohere = new Cohere({});
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await cohere.invoke(
    "What is a good name for a company that makes colorful socks?"
  );
  // console.log({ result });
});

test("test invoke with callback", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
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
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
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
