import { test, expect } from "vitest";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CloudflareWorkersAI } from "../llms.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("Test CloudflareWorkersAI", async () => {
  const model = new CloudflareWorkersAI({});
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("1 + 1 =");
  // console.log(res);
}, 50000);

test("generate with streaming true", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    const model = new CloudflareWorkersAI({
      streaming: true,
    });
    const tokens: string[] = [];
    const res = await model.invoke("What is 2 + 2?", {
      callbacks: [
        {
          handleLLMNewToken: (token) => {
            // console.log(token);
            tokens.push(token);
          },
        },
      ],
    });
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join("")).toEqual(res);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test CloudflareWorkersAI streaming", async () => {
  const model = new CloudflareWorkersAI({});
  const stream = await model.stream("What is 2 + 2?");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    // console.log(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  // console.log(chunks.join(""));
}, 50000);

test.skip("Test custom base url", async () => {
  const model = new CloudflareWorkersAI({
    baseUrl: `https://gateway.ai.cloudflare.com/v1/${getEnvironmentVariable(
      "CLOUDFLARE_ACCOUNT_ID"
    )}/lang-chainjs/workers-ai/`,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("1 + 1 =");
  // console.log(res);
});
